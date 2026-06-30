import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, FamilyMember, GameSettings, GameState, TriviaQuestion, Contestant, healGameState } from '../../utils/db';
import { sync } from '../../utils/sync';
import { excelHelper } from '../../utils/excelHelper';
import { audioHelper } from '../../utils/audioHelper';
import { rtdb } from '../../utils/firebase';
import { ref, onValue, off, set, remove, get, onDisconnect } from 'firebase/database';

export const CONTESTANT_COLORS = [
  {
    bg: 'bg-sky-950/40 border-sky-500/40 hover:bg-sky-900/40 text-sky-100',
    text: 'text-sky-400',
    glow: 'כחול Glow',
    border: 'border-sky-500'
  },
  {
    bg: 'bg-fuchsia-950/40 border-fuchsia-500/40 hover:bg-fuchsia-900/40 text-fuchsia-100',
    text: 'text-fuchsia-400',
    glow: 'סגול Glow',
    border: 'border-fuchsia-500'
  },
  {
    bg: 'bg-amber-950/40 border-amber-500/40 hover:bg-amber-900/40 text-amber-100',
    text: 'text-amber-400',
    glow: 'כתום Glow',
    border: 'border-amber-500'
  },
  {
    bg: 'bg-emerald-950/40 border-emerald-500/40 hover:bg-emerald-900/40 text-emerald-100',
    text: 'text-emerald-400',
    glow: 'ירוק Glow',
    border: 'border-emerald-500'
  }
];

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const compressImage = (base64Str: string, maxWidth = 160, maxHeight = 160): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
  });
};

export const healSettings = (s: any): GameSettings => {
  const defaultSettings = db.getSettings();
  if (!s) return defaultSettings;
  const parsed = { ...s };
  if (!parsed.contestants || !Array.isArray(parsed.contestants) || parsed.contestants.length < 2) {
    parsed.contestants = [
      { id: 'contestant_1', name: parsed.grandpaName || 'כחול', image: parsed.grandpaImage || null },
      { id: 'contestant_2', name: parsed.grandmaName || 'סגול', image: parsed.grandmaImage || null }
    ];
  }
  if (parsed.treeLayout !== 'none') {
    parsed.treeLayout = 'none';
  }
  if (parsed.hostName === undefined) {
    parsed.hostName = '';
  }
  if (parsed.showNameBank === undefined) {
    parsed.showNameBank = false;
  }
  return parsed;
};

interface MemberFormState {
  name: string;
  generation: FamilyMember['generation'];
  parentId: string;
  parentIds: string[];
  image: string | null;
  gender: 'male' | 'female';
  familyName: string;
  spouseId: string;
}

interface QuestionFormState {
  text: string;
  speakerId: string;
}

interface WizardConfirmModalState {
  message: string;
  onConfirm: () => void;
  showExcelDownload?: 'players' | 'questions';
}

interface AdminContextType {
  activeTab: 'control' | 'members' | 'questions' | 'settings' | 'import' | 'stats';
  setActiveTab: React.Dispatch<React.SetStateAction<'control' | 'members' | 'questions' | 'settings' | 'import' | 'stats'>>;
  members: FamilyMember[];
  setMembers: React.Dispatch<React.SetStateAction<FamilyMember[]>>;
  questions: TriviaQuestion[];
  setQuestions: React.Dispatch<React.SetStateAction<TriviaQuestion[]>>;
  settings: GameSettings;
  setSettings: React.Dispatch<React.SetStateAction<GameSettings>>;
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  gameScreenConnected: boolean;
  isLoading: boolean;
  securityError: boolean;
  roomError: string | null;
  countdown: number;
  newMember: MemberFormState;
  setNewMember: React.Dispatch<React.SetStateAction<MemberFormState>>;
  newQuestion: QuestionFormState;
  setNewQuestion: React.Dispatch<React.SetStateAction<QuestionFormState>>;
  editingMemberId: string | null;
  setEditingMemberId: React.Dispatch<React.SetStateAction<string | null>>;
  warnings: string[];
  setWarnings: React.Dispatch<React.SetStateAction<string[]>>;
  successMsg: string | null;
  setSuccessMsg: React.Dispatch<React.SetStateAction<string | null>>;
  nextQuestionTimer: number;
  setNextQuestionTimer: React.Dispatch<React.SetStateAction<number>>;
  showContestantOrderModal: boolean;
  setShowContestantOrderModal: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Wizard buffers
  wizardHostName: string;
  setWizardHostName: React.Dispatch<React.SetStateAction<string>>;
  wizardTreeLayout: 'none';
  setWizardTreeLayout: React.Dispatch<React.SetStateAction<'none'>>;
  wizardContestantCount: number;
  setWizardContestantCount: React.Dispatch<React.SetStateAction<number>>;
  wizardQuestionTimer: number | null;
  setWizardQuestionTimer: React.Dispatch<React.SetStateAction<number | null>>;
  wizardShowNameBank: boolean;
  setWizardShowNameBank: React.Dispatch<React.SetStateAction<boolean>>;
  wizardContestants: Array<{ id: string; name: string; image: string | null }>;
  setWizardContestants: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string; image: string | null }>>>;
  wizardStepLocal: number | null;
  setWizardStepLocal: React.Dispatch<React.SetStateAction<number | null>>;
  hasInitializedWizard: boolean;
  setHasInitializedWizard: React.Dispatch<React.SetStateAction<boolean>>;
  adminSubMode: 'controller' | 'wizard';
  setAdminSubMode: React.Dispatch<React.SetStateAction<'controller' | 'wizard'>>;
  showSuccessScreen: boolean;
  setShowSuccessScreen: React.Dispatch<React.SetStateAction<boolean>>;
  wizardConfirmModal: WizardConfirmModalState | null;
  setWizardConfirmModal: React.Dispatch<React.SetStateAction<WizardConfirmModalState | null>>;
  showMidSetupNotice: boolean;
  setShowMidSetupNotice: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Handlers
  updateGameState: (newState: GameState) => void;
  updateSettings: (newSettings: GameSettings) => void;
  handleStartGame: () => void;
  handleStartGameAfterContestantOrder: () => void;
  handleNextQuestion: () => void;
  handlePrevQuestion: () => void;
  handleRevealAnswer: () => void;
  handleAssignPoints: (winner: string) => void;
  handleAddMember: (e: React.FormEvent) => Promise<void>;
  handleDeleteMember: (id: string) => void;
  handleStartEdit: (m: FamilyMember) => void;
  handleSaveEdit: (e: React.FormEvent) => void;
  handleCancelEdit: () => void;
  handleMemberImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleAddQuestion: (e: React.FormEvent) => void;
  handleDeleteQuestion: (id: string) => void;
  handleExcelTemplateDownload: () => void;
  handleImportMembersExcel: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleImportQuestionsExcel: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleAbsoluteReset: () => Promise<void>;
  handleSettingsImageUpload: (e: React.ChangeEvent<HTMLInputElement>, contestantId: string) => Promise<void>;
  handleTogglePause: () => void;
  showSuccess: (msg: string) => void;
  copyToClipboard: (text: string, label: string) => void;
  validateRelations: (name: string, parentId: string | null, spouseId: string | null, currentId: string | null) => string | null;
  renderParentOptions: (generation: FamilyMember['generation']) => React.ReactNode[];
  saveDraftToLocalStorage: (
    hostName: string,
    treeLayout: 'none',
    contestantCount: number,
    contestants: Array<{ id: string; name: string; image: string | null }>,
    questionTimer: number | null,
    questionOrder: 'sequential' | 'random',
    step: number,
    showNameBankVal?: boolean
  ) => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<'control' | 'members' | 'questions' | 'settings' | 'import' | 'stats'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('setup') === 'true' ? 'members' : 'control';
  });

  // Core Data State
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [settings, setSettings] = useState<GameSettings>(healSettings(db.getSettings()));
  const [gameState, setGameState] = useState<GameState>(db.getGameState());
  const [gameScreenConnected, setGameScreenConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(!!sync.getRoomCode());
  const [roomError, setRoomError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(5);
  const [securityError, setSecurityError] = useState<boolean>(false);

  // Countdown for room error redirect
  useEffect(() => {
    if (roomError && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (roomError && countdown === 0) {
      window.location.href = window.location.origin + window.location.pathname;
    }
  }, [roomError, countdown]);

  // Register controller connection and listen to game screen connection status in Firebase
  useEffect(() => {
    const roomCode = sync.getRoomCode();
    if (roomCode && !isLoading && !securityError) {
      const controllerStatusRef = ref(rtdb, `rooms/${roomCode}/controllerConnected`);
      const roomRef = ref(rtdb, `rooms/${roomCode}/database`);
      
      // Only set controller status if room exists to avoid creating data for non-existent rooms
      get(roomRef).then((snapshot) => {
        if (snapshot.exists()) {
          set(controllerStatusRef, true);
        }
      }).catch(err => console.error("Error checking room existence:", err));

      // Broadcast controller connection locally for instant tab-to-tab sync
      sync.sendMessage({ type: 'CONTROLLER_CONNECTED', roomCode });

      const statusRef = ref(rtdb, `rooms/${roomCode}/gameScreenConnected`);
      onValue(statusRef, (snapshot) => {
        setGameScreenConnected(!!snapshot.val());
      });

      return () => {
        get(roomRef).then((snapshot) => {
          if (snapshot.exists()) {
            set(controllerStatusRef, false);
          }
        }).catch(err => console.error("Error checking room existence:", err));
        off(statusRef);
      };
    }
  }, [isLoading, securityError]);

  // Input Forms States
  const [newMember, setNewMember] = useState<MemberFormState>({
    name: '',
    generation: 'grandchild',
    parentId: '',
    parentIds: [],
    image: null,
    gender: 'male',
    familyName: '',
    spouseId: '',
  });

  const [newQuestion, setNewQuestion] = useState<QuestionFormState>({
    text: '',
    speakerId: '',
  });

  // Edit member states
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  // Warnings / Notifications
  const [warnings, setWarnings] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [nextQuestionTimer, setNextQuestionTimer] = useState<number>(0);
  const [showContestantOrderModal, setShowContestantOrderModal] = useState<boolean>(false);

  // Local wizard buffer states to prevent saving to Firebase on every keystroke
  const [wizardHostName, setWizardHostName] = useState('');
  const [wizardTreeLayout, setWizardTreeLayout] = useState<'none'>('none');
  const [wizardContestantCount, setWizardContestantCount] = useState(2);
  const [wizardQuestionTimer, setWizardQuestionTimer] = useState<number | null>(null);
  const [wizardShowNameBank, setWizardShowNameBank] = useState<boolean>(false);
  const [wizardContestants, setWizardContestants] = useState<Array<{ id: string; name: string; image: string | null }>>([]);
  const [wizardStepLocal, setWizardStepLocal] = useState<number | null>(null);
  const [hasInitializedWizard, setHasInitializedWizard] = useState(false);
  const [adminSubMode, setAdminSubMode] = useState<'controller' | 'wizard'>('controller');
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [wizardConfirmModal, setWizardConfirmModal] = useState<WizardConfirmModalState | null>(null);
  const [showMidSetupNotice, setShowMidSetupNotice] = useState<boolean>(false);

  // Sync settings to local wizard states on load or changes from Firebase
  useEffect(() => {
    if (settings && !hasInitializedWizard) {
      const urlParams = new URLSearchParams(window.location.search);
      const controllerMode = urlParams.get('controller') === 'true';
      const wizardMode = urlParams.get('wizard') === 'true';
      
      const rCode = sync.getRoomCode();
      let draft: any = null;
      if (rCode) {
        try {
          const draftStr = localStorage.getItem(`wizard_draft_${rCode}`);
          if (draftStr) {
            draft = JSON.parse(draftStr);
          }
        } catch (e) {
          console.error("Failed to parse wizard draft", e);
        }
      }

      if (draft) {
        setWizardHostName(draft.hostName || '');
        setWizardTreeLayout('none');
        setWizardContestantCount(draft.contestantCount || 2);
        setWizardQuestionTimer(draft.questionTimer !== undefined ? draft.questionTimer : (settings.questionTimer || null));
        setWizardShowNameBank(draft.showNameBank !== undefined ? draft.showNameBank : (settings.showNameBank || false));
        setWizardStepLocal(draft.wizardStep || settings.wizardStep || 1);
        
        const defaultNames = ['כחול', 'סגול', 'ירוק', 'כתום'];
        const defaultIds = ['contestant_1', 'contestant_2', 'contestant_3', 'contestant_4'];
        const arr = [];
        for (let i = 0; i < 4; i++) {
          const existing = draft.contestants?.[i] || settings.contestants?.[i];
          arr.push({
            id: existing?.id || defaultIds[i],
            name: existing?.name || defaultNames[i],
            image: existing?.image || null
          });
        }
        setWizardContestants(arr);
      } else {
        setWizardHostName(settings.hostName || '');
        setWizardTreeLayout('none');
        setWizardContestantCount(settings.contestants?.length || 2);
        setWizardQuestionTimer(settings.questionTimer !== undefined ? settings.questionTimer : null);
        setWizardShowNameBank(settings.showNameBank || false);
        setWizardStepLocal(settings.wizardStep || 1);
        
        const defaultNames = ['כחול', 'סגול', 'ירוק', 'כתום'];
        const defaultIds = ['contestant_1', 'contestant_2', 'contestant_3', 'contestant_4'];
        const arr = [];
        for (let i = 0; i < 4; i++) {
          const existing = settings.contestants?.[i];
          arr.push({
            id: existing?.id || defaultIds[i],
            name: existing?.name || defaultNames[i],
            image: existing?.image || null
          });
        }
        setWizardContestants(arr);
      }
      setHasInitializedWizard(true);
      
      // Set mode based on URL parameters or setupComplete
      if (controllerMode) {
        setAdminSubMode('controller');
      } else if (wizardMode) {
        setAdminSubMode('wizard');
      } else if (settings.setupComplete) {
        setAdminSubMode('controller');
      } else {
        setAdminSubMode('wizard');
        if (!hasInitializedWizard) {
          const currentStep = draft?.wizardStep || settings.wizardStep || 1;
          if (currentStep > 1) {
            setShowMidSetupNotice(true);
          }
        }
      }
    }
  }, [settings, hasInitializedWizard]);

  // Timer for next question countdown (auto-advances to next question at 0)
  useEffect(() => {
    if (nextQuestionTimer > 0) {
      const interval = setInterval(() => {
        setNextQuestionTimer(prev => {
          if (prev <= 1) {
            handleNextQuestion();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [nextQuestionTimer]);

  // Sync shuffledQuestionIds with actual questions list (appends added questions, removes deleted ones)
  useEffect(() => {
    if (!gameState || !questions) return;
    const currentShuffled = gameState.shuffledQuestionIds || [];
    const questionIdsSet = new Set(questions.map(q => q.id));
    let updatedShuffled = currentShuffled.filter(id => questionIdsSet.has(id));
    
    const shuffledSet = new Set(updatedShuffled);
    const newQuestionIds = questions.filter(q => !shuffledSet.has(q.id)).map(q => q.id);
    
    if (newQuestionIds.length > 0) {
      const newIdsToAppend = [...newQuestionIds];
      if (settings.questionOrder !== 'sequential') {
        // Shuffle new items only if not sequential
        for (let i = newIdsToAppend.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [newIdsToAppend[i], newIdsToAppend[j]] = [newIdsToAppend[j], newIdsToAppend[i]];
        }
      }
      updatedShuffled = [...updatedShuffled, ...newIdsToAppend];
    }
    
    if (JSON.stringify(currentShuffled) !== JSON.stringify(updatedShuffled)) {
      setGameState(prev => {
        const updated = {
          ...prev,
          shuffledQuestionIds: updatedShuffled
        };
        db.saveGameState(updated);
        sync.sendMessage({ type: 'STATE_CHANGED', state: updated });
        return updated;
      });
    }
  }, [questions, gameState?.shuffledQuestionIds, settings.questionOrder]);

  const saveDraftToLocalStorage = (
    hostName: string,
    treeLayoutVal: 'none',
    contestantCount: number,
    contestants: Array<{ id: string; name: string; image: string | null }>,
    questionTimer: number | null,
    questionOrder: 'sequential' | 'random',
    step: number,
    showNameBankVal?: boolean
  ) => {
    const rCode = sync.getRoomCode();
    if (!rCode) return;
    try {
      localStorage.setItem(`wizard_draft_${rCode}`, JSON.stringify({
        hostName,
        treeLayout: 'none',
        contestantCount,
        contestants: contestants.slice(0, contestantCount),
        questionTimer,
        questionOrder,
        showNameBank: showNameBankVal !== undefined ? showNameBankVal : wizardShowNameBank,
        wizardStep: step
      }));
    } catch (e: any) {
      console.error("Failed to save wizard draft", e);
    }
  };

  const renderParentOptions = (generation: FamilyMember['generation']) => {
    return [];
  };

  const healMembersGenerations = (membersList: FamilyMember[]): FamilyMember[] => {
    return membersList;
  };

  const playAdminSound = (type: 'success' | 'undo' | 'reveal') => {
    audioHelper.play(type);
  };

  // Load Data
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const controllerMode = urlParams.get('controller') === 'true';
    const wizardMode = urlParams.get('wizard') === 'true';
    
    if (controllerMode) {
      setAdminSubMode('controller');
    } else if (wizardMode) {
      setAdminSubMode('wizard');
    }
    
    const initData = async () => {
      const roomCode = sync.getRoomCode();
      if (roomCode) {
        try {
          const data = await sync.fetchCurrentRoomDatabase();
          if (data) {
            const fbMembers = data.db?.members || [];
            const fbQuestions = data.db?.questions || [];
            const fbSettings = data.db?.settings || data.settings || {};
            const fbState = data.state || data.db?.state || {};

            const storedHostName = (fbSettings.hostName || '').trim();
            const urlHostName = (urlParams.get('host') || '').trim();
            if (storedHostName && urlHostName.toLowerCase() !== storedHostName.toLowerCase()) {
              setSecurityError(true);
            }

            // Set onDisconnect to pause the game automatically when host leaves/disconnects
            const isPausedRef = ref(rtdb, `rooms/${roomCode}/database/state/isPaused`);
            onDisconnect(isPausedRef).set(true);

            const healed = healMembersGenerations(fbMembers);
            
            db.saveMembers(healed);
            db.saveQuestions(fbQuestions);
            
            const currentSettings = db.getSettings();
            const mergedSettings = { ...currentSettings, ...fbSettings };
            db.saveSettings(mergedSettings);
            
            const currentGameState = db.getGameState();
            const mergedState = healGameState({ ...currentGameState, ...fbState, isPaused: false }, mergedSettings);
            db.saveGameState(mergedState);

            setMembers(healed);
            setQuestions(fbQuestions);
            setSettings(mergedSettings);
            setGameState(mergedState);
            setIsLoading(false);
            return;
          } else {
            // Room doesn't exist, show error in app
            setRoomError('החדר לא קיים במערכת. אנא בדוק את מספר החדר ונסה שוב.');
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.error("Failed to fetch initial room database from Firebase, falling back to localStorage", e);
        }
      }

      // Local storage fallback
      const loadedMembers = db.getMembers();
      const loadedQuestions = db.getQuestions();
      const loadedSettings = db.getSettings();

      const healedMembers = healMembersGenerations(loadedMembers);
      if (JSON.stringify(loadedMembers) !== JSON.stringify(healedMembers)) {
        db.saveMembers(healedMembers);
      }

      setMembers(healedMembers);
      setQuestions(loadedQuestions);
      setSettings(loadedSettings);
      setGameState(db.getGameState());
      setIsLoading(false);

      if (!roomCode) {
        sync.sendMessage({
          type: 'DATABASE_SYNC',
          members: healedMembers,
          questions: loadedQuestions,
          settings: loadedSettings
        });
      }
    };

    initData();
  }, []);

  // Listen to remote changes
  useEffect(() => {
    const unsubscribe = sync.subscribe((msg) => {
      if (msg.type === 'REQUEST_DATABASE') {
        sync.sendMessage({
          type: 'DATABASE_SYNC',
          members: db.getMembers(),
          questions: db.getQuestions(),
          settings: db.getSettings()
        });
      } else if (msg.type === 'DATABASE_SYNC') {
        const healed = healMembersGenerations(msg.members);
        const healedSettings = healSettings(msg.settings);
        setMembers(healed);
        setQuestions(msg.questions);
        setSettings(healedSettings);
        db.saveMembers(healed);
        db.saveQuestions(msg.questions);
        db.saveSettings(healedSettings);
      } else if (msg.type === 'STATE_CHANGED') {
        const healedState = healGameState(msg.state, settings);
        setGameState(healedState);
        db.saveGameState(healedState);
      } else if (msg.type === 'SETTINGS_CHANGED') {
        const healedSettings = healSettings(msg.settings);
        setSettings(healedSettings);
        db.saveSettings(healedSettings);
      }
    });
    return () => unsubscribe();
  }, [members, questions, settings]);

  const updateGameState = (newState: GameState) => {
    setGameState(newState);
    db.saveGameState(newState);
    sync.sendMessage({ type: 'STATE_CHANGED', state: newState });
  };

  const updateSettings = (newSettings: GameSettings) => {
    setSettings(newSettings);
    db.saveSettings(newSettings);
    
    // Update scores in gameState for new contestants if not exists
    const newScores = { ...(gameState?.scores || {}) };
    let scoreChanged = false;
    (newSettings.contestants || []).forEach(c => {
      if (newScores[c.id] === undefined) {
        newScores[c.id] = 0;
        scoreChanged = true;
      }
    });
    // Clean up scores of removed contestants
    if (newScores && typeof newScores === 'object') {
      Object.keys(newScores).forEach(key => {
        if (!(newSettings.contestants || []).some(c => c.id === key)) {
          delete newScores[key];
          scoreChanged = true;
        }
      });
    }
    
    if (scoreChanged && gameState) {
      const updatedState = { ...gameState, scores: newScores };
      setGameState(updatedState);
      db.saveGameState(updatedState);
      sync.sendMessage({ type: 'STATE_CHANGED', state: updatedState });
    }

    sync.sendMessage({ type: 'SETTINGS_CHANGED', settings: newSettings });
    sync.sendMessage({ type: 'DATABASE_SYNC', members, questions, settings: newSettings });
  };

  const handleStartGame = () => {
    // If sequential order is selected, show contestant order modal first
    if (settings.questionOrder === 'sequential') {
      setShowContestantOrderModal(true);
      return;
    }

    const freshState = db.resetGame();
    updateGameState(freshState);
    const newSettings = { ...settings, setupComplete: true };
    db.saveSettings(newSettings);
    setSettings(newSettings);
    sync.sendMessage({ type: 'SETTINGS_CHANGED', settings: newSettings });
    showSuccess('המשחק אותחל וערבוב השאלות הושלם בהצלחה!');
  };

  const handleStartGameAfterContestantOrder = () => {
    setShowContestantOrderModal(false);
    const freshState = db.resetGame();
    updateGameState(freshState);
    const newSettings = { ...settings, setupComplete: true };
    db.saveSettings(newSettings);
    setSettings(newSettings);
    sync.sendMessage({ type: 'SETTINGS_CHANGED', settings: newSettings });
    showSuccess('המשחק אותחל בהצלחה!');
  };

  const handleNextQuestion = () => {
    setNextQuestionTimer(0);
    const total = (gameState.shuffledQuestionIds || []).length;
    if (gameState.currentQuestionIndex < total) {
      const nextIndex = gameState.currentQuestionIndex + 1;
      updateGameState({
        ...gameState,
        currentQuestionIndex: nextIndex,
        isRevealed: false,
      });
    }
  };

  const handlePrevQuestion = () => {
    setNextQuestionTimer(0);
    if (gameState.currentQuestionIndex > 0) {
      const prevIndex = gameState.currentQuestionIndex - 1;
      updateGameState({
        ...gameState,
        currentQuestionIndex: prevIndex,
        isRevealed: false,
      });
    }
  };

  const handleRevealAnswer = () => {
    updateGameState({
      ...gameState,
      isRevealed: true,
    });
  };

  const handleAssignPoints = (winner: string) => {
    const currentQId = (gameState.shuffledQuestionIds || [])[gameState.currentQuestionIndex];
    if (!currentQId) return;

    const currentSolvedValue = (gameState.solvedQuestions || {})[currentQId];
    const currentWinners = (!currentSolvedValue || currentSolvedValue === 'nobody')
      ? []
      : currentSolvedValue.split(',');

    const newScores = { ...(gameState.scores || {}) };
    let newSolved = { ...(gameState.solvedQuestions || {}) };
    let isUndo = false;

    if (winner === 'nobody') {
      currentWinners.forEach(wId => {
        newScores[wId] = Math.max(0, (newScores[wId] || 0) - 1);
      });
      newSolved[currentQId] = 'nobody';
      const updatedState = {
        ...gameState,
        scores: newScores,
        solvedQuestions: newSolved,
        isRevealed: true,
      };
      updateGameState(updatedState);
      playAdminSound('success');
      showSuccess('התשובה נחשפה (אף אחד לא קיבל ניקוד).');
      setNextQuestionTimer(10);
      return;
    }

    // Normal contestant winner logic
    // If it was previously marked as nobody, remove the nobody mark first
    if (currentSolvedValue === 'nobody') {
      delete newSolved[currentQId];
    }

    if (currentWinners.includes(winner)) {
      const updatedWinners = currentWinners.filter(wId => wId !== winner);
      newScores[winner] = Math.max(0, (newScores[winner] || 0) - 1);
      isUndo = true;
      
      if (updatedWinners.length > 0) {
        newSolved[currentQId] = updatedWinners.join(',');
      } else {
        delete newSolved[currentQId];
      }
      showSuccess(`בוטל הניקוד עבור ${settings.contestants?.find(c => c.id === winner)?.name || 'מתמודד זה'}.`);
    } else {
      const updatedWinners = [...currentWinners, winner];
      newScores[winner] = (newScores[winner] || 0) + 1;
      newSolved[currentQId] = updatedWinners.join(',');
      showSuccess(`התווספה נקודה עבור ${settings.contestants?.find(c => c.id === winner)?.name || 'מתמודד זה'}!`);
    }

    const updatedState = {
      ...gameState,
      scores: newScores,
      solvedQuestions: newSolved,
      isRevealed: true,
    };

    updateGameState(updatedState);
    playAdminSound(isUndo ? 'undo' : 'success');

    if (winner !== 'nobody') {
      sync.sendMessage({ type: 'TRIGGER_CONFETTI', winner, isUndo });
    }

    // Start 10-second timer after assigning points
    setNextQuestionTimer(10);
  };

  const validateRelations = (
    name: string,
    parentId: string | null,
    spouseId: string | null,
    currentId: string | null
  ): string | null => {
    const cleanName = name.trim();
    if (!cleanName) return 'נא להזין שם.';
    return null;
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMember.name.trim()) {
      alert('נא להזין שם לבן המשפחה');
      return;
    }
    
    const error = validateRelations(
      newMember.name,
      newMember.parentId || null,
      newMember.spouseId || null,
      null
    );
    if (error) {
      alert(error);
      return;
    }
    
    if (newMember.name.trim().length < 2) {
      alert('השם חייב להכיל לפחות 2 תווים');
      return;
    }
    
    if (newMember.name.trim().length > 50) {
      alert('השם ארוך מדי (מקסימום 50 תווים)');
      return;
    }

    const id = 'm_' + Math.random().toString(36).substr(2, 9);

    const memberToAdd: FamilyMember = {
      id,
      name: newMember.name.trim(),
      generation: 'grandchild',
      parentId: null,
      parentIds: [],
      image: newMember.image,
      gender: newMember.gender,
      familyName: '',
      spouseId: null
    };

    let updated = [...members, memberToAdd];

    setMembers(updated);
    db.saveMembers(updated);
    sync.sendMessage({ type: 'DATABASE_SYNC', members: updated, questions, settings });
    
    setNewMember({
      name: '',
      parentId: '',
      parentIds: [],
      gender: 'male',
      image: null,
      generation: 'grandchild',
      familyName: '',
      spouseId: '',
    });

    showSuccess('בן המשפחה הועלה ונוסף בהצלחה!');
  };

  const handleDeleteMember = (id: string) => {
    const updated = members.filter(m => m.id !== id);
    setMembers(updated);
    db.saveMembers(updated);
    sync.sendMessage({ type: 'DATABASE_SYNC', members: updated, questions, settings });
    showSuccess('בן המשפחה נמחק.');
  };

  const handleStartEdit = (m: FamilyMember) => {
    setEditingMemberId(m.id);
    setNewMember({
      name: m.name,
      parentId: m.parentId || '',
      parentIds: m.parentIds || [],
      gender: m.gender || 'male',
      image: m.image || null,
      generation: m.generation,
      familyName: m.familyName || '',
      spouseId: m.spouseId || '',
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMemberId || !newMember.name) return;

    const error = validateRelations(
      newMember.name,
      null,
      null,
      editingMemberId
    );
    if (error) {
      alert(error);
      return;
    }

    const updated = members.map(m => {
      if (m.id === editingMemberId) {
        return {
          ...m,
          name: newMember.name.trim(),
          gender: newMember.gender,
          image: newMember.image,
        };
      }
      return m;
    });

    setMembers(updated);
    db.saveMembers(updated);
    sync.sendMessage({ type: 'DATABASE_SYNC', members: updated, questions, settings });
    setEditingMemberId(null);

    setNewMember({
      name: '',
      parentId: '',
      parentIds: [],
      gender: 'male',
      image: null,
      generation: 'grandchild',
      familyName: '',
      spouseId: '',
    });

    showSuccess('פרטי בן המשפחה עודכנו בהצלחה!');
  };

  const handleCancelEdit = () => {
    setEditingMemberId(null);
    setNewMember({
      name: '',
      parentId: '',
      parentIds: [],
      gender: 'male',
      image: null,
      generation: 'grandchild',
      familyName: '',
      spouseId: '',
    });
  };

  const handleMemberImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64);
      setNewMember(prev => ({ ...prev, image: compressed }));
    }
  };

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newQuestion.text.trim()) {
      alert('נא להזין משפט/ציטוט לשאלה');
      return;
    }
    
    if (newQuestion.text.trim().length < 3) {
      alert('המשפט חייב להכיל לפחות 3 תווים');
      return;
    }
    
    if (newQuestion.text.trim().length > 200) {
      alert('המשפט ארוך מדי (מקסימום 200 תווים)');
      return;
    }
    
    const speakerId = newQuestion.speakerId || 'general';
    const id = 'q_' + Math.random().toString(36).substr(2, 9);
    const questionToAdd: TriviaQuestion = {
      id,
      text: newQuestion.text.trim(),
      speakerId
    };

    const updated = [...questions, questionToAdd];
    setQuestions(updated);
    db.saveQuestions(updated);
    sync.sendMessage({ type: 'DATABASE_SYNC', members, questions: updated, settings });

    setNewQuestion({
      text: '',
      speakerId: ''
    });
    showSuccess('השאלה נוספה בהצלחה!');
  };

  const handleDeleteQuestion = (id: string) => {
    const updated = questions.filter(q => q.id !== id);
    setQuestions(updated);
    db.saveQuestions(updated);
    sync.sendMessage({ type: 'DATABASE_SYNC', members, questions: updated, settings });
    showSuccess('השאלה נמחקה.');
  };

  const handleExcelTemplateDownload = () => {
    excelHelper.downloadTemplate();
  };

  const handleImportMembersExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const result = await excelHelper.importMembers(file, members);
        setMembers(result.members);
        db.saveMembers(result.members);
        sync.sendMessage({ type: 'DATABASE_SYNC', members: result.members, questions, settings });
        setWarnings(result.warnings);
        showSuccess('ייבוא בני המשפחה מ-Excel הושלם!');
      } catch (err) {
        console.error(err);
        alert('שגיאה בקריאת קובץ ה-Excel. אנא וודא שהשתמשת בתבנית הנכונה.');
      }
    }
  };

  const handleImportQuestionsExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const result = await excelHelper.importQuestions(file, members, questions);
        setQuestions(result.questions);
        db.saveQuestions(result.questions);
        
        let finalMembers = members;
        if (result.updatedMembers) {
          finalMembers = result.updatedMembers;
          setMembers(finalMembers);
          db.saveMembers(finalMembers);
        }
        
        sync.sendMessage({ type: 'DATABASE_SYNC', members: finalMembers, questions: result.questions, settings });
        setWarnings(result.warnings);
        showSuccess('ייבוא השאלות מ-Excel הושלם!');
      } catch (err) {
        console.error(err);
        alert('שגיאה בקריאת קובץ ה-Excel. אנא וודא שהשתמשת בתבנית הנכונה.');
      }
    }
  };

  const handleAbsoluteReset = async () => {
    const confirmed = window.confirm(
      "⚠️ איפוס מוחלט של החדר!\n\nפעולה זו תמחק את כל הנתונים של החדר מהענן ותנקה את הדפדפן. לא ניתן לשחזר!\n\nהאם אתה בטוח?"
    );
    if (!confirmed) return;
    
    try {
      const roomCode = sync.getRoomCode();
      // Delete Firebase room data
      if (roomCode) {
        const roomRef = ref(rtdb, `rooms/${roomCode}`);
        const isPausedRef = ref(rtdb, `rooms/${roomCode}/database/state/isPaused`);
        const controllerStatusRef = ref(rtdb, `rooms/${roomCode}/controllerConnected`);
        
        try {
          await onDisconnect(isPausedRef).cancel();
        } catch (_) {}
        try {
          await onDisconnect(controllerStatusRef).cancel();
        } catch (_) {}
        
        await remove(roomRef);
      }
    } catch (e) {
      console.error('Failed to delete Firebase room', e);
    }
    
    // Clear all local storage room keys
    try {
      localStorage.removeItem('family_game_members');
      localStorage.removeItem('family_game_questions');
      localStorage.removeItem('family_game_settings');
      localStorage.removeItem('family_game_state');
      const roomCode = sync.getRoomCode();
      if (roomCode) {
        localStorage.removeItem(`wizard_draft_${roomCode}`);
      }
    } catch (e) {
      console.error('Failed to clear localStorage', e);
    }
    
    // Redirect to home page
    window.location.href = window.location.origin + window.location.pathname;
  };


  const handleSettingsImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, contestantId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64);
      
      const updatedContestants = (settings.contestants || []).map(c => 
        c.id === contestantId ? { ...c, image: compressed } : c
      );
      
      let grandpaImage = settings.grandpaImage;
      let grandmaImage = settings.grandmaImage;
      if (contestantId === 'grandpa' || settings.contestants?.[0]?.id === contestantId) grandpaImage = compressed;
      if (contestantId === 'grandma' || settings.contestants?.[1]?.id === contestantId) grandmaImage = compressed;

      updateSettings({ 
        ...settings, 
        contestants: updatedContestants,
        grandpaImage,
        grandmaImage
      });
    }
  };

  const handleTogglePause = () => {
    const updated = { ...gameState, isPaused: !gameState.isPaused };
    setGameState(updated);
    db.saveGameState(updated);
    sync.sendMessage({ type: 'DATABASE_SYNC', members, questions, settings });
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showSuccess(`קישור ל${label} הועתק לקליפבורד! 📋`);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      alert('העתקה נכשלה. אנא העתק ידנית.');
    });
  };

  return (
    <AdminContext.Provider value={{
      activeTab,
      setActiveTab,
      members,
      setMembers,
      questions,
      setQuestions,
      settings,
      setSettings,
      gameState,
      setGameState,
      gameScreenConnected,
      isLoading,
      securityError,
      roomError,
      countdown,
      newMember,
      setNewMember,
      newQuestion,
      setNewQuestion,
      editingMemberId,
      setEditingMemberId,
      warnings,
      setWarnings,
      successMsg,
      setSuccessMsg,
      nextQuestionTimer,
      setNextQuestionTimer,
      showContestantOrderModal,
      setShowContestantOrderModal,
      
      wizardHostName,
      setWizardHostName,
      wizardTreeLayout,
      setWizardTreeLayout,
      wizardContestantCount,
      setWizardContestantCount,
      wizardQuestionTimer,
      setWizardQuestionTimer,
      wizardShowNameBank,
      setWizardShowNameBank,
      wizardContestants,
      setWizardContestants,
      wizardStepLocal,
      setWizardStepLocal,
      hasInitializedWizard,
      setHasInitializedWizard,
      adminSubMode,
      setAdminSubMode,
      showSuccessScreen,
      setShowSuccessScreen,
      wizardConfirmModal,
      setWizardConfirmModal,
      showMidSetupNotice,
      setShowMidSetupNotice,
      
      updateGameState,
      updateSettings,
      handleStartGame,
      handleStartGameAfterContestantOrder,
      handleNextQuestion,
      handlePrevQuestion,
      handleRevealAnswer,
      handleAssignPoints,
      handleAddMember,
      handleDeleteMember,
      handleStartEdit,
      handleSaveEdit,
      handleCancelEdit,
      handleMemberImageUpload,
      handleAddQuestion,
      handleDeleteQuestion,
      handleExcelTemplateDownload,
      handleImportMembersExcel,
      handleImportQuestionsExcel,
      handleAbsoluteReset,
      handleSettingsImageUpload,
      handleTogglePause,
      showSuccess,
      copyToClipboard,
      validateRelations,
      renderParentOptions,
      saveDraftToLocalStorage
    }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
