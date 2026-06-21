import { GameState, GameSettings } from './db';

export type SyncMessage =
  | { type: 'STATE_CHANGED'; state: GameState }
  | { type: 'SETTINGS_CHANGED'; settings: GameSettings }
  | { type: 'TRIGGER_CONFETTI'; winner: 'grandpa' | 'grandma' | 'nobody' }
  | { type: 'PING' }
  | { type: 'PONG' };

const CHANNEL_NAME = 'family_trivia_sync';
const STORAGE_KEY = 'family_trivia_sync_fallback';

let channel: BroadcastChannel | null = null;
let subscribers: Array<(message: SyncMessage) => void> = [];
let fallbackInterval: number | null = null;

try {
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.addEventListener('message', (event: MessageEvent<SyncMessage>) => {
    subscribers.forEach(callback => callback(event.data));
  });
} catch (e) {
  console.warn('BroadcastChannel is not supported in this environment, using localStorage fallback', e);
  // Fallback: use localStorage polling
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

export const sync = {
  sendMessage(message: SyncMessage): void {
    if (channel) {
      channel.postMessage(message);
    } else {
      // Fallback: use localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
      } catch (e) {
        console.error('Error sending fallback sync message', e);
      }
    }
  },

  subscribe(callback: (message: SyncMessage) => void): () => void {
    subscribers.push(callback);

    // Return unsubscribe function
    return () => {
      subscribers = subscribers.filter(cb => cb !== callback);
    };
  },

  cleanup(): void {
    if (channel) {
      channel.close();
    }
    if (fallbackInterval) {
      clearInterval(fallbackInterval);
    }
    subscribers = [];
  }
};
