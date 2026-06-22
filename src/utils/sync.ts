import { GameState, GameSettings, FamilyMember, TriviaQuestion } from './db';

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

let channel: BroadcastChannel | null = null;
let subscribers: Array<(message: SyncMessage) => void> = [];
let fallbackInterval: number | null = null;
let socket: WebSocket | null = null;
let isSocketConnected = false;

// Initialize WebSocket client connection to relay server on port 5175
const connectWebSocket = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Use port 5175 for sync server
  const wsUrl = `${protocol}//${window.location.hostname}:5175`;

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('Live Sync WebSocket connected!');
      isSocketConnected = true;
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as SyncMessage;
        subscribers.forEach(callback => callback(message));
      } catch (e) {
        console.error('Error parsing sync message from WebSocket', e);
      }
    };

    socket.onclose = () => {
      console.log('Live Sync WebSocket disconnected. Reconnecting in 3s...');
      isSocketConnected = false;
      setTimeout(connectWebSocket, 3000);
    };

    socket.onerror = () => {
      isSocketConnected = false;
    };
  } catch (err) {
    console.warn('Failed to initialize WebSocket client', err);
  }
};

// Start client connection attempt
connectWebSocket();

// Local BroadcastChannel setup for single-machine tabs syncing
try {
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.addEventListener('message', (event: MessageEvent<SyncMessage>) => {
    // Only dispatch locally if socket is not connected to prevent duplicate executions
    if (!isSocketConnected) {
      subscribers.forEach(callback => callback(event.data));
    }
  });
} catch (e) {
  console.warn('BroadcastChannel is not supported, using localStorage fallback', e);
  fallbackInterval = setInterval(() => {
    if (!isSocketConnected) {
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
    }
  }, 100);
}

export const sync = {
  sendMessage(message: SyncMessage): void {
    // 1. Send via network WebSocket if available
    if (socket && isSocketConnected && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message));
      } catch (e) {
        console.error('Failed to send message via WebSocket', e);
      }
    }

    // 2. Duplicate to local browser BroadcastChannel/localStorage for local multi-tab convenience
    if (channel) {
      channel.postMessage(message);
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
      } catch (e) {
        console.error('Error sending fallback sync message', e);
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
    if (socket) {
      socket.close();
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
