export interface FamilyMember {
  id: string;
  name: string;
  image: string | null; // Base64 data or URL
  gender?: 'male' | 'female';
}


export interface TriviaQuestion {
  id: string;
  text: string;
  speakerId: string;
}

export interface Contestant {
  id: string;
  name: string;
  image: string | null;
}

export interface GameSettings {
  theme: 'forest' | 'gold' | 'neon' | 'classic';
  contestants: Contestant[]; // Dynamic list of contestants (up to 5)
  hostName?: string; // Optional host name
  setupComplete?: boolean; // Whether host has finished setting up the room
  questionTimer?: number | null; // Timer in seconds (null/0 means unlimited)
  wizardStep?: number; // Current wizard step (1-6) if setup not complete
  questionOrder?: 'sequential' | 'random'; // Order of questions in game
  showNameBank?: boolean;
}

export interface GameState {
  currentQuestionIndex: number;
  scores: Record<string, number>; // contestantId -> score
  solvedQuestions: Record<string, string>; // questionId -> winning contestantId ('nobody' or contestant.id)
  revealedSpeakers: Record<string, string>; // questionId -> revealedSpeakerId (the member chosen as speaker for general questions)
  shuffledQuestionIds: string[];
  isRevealed: boolean;
  isPlaying: boolean;
  isPaused: boolean; // Whether game is paused (host disconnected)
}

const STORAGE_KEYS = {
  MEMBERS: 'family_game_members',
  QUESTIONS: 'family_game_questions',
  SETTINGS: 'family_game_settings',
  GAME_STATE: 'family_game_state',
};

// Initial default data - empty by default
const DEFAULT_MEMBERS: FamilyMember[] = [];

const DEFAULT_QUESTIONS: TriviaQuestion[] = [];

const DEFAULT_SETTINGS: GameSettings = {
  theme: 'classic',
  contestants: [
    { id: 'contestant_1', name: 'כחול', image: null },
    { id: 'contestant_2', name: 'סגול', image: null }
  ],
  hostName: '',
  questionTimer: null,
  wizardStep: 1,
  questionOrder: 'random'
};

const DEFAULT_GAME_STATE: GameState = {
  currentQuestionIndex: 0,
  scores: { contestant_1: 0, contestant_2: 0 },
  solvedQuestions: {},
  revealedSpeakers: {},
  shuffledQuestionIds: [],
  isRevealed: false,
  isPlaying: false,
  isPaused: false,
};

// Healing function for GameState to handle null/undefined from Firebase
export const healGameState = (s: any, settings?: GameSettings): GameState => {
  const defaultState = { ...DEFAULT_GAME_STATE };
  if (!s) return defaultState;
  const parsed = { ...s };
  
  // Ensure scores is an object
  if (!parsed.scores || typeof parsed.scores !== 'object') {
    parsed.scores = {};
  }
  
  // Ensure solvedQuestions is an object
  if (!parsed.solvedQuestions || typeof parsed.solvedQuestions !== 'object') {
    parsed.solvedQuestions = {};
  }
  
  // Ensure revealedSpeakers is an object
  if (!parsed.revealedSpeakers || typeof parsed.revealedSpeakers !== 'object') {
    parsed.revealedSpeakers = {};
  }
  
  // Ensure shuffledQuestionIds is an array
  if (!Array.isArray(parsed.shuffledQuestionIds)) {
    parsed.shuffledQuestionIds = [];
  }
  
  // Ensure numeric fields
  if (typeof parsed.currentQuestionIndex !== 'number') {
    parsed.currentQuestionIndex = 0;
  }
  
  // Ensure boolean fields
  if (typeof parsed.isRevealed !== 'boolean') {
    parsed.isRevealed = false;
  }
  
  if (typeof parsed.isPlaying !== 'boolean') {
    parsed.isPlaying = false;
  }
  
  // Ensure all contestants have scores
  if (settings && settings.contestants) {
    settings.contestants.forEach(c => {
      if (parsed.scores[c.id] === undefined) {
        parsed.scores[c.id] = 0;
      }
    });
  }
  
  return parsed;
};

const safeLocalStorageSet = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e: any) {
    console.error(`LocalStorage save failed for key "${key}":`, e);
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22) {
      window.dispatchEvent(new CustomEvent('localstorage-quota-exceeded', { detail: { key } }));
      alert('⚠️ שגיאה: שטח האחסון המקומי בדפדפן מלא! ייתכן שישנן תמונות רבות מדי או כבדות מדי. אנא הקטן/צמצם את גודל תמונות בני המשפחה או מחק כמה מהן כדי שתוכל לשמור.');
    }
    return false;
  }
};

export const db = {
  // Family Members
  getMembers(): FamilyMember[] {
    const DB_VERSION_KEY = 'family_game_db_version';
    const CURRENT_VERSION = 'v7'; // Incremented for contestants schema
    
    try {
      const version = localStorage.getItem(DB_VERSION_KEY);
      if (version !== CURRENT_VERSION) {
        this.clearAllData();
        safeLocalStorageSet(DB_VERSION_KEY, CURRENT_VERSION);
        this.saveMembers(DEFAULT_MEMBERS);
        return DEFAULT_MEMBERS;
      }

      const data = localStorage.getItem(STORAGE_KEYS.MEMBERS);
      if (!data) {
        this.saveMembers(DEFAULT_MEMBERS);
        return DEFAULT_MEMBERS;
      }
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to read or parse members from localStorage', e);
      return DEFAULT_MEMBERS;
    }
  },

  clearAllData(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.MEMBERS);
      localStorage.removeItem(STORAGE_KEYS.QUESTIONS);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.GAME_STATE);
    } catch (e) {
      console.error('Failed to clear data from localStorage', e);
    }
  },

  saveMembers(members: FamilyMember[]): void {
    safeLocalStorageSet(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
  },

  // Questions
  getQuestions(): TriviaQuestion[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
      if (!data) {
        this.saveQuestions(DEFAULT_QUESTIONS);
        return DEFAULT_QUESTIONS;
      }
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to read or parse questions from localStorage', e);
      return DEFAULT_QUESTIONS;
    }
  },

  saveQuestions(questions: TriviaQuestion[]): void {
    safeLocalStorageSet(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
  },

  // Settings
  getSettings(): GameSettings {
    let data: string | null = null;
    try {
      data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    } catch (e) {
      console.error('Failed to read settings from localStorage', e);
    }
    if (!data) {
      this.saveSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    try {
      const parsed = JSON.parse(data) as GameSettings;
      let changed = false;

      // Migrate/Validate contestants if missing or has less than 2
      if (!parsed.contestants || !Array.isArray(parsed.contestants) || parsed.contestants.length < 2) {
        parsed.contestants = [
          { id: 'contestant_1', name: (parsed as any).grandpaName || 'כחול', image: (parsed as any).grandpaImage || null },
          { id: 'contestant_2', name: (parsed as any).grandmaName || 'סגול', image: (parsed as any).grandmaImage || null }
        ];
        changed = true;
      }


      if (parsed.hostName === undefined) {
        parsed.hostName = '';
        changed = true;
      }

      if (changed) {
        this.saveSettings(parsed);
      }
      return parsed;
    } catch (e) {
      console.error('Failed to parse settings, using defaults', e);
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: GameSettings): void {
    safeLocalStorageSet(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  getGameState(): GameState {
    let data: string | null = null;
    try {
      data = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
    } catch (e) {
      console.error('Failed to read game state from localStorage', e);
    }
    const currentSettings = this.getSettings();
    if (!data) {
      const state = healGameState(null, currentSettings);
      this.saveGameState(state);
      return state;
    }
    try {
      const parsed = JSON.parse(data) as GameState;
      const healed = healGameState(parsed, currentSettings);
      if (JSON.stringify(parsed) !== JSON.stringify(healed)) {
        this.saveGameState(healed);
      }
      return healed;
    } catch (e) {
      console.error('Failed to parse game state, using defaults', e);
      return healGameState(null, currentSettings);
    }
  },

  saveGameState(state: GameState): void {
    safeLocalStorageSet(STORAGE_KEYS.GAME_STATE, JSON.stringify(state));
  },

  // Reset Game
  resetGame(): GameState {
    const questions = this.getQuestions();
    const settings = this.getSettings();
    const ids = [...questions].map(q => q.id);
    
    // Shuffle questions only if questionOrder is 'random'
    if (settings.questionOrder === 'random') {
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
    }
    
    // Initialize scores for all current contestants
    const currentSettings = this.getSettings();
    const initialScores: Record<string, number> = {};
    currentSettings.contestants.forEach(c => {
      initialScores[c.id] = 0;
    });
    
    const newState: GameState = {
      currentQuestionIndex: 0,
      scores: initialScores,
      solvedQuestions: {},
      revealedSpeakers: {},
      shuffledQuestionIds: ids,
      isRevealed: false,
      isPlaying: true,
      isPaused: false,
    };
    
    this.saveGameState(newState);
    return newState;
  },

  // Backup & Import
  exportBackup(): string {
    try {
      const backup = {
        members: this.getMembers(),
        questions: this.getQuestions(),
        settings: this.getSettings(),
      };
      return JSON.stringify(backup, null, 2);
    } catch (e) {
      console.error('Failed to export backup', e);
      return '';
    }
  },

  importBackup(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.members && Array.isArray(parsed.members) && parsed.questions && Array.isArray(parsed.questions)) {
        this.saveMembers(parsed.members);
        this.saveQuestions(parsed.questions);
        if (parsed.settings) {
          this.saveSettings(parsed.settings);
        }
        this.resetGame();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to import backup', e);
      return false;
    }
  }
};
