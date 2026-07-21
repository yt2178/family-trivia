import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db, FamilyMember, GameSettings, GameState, TriviaQuestion, Contestant, healGameState, ensureArray } from '../../utils/db';
import { sync } from '../../utils/sync';
import { excelHelper } from '../../utils/excelHelper';
import { audioHelper } from '../../utils/audioHelper';
import { rtdb } from '../../utils/firebase';
import { ref, onValue, off, set, remove, get, onDisconnect } from 'firebase/database';
import { fileToBase64, compressImage, cropImage, isValidUserImage } from '../../utils/imageHelper';

export const CONTESTANT_COLORS = [
  {
    bg: 'bg-sky-950/40 border-sky-500/40 hover:bg-sky-900/40 text-sky-100',
    text: 'text-sky-400',
    glow: 'שחקן כחול',
    border: 'border-sky-500',
    gradient: 'from-sky-600 to-sky-400',
    scoreBg: 'bg-sky-955/30',
    imageFallbackBg: 'bg-sky-955/40',
    accentGlow: 'bg-sky-500/10',
    shadowGlow: 'shadow-sky-500/20'
  },
  {
    bg: 'bg-fuchsia-950/40 border-fuchsia-500/40 hover:bg-fuchsia-900/40 text-fuchsia-100',
    text: 'text-fuchsia-400',
    glow: 'שחקן סגול',
    border: 'border-fuchsia-500',
    gradient: 'from-fuchsia-600 to-fuchsia-400',
    scoreBg: 'bg-fuchsia-955/30',
    imageFallbackBg: 'bg-fuchsia-955/40',
    accentGlow: 'bg-fuchsia-500/10',
    shadowGlow: 'shadow-fuchsia-500/20'
  },
  {
    bg: 'bg-amber-950/40 border-amber-500/40 hover:bg-amber-900/40 text-amber-100',
    text: 'text-amber-400',
    glow: 'שחקן כתום',
    border: 'border-amber-500',
    gradient: 'from-amber-600 to-amber-400',
    scoreBg: 'bg-amber-955/30',
    imageFallbackBg: 'bg-amber-955/40',
    accentGlow: 'bg-amber-500/10',
    shadowGlow: 'shadow-amber-500/20'
  },
  {
    bg: 'bg-emerald-950/40 border-emerald-500/40 hover:bg-emerald-900/40 text-emerald-100',
    text: 'text-emerald-400',
    glow: 'שחקן ירוק',
    border: 'border-emerald-500',
    gradient: 'from-emerald-600 to-emerald-400',
    scoreBg: 'bg-emerald-955/30',
    imageFallbackBg: 'bg-emerald-955/40',
    accentGlow: 'bg-emerald-500/10',
    shadowGlow: 'shadow-emerald-500/20'
  }
];

export const CONTESTANT_THEMES = [
  {
    bg: 'bg-sky-500/10 text-sky-400',
    border: 'border-sky-500/30'
  },
  {
    bg: 'bg-fuchsia-500/10 text-fuchsia-400',
    border: 'border-fuchsia-500/30'
  },
  {
    bg: 'bg-amber-500/10 text-amber-400',
    border: 'border-amber-500/30'
  },
  {
    bg: 'bg-emerald-500/10 text-emerald-400',
    border: 'border-emerald-500/30'
  }
];

export const healSettings = (s: any): GameSettings => {
  const defaultSettings = db.getSettings();
  if (!s) return defaultSettings;
  const parsed = { ...s };
  parsed.contestants = ensureArray<Contestant>(parsed.contestants);
  if (parsed.contestants.length < 2) {
    parsed.contestants = [
      { id: 'contestant_1', name: 'כחול', image: null },
      { id: 'contestant_2', name: 'סגול', image: null }
    ];
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
  image: string | null;
  gender: 'male' | 'female';
}

interface QuestionFormState {
  id?: string;
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
  wizardGroupName: string;
  setWizardGroupName: React.Dispatch<React.SetStateAction<string>>;
  wizardContestantCount: number;
  setWizardContestantCount: React.Dispatch<React.SetStateAction<number>>;
  wizardQuestionTimer: number | null;
  setWizardQuestionTimer: React.Dispatch<React.SetStateAction<number | null>>;
  wizardShowNameBank: boolean;
  setWizardShowNameBank: React.Dispatch<React.SetStateAction<boolean>>;
  wizardShowDetailedGalleryPage: boolean;
  setWizardShowDetailedGalleryPage: React.Dispatch<React.SetStateAction<boolean>>;
  wizardNextQuestionDelay: 'manual' | number;
  setWizardNextQuestionDelay: React.Dispatch<React.SetStateAction<'manual' | number>>;
  wizardContestants: Array<{ id: string; name: string; image: string | null; gender?: 'male' | 'female' }>;
  setWizardContestants: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string; image: string | null; gender?: 'male' | 'female' }>>>;
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
  handleAdvanceStartStage: (nextStage: 'logo' | 'group_welcome' | 'contestants_welcome' | 'contestants_names' | 'ready' | 'contestants_photos' | 'starting' | 'in_game') => void;
  handleNextQuestion: () => void;
  handlePrevQuestion: () => void;
  handleRevealAnswer: () => void;
  handleAssignPoints: (winner: string) => void;
  handleAddMember: (e: React.FormEvent) => Promise<void>;
  handleDeleteMember: (id: string) => void;
  handleReorderMembers: (startIndex: number, endIndex: number) => void;
  handleStartEdit: (m: FamilyMember) => void;
  handleSaveEdit: (e: React.FormEvent) => void;
  handleCancelEdit: () => void;
  handleMemberImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleAddQuestion: (e: React.FormEvent) => void;
  handleDeleteQuestion: (id: string) => void;
  handleReorderQuestions: (startIndex: number, endIndex: number) => void;
  handleExcelTemplateDownload: () => void;
  handleImportMembersExcel: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleImportQuestionsExcel: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleAbsoluteReset: () => void;
  handleSettingsImageUpload: (e: React.ChangeEvent<HTMLInputElement>, contestantId: string) => Promise<void>;
  handleTogglePause: () => void;
  showSuccess: (msg: string) => void;
  copyToClipboard: (text: string, label: string) => void;
  saveDraftToLocalStorage: (
    hostName: string,
    groupName: string,
    contestantCount: number,
    contestants: Array<{ id: string; name: string; image: string | null; gender?: 'male' | 'female' }>,
    questionTimer: number | null,
    questionOrder: 'sequential' | 'random',
    step: number,
    showNameBankVal?: boolean,
    nextQuestionDelayVal?: 'manual' | number,
    showDetailedGalleryPageVal?: boolean
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
      const connectedRef = ref(rtdb, ".info/connected");
      let unsubscribeConnected: (() => void) | null = null;
      
      // Set controller status directly to register connection presence instantly
      unsubscribeConnected = onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
          set(controllerStatusRef, true);
          onDisconnect(controllerStatusRef).set(false);
        }
      });

      // Broadcast controller connection locally for instant tab-to-tab sync
      sync.sendMessage({ type: 'CONTROLLER_CONNECTED', roomCode });

      const statusRef = ref(rtdb, `rooms/${roomCode}/gameScreenConnected`);
      onValue(statusRef, (snapshot) => {
        setGameScreenConnected(!!snapshot.val());
      });

      return () => {
        if (unsubscribeConnected) unsubscribeConnected();
        set(controllerStatusRef, false);
        off(statusRef);
      };
    }
  }, [isLoading, securityError]);

  // Input Forms States
  const [newMember, setNewMember] = useState<MemberFormState>({
    name: '',
    image: null,
    gender: 'male',
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
  const lastScoreClickTimeRef = useRef<number>(0);

  // Local wizard buffer states to prevent saving to Firebase on every keystroke
  const [wizardHostName, setWizardHostName] = useState('');
  const [wizardGroupName, setWizardGroupName] = useState('');
  const [wizardContestantCount, setWizardContestantCount] = useState(2);
  const [wizardQuestionTimer, setWizardQuestionTimer] = useState<number | null>(null);
  const [wizardShowNameBank, setWizardShowNameBank] = useState<boolean>(false);
  const [wizardShowDetailedGalleryPage, setWizardShowDetailedGalleryPage] = useState<boolean>(false);
  const [wizardNextQuestionDelay, setWizardNextQuestionDelay] = useState<'manual' | number>('manual');
  const [wizardContestants, setWizardContestants] = useState<Array<{ id: string; name: string; image: string | null; gender?: 'male' | 'female' }>>([]);
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
        setWizardGroupName(draft.groupName || settings.groupName || '');
        setWizardContestantCount(draft.contestantCount || 2);
        setWizardQuestionTimer(draft.questionTimer !== undefined ? draft.questionTimer : (settings.questionTimer || null));
        setWizardShowNameBank(draft.showNameBank !== undefined ? draft.showNameBank : (settings.showNameBank || false));
        setWizardShowDetailedGalleryPage(draft.showDetailedGalleryPage !== undefined ? draft.showDetailedGalleryPage : (settings.showDetailedGalleryPage !== undefined ? settings.showDetailedGalleryPage : true));
        setWizardNextQuestionDelay(draft.nextQuestionDelay !== undefined ? draft.nextQuestionDelay : (settings.nextQuestionDelay || 'manual'));
        setWizardStepLocal(draft.wizardStep || settings.wizardStep || 1);
        
        const defaultNames = ['כחול', 'סגול', 'ירוק', 'כתום'];
        const defaultIds = ['contestant_1', 'contestant_2', 'contestant_3', 'contestant_4'];
        const arr = [];
        for (let i = 0; i < 4; i++) {
          const draftImg = draft.contestants?.[i]?.image;
          const settingsImg = settings.contestants?.[i]?.image;
          const validImg = isValidUserImage(draftImg) ? draftImg : (isValidUserImage(settingsImg) ? settingsImg : null);
          const existing = draft.contestants?.[i] || settings.contestants?.[i];
          arr.push({
            id: existing?.id || defaultIds[i],
            name: existing?.name || defaultNames[i],
            image: validImg,
            gender: existing?.gender || (defaultNames[i] === 'סגול' ? 'female' : 'male')
          });
        }
        setWizardContestants(arr);
      } else {
        setWizardHostName(settings.hostName || '');
        setWizardGroupName(settings.groupName || '');
        setWizardContestantCount(settings.contestants?.length || 2);
        setWizardQuestionTimer(settings.questionTimer !== undefined ? settings.questionTimer : null);
        setWizardShowNameBank(settings.showNameBank || false);
        setWizardShowDetailedGalleryPage(settings.showDetailedGalleryPage !== undefined ? settings.showDetailedGalleryPage : true);
        setWizardNextQuestionDelay(settings.nextQuestionDelay !== undefined ? settings.nextQuestionDelay : 'manual');
        setWizardStepLocal(settings.wizardStep || 1);
        
        const defaultNames = ['כחול', 'סגול', 'ירוק', 'כתום'];
        const defaultIds = ['contestant_1', 'contestant_2', 'contestant_3', 'contestant_4'];
        const arr = [];
        for (let i = 0; i < 4; i++) {
          const existing = settings.contestants?.[i];
          arr.push({
            id: existing?.id || defaultIds[i],
            name: existing?.name || defaultNames[i],
            image: existing?.image || null,
            gender: existing?.gender || (defaultNames[i] === 'סגול' ? 'female' : 'male')
          });
        }
        setWizardContestants(arr);
      }
      setHasInitializedWizard(true);
      
      // Set mode based on URL parameters or setupComplete
      if (controllerMode) {
        setAdminSubMode('controller');
        if (!settings.setupComplete) {
          const newSettings = { ...settings, setupComplete: true };
          db.saveSettings(newSettings);
          setSettings(newSettings);
          sync.sendMessage({ type: 'SETTINGS_CHANGED', settings: newSettings });
        }
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

  // Automatically show the participant order modal when entering controller mode at the beginning of the game
  useEffect(() => {
    if (
      adminSubMode === 'controller' &&
      settings?.questionOrder === 'sequential' &&
      gameState?.currentQuestionIndex === 0
    ) {
      setShowContestantOrderModal(true);
    }
  }, [adminSubMode, settings?.questionOrder, gameState?.currentQuestionIndex]);

  const saveDraftToLocalStorage = (
    hostName: string,
    groupName: string,
    contestantCount: number,
    contestants: Array<{ id: string; name: string; image: string | null }>,
    questionTimer: number | null,
    questionOrder: 'sequential' | 'random',
    step: number,
    showNameBankVal?: boolean,
    nextQuestionDelayVal?: 'manual' | number,
    showDetailedGalleryPageVal?: boolean
  ) => {
    const rCode = sync.getRoomCode();
    if (!rCode) return;
    try {
      localStorage.setItem(`wizard_draft_${rCode}`, JSON.stringify({
        hostName,
        groupName,
        contestantCount,
        contestants: contestants.slice(0, contestantCount),
        questionTimer,
        questionOrder,
        showNameBank: showNameBankVal !== undefined ? showNameBankVal : wizardShowNameBank,
        nextQuestionDelay: nextQuestionDelayVal !== undefined ? nextQuestionDelayVal : wizardNextQuestionDelay,
        showDetailedGalleryPage: showDetailedGalleryPageVal !== undefined ? showDetailedGalleryPageVal : wizardShowDetailedGalleryPage,
        wizardStep: step
      }));
    } catch (e: any) {
      console.error("Failed to save wizard draft", e);
    }
  };

  const playAdminSound = (_type: 'success' | 'undo' | 'reveal') => {
    // No-op: Silence audio completely on host remote/admin screens
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
             const rawFbMembers = ensureArray<FamilyMember>(data.db?.members || data.members);
             const fbQuestions = ensureArray<TriviaQuestion>(data.db?.questions || data.questions);
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

             const localMembers = db.getMembers();
             const healed = rawFbMembers.length > 0 ? rawFbMembers.map(fbMem => {
               const localMem = localMembers.find(m => m.id === fbMem.id || m.name === fbMem.name);
               const validFbImg = isValidUserImage(fbMem.image) ? fbMem.image : null;
               const validLocalImg = localMem && isValidUserImage(localMem.image) ? localMem.image : null;
               return {
                 ...fbMem,
                 image: validFbImg || validLocalImg || null
               };
             }) : localMembers;
             
             db.saveMembers(healed);
             db.saveQuestions(fbQuestions);
             
             const currentSettings = db.getSettings();
             const mergedSettings = healSettings({ ...currentSettings, ...fbSettings });
             
             // Preserve contestant images from local settings if Firebase has null
             if (mergedSettings.contestants) {
               mergedSettings.contestants = mergedSettings.contestants.map((c, i) => {
                 const localContestant = currentSettings.contestants?.[i];
                 const validFbImg = isValidUserImage(c.image) ? c.image : null;
                 const validLocalImg = localContestant && isValidUserImage(localContestant.image) ? localContestant.image : null;
                 return {
                   ...c,
                   image: validFbImg || validLocalImg || null
                 };
               });
             }
             
             db.saveSettings(mergedSettings);
             
             const currentGameState = db.getGameState();
             const mergedState = healGameState({ ...currentGameState, ...fbState, isPaused: false }, mergedSettings);
             db.saveGameState(mergedState);

             setMembers(healed);
             setQuestions(fbQuestions);
             setSettings(mergedSettings);
             setGameState(mergedState);

             // Sync wizard states from Firebase loaded settings to prevent defaulting to 2 contestants
             setWizardHostName(mergedSettings.hostName || '');
             setWizardContestantCount(mergedSettings.contestants?.length || 2);
             setWizardQuestionTimer(mergedSettings.questionTimer !== undefined ? mergedSettings.questionTimer : null);
             setWizardShowNameBank(mergedSettings.showNameBank || false);
             setWizardNextQuestionDelay(mergedSettings.nextQuestionDelay !== undefined ? mergedSettings.nextQuestionDelay : 'manual');
             setWizardStepLocal(mergedSettings.wizardStep || 1);
             
             const defaultNames = ['כחול', 'סגול', 'ירוק', 'כתום'];
             const defaultIds = ['contestant_1', 'contestant_2', 'contestant_3', 'contestant_4'];
             const arr = [];
             for (let i = 0; i < 4; i++) {
               const existing = mergedSettings.contestants?.[i];
               const validImg = isValidUserImage(existing?.image) ? existing?.image : null;
               arr.push({
                 id: existing?.id || defaultIds[i],
                 name: existing?.name || defaultNames[i],
                 image: validImg,
                 gender: existing?.gender || (defaultNames[i] === 'סגול' ? 'female' : 'male')
               });
             }
             setWizardContestants(arr);
             setHasInitializedWizard(true);

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

      const healedMembers = loadedMembers;

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
        const localMembers = db.getMembers();
        const localQuestions = db.getQuestions();
        if (localMembers.length > 0 || localQuestions.length > 0) {
          sync.sendMessage({
            type: 'DATABASE_SYNC',
            members: localMembers,
            questions: localQuestions,
            settings: db.getSettings()
          });
        }
      } else if (msg.type === 'DATABASE_SYNC') {
        const healed = ensureArray<FamilyMember>(msg.members);
        const healedQuestions = ensureArray<TriviaQuestion>(msg.questions);
        const healedSettings = healSettings(msg.settings);
        setMembers(healed);
        setQuestions(healedQuestions);
        setSettings(healedSettings);
        db.saveMembers(healed);
        db.saveQuestions(healedQuestions);
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
    // Preserve existing valid contestant images if incoming has null/invalid
    const sanitizedContestants = (newSettings.contestants || []).map((c, idx) => {
      const existingImg = settings?.contestants?.[idx]?.image;
      const validIncoming = isValidUserImage(c.image) ? c.image : null;
      const validExisting = isValidUserImage(existingImg) ? existingImg : null;
      return {
        ...c,
        image: validIncoming || validExisting || null
      };
    });

    const finalSettings = { ...newSettings, contestants: sanitizedContestants };
    setSettings(finalSettings);
    db.saveSettings(finalSettings);
    
    // Update scores in gameState for new contestants if not exists
    const newScores = { ...(gameState?.scores || {}) };
    let scoreChanged = false;
    (finalSettings.contestants || []).forEach(c => {
      if (newScores[c.id] === undefined) {
        newScores[c.id] = 0;
        scoreChanged = true;
      }
    });
    // Clean up scores of removed contestants
    if (newScores && typeof newScores === 'object') {
      Object.keys(newScores).forEach(key => {
        if (!(finalSettings.contestants || []).some(c => c.id === key)) {
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

    const safeMembers = members.length > 0 ? members : db.getMembers();
    sync.sendMessage({ type: 'SETTINGS_CHANGED', settings: finalSettings });
    sync.sendMessage({ type: 'DATABASE_SYNC', members: safeMembers, questions, settings: finalSettings });
  };

  const handleStartGame = () => {
    setWizardConfirmModal({
      message: "⚠️ האם אתה בטוח שברצונך לאפס את הניקוד ולהתחיל את המשחק מחדש?\n\nכל הניקוד הנוכחי של המתחרים יימחק!",
      onConfirm: () => {
        setWizardConfirmModal(null);
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
        sync.sendMessage({ type: 'START_GAME_COUNTDOWN' });
        showSuccess('המשחק אותחל וערבוב השאלות הושלם בהצלחה!');
      }
    });
  };

  const handleStartGameAfterContestantOrder = () => {
    setShowContestantOrderModal(false);
    handleAdvanceStartStage('logo');
  };

  const handleAdvanceStartStage = (nextStage: 'logo' | 'group_welcome' | 'contestants_welcome' | 'contestants_names' | 'ready' | 'contestants_photos' | 'starting' | 'in_game') => {
    if (!settings.setupComplete) {
      const newSettings = { ...settings, setupComplete: true };
      db.saveSettings(newSettings);
      setSettings(newSettings);
      sync.sendMessage({ type: 'SETTINGS_CHANGED', settings: newSettings });
    }

    if (nextStage === 'logo') {
      const freshState = db.resetGame();
      const updatedState: GameState = {
        ...freshState,
        startStage: 'logo',
        winnerRevealed: false,
        galleryRevealed: false
      };
      updateGameState(updatedState);
      showSuccess('המשחק הוחזר לשלב הראשון 📺');
    } else if (nextStage === 'in_game') {
      const updatedState: GameState = {
        ...gameState,
        startStage: 'in_game',
        isPlaying: true
      };
      updateGameState(updatedState);
      showSuccess('המשחק הופעל!');
    } else {
      updateGameState({
        ...gameState,
        startStage: nextStage,
        winnerRevealed: false,
        galleryRevealed: false
      });
    }
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
    const now = Date.now();
    if (now - lastScoreClickTimeRef.current < 250) {
      return;
    }
    lastScoreClickTimeRef.current = now;

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
      const delay = settings.nextQuestionDelay && settings.nextQuestionDelay !== 'manual'
        ? (settings.nextQuestionDelay as number)
        : 0;
      setNextQuestionTimer(delay);
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

    // Start auto-advance timer if configured
    const delay = settings.nextQuestionDelay && settings.nextQuestionDelay !== 'manual'
      ? (settings.nextQuestionDelay as number)
      : 0;
    setNextQuestionTimer(delay);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanName = newMember.name.trim();
    if (!cleanName) {
      alert('נא להזין שם משתתף');
      return;
    }
    
    if (cleanName.length < 2) {
      alert('השם חייב להכיל לפחות 2 תווים');
      return;
    }
    
    if (cleanName.length > 50) {
      alert('השם ארוך מדי (מקסימום 50 תווים)');
      return;
    }

    const id = 'm_' + Math.random().toString(36).substring(2, 11);

    const memberToAdd: FamilyMember = {
      id,
      name: cleanName,
      image: newMember.image,
      gender: newMember.gender,
    };

    let updated = [...members, memberToAdd];

    setMembers(updated);
    db.saveMembers(updated);
    sync.sendMessage({ type: 'DATABASE_SYNC', members: updated, questions, settings });
    
    setNewMember({
      name: '',
      gender: 'male',
      image: null,
    });

    showSuccess('המשתתף נוסף בהצלחה!');
  };

  const handleDeleteMember = (id: string) => {
    const member = members.find(m => m.id === id);
    const memberName = member?.name || 'משתתף זה';
    setWizardConfirmModal({
      message: `האם אתה בטוח שברצונך למחוק את המשתתף "${memberName}"?\n\nלא ניתן יהיה לשחזר פעולה זו.`,
      onConfirm: () => {
        const updatedMembers = members.filter(m => m.id !== id);
        const updatedQuestions = questions.map(q => q.speakerId === id ? { ...q, speakerId: '' } : q);
        setMembers(updatedMembers);
        setQuestions(updatedQuestions);
        db.saveMembers(updatedMembers);
        db.saveQuestions(updatedQuestions);
        sync.sendMessage({ type: 'DATABASE_SYNC', members: updatedMembers, questions: updatedQuestions, settings });
        setWizardConfirmModal(null);
        showSuccess('בן המשפחה נמחק.');
      }
    });
  };

  const handleReorderMembers = (startIndex: number, endIndex: number) => {
    if (startIndex < 0 || startIndex >= members.length || endIndex < 0 || endIndex >= members.length || startIndex === endIndex) {
      return;
    }
    const result = Array.from(members);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    setMembers(result);
    db.saveMembers(result);
    sync.sendMessage({ type: 'DATABASE_SYNC', members: result, questions, settings });
  };

  const handleStartEdit = (m: FamilyMember) => {
    setEditingMemberId(m.id);
    setNewMember({
      name: m.name,
      gender: m.gender || 'male',
      image: m.image || null,
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMemberId || !newMember.name) return;

    const cleanName = newMember.name.trim();
    if (!cleanName) {
      alert('נא להזין שם');
      return;
    }

    const updated = members.map(m => {
      if (m.id === editingMemberId) {
        const finalImage = isValidUserImage(newMember.image)
          ? newMember.image
          : (isValidUserImage(m.image) ? m.image : null);
        return {
          ...m,
          name: cleanName,
          gender: newMember.gender,
          image: finalImage,
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
      gender: 'male',
      image: null,
    });

    showSuccess('פרטי המשתתף עודכנו בהצלחה!');
  };

  const handleCancelEdit = () => {
    setEditingMemberId(null);
    setNewMember({
      name: '',
      gender: 'male',
      image: null,
    });
  };

  const handleMemberImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const cropped = await cropImage(file);
        setNewMember(prev => ({ ...prev, image: cropped }));
      } catch (err) {
        console.log("Image crop cancelled or failed:", err);
      }
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
    const isEdit = !!newQuestion.id;
    
    let updated: TriviaQuestion[];
    if (isEdit) {
      updated = questions.map(q => q.id === newQuestion.id ? { ...q, text: newQuestion.text.trim(), speakerId } : q);
      showSuccess('השאלה עודכנה בהצלחה!');
    } else {
      const id = 'q_' + Math.random().toString(36).substring(2, 11);
      const questionToAdd: TriviaQuestion = {
        id,
        text: newQuestion.text.trim(),
        speakerId
      };
      updated = [...questions, questionToAdd];
      showSuccess('השאלה נוספה בהצלחה!');
    }

    setQuestions(updated);
    db.saveQuestions(updated);
    sync.sendMessage({ type: 'DATABASE_SYNC', members, questions: updated, settings });

    setNewQuestion({
      text: '',
      speakerId: ''
    });
  };

  const handleDeleteQuestion = (id: string) => {
    const question = questions.find(q => q.id === id);
    const textSnippet = question?.text ? `"${question.text.substring(0, 35)}..."` : 'שאלה זו';
    setWizardConfirmModal({
      message: `האם אתה בטוח שברצונך למחוק את השאלה:\n${textSnippet}?\n\nלא ניתן יהיה לשחזר פעולה זו.`,
      onConfirm: () => {
        const updated = questions.filter(q => q.id !== id);
        setQuestions(updated);
        db.saveQuestions(updated);
        sync.sendMessage({ type: 'DATABASE_SYNC', members, questions: updated, settings });
        setWizardConfirmModal(null);
        showSuccess('השאלה נמחקה.');
      }
    });
  };

  const handleReorderQuestions = (startIndex: number, endIndex: number) => {
    if (startIndex < 0 || startIndex >= questions.length || endIndex < 0 || endIndex >= questions.length || startIndex === endIndex) {
      return;
    }
    const result = Array.from(questions);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    
    setQuestions(result);
    db.saveQuestions(result);
    sync.sendMessage({ type: 'DATABASE_SYNC', members, questions: result, settings });
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
        const errMsg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
        alert(`שגיאה בייבוא שחקנים מ-Excel: ${errMsg}\n\nוודא שהקובץ מכיל עמודת "שם" או "Name" תקינה.`);
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
        const errMsg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
        alert(`שגיאה בייבוא שאלות מ-Excel: ${errMsg}\n\nוודא שהקובץ מכיל עמודת "משפט" או "ציטוט" תקינה.`);
      }
    }
  };

  const handleAbsoluteReset = () => {
    setWizardConfirmModal({
      message: "⚠️ איפוס מוחלט של החדר!\n\nפעולה זו תמחק את כל הנתונים של החדר מהענן ותנקה את הדפדפן. לא ניתן לשחזר!\n\nהאם אתה בטוח שברצונך לאפס?",
      onConfirm: async () => {
        setWizardConfirmModal(null);
        try {
          const roomCode = sync.getRoomCode();
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
        
        window.location.href = window.location.origin + window.location.pathname;
      }
    });
  };


  const handleSettingsImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, contestantId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const cropped = await cropImage(file);
        const updatedContestants = (settings.contestants || []).map(c => 
          c.id === contestantId ? { ...c, image: cropped } : c
        );

        updateSettings({ 
          ...settings, 
          contestants: updatedContestants
        });
      } catch (err) {
        console.error("Image crop cancelled or failed:", err);
      }
    }
  };

  const handleTogglePause = () => {
    const updated = { ...gameState, isPaused: !gameState.isPaused };
    setGameState(updated);
    db.saveGameState(updated);
    sync.sendMessage({ type: 'STATE_CHANGED', state: updated });
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
      wizardGroupName,
      setWizardGroupName,
      wizardContestantCount,
      setWizardContestantCount,
      wizardQuestionTimer,
      setWizardQuestionTimer,
      wizardShowNameBank,
      setWizardShowNameBank,
      wizardShowDetailedGalleryPage,
      setWizardShowDetailedGalleryPage,
      wizardNextQuestionDelay,
      setWizardNextQuestionDelay,
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
      handleAdvanceStartStage,
      handleNextQuestion,
      handlePrevQuestion,
      handleRevealAnswer,
      handleAssignPoints,
      handleAddMember,
      handleDeleteMember,
      handleReorderMembers,
      handleStartEdit,
      handleSaveEdit,
      handleCancelEdit,
      handleMemberImageUpload,
      handleAddQuestion,
      handleDeleteQuestion,
      handleReorderQuestions,
      handleExcelTemplateDownload,
      handleImportMembersExcel,
      handleImportQuestionsExcel,
      handleAbsoluteReset,
      handleSettingsImageUpload,
      handleTogglePause,
      showSuccess,
      copyToClipboard,
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
