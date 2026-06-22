export interface FamilyMember {
  id: string;
  name: string;
  generation: 'grandparent' | 'parent' | 'child' | 'grandchild' | 'great-grandchild';
  parentId: string | null;
  image: string | null; // Base64 data or URL
  gender?: 'male' | 'female';
  spouseId?: string | null; // ID of spouse if married
  familyName?: string; // Family name for grouping
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
  grandpaName: string;
  grandpaImage: string | null;
  grandmaName: string;
  grandmaImage: string | null;
  theme: 'forest' | 'gold' | 'neon' | 'classic';
  treeLayout: 'botanical' | 'traditional' | 'none';
  contestants: Contestant[]; // Dynamic list of contestants (up to 4)
}

export interface GameState {
  currentQuestionIndex: number;
  scores: Record<string, number>; // contestantId -> score
  solvedQuestions: Record<string, string>; // questionId -> winning contestantId ('nobody' or contestant.id)
  revealedSpeakers: Record<string, boolean>; // memberId -> whether revealed
  shuffledQuestionIds: string[];
  isRevealed: boolean;
  isPlaying: boolean;
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
  grandpaName: '',
  grandpaImage: null,
  grandmaName: '',
  grandmaImage: null,
  theme: 'classic',
  treeLayout: 'traditional',
  contestants: [
    { id: 'grandpa', name: 'סבא', image: null },
    { id: 'grandma', name: 'סבתא', image: null }
  ]
};

const DEFAULT_GAME_STATE: GameState = {
  currentQuestionIndex: 0,
  scores: { grandpa: 0, grandma: 0 },
  solvedQuestions: {},
  revealedSpeakers: {},
  shuffledQuestionIds: [],
  isRevealed: false,
  isPlaying: false,
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
          { id: 'grandpa', name: parsed.grandpaName || 'סבא', image: parsed.grandpaImage || null },
          { id: 'grandma', name: parsed.grandmaName || 'סבתא', image: parsed.grandmaImage || null }
        ];
        changed = true;
      }
      
      if (!parsed.treeLayout) {
        parsed.treeLayout = 'traditional';
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

  // Game State
  getGameState(): GameState {
    let data: string | null = null;
    try {
      data = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
    } catch (e) {
      console.error('Failed to read game state from localStorage', e);
    }
    if (!data) {
      const state = { ...DEFAULT_GAME_STATE };
      this.saveGameState(state);
      return state;
    }
    try {
      const parsed = JSON.parse(data) as GameState;
      const currentSettings = this.getSettings();
      let changed = false;

      if (!parsed.scores || typeof parsed.scores !== 'object') {
        parsed.scores = {};
        changed = true;
      }

      // Ensure every contestant has a score record
      currentSettings.contestants.forEach(c => {
        if (parsed.scores[c.id] === undefined) {
          parsed.scores[c.id] = 0;
          changed = true;
        }
      });

      if (changed) {
        this.saveGameState(parsed);
      }
      return parsed;
    } catch (e) {
      console.error('Failed to parse game state, using defaults', e);
      return DEFAULT_GAME_STATE;
    }
  },

  saveGameState(state: GameState): void {
    safeLocalStorageSet(STORAGE_KEYS.GAME_STATE, JSON.stringify(state));
  },

  // Reset Game
  resetGame(): GameState {
    const questions = this.getQuestions();
    const ids = [...questions].map(q => q.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
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
