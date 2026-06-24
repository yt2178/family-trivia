import { useState, useEffect } from 'react';
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

// Track Firebase connection status
let isConnected = false;
const connectionCallbacks = new Set<(connected: boolean) => void>();

const connectedRef = ref(rtdb, '.info/connected');
onValue(connectedRef, (snap) => {
  const connected = snap.val() === true;
  isConnected = connected;
  console.log(`[Firebase Connection] ${connected ? '🟢 Connected' : '🔴 Disconnected'}`);
  connectionCallbacks.forEach(cb => {
    try {
      cb(connected);
    } catch (e) {
      console.error('Error in connection callback', e);
    }
  });
});

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
  });}

function sanitizeForFirebase(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirebase);
  }
  if (typeof obj === 'object') {
    const clean: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (val !== undefined) {
          clean[key] = sanitizeForFirebase(val);
        }
      }
    }
    return clean;
  }
  return obj;
}

export const sync = {
  getRoomCode(): string | null {
    return ROOM_CODE;
  },

  isConnected(): boolean {
    return isConnected;
  },

  async fetchCurrentRoomDatabase(): Promise<any> {
    if (!ROOM_CODE) return null;
    try {
      const dbRef = ref(rtdb);
      const snapshot = await get(child(dbRef, `rooms/${ROOM_CODE}/database`));
      if (snapshot.exists()) {
        return snapshot.val();
      }
    } catch (e) {
      console.error("Error fetching room database from Firebase:", e);
    }
    return null;
  },

  onConnectionChange(callback: (connected: boolean) => void): () => void {
    connectionCallbacks.add(callback);
    callback(isConnected);
    return () => {
      connectionCallbacks.delete(callback);
    };
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
      set(roomRef, sanitizeForFirebase(envelope)).catch(err => {
        console.error('Failed to send message via Firebase:', err);
      });

      // Persist states in Firebase RTDB
      if (message.type === 'DATABASE_SYNC') {
        const dbPersistRef = ref(rtdb, `rooms/${ROOM_CODE}/database/db`);
        set(dbPersistRef, sanitizeForFirebase({
          members: message.members,
          questions: message.questions,
          settings: message.settings
        })).catch(err => console.error('Failed to persist db:', err));
        
        const settingsPersistRef = ref(rtdb, `rooms/${ROOM_CODE}/database/settings`);
        set(settingsPersistRef, sanitizeForFirebase(message.settings)).catch(err => console.error('Failed to persist settings:', err));
      } else if (message.type === 'STATE_CHANGED') {
        const statePersistRef = ref(rtdb, `rooms/${ROOM_CODE}/database/state`);
        set(statePersistRef, sanitizeForFirebase(message.state)).catch(err => console.error('Failed to persist state:', err));
      } else if (message.type === 'SETTINGS_CHANGED') {
        const settingsPersistRef = ref(rtdb, `rooms/${ROOM_CODE}/database/settings`);
        set(settingsPersistRef, sanitizeForFirebase(message.settings)).catch(err => console.error('Failed to persist settings:', err));
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

export function useConnectionStatus() {
  const [connected, setConnected] = useState(sync.isConnected());
  useEffect(() => {
    return sync.onConnectionChange(setConnected);
  }, []);
  return connected;
}
