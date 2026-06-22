import { GameState, GameSettings, FamilyMember, TriviaQuestion } from './db';
import { rtdb } from './firebase';
import { ref, onValue, set, off } from 'firebase/database';

export type SyncMessage =
  | { type: 'STATE_CHANGED'; state: GameState }
  | { type: 'SETTINGS_CHANGED'; settings: GameSettings }
  | { type: 'DATABASE_SYNC'; members: FamilyMember[]; questions: TriviaQuestion[]; settings: GameSettings }
  | { type: 'REQUEST_DATABASE' }
  | { type: 'TRIGGER_CONFETTI'; winner: 'grandpa' | 'grandma' | 'nobody' }
  | { type: 'PING' }
  | { type: 'PONG' };

const CHANNEL_NAME = 'family_trivia_sync';
const STORAGE_KEY = 'family_trivia_sync_fallback';
const CLIENT_ID = Math.random().toString(36).substring(2, 15);

let channel: BroadcastChannel | null = null;
let subscribers: Array<(message: SyncMessage) => void> = [];
let fallbackInterval: number | null = null;

// Get room code from URL parameters
const getRoomCode = (): string | null => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('room');
};

const ROOM_CODE = getRoomCode();
let lastFirebaseTimestamp = 0;

// Setup Firebase sync if room code exists
if (ROOM_CODE) {
  const roomRef = ref(rtdb, `rooms/${ROOM_CODE}/lastMessage`);
  
  onValue(roomRef, (snapshot) => {
    const data = snapshot.val();
    if (data && data.sender !== CLIENT_ID && data.timestamp > lastFirebaseTimestamp) {
      lastFirebaseTimestamp = data.timestamp;
      try {
        const message = data.message as SyncMessage;
        subscribers.forEach(callback => callback(message));
      } catch (e) {
        console.error('Error parsing sync message from Firebase', e);
      }
    }
  });
} else {
  // Local BroadcastChannel setup for single-machine tabs syncing
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener('message', (event: MessageEvent<SyncMessage>) => {
      subscribers.forEach(callback => callback(event.data));
    });
  } catch (e) {
    console.warn('BroadcastChannel is not supported, using localStorage fallback', e);
    fallbackInterval = setInterval(() => {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        try {
          const message = JSON.parse(data) as SyncMessage;
          subscribers.forEach(callback => callback(message));
          localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
          console.error('Error parsing fallback sync message', e);
        }
      }
    }, 100);
  }
}

export const sync = {
  getRoomCode(): string | null {
    return ROOM_CODE;
  },

  sendMessage(message: SyncMessage): void {
    // 1. Send via Firebase if room exists
    if (ROOM_CODE) {
      const roomRef = ref(rtdb, `rooms/${ROOM_CODE}/lastMessage`);
      const timestamp = Date.now();
      set(roomRef, {
        sender: CLIENT_ID,
        timestamp,
        message
      }).catch(err => {
        console.error('Failed to send message via Firebase:', err);
      });
    } else {
      // 2. Fall back to local BroadcastChannel/localStorage
      if (channel) {
        channel.postMessage(message);
      } else {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
        } catch (e) {
          console.error('Error sending fallback sync message', e);
        }
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
