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
  | { type: 'CONTROLLER_CONNECTED'; roomCode: string }
  | { type: 'START_GAME_COUNTDOWN' };

const CLIENT_ID = Math.random().toString(36).substring(2, 15);

let subscribers: Array<(message: SyncMessage) => void> = [];

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
let roomExistsCached: boolean | null = null;

const handleReceivedMessage = (envelope: any) => {
  if (!envelope || envelope.sender === CLIENT_ID) return;

  const message = envelope.message || envelope; // Handle envelope wrapped or flat
  subscribers.forEach(callback => {
    try {
      callback(message);
    } catch (e) {
      console.error('Error in subscriber callback', e);
    }
  });
};

// 2. Setup Firebase sync if room code exists
if (ROOM_CODE) {
  const roomRef = ref(rtdb, `rooms/${ROOM_CODE}/lastMessage`);
  
  onValue(roomRef, (snapshot) => {
    const data = snapshot.val();
    if (data && data.sender !== CLIENT_ID && data.timestamp > lastFirebaseTimestamp) {
      lastFirebaseTimestamp = data.timestamp;
      roomExistsCached = true; // Since we received a message from it, it exists!
      handleReceivedMessage(data);
    }
  });
}

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
        roomExistsCached = true;
        return snapshot.val();
      }
    } catch (e) {
      console.error("Error fetching room database from Firebase:", e);
    }
    return null;
  },

  async roomExists(): Promise<boolean> {
    if (!ROOM_CODE) return false;
    if (roomExistsCached !== null) return roomExistsCached;
    try {
      const dbRef = ref(rtdb);
      const snapshot = await get(child(dbRef, `rooms/${ROOM_CODE}/database`));
      const exists = snapshot.exists();
      roomExistsCached = exists;
      return exists;
    } catch (e) {
      console.error("Error checking room existence:", e);
      return false;
    }
  },

  onConnectionChange(callback: (connected: boolean) => void): () => void {
    connectionCallbacks.add(callback);
    callback(isConnected);
    return () => {
      connectionCallbacks.delete(callback);
    };
  },

  sendMessage(message: SyncMessage): void {
    const timestamp = Date.now();
    const envelope = {
      sender: CLIENT_ID,
      timestamp,
      message
    };

    // Send via Firebase Cloud if room exists
    if (ROOM_CODE) {
      const writeFirebase = () => {
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
      };

      if (message.type === 'DATABASE_SYNC') {
        roomExistsCached = true;
        writeFirebase();
      } else if (roomExistsCached === true) {
        writeFirebase();
      } else {
        this.roomExists().then(exists => {
          if (!exists) {
            console.warn(`[Sync] Room ${ROOM_CODE} does not exist, skipping Firebase write`);
            return;
          }
          writeFirebase();
        }).catch(err => {
          console.error('Error checking room existence before Firebase write:', err);
        });
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

