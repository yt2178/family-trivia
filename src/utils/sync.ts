import { GameState, GameSettings, FamilyMember, TriviaQuestion } from './db';
import { rtdb } from './firebase';
import { ref, onValue, set, off, get, child } from 'firebase/database';

export type SyncMessage =
  | { type: 'STATE_CHANGED'; state: GameState }
  | { type: 'SETTINGS_CHANGED'; settings: GameSettings }
  | { type: 'DATABASE_SYNC'; members: FamilyMember[]; questions: TriviaQuestion[]; settings: GameSettings }
  | { type: 'REQUEST_DATABASE' }
  | { type: 'TRIGGER_CONFETTI'; winner: string; isUndo?: boolean }
  | { type: 'PING' }
  | { type: 'PONG' }
  | { type: 'CONTROLLER_CONNECTED'; roomCode: string };

const CHANNEL_NAME = 'family_trivia_sync';
const STORAGE_KEY = 'family_trivia_sync_fallback';
const CLIENT_ID = Math.random().toString(36).substring(2, 15);

let channel: BroadcastChannel | null = null;
let subscribers: Array<(message: SyncMessage) => void> = [];
let fallbackInterval: number | null = null;

// Get room code from URL parameters
const getRoomCode = (): string | null => {
  const urlParams = new URLSearchParams(window.location.search);
  const room = urlParams.get('room');
  if (!room) return null;
  const clean = room.trim().toUpperCase();
  if (clean === '' || clean === 'UNDEFINED' || clean === 'NULL') return null;
  return clean;
};

const ROOM_CODE = getRoomCode();
let lastFirebaseTimestamp = 0;

// Duplicate message tracking
const processedMsgIds = new Set<string>();

const handleReceivedMessage = (envelope: any) => {
  if (!envelope || envelope.sender === CLIENT_ID) return;

  const msgId = envelope.msgId || `${envelope.timestamp}_${envelope.sender}`;
  if (processedMsgIds.has(msgId)) return;
  processedMsgIds.add(msgId);

  // Limit memory growth
  if (processedMsgIds.size > 150) {
    const first = processedMsgIds.values().next().value;
    if (first !== undefined) processedMsgIds.delete(first);
  }

  const message = envelope.message || envelope; // Handle envelope wrapped or flat
  subscribers.forEach(callback => {
    try {
      callback(message);
    } catch (e) {
      console.error('Error in subscriber callback', e);
    }
  });
};

// 1. Setup local BroadcastChannel always (for local tab-to-tab sync)
try {
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.addEventListener('message', (event: MessageEvent<any>) => {
    handleReceivedMessage(event.data);
  });
} catch (e) {
  console.warn('BroadcastChannel is not supported, using localStorage fallback', e);
  fallbackInterval = setInterval(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const envelope = JSON.parse(data);
        handleReceivedMessage(envelope);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error('Error parsing fallback sync message', e);
    }
  }, 150);
}

// 2. Setup Firebase sync in addition if room code exists
if (ROOM_CODE) {
  const roomRef = ref(rtdb, `rooms/${ROOM_CODE}/lastMessage`);
  
  onValue(roomRef, (snapshot) => {
    const data = snapshot.val();
    if (data && data.sender !== CLIENT_ID && data.timestamp > lastFirebaseTimestamp) {
      lastFirebaseTimestamp = data.timestamp;
      handleReceivedMessage(data);
    }
  });

  // Hydrate initial cloud data
  const dbRef = ref(rtdb);
  get(child(dbRef, `rooms/${ROOM_CODE}/database`)).then((snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      if (data.db) {
        const cachedDb: SyncMessage = {
          type: 'DATABASE_SYNC',
          members: data.db.members || [],
          questions: data.db.questions || [],
          settings: data.db.settings || { grandpaName: '', grandpaImage: null, grandmaName: '', grandmaImage: null, theme: 'forest', treeLayout: 'traditional', contestants: [] }
        };
        subscribers.forEach(cb => cb(cachedDb));
      }
      if (data.settings) {
        const cachedSettings: SyncMessage = {
          type: 'SETTINGS_CHANGED',
          settings: data.settings
        };
        subscribers.forEach(cb => cb(cachedSettings));
      }
      if (data.state) {
        const cachedState: SyncMessage = {
          type: 'STATE_CHANGED',
          state: data.state
        };
        subscribers.forEach(cb => cb(cachedState));
      }
    }
  }).catch((err) => {
    console.error("Error fetching initial database from Firebase:", err);
  });
}

export const sync = {
  getRoomCode(): string | null {
    return ROOM_CODE;
  },

  sendMessage(message: SyncMessage): void {
    const msgId = Math.random().toString(36).substring(2, 10);
    const timestamp = Date.now();
    const envelope = {
      sender: CLIENT_ID,
      timestamp,
      msgId,
      message
    };

    // A. Always broadcast locally via BroadcastChannel/localStorage
    if (channel) {
      channel.postMessage(envelope);
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
      } catch (e) {
        console.error('Error sending fallback sync message', e);
      }
    }

    // B. Send via Firebase Cloud if room exists
    if (ROOM_CODE) {
      const roomRef = ref(rtdb, `rooms/${ROOM_CODE}/lastMessage`);
      set(roomRef, envelope).catch(err => {
        console.error('Failed to send message via Firebase:', err);
      });

      // Persist states in Firebase RTDB
      if (message.type === 'DATABASE_SYNC') {
        const dbPersistRef = ref(rtdb, `rooms/${ROOM_CODE}/database/db`);
        set(dbPersistRef, {
          members: message.members,
          questions: message.questions,
          settings: message.settings
        }).catch(err => console.error('Failed to persist db:', err));
        
        const settingsPersistRef = ref(rtdb, `rooms/${ROOM_CODE}/database/settings`);
        set(settingsPersistRef, message.settings).catch(err => console.error('Failed to persist settings:', err));
      } else if (message.type === 'STATE_CHANGED') {
        const statePersistRef = ref(rtdb, `rooms/${ROOM_CODE}/database/state`);
        set(statePersistRef, message.state).catch(err => console.error('Failed to persist state:', err));
      } else if (message.type === 'SETTINGS_CHANGED') {
        const settingsPersistRef = ref(rtdb, `rooms/${ROOM_CODE}/database/settings`);
        set(settingsPersistRef, message.settings).catch(err => console.error('Failed to persist settings:', err));
      }
    }
  },

  subscribe(callback: (message: SyncMessage) => void): () => void {
    subscribers.push(callback);
    return () => {
      subscribers = subscribers.filter(cb => cb !== callback);
    };
  },

  cleanup(): void {
    if (ROOM_CODE) {
      const roomRef = ref(rtdb, `rooms/${ROOM_CODE}/lastMessage`);
      off(roomRef);
    }
    if (channel) {
      channel.close();
    }
    if (fallbackInterval) {
      clearInterval(fallbackInterval);
    }
    subscribers = [];
  }
};
