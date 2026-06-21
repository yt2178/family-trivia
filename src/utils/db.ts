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

export interface GameSettings {
  grandpaName: string;
  grandpaImage: string | null;
  grandmaName: string;
  grandmaImage: string | null;
  theme: 'forest' | 'gold' | 'neon' | 'classic';
  treeLayout: 'botanical' | 'traditional';
}

export interface GameState {
  currentQuestionIndex: number;
  scores: { grandpa: number; grandma: number };
  solvedQuestions: Record<string, 'grandpa' | 'grandma' | 'nobody'>; // maps questionId to winner
  revealedSpeakers: Record<string, boolean>; // maps memberId to whether they've been revealed/solved in the game
  shuffledQuestionIds: string[];
  isRevealed: boolean; // Is current question answer revealed
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
  theme: 'forest',
  treeLayout: 'traditional', // Traditional top-down layout by default
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

export const db = {
  // Family Members
  getMembers(): FamilyMember[] {
    const DB_VERSION_KEY = 'family_game_db_version';
    const CURRENT_VERSION = 'v6'; // Changed to v6 for empty default settings names
    
    const version = localStorage.getItem(DB_VERSION_KEY);
    if (version !== CURRENT_VERSION) {
      this.clearAllData();
      localStorage.setItem(DB_VERSION_KEY, CURRENT_VERSION);
      this.saveMembers(DEFAULT_MEMBERS);
      return DEFAULT_MEMBERS;
    }

    const data = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    if (!data) {
      this.saveMembers(DEFAULT_MEMBERS);
      return DEFAULT_MEMBERS;
    }
    return JSON.parse(data);
  },

  clearAllData(): void {
    localStorage.removeItem(STORAGE_KEYS.MEMBERS);
    localStorage.removeItem(STORAGE_KEYS.QUESTIONS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.GAME_STATE);
  },

  saveMembers(members: FamilyMember[]): void {
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
  },

  // Questions
  getQuestions(): TriviaQuestion[] {
    const data = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
    if (!data) {
      this.saveQuestions(DEFAULT_QUESTIONS);
      return DEFAULT_QUESTIONS;
    }
    return JSON.parse(data);
  },

  saveQuestions(questions: TriviaQuestion[]): void {
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
  },

  // Settings
  getSettings(): GameSettings {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      this.saveSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    return JSON.parse(data);
  },

  saveSettings(settings: GameSettings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  // Game State
  getGameState(): GameState {
    const data = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
    if (!data) {
      const state = { ...DEFAULT_GAME_STATE };
      this.saveGameState(state);
      return state;
    }
    return JSON.parse(data);
  },

  saveGameState(state: GameState): void {
    localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(state));
  },

  // Reset Game
  resetGame(): GameState {
    const questions = this.getQuestions();
    // Fisher-Yates shuffle for proper randomization
    const ids = [...questions].map(q => q.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    
    const newState: GameState = {
      currentQuestionIndex: 0,
      scores: { grandpa: 0, grandma: 0 },
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
    const backup = {
      members: this.getMembers(),
      questions: this.getQuestions(),
      settings: this.getSettings(),
    };
    return JSON.stringify(backup, null, 2);
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
        // Reset game state
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
