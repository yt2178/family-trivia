import React, { useState, useEffect, useRef } from 'react';
import { db, FamilyMember, GameSettings, GameState, TriviaQuestion } from '../utils/db';
import { sync } from '../utils/sync';
import { excelHelper } from '../utils/excelHelper';
import { audioHelper } from '../utils/audioHelper';
import { rtdb } from '../utils/firebase';
import { ref, onValue, off, set } from 'firebase/database';
import {
  Users,
  Settings,
  HelpCircle,
  FileSpreadsheet,
  Play,
  Check,
  X,
  Plus,
  Trash2,
  Download,
  Upload,
  Mic,
  Square,
  Volume2,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Image as ImageIcon,
  Pencil,
  Tv
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Helper to convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// Canvas Helper to compress image to save LocalStorage quota
const compressImage = (base64Str: string, maxWidth = 160, maxHeight = 160): Promise<string> => {
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

export const AdminView: React.FC = () => {
  // Tabs: 'control' | 'members' | 'questions' | 'settings' | 'import' | 'stats'
  const [activeTab, setActiveTab] = useState<'control' | 'members' | 'questions' | 'settings' | 'import' | 'stats'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('setup') === 'true' ? 'members' : 'control';
  });

  // Core Data State
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [settings, setSettings] = useState<GameSettings>(db.getSettings());
  const [gameState, setGameState] = useState<GameState>(db.getGameState());
  const [gameScreenConnected, setGameScreenConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(!!sync.getRoomCode());

  // Register controller connection and listen to game screen connection status in Firebase
  useEffect(() => {
    const roomCode = sync.getRoomCode();
    if (roomCode) {
      const controllerStatusRef = ref(rtdb, `rooms/${roomCode}/controllerConnected`);
      set(controllerStatusRef, true);

      // Broadcast controller connection locally for instant tab-to-tab sync
      sync.sendMessage({ type: 'CONTROLLER_CONNECTED', roomCode });

      const statusRef = ref(rtdb, `rooms/${roomCode}/gameScreenConnected`);
      onValue(statusRef, (snapshot) => {
        setGameScreenConnected(!!snapshot.val());
      });

      return () => {
        set(controllerStatusRef, false);
        off(statusRef);
      };
    }
  }, []);

  // Input Forms States
  const [newMember, setNewMember] = useState<{
    name: string;
    generation: FamilyMember['generation'];
    parentId: string;
    image: string | null;
    gender: 'male' | 'female';
    familyName: string;
    spouseId: string;
  }>({
    name: '',
    generation: 'grandchild',
    parentId: '',
    image: null,
    gender: 'male',
    familyName: '',
    spouseId: '',
  });

  const [newQuestion, setNewQuestion] = useState<{
    text: string;
    speakerId: string;
  }>({
    text: '',
    speakerId: '',
  });

  // Edit member states
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  // Warnings / Notifications
  const [warnings, setWarnings] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const renderParentOptions = (generation: FamilyMember['generation']) => {
    const groupMembers = members.filter(m => m.generation === generation && m.id !== editingMemberId);
    const renderedIds = new Set<string>();
    const options: React.ReactNode[] = [];

    groupMembers.forEach(m => {
      if (renderedIds.has(m.id)) return;

      if (m.spouseId) {
        const spouse = members.find(s => s.id === m.spouseId);
        if (spouse && spouse.generation === generation && spouse.id !== editingMemberId) {
          options.push(
            <option key={`${m.id}-${spouse.id}`} value={m.id}>
              {m.name} ו{spouse.name}
            </option>
          );
          renderedIds.add(m.id);
          renderedIds.add(spouse.id);
          return;
        }
      }

      options.push(
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      );
      renderedIds.add(m.id);
    });

    return options;
  };

  // Helper to heal spouse generations
  const healMembersGenerations = (membersList: FamilyMember[]): FamilyMember[] => {
    const healed = membersList.map(m => {
      if (m.spouseId) {
        const spouse = membersList.find(s => s.id === m.spouseId);
        if (spouse && m.generation !== spouse.generation) {
          if (spouse.parentId && !m.parentId) {
            return { ...m, generation: spouse.generation };
          } else if (m.parentId && !spouse.parentId) {
            return m;
          } else {
            return { ...m, generation: spouse.generation };
          }
        }
      }
      return m;
    });

    return healed.map(m => {
      if (m.spouseId) {
        const spouse = healed.find(s => s.id === m.spouseId);
        if (spouse && m.generation !== spouse.generation) {
          return { ...m, generation: spouse.generation };
        }
      }
      return m;
    });
  };

  // Pure Web Audio API tone generator wrapper using audioHelper
  const playAdminSound = (type: 'success' | 'undo' | 'reveal') => {
    audioHelper.play(type);
  };

  // Load Data
  useEffect(() => {
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

            const healed = healMembersGenerations(fbMembers);
            
            db.saveMembers(healed);
            db.saveQuestions(fbQuestions);
            
            const currentSettings = db.getSettings();
            const mergedSettings = { ...currentSettings, ...fbSettings };
            db.saveSettings(mergedSettings);
            
            const currentGameState = db.getGameState();
            const mergedState = { ...currentGameState, ...fbState };
            db.saveGameState(mergedState);

            setMembers(healed);
            setQuestions(fbQuestions);
            setSettings(mergedSettings);
            setGameState(mergedState);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.error("Failed to fetch initial room database from Firebase, falling back to localStorage", e);
        }
      }

      // Local storage fallback (or local-only mode)
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

  // Listen to remote client database requests and incoming sync updates
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
        setMembers(healed);
        setQuestions(msg.questions);
        setSettings(msg.settings);
        db.saveMembers(healed);
        db.saveQuestions(msg.questions);
        db.saveSettings(msg.settings);
      } else if (msg.type === 'STATE_CHANGED') {
        setGameState(msg.state);
        db.saveGameState(msg.state);
      } else if (msg.type === 'SETTINGS_CHANGED') {
        setSettings(msg.settings);
        db.saveSettings(msg.settings);
      }
    });
    return () => unsubscribe();
  }, [members, questions, settings]);

  // Broadcast state changes whenever gameState or settings change
  const updateGameState = (newState: GameState) => {
    setGameState(newState);
    db.saveGameState(newState);
    sync.sendMessage({ type: 'STATE_CHANGED', state: newState });
  };

  const updateSettings = (newSettings: GameSettings) => {
    setSettings(newSettings);
    db.saveSettings(newSettings);
    
    // Update scores in gameState for new contestants if not exists
    const newScores = { ...gameState.scores };
    let scoreChanged = false;
    newSettings.contestants.forEach(c => {
      if (newScores[c.id] === undefined) {
        newScores[c.id] = 0;
        scoreChanged = true;
      }
    });
    // Clean up scores of removed contestants
    Object.keys(newScores).forEach(key => {
      if (!newSettings.contestants.some(c => c.id === key)) {
        delete newScores[key];
        scoreChanged = true;
      }
    });
    
    if (scoreChanged) {
      const updatedState = { ...gameState, scores: newScores };
      setGameState(updatedState);
      db.saveGameState(updatedState);
      sync.sendMessage({ type: 'STATE_CHANGED', state: updatedState });
    }

    sync.sendMessage({ type: 'SETTINGS_CHANGED', settings: newSettings });
    sync.sendMessage({ type: 'DATABASE_SYNC', members, questions, settings: newSettings });
  };

  // --- GAME CONTROLLER ACTIONS ---
  const handleStartGame = () => {
    const freshState = db.resetGame();
    updateGameState(freshState);
    // Mark setup as complete so projector screen is allowed to enter
    const newSettings = { ...settings, setupComplete: true };
    db.saveSettings(newSettings);
    setSettings(newSettings);
    sync.sendMessage({ type: 'SETTINGS_CHANGED', settings: newSettings });
    showSuccess('המשחק אותחל וערבוב השאלות הושלם בהצלחה!');
  };

  const handleNextQuestion = () => {
    const total = gameState.shuffledQuestionIds.length;
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
    const currentQId = gameState.shuffledQuestionIds[gameState.currentQuestionIndex];
    if (!currentQId) return;

    const currentSolvedValue = gameState.solvedQuestions[currentQId];
    const currentWinners = (!currentSolvedValue || currentSolvedValue === 'nobody') 
      ? [] 
      : currentSolvedValue.split(',');

    const newScores = { ...gameState.scores };
    let newSolved = { ...gameState.solvedQuestions };
    let isUndo = false;

    if (winner === 'nobody') {
      // Clear all winners for this question and deduct their points
      currentWinners.forEach(wId => {
        newScores[wId] = Math.max(0, (newScores[wId] || 0) - 1);
      });
      delete newSolved[currentQId];
      showSuccess('בוטל הניקוד לכל המתמודדים בשאלה זו.');
    } else {
      if (currentWinners.includes(winner)) {
        // Toggle off (Undo point)
        const updatedWinners = currentWinners.filter(wId => wId !== winner);
        newScores[winner] = Math.max(0, (newScores[winner] || 0) - 1);
        isUndo = true;
        
        if (updatedWinners.length > 0) {
          newSolved[currentQId] = updatedWinners.join(',');
        } else {
          delete newSolved[currentQId];
        }
        showSuccess(`בוטל הניקוד עבור ${settings.contestants.find(c => c.id === winner)?.name || 'מתמודד זה'}.`);
      } else {
        // Toggle on (Add winner point)
        const updatedWinners = [...currentWinners, winner];
        newScores[winner] = (newScores[winner] || 0) + 1;
        newSolved[currentQId] = updatedWinners.join(',');
        showSuccess(`התווספה נקודה עבור ${settings.contestants.find(c => c.id === winner)?.name || 'מתמודד זה'}!`);
      }
    }

    const updatedState = {
      ...gameState,
      scores: newScores,
      solvedQuestions: newSolved,
      isRevealed: true, // Auto-reveal
    };

    updateGameState(updatedState);
    
    // Play sound effect
    playAdminSound(isUndo ? 'undo' : 'success');

    // Trigger confetti on the projector!
    if (winner !== 'nobody') {
      sync.sendMessage({ type: 'TRIGGER_CONFETTI', winner, isUndo });
    }
  };



  // --- FAMILY MEMBER ACTIONS ---
  const validateRelations = (
    name: string,
    parentId: string | null,
    spouseId: string | null,
    currentId: string | null
  ): string | null => {
    const cleanName = name.trim();
    if (!cleanName) return 'נא להזין שם.';

    if (spouseId) {
      if (currentId && spouseId === currentId) {
        return 'אדם אינו יכול להיות בן הזוג של עצמו.';
      }
      
      const spouse = members.find(m => m.id === spouseId);
      if (spouse) {
        // Double marriage check
        if (spouse.spouseId && spouse.spouseId !== currentId) {
          return `בן/בת הזוג שנבחרו (${spouse.name}) כבר נשואים ל-${members.find(m => m.id === spouse.spouseId)?.name || 'אדם אחר'}.`;
        }
        
        // Parent/Child marriage check
        if (parentId && parentId === spouseId) {
          return 'אדם אינו יכול להתחתן עם ההורה שלו.';
        }
      }
    }

    if (parentId) {
      if (currentId && parentId === currentId) {
        return 'אדם אינו יכול להיות ההורה של עצמו.';
      }

      // Check hierarchy loop: A is parent of B, B is parent of A
      if (currentId) {
        let currParentId = parentId;
        const visited = new Set<string>();
        while (currParentId) {
          if (currParentId === currentId) {
            return 'שגיאה: הגדרה זו יוצרת לולאת היררכיה אינסופית בעץ המשפחה.';
          }
          if (visited.has(currParentId)) break;
          visited.add(currParentId);
          const p = members.find(m => m.id === currParentId);
          currParentId = p?.parentId || '';
        }
      }
    }

    return null;
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
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

    // Automatically calculate generation based on parentId or spouseId in tree layout,
    // otherwise preserve user-selected generation.
    let generation = newMember.generation;
    if (settings.treeLayout === 'traditional') {
      if (newMember.parentId) {
        const parent = members.find(m => m.id === newMember.parentId);
        if (parent) {
          if (parent.generation === 'grandparent') generation = 'parent';
          else if (parent.generation === 'parent') generation = 'child';
          else if (parent.generation === 'child') generation = 'grandchild';
          else generation = 'great-grandchild';
        }
      } else if (newMember.spouseId) {
        const spouse = members.find(m => m.id === newMember.spouseId);
        if (spouse) {
          generation = spouse.generation;
        }
      } else {
        generation = 'grandparent';
      }
    }

    // Inherit parent's family name if left blank
    let familyName = newMember.familyName.trim();
    if (!familyName && newMember.parentId) {
      const parent = members.find(p => p.id === newMember.parentId);
      if (parent && parent.familyName) {
        familyName = parent.familyName;
      }
    }

    const id = 'm_' + Math.random().toString(36).substr(2, 9);
    const spouseId = newMember.spouseId || null;

    const memberToAdd: FamilyMember = {
      id,
      name: newMember.name.trim(),
      generation,
      parentId: newMember.parentId || null,
      image: newMember.image,
      gender: newMember.gender,
      familyName,
      spouseId
    };

    let updated = [...members, memberToAdd];

    // If spouseId is specified, set the spouse's spouseId and match generation
    if (spouseId) {
      updated = updated.map(m => {
        if (m.id === spouseId) {
          return { ...m, spouseId: id, generation };
        }
        return m;
      });
      const spouseNode = members.find(m => m.id === spouseId);
      if (spouseNode && spouseNode.parentId) {
        memberToAdd.parentId = spouseNode.parentId;
      }
    }

    setMembers(updated);
    db.saveMembers(updated);
    sync.sendMessage({ type: 'DATABASE_SYNC', members: updated, questions, settings });
    
    // Reset form
    setNewMember({
      name: '',
      parentId: '',
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
    // Clean parent and spouse pointers to prevent dangling references
    const cleaned = updated.map(m => {
      let changed = false;
      const updatedMember = { ...m };
      if (updatedMember.parentId === id) {
        updatedMember.parentId = null;
        changed = true;
      }
      if (updatedMember.spouseId === id) {
        updatedMember.spouseId = null;
        changed = true;
      }
      return changed ? updatedMember : m;
    });
    setMembers(cleaned);
    db.saveMembers(cleaned);
    sync.sendMessage({ type: 'DATABASE_SYNC', members: cleaned, questions, settings });
    showSuccess('בן המשפחה נמחק.');
  };

  const handleStartEdit = (m: FamilyMember) => {
    setEditingMemberId(m.id);
    setNewMember({
      name: m.name,
      parentId: m.parentId || '',
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
      newMember.parentId || null,
      newMember.spouseId || null,
      editingMemberId
    );
    if (error) {
      alert(error);
      return;
    }

    // Recalculate generation based on parentId or spouseId in tree layout,
    // otherwise preserve user-selected generation.
    let generation = newMember.generation;
    if (settings.treeLayout === 'traditional') {
      if (newMember.parentId) {
        const parent = members.find(p => p.id === newMember.parentId);
        if (parent) {
          if (parent.generation === 'grandparent') generation = 'parent';
          else if (parent.generation === 'parent') generation = 'child';
          else if (parent.generation === 'child') generation = 'grandchild';
          else generation = 'great-grandchild';
        }
      } else if (newMember.spouseId) {
        const spouse = members.find(p => p.id === newMember.spouseId);
        if (spouse) {
          generation = spouse.generation;
        }
      } else {
        generation = 'grandparent';
      }
    }

    // Inherit parent's family name if left blank
    let familyName = newMember.familyName.trim();
    if (!familyName && newMember.parentId) {
      const parent = members.find(p => p.id === newMember.parentId);
      if (parent && parent.familyName) {
        familyName = parent.familyName;
      }
    }

    const spouseId = newMember.spouseId || null;

    let updated = members.map(m => {
      if (m.id === editingMemberId) {
        return {
          ...m,
          name: newMember.name.trim(),
          gender: newMember.gender,
          parentId: newMember.parentId || null,
          generation,
          familyName,
          image: newMember.image,
          spouseId,
        };
      }
      return m;
    });

    // Clear old spouse relationship if changed
    const oldMember = members.find(m => m.id === editingMemberId);
    if (oldMember && oldMember.spouseId && oldMember.spouseId !== spouseId) {
      updated = updated.map(m => {
        if (m.id === oldMember.spouseId) {
          return { ...m, spouseId: null };
        }
        return m;
      });
    }

    // Set new spouse relationship and align generation
    if (spouseId) {
      updated = updated.map(m => {
        if (m.id === spouseId) {
          return { ...m, spouseId: editingMemberId, generation };
        }
        return m;
      });
      // Align parentId to match spouse's parentId
      const spouseNode = members.find(m => m.id === spouseId);
      if (spouseNode && spouseNode.parentId) {
        const primary = updated.find(m => m.id === editingMemberId);
        if (primary) {
          primary.parentId = spouseNode.parentId;
        }
      }
    }

    setMembers(updated);
    db.saveMembers(updated);
    sync.sendMessage({ type: 'DATABASE_SYNC', members: updated, questions, settings });
    setEditingMemberId(null);

    // Clear form
    setNewMember({
      name: '',
      parentId: '',
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



  // --- QUESTION ACTIONS ---
  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
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


  // --- EXCEL & BACKUP ACTIONS ---
  const handleExcelTemplateDownload = (mode: 'tree' | 'list') => {
    excelHelper.downloadTemplate(mode);
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

  const handleExportBackup = () => {
    const json = db.exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'מי_אמר_מה_גיבוי_משחק.json';
    link.click();
    showSuccess('קובץ הגיבוי יוצא בהצלחה!');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const success = db.importBackup(text);
        if (success) {
          const m = db.getMembers();
          const q = db.getQuestions();
          const s = db.getSettings();
          setMembers(m);
          setQuestions(q);
          setSettings(s);
          setGameState(db.getGameState());
          sync.sendMessage({ type: 'DATABASE_SYNC', members: m, questions: q, settings: s });
          showSuccess('שחזור הגיבוי המלא הושלם בהצלחה!');
        } else {
          alert('קובץ הגיבוי אינו תקין.');
        }
      };
      reader.readAsText(file);
    }
  };

  // Settings photo uploads
  const handleSettingsImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, contestantId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64);
      
      const updatedContestants = settings.contestants.map(c => 
        c.id === contestantId ? { ...c, image: compressed } : c
      );
      
      // For backward compatibility
      let grandpaImage = settings.grandpaImage;
      let grandmaImage = settings.grandmaImage;
      if (contestantId === 'grandpa' || settings.contestants[0]?.id === contestantId) grandpaImage = compressed;
      if (contestantId === 'grandma' || settings.contestants[1]?.id === contestantId) grandmaImage = compressed;

      updateSettings({ 
        ...settings, 
        contestants: updatedContestants,
        grandpaImage,
        grandmaImage
      });
    }
  };

  // Utility to flash notifications
  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Calculate family statistics
  const getFamilyStats = () => {
    const familyGroups: Record<string, { adults: number; children: number; total: number }> = {};
    
    members.forEach(m => {
      const familyName = m.familyName || 'ללא משפחה';
      if (!familyGroups[familyName]) {
        familyGroups[familyName] = { adults: 0, children: 0, total: 0 };
      }
      
      if (m.generation === 'parent' || m.generation === 'grandparent') {
        familyGroups[familyName].adults++;
      } else {
        familyGroups[familyName].children++;
      }
      familyGroups[familyName].total++;
    });

    return familyGroups;
  };

  const familyStats = getFamilyStats();

  // Get active question
  const activeQuestionId = gameState.shuffledQuestionIds[gameState.currentQuestionIndex];
  const activeQuestion = questions.find(q => q.id === activeQuestionId);
  const activeSpeaker = activeQuestion ? members.find(m => m.id === activeQuestion.speakerId) : null;
  const isGameLoaded = gameState.shuffledQuestionIds.length > 0;

  const totalDescendants = members.filter(m => m.generation !== 'grandparent').length;
  const childrenAndGrandchildren = members.filter(m => m.generation === 'parent' || m.generation === 'child' || m.generation === 'grandchild').length;
  const greatGrandchildren = members.filter(m => m.generation === 'great-grandchild').length;

  const renderSetupWizard = () => {
    const currentStep = settings.wizardStep || 1;
    const roomCode = sync.getRoomCode() || '';

    // Handle contestant count changes
    const handleWizardContestantCountChange = (count: number) => {
      let updated = [...(settings.contestants || [])];
      const defaultNames = ['כחול', 'סגול', 'ירוק', 'כתום'];
      const defaultIds = ['grandpa', 'grandma', 'contestant_3', 'contestant_4'];

      if (count > updated.length) {
        for (let i = updated.length; i < count; i++) {
          updated.push({
            id: defaultIds[i],
            name: defaultNames[i],
            image: null
          });
        }
      } else if (count < updated.length) {
        updated = updated.slice(0, count);
      }

      updateSettings({ 
        ...settings, 
        contestants: updated,
        grandpaName: updated[0]?.name || 'סבא',
        grandmaName: updated[1]?.name || 'סבתא',
        grandpaImage: updated[0]?.image || null,
        grandmaImage: updated[1]?.image || null
      });
    };

    // Handle contestant field changes
    const handleWizardContestantNameChange = (index: number, name: string) => {
      const updated = [...(settings.contestants || [])];
      if (updated[index]) {
        updated[index] = { ...updated[index], name };
        
        let grandpaName = settings.grandpaName;
        let grandmaName = settings.grandmaName;
        if (index === 0) grandpaName = name;
        if (index === 1) grandmaName = name;

        updateSettings({ 
          ...settings, 
          contestants: updated,
          grandpaName,
          grandmaName
        });
      }
    };

    const handleWizardContestantImageChange = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          const base64 = await fileToBase64(file);
          const compressed = await compressImage(base64);
          const updated = [...(settings.contestants || [])];
          if (updated[index]) {
            updated[index] = { ...updated[index], image: compressed };
            
            let grandpaImage = settings.grandpaImage;
            let grandmaImage = settings.grandmaImage;
            if (index === 0) grandpaImage = compressed;
            if (index === 1) grandmaImage = compressed;

            updateSettings({ 
              ...settings, 
              contestants: updated,
              grandpaImage,
              grandmaImage
            });
          }
        } catch (err) {
          console.error(err);
        }
      }
    };

    const handleRemoveContestantImage = (index: number) => {
      const updated = [...(settings.contestants || [])];
      if (updated[index]) {
        updated[index] = { ...updated[index], image: null };
        
        let grandpaImage = settings.grandpaImage;
        let grandmaImage = settings.grandmaImage;
        if (index === 0) grandpaImage = null;
        if (index === 1) grandmaImage = null;

        updateSettings({ 
          ...settings, 
          contestants: updated,
          grandpaImage,
          grandmaImage
        });
      }
    };

    // Excel functions
    const handleWizardImportMembers = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          const result = await excelHelper.importMembers(file, members);
          if (result && result.members) {
            setMembers(result.members);
            sync.sendMessage({
              type: 'DATABASE_SYNC',
              members: result.members,
              questions,
              settings
            });
            showSuccess(`ייבוא שחקנים הושלם בהצלחה! נוספו ${result.members.length - members.length} שחקנים.`);
          }
        } catch (err) {
          console.error(err);
          alert('ייבוא קובץ אקסל נכשל. ודא שהקובץ נכון.');
        }
      }
    };

    const handleWizardImportQuestions = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          const result = await excelHelper.importQuestions(file, members, questions);
          if (result && result.questions) {
            setQuestions(result.questions);
            sync.sendMessage({
              type: 'DATABASE_SYNC',
              members,
              questions: result.questions,
              settings
            });
            showSuccess(`ייבוא שאלות הושלם בהצלחה! נוספו ${result.questions.length - questions.length} שאלות.`);
          }
        } catch (err) {
          console.error(err);
          alert('ייבוא שאלות נכשל. ודא שהקובץ נכון.');
        }
      }
    };

    // Wizard navigation
    const handleNext = () => {
      if (currentStep === 1) {
        if (!settings.hostName?.trim()) {
          alert('נא להזין שם מנחה');
          return;
        }
      }
      if (currentStep < 6) {
        updateSettings({ ...settings, wizardStep: currentStep + 1 });
      }
    };

    const handleBack = () => {
      if (currentStep > 1) {
        updateSettings({ ...settings, wizardStep: currentStep - 1 });
      }
    };

    const handleSkip = () => {
      const confirmSkip = window.confirm(
        "האם אתה בטוח שברצונך לדלג על תהליך הרישום?\n\nעליך יהיה להזין את כל הפרטים (מתמודדים, שחקנים ושאלות) בתוך שלט המנחה המלא. מסך ההקרנה לא יוכל לפעול כל עוד לא תשלים את הגדרת המשחק ותסיים את הגדרת החדר."
      );
      if (confirmSkip) {
        updateSettings({ 
          ...settings, 
          setupComplete: true, 
          wizardStep: undefined 
        });
      }
    };

    const handleFinish = () => {
      updateSettings({ 
        ...settings, 
        setupComplete: true, 
        wizardStep: undefined 
      });
      showSuccess("הגדרת החדר הושלמה בהצלחה! תהנו מהמשחק!");
    };

    const stepTitles = [
      "פרטי חדר",
      "מתמודדים",
      "משתתפים",
      "שאלות",
      "הגדרות",
      "סיכום"
    ];

    const CONTESTANT_THEMES = [
      { border: 'border-sky-500/40', text: 'text-sky-400', name: 'כחול', bg: 'bg-sky-950/20' },
      { border: 'border-fuchsia-500/40', text: 'text-fuchsia-400', name: 'סגול', bg: 'bg-fuchsia-950/20' },
      { border: 'border-emerald-500/40', text: 'text-emerald-400', name: 'ירוק', bg: 'bg-emerald-950/20' },
      { border: 'border-amber-500/40', text: 'text-amber-400', name: 'כתום', bg: 'bg-amber-950/20' }
    ];

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col justify-between" dir="rtl">
        {/* Top Header */}
        <div className="flex justify-between items-center max-w-3xl w-full mx-auto border-b border-slate-800 pb-4 mb-6">
          <div>
            <h1 className="text-xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent flex items-center gap-2">
              <span>הגדרת חדר משחק חדש</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded font-mono">
                #{roomCode}
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">הגדירו את החדר שלב-אחר-שלב ליצירת חוויית משחק מושלמת</p>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-slate-500 hover:text-rose-400 transition-colors font-bold px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-rose-950 bg-slate-900/30 flex items-center gap-1"
          >
            <span>דלג לממשק מלא ⏭️</span>
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="w-full max-w-xl mx-auto mb-8 relative">
          <div className="absolute top-4 left-0 right-0 h-[2px] bg-slate-850 -translate-y-1/2 z-0" />
          <div 
            className="absolute top-4 left-0 h-[2px] bg-emerald-500/70 -translate-y-1/2 z-0 transition-all duration-500"
            style={{ width: `${((currentStep - 1) / 5) * 100}%`, direction: 'ltr' }}
          />
          <div className="flex justify-between items-center relative z-10">
            {stepTitles.map((title, idx) => {
              const stepNum = idx + 1;
              const isCompleted = currentStep > stepNum;
              const isActive = currentStep === stepNum;
              return (
                <div key={title} className="flex flex-col items-center">
                  <button
                    type="button"
                    disabled={stepNum > currentStep && !isCompleted}
                    onClick={() => updateSettings({ ...settings, wizardStep: stepNum })}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      isActive 
                        ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/20 scale-110 shadow-lg shadow-emerald-550/20' 
                        : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-900 border border-slate-850 text-slate-400'
                    }`}
                  >
                    {isCompleted ? <Check size={14} /> : stepNum}
                  </button>
                  <span className={`text-[10px] mt-1.5 font-bold ${isActive ? 'text-emerald-400' : 'text-slate-500'}`}>{title}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wizard Main Form Panel */}
        <div className="max-w-2xl w-full mx-auto bg-slate-900/40 border border-slate-850 p-6 md:p-8 rounded-3xl backdrop-blur-md shadow-2xl flex-grow flex flex-col justify-between relative overflow-hidden">
          
          {/* Inner slide animations */}
          <div className="flex-grow space-y-6">
            
            {/* Step 1: רישום חדר ומנחה */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-right">
                  <h3 className="text-lg font-black text-slate-100">שלב 1: אישור פרטי המנחה וסוג הלוח</h3>
                  <p className="text-xs text-slate-400 mt-1">אמת את שם המנחה ובחר את סוג הלוח להקרנה</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">שם מנחה המשחק:</label>
                    <input
                      type="text"
                      required
                      value={settings.hostName || ''}
                      onChange={(e) => updateSettings({ ...settings, hostName: e.target.value })}
                      placeholder="הקלד שם מנחה"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">מספר חדר (קבוע ולא ניתן לשינוי):</label>
                    <div className="w-full bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-2.5 text-center text-lg font-black text-emerald-400 font-mono tracking-wider">
                      {roomCode}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-2">סוג לוח המשחק:</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => updateSettings({ ...settings, treeLayout: 'traditional' })}
                        className={`p-4 text-xs font-bold rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 ${
                          settings.treeLayout === 'traditional'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/80 shadow-md shadow-emerald-950/10'
                            : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="text-2xl">🌳</span>
                        <span className="font-black">עץ יוחסין משפחתי</span>
                        <span className="text-[9px] text-slate-500 font-normal">חיבור הורים, בני זוג ודורות</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateSettings({ ...settings, treeLayout: 'none' })}
                        className={`p-4 text-xs font-bold rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 ${
                          settings.treeLayout === 'none'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/80 shadow-md shadow-emerald-950/10'
                            : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="text-2xl">📋</span>
                        <span className="font-black">ללא עץ יוחסין (רשימה)</span>
                        <span className="text-[9px] text-slate-500 font-normal">מצב פשוט ללא קשרים משפחתיים</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: מתמודדים */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-right">
                  <h3 className="text-lg font-black text-slate-100">שלב 2: הגדרת המתמודדים (הקבוצות)</h3>
                  <p className="text-xs text-slate-400 mt-1">בחר כמה קבוצות מתחרות בחידון (2 עד 4) והזן את שמותיהן ותמונותיהן</p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-2">מספר מתמודדים במשחק:</label>
                    <div className="flex gap-2">
                      {[2, 3, 4].map(num => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleWizardContestantCountChange(num)}
                          className={`flex-1 py-2 text-xs font-black rounded-lg border transition-all ${
                            settings.contestants?.length === num
                              ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md'
                              : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-white'
                          }`}
                        >
                          {num} מתמודדים
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                    {settings.contestants?.map((c, idx) => {
                      const theme = CONTESTANT_THEMES[idx % CONTESTANT_THEMES.length];
                      return (
                        <div key={c.id} className={`flex items-center gap-3 p-3 bg-slate-950/70 border ${theme.border} rounded-2xl`}>
                          {/* Contestant Image Upload */}
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-800 bg-slate-900 flex items-center justify-center">
                              {c.image ? (
                                <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="text-slate-600" size={20} />
                              )}
                            </div>
                            <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-full flex items-center justify-center cursor-pointer shadow-md">
                              <Plus size={10} className="text-emerald-400" />
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleWizardContestantImageChange(e, idx)}
                                className="hidden"
                              />
                            </label>
                          </div>

                          <div className="flex-grow">
                            <label className={`text-[10px] font-black ${theme.text} block mb-0.5`}>
                              קבוצה {idx + 1} ({theme.name}):
                            </label>
                            <input
                              type="text"
                              value={c.name}
                              onChange={(e) => handleWizardContestantNameChange(idx, e.target.value)}
                              placeholder={`שם מתמודד (למשל: ${theme.name})`}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-100 placeholder-slate-650 focus:outline-none focus:border-emerald-500 text-xs font-bold"
                            />
                          </div>

                          {c.image && (
                            <button
                              type="button"
                              onClick={() => handleRemoveContestantImage(idx)}
                              className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors mt-4"
                              title="הסר תמונה"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: משתתפים שיופיעו במשחק */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="text-right flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-black text-slate-100">שלב 3: הוספת שחקנים (בני משפחה)</h3>
                    <p className="text-xs text-slate-400 mt-0.5">הזן את שמות בני המשפחה או העלה מקובץ Excel</p>
                  </div>
                  
                  {/* Excel Actions */}
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => excelHelper.downloadTemplate(settings.treeLayout === 'traditional' ? 'tree' : 'list')}
                      className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1"
                      title="הורד קובץ שחקנים למילוי"
                    >
                      <Download size={12} />
                      <span>אבטיפוס Excel 📥</span>
                    </button>
                    <label className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer">
                      <Upload size={12} />
                      <span>העלה Excel 📤</span>
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleWizardImportMembers}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Add Member Form inline */}
                <form onSubmit={handleAddMember} className="bg-slate-950/60 p-4 border border-slate-850 rounded-2xl space-y-3 text-right">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-0.5">שם מלא:</label>
                      <input
                        type="text"
                        required
                        value={newMember.name}
                        onChange={e => setNewMember({ ...newMember, name: e.target.value })}
                        placeholder="לדוגמה: אבא יוסי, סבא שמואל"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-0.5">מין:</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setNewMember({ ...newMember, gender: 'male' })}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg border ${
                            newMember.gender === 'male' 
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/50' 
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          זכר 👨
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewMember({ ...newMember, gender: 'female' })}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg border ${
                            newMember.gender === 'female' 
                              ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/50' 
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          נקבה 👩
                        </button>
                      </div>
                    </div>
                  </div>

                  {settings.treeLayout === 'traditional' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-0.5">הורה משויך בעץ המשפחה:</label>
                        <select
                          value={newMember.parentId}
                          onChange={e => setNewMember({ ...newMember, parentId: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-350 text-xs focus:outline-none focus:border-emerald-500 font-bold"
                        >
                          <option value="">-- ללא הורה (ראש משפחה) --</option>
                          {members.map(m => (
                            <option key={m.id} value={m.id}>{m.name} ({m.generation})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-0.5">בן/בת זוג:</label>
                        <select
                          value={newMember.spouseId}
                          onChange={e => setNewMember({ ...newMember, spouseId: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-350 text-xs focus:outline-none focus:border-emerald-500 font-bold"
                        >
                          <option value="">-- ללא בן/בת זוג --</option>
                          {members.filter(m => m.id !== editingMemberId).map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-0.5">דור (שיוך דורות):</label>
                      <select
                        value={newMember.generation}
                        onChange={e => setNewMember({ ...newMember, generation: e.target.value as any })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-350 text-xs focus:outline-none focus:border-emerald-500 font-bold"
                      >
                        <option value="grandparent">דור 1 - סבא/סבתא (מבוגרים)</option>
                        <option value="parent">דור 2 - הורים</option>
                        <option value="child">דור 3 - ילדים / נכדים</option>
                        <option value="grandchild">דור 4 - נינים</option>
                      </select>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Plus size={14} />
                      <span>הוסף שחקן משפחה</span>
                    </button>
                  </div>
                </form>

                {/* List of members added */}
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 mb-1.5">שחקנים שהוספו ({members.length}):</h4>
                  <div className="max-h-[110px] overflow-y-auto border border-slate-850 bg-slate-950/20 rounded-xl p-2 space-y-1.5">
                    {members.length === 0 ? (
                      <p className="text-[10px] text-slate-650 text-center py-4">טרם הוספו שחקנים. הוסף שחקן למעלה או העלה קובץ Excel.</p>
                    ) : (
                      members.map(m => {
                        const parent = members.find(p => p.id === m.parentId);
                        const spouse = members.find(s => s.id === m.spouseId);
                        return (
                          <div key={m.id} className="flex justify-between items-center bg-slate-950/70 border border-slate-850 p-2 rounded-xl text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{m.gender === 'female' ? '👩' : '👨'}</span>
                              <span className="font-bold text-slate-200">{m.name}</span>
                              <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-medium">
                                {m.generation === 'grandparent' ? 'דור 1' : m.generation === 'parent' ? 'דור 2' : m.generation === 'child' ? 'דור 3' : 'דור 4'}
                              </span>
                              {settings.treeLayout === 'traditional' && (
                                <span className="text-[8px] text-slate-500">
                                  {parent && ` | הורה: ${parent.name}`}
                                  {spouse && ` | זוג: ${spouse.name}`}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteMember(m.id)}
                              className="text-rose-400 hover:bg-rose-500/10 p-1 rounded transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: שאלות וציטוטים */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="text-right flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-black text-slate-100">שלב 4: הכנסת שאלות וציטוטים</h3>
                    <p className="text-xs text-slate-400 mt-0.5">הזן ציטוטים משפחתיים או העלה שאלות מקובץ Excel</p>
                  </div>
                  
                  {/* Excel Actions */}
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => excelHelper.downloadTemplate('list')}
                      className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1"
                      title="הורד אבטיפוס שאלות למילוי"
                    >
                      <Download size={12} />
                      <span>אבטיפוס Excel 📥</span>
                    </button>
                    <label className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer">
                      <Upload size={12} />
                      <span>העלה Excel 📤</span>
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleWizardImportQuestions}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Add Question Form inline */}
                <form onSubmit={handleAddQuestion} className="bg-slate-950/60 p-4 border border-slate-850 rounded-2xl space-y-3 text-right">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">הציטוט או השאלה (למשל: "אני לא סובל בצל באוכל"):</label>
                    <textarea
                      required
                      value={newQuestion.text}
                      onChange={e => setNewQuestion({ ...newQuestion, text: e.target.value })}
                      placeholder="הקלד את הציטוט או השאלה..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-bold focus:outline-none focus:border-emerald-500 h-14 resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">מי אמר את זה? (הדובר):</label>
                    <select
                      value={newQuestion.speakerId}
                      onChange={e => setNewQuestion({ ...newQuestion, speakerId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-350 text-xs focus:outline-none focus:border-emerald-500 font-bold"
                    >
                      <option value="">-- ללא שיוך (שאלה כללית לכולם) --</option>
                      <option value="general">❓ שאלה כללית (ללא שיוך לבן משפחה)</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Plus size={14} />
                      <span>הוסף שאלה</span>
                    </button>
                  </div>
                </form>

                {/* List of questions added */}
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 mb-1.5">שאלות שהוספו ({questions.length}):</h4>
                  <div className="max-h-[110px] overflow-y-auto border border-slate-850 bg-slate-950/20 rounded-xl p-2 space-y-1.5">
                    {questions.length === 0 ? (
                      <p className="text-[10px] text-slate-650 text-center py-4">טרם הוספו שאלות. הוסף שאלה למעלה או העלה קובץ Excel.</p>
                    ) : (
                      questions.map((q, idx) => {
                        const speaker = members.find(m => m.id === q.speakerId);
                        return (
                          <div key={q.id} className="flex justify-between items-center bg-slate-950/70 border border-slate-850 p-2 rounded-xl text-xs">
                            <div className="flex items-center gap-2 truncate max-w-[90%]">
                              <span className="font-black text-emerald-400">#{idx + 1}</span>
                              <span className="text-slate-200 truncate font-semibold">“{q.text}”</span>
                              <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-bold shrink-0">
                                {speaker ? `אמר/ה: ${speaker.name}` : 'שאלה כללית'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="text-rose-400 hover:bg-rose-500/10 p-1 rounded transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: הגדרות זמן */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="text-right">
                  <h3 className="text-lg font-black text-slate-100">שלב 5: הגדרות זמן (טיימר)</h3>
                  <p className="text-xs text-slate-400 mt-1">הגדר האם תהיה הגבלת זמן מענה לכל שאלה על מסך ההקרנה</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-2">מגבלת זמן למענה על שאלה:</label>
                    <select
                      value={settings.questionTimer === undefined || settings.questionTimer === null ? 'unlimited' : settings.questionTimer.toString()}
                      onChange={e => {
                        const val = e.target.value;
                        const seconds = val === 'unlimited' ? null : parseInt(val);
                        updateSettings({ ...settings, questionTimer: seconds });
                      }}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-emerald-500 text-sm font-black"
                    >
                      <option value="unlimited">⏳ ללא הגבלת זמן (חשיפה ידנית בלבד)</option>
                      <option value="10">⏱️ 10 שניות</option>
                      <option value="15">⏱️ 15 שניות</option>
                      <option value="20">⏱️ 20 שניות</option>
                      <option value="30">⏱️ 30 שניות</option>
                      <option value="45">⏱️ 45 שניות</option>
                      <option value="60">⏱️ 60 שניות (דקה אחת)</option>
                    </select>
                    <p className="text-[10px] text-slate-500 mt-2 bg-slate-950/30 p-3 rounded-lg leading-relaxed">
                      💡 אם תבחר הגבלת זמן, יופיע פס התקדמות (טיימר) בראש מסך ההקרנה כשהמנחה מפעיל שאלה. כשהזמן ייגמר יושמע צליל התראה מיוחד על מנת לזרז את המתמודדים.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: סיכום והפעלה */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div className="text-right">
                  <h3 className="text-lg font-black text-slate-100">שלב 6: סיכום והשלמת הגדרת החדר!</h3>
                  <p className="text-xs text-slate-400 mt-1">בדוק שכל הפרטים נכונים ושמור את פרטי הכניסה של החדר</p>
                </div>

                {/* Summarized Box */}
                <div className="bg-slate-950/70 border border-slate-850 p-5 rounded-2xl text-right space-y-3.5 relative overflow-hidden">
                  <div className="absolute -top-16 -left-16 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl" />
                  
                  <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                    <span className="text-xs text-slate-400">שם מנחה המשחק:</span>
                    <strong className="text-xs text-slate-200 font-bold">{settings.hostName}</strong>
                  </div>

                  <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                    <span className="text-xs text-slate-400">מספר חדר (לשיתוף והתחברות):</span>
                    <strong className="text-sm text-emerald-400 font-mono font-black">{roomCode}</strong>
                  </div>

                  <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                    <span className="text-xs text-slate-400">סוג לוח:</span>
                    <span className="text-xs text-slate-200 font-bold">
                      {settings.treeLayout === 'traditional' ? '🌳 עץ יוחסין משפחתי' : '📋 רשימה פשוטה'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                      <span className="text-[10px] text-slate-500 block font-bold">מתמודדים</span>
                      <strong className="text-base text-sky-400 font-black">{settings.contestants?.length || 0}</strong>
                    </div>
                    <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                      <span className="text-[10px] text-slate-500 block font-bold">שחקנים</span>
                      <strong className="text-base text-fuchsia-400 font-black">{members.length}</strong>
                    </div>
                    <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                      <span className="text-[10px] text-slate-500 block font-bold">שאלות</span>
                      <strong className="text-base text-emerald-400 font-black">{questions.length}</strong>
                    </div>
                  </div>
                </div>

                {/* Important Alert */}
                <div className="bg-amber-500/10 border-2 border-amber-500/20 p-4 rounded-2xl text-right space-y-2">
                  <p className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                    <span>⚠️ שימו לב - שמרו את פרטי החדר!</span>
                  </p>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-bold">
                    עליכם לזכור את <strong className="text-amber-400 underline">מספר החדר ({roomCode})</strong> ואת <strong className="text-amber-400 underline">שם המנחה ({settings.hostName})</strong>. אלו הם פרטי הזיהוי של החדר שלכם. ללא שני הפרטים האלה, לא תוכלו לחזור ולהתחבר לחדר זה בהמשך או להפעיל את מסך ההקרנה!
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Stepper Navigation Buttons */}
          <div className="mt-8 border-t border-slate-850 pt-4 flex gap-3 z-10 relative">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 py-3 bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-350 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <ChevronRight size={14} />
                <span>הקודם</span>
              </button>
            )}

            {currentStep < 6 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex-[2] py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs rounded-xl transition-all shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-1.5 active:scale-95"
              >
                <span>הבא (שלב {currentStep + 1})</span>
                <ChevronLeft size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="flex-[2] py-3 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs rounded-xl transition-all shadow-lg shadow-amber-950/20 flex items-center justify-center gap-1.5 active:scale-95 animate-pulse"
              >
                <Play size={14} />
                <span>שמור וסיים הגדרה 🎮</span>
              </button>
            )}
          </div>

          {/* Tip Footer Message */}
          <div className="text-center mt-4">
            <span className="text-[10px] text-slate-500 font-bold block bg-slate-950/20 py-1.5 px-3 rounded-lg border border-slate-950">
              💡 אל דאגה! תוכלו לערוך ולשנות את כל הפרטים הללו גם בהמשך מתוך שלט המנחה המלא.
            </span>
          </div>

        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 text-emerald-400" dir="rtl">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-bold">טוען נתוני משחק מהענן...</span>
      </div>
    );
  }

  if (!settings.setupComplete) {
    return renderSetupWizard();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col">
      
      {/* Alert popup */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 font-bold px-6 py-3 rounded-full shadow-2xl flex items-center gap-2"
          >
            <Check size={18} />
            <span>{successMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center border-b border-slate-800 pb-4 mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-50 flex flex-wrap items-center gap-2">
            <span>שלום מנחה המשחק, <span className="font-black text-amber-400 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent inline-block">{settings.hostName || 'המנחה'}</span>! 👑</span>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded">
              מחובר {sync.getRoomCode() ? `| חדר: ${sync.getRoomCode()}` : ''}
            </span>
            {sync.getRoomCode() && (
              <button
                onClick={() => {
                  const url = `${window.location.origin}${window.location.pathname}?mode=game&room=${sync.getRoomCode()}`;
                  window.open(url, '_blank', 'width=1200,height=800');
                }}
                className="text-xs bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shadow-md shadow-sky-950/20 hover:scale-[1.03] active:scale-[0.97]"
              >
                <Tv size={12} />
                <span>פתח מסך הקרנה 📺</span>
              </button>
            )}
          </h1>
          <p className="text-xs text-slate-400">שלוט במשחק המוקרן על מסך גדול בזמן אמת</p>
          {settings.treeLayout === 'none' ? (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-400 font-medium">
              <span>סה״כ משתתפים רשומים: <strong className="text-emerald-400">{members.length}</strong></span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-400 font-medium">
              <span>סה״כ צאצאים בעץ: <strong className="text-emerald-400">{totalDescendants}</strong></span>
              <span>|</span>
              <span>ילדים ונכדים: <strong className="text-emerald-400">{childrenAndGrandchildren}</strong></span>
              <span>|</span>
              <span>נינים: <strong className="text-emerald-400">{greatGrandchildren}</strong></span>
            </div>
          )}
        </div>

        {/* Tab Selector */}
        <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-full whitespace-nowrap scrollbar-none flex-shrink-0">
          <button
            onClick={() => setActiveTab('control')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'control' ? 'bg-emerald-600 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutGrid size={14} />
            <span>בקרה ושליטה</span>
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'members' ? 'bg-emerald-600 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users size={14} />
            <span>{settings.treeLayout === 'none' ? 'ניהול משתתפים' : 'ניהול משפחה'}</span>
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'questions' ? 'bg-emerald-600 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <HelpCircle size={14} />
            <span>שאלות וציטוטים</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'settings' ? 'bg-emerald-600 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings size={14} />
            <span>הגדרות משחק</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'import' ? 'bg-emerald-600 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet size={14} />
            <span>ייבוא וגיבוי</span>
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'stats' ? 'bg-emerald-600 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutGrid size={14} />
            <span>סטטיסטיקת משפחות</span>
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-grow">
        
        {/* TAB 1: GAME CONTROL */}
        {activeTab === 'control' && (
          <div className="grid grid-cols-12 gap-6 items-stretch">
            
            {/* Left side: Current Question Control */}
            <div className="col-span-12 lg:col-span-8 flex flex-col justify-between glass-panel p-6 rounded-3xl border border-slate-800">
              <div>
                <h3 className="text-lg font-bold mb-4 text-emerald-400 flex items-center gap-2">
                  <span>שליטה בסיבוב המשחק</span>
                  {!isGameLoaded && (
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                      טרם התחיל המשחק
                    </span>
                  )}
                </h3>

                {isGameLoaded ? (
                  gameState.currentQuestionIndex < gameState.shuffledQuestionIds.length ? (
                    <div>
                      {/* Active quote */}
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-6">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                          המשפט המוקרן כעת:
                        </span>
                        <blockquote className="text-xl md:text-2xl font-bold italic mt-2 text-slate-100">
                          ״{activeQuestion?.text}״
                        </blockquote>
                      </div>

                      {/* Speaker Answer & Reveal State */}
                      <div className="flex justify-between items-center bg-slate-900/60 p-4 rounded-xl border border-slate-800 mb-6">
                        <div>
                          <span className="text-xs text-slate-400 block">האדם שאמר את המשפט (התשובה הנכונה):</span>
                          <strong className="text-base text-amber-400 font-bold">
                            {activeSpeaker ? activeSpeaker.name : 'לא משויך'}
                          </strong>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={handleRevealAnswer}
                            disabled={gameState.isRevealed}
                            className={`px-4 py-2 font-bold text-xs rounded-lg transition-colors ${
                              gameState.isRevealed
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                            }`}
                          >
                            {gameState.isRevealed ? 'התשובה גלויה במסך' : 'חשוף תשובה במסך'}
                          </button>
                        </div>
                      </div>

                      {/* Scoring Actions */}
                      <div>
                        <span className="text-xs text-slate-400 block mb-3 font-semibold">
                          מי צדק במשחק המשפחה?
                        </span>
                        <div className={`grid gap-4 ${settings.contestants.length <= 2 ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'}`}>
                          {settings.contestants.map((c, index) => {
                            const colors = CONTESTANT_COLORS[index % CONTESTANT_COLORS.length];
                            const solvedVal = gameState.solvedQuestions[gameState.shuffledQuestionIds[gameState.currentQuestionIndex]];
                            const isWinner = solvedVal ? solvedVal.split(',').includes(c.id) : false;
                            return (
                              <button
                                key={c.id}
                                onClick={() => handleAssignPoints(c.id)}
                                className={`p-4 hover:scale-[1.02] active:scale-[0.98] transition-all rounded-2xl flex flex-col items-center gap-2 group relative border ${
                                  isWinner
                                    ? `${colors.border} bg-slate-900 shadow-lg shadow-${colors.text.split('-')[1]}-500/20`
                                    : colors.bg
                                }`}
                              >
                                <Check size={28} className={`${isWinner ? colors.text : 'text-slate-500'} group-hover:scale-110 transition-transform`} />
                                <span className="font-bold text-sm">{c.name} {c.name.endsWith('ה') || c.name.endsWith('ת') ? 'צדקה!' : 'צדק!'}</span>
                                <span className="text-[10px] text-slate-400">{isWinner ? 'לחץ שוב לביטול' : `+1 נקודה ו-${colors.glow}`}</span>
                              </button>
                            );
                          })}

                          <button
                            onClick={() => handleAssignPoints('nobody')}
                            className="p-4 bg-slate-900 border border-slate-800 hover:bg-slate-800/80 transition-colors rounded-2xl flex flex-col items-center gap-2 group text-slate-300"
                          >
                            <X size={28} className="text-slate-500 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-sm">אף אחד</span>
                            <span className="text-[10px] text-slate-500">חשיפה באפור</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <h4 className="text-xl font-bold text-amber-400 mb-2">🏆 המשחק הסתיים!</h4>
                      <p className="text-xs text-slate-400">הגענו לסוף כל השאלות.</p>
                    </div>
                  )
                ) : (
                  <div className="space-y-6">
                    <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl text-right space-y-4">
                      <h4 className="text-base font-bold text-emerald-400 border-b border-slate-800 pb-2 flex items-center justify-between">
                        <span>מדריך הכנת השעשועון ב-4 שלבים פשוטים</span>
                        <span className="text-xs text-slate-500">בצע את הצעדים הבאים לפי הסדר</span>
                      </h4>

                      <div className="space-y-4">
                        {/* Step 1 */}
                        <div className="flex items-start gap-3">
                          <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            gameScreenConnected ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                          }`}>1</span>
                          <div className="flex-grow">
                            <h5 className="text-sm font-bold text-slate-200">חיבור מסך ההקרנה (טלוויזיה / מקרן)</h5>
                            <p className="text-xs text-slate-400 mt-0.5">
                              פתחו את הקישור במחשב המחובר לטלוויזיה, בחרו "התחבר לחדר קיים" והזינו את מספר החדר ← "פתח מסך הקרנה 📺".
                            </p>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded mt-2 ${
                              gameScreenConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {gameScreenConnected ? 'מחובר בהצלחה ✅' : 'ממתין לחיבור מסך ההקרנה... ⏳'}
                            </span>
                          </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex items-start gap-3 border-t border-slate-800/60 pt-4">
                          <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            members.length > 0 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                          }`}>2</span>
                          <div className="flex-grow">
                            <h5 className="text-sm font-bold text-slate-200">בניית עץ המשפחה</h5>
                            <p className="text-xs text-slate-400 mt-0.5">
                              היכנס ללשונית "ניהול משפחה" והוסף את כל בני המשפחה (ילדים, נכדים, בני זוג וכו').
                            </p>
                            <div className="flex gap-2 mt-2">
                              <span className="text-[10px] text-slate-400">חברים כרגע: <strong>{members.length}</strong></span>
                              <button 
                                onClick={() => setActiveTab('members')}
                                className="text-[10px] text-emerald-400 hover:underline font-bold"
                              >
                                להוספת בני משפחה ←
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex items-start gap-3 border-t border-slate-800/60 pt-4">
                          <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            questions.length > 0 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                          }`}>3</span>
                          <div className="flex-grow">
                            <h5 className="text-sm font-bold text-slate-200">כתיבת שאלות וציטוטים</h5>
                            <p className="text-xs text-slate-400 mt-0.5">
                              היכנס ללשונית "שאלות וציטוטים" והקלד משפטים מצחיקים שחברי המשפחה אמרו.
                            </p>
                            <div className="flex gap-2 mt-2">
                              <span className="text-[10px] text-slate-400">שאלות כרגע: <strong>{questions.length}</strong></span>
                              <button 
                                onClick={() => setActiveTab('questions')}
                                className="text-[10px] text-emerald-400 hover:underline font-bold"
                              >
                                להוספת שאלות ←
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Step 4 */}
                        <div className="flex items-start gap-3 border-t border-slate-800/60 pt-4">
                          <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            members.length > 0 && questions.length > 0 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                          }`}>4</span>
                          <div className="flex-grow">
                            <h5 className="text-sm font-bold text-slate-200">הפעלת המשחק</h5>
                            <p className="text-xs text-slate-400 mt-0.5">
                              ברגע שהכנסתם את בני המשפחה והשאלות, לחצו על הכפתור למטה כדי להתחיל את השעשועון במסך הגדול!
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-center pt-4">
                      <button
                        onClick={handleStartGame}
                        disabled={members.length === 0 || questions.length === 0}
                        className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 mx-auto hover:from-emerald-400 hover:to-teal-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-950/20"
                      >
                        <Play size={18} fill="currentColor" />
                        <span>הפעל והתחל משחק 🚀</span>
                      </button>
                      {(members.length === 0 || questions.length === 0) && (
                        <p className="text-[10px] text-amber-500/80 mt-2">
                          * יש להוסיף לפחות בן משפחה אחד ושאלה אחת כדי להפעיל את המשחק.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Prev / Next Pagination */}
              {isGameLoaded && (
                <div className="flex justify-between items-center border-t border-slate-800 pt-4 mt-6">
                  <button
                    onClick={handlePrevQuestion}
                    disabled={gameState.currentQuestionIndex === 0}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-xs text-slate-400 font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <ChevronRight size={14} />
                    <span>שאלה קודמת</span>
                  </button>
                  
                  <div className="text-xs text-slate-500">
                    שאלה {gameState.currentQuestionIndex + 1} מתוך {gameState.shuffledQuestionIds.length}
                  </div>

                  <button
                    onClick={handleNextQuestion}
                    disabled={gameState.currentQuestionIndex >= gameState.shuffledQuestionIds.length}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-xs text-slate-400 font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <span>שאלה הבאה</span>
                    <ChevronLeft size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Right side: Scores and Game Session Stats */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
              {/* Scoreboard Monitor */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-800">
                <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">
                  ניקוד נוכחי
                </h3>
                
                <div className={`grid gap-4 ${settings.contestants.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-2 xl:grid-cols-4'}`}>
                  {settings.contestants.map((c, index) => {
                    const colors = CONTESTANT_COLORS[index % CONTESTANT_COLORS.length];
                    return (
                      <div key={c.id} className={`p-4 bg-slate-900 border ${colors.border}/20 rounded-2xl flex flex-col items-center`}>
                        <span className={`text-xs ${colors.text} font-semibold truncate max-w-full`}>{c.name}</span>
                        <div className={`text-3xl md:text-4xl font-extrabold text-slate-200 mt-2`}>
                          {gameState.scores[c.id] || 0}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {isGameLoaded && (
                  <button
                    onClick={handleStartGame}
                    className="w-full mt-4 py-2 border border-slate-800 hover:bg-slate-900 transition-colors text-slate-400 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw size={12} />
                    <span>אפס והתחל משחק מחדש</span>
                  </button>
                )}
              </div>

              {/* Solved Status Sidebar */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex-grow max-h-[300px] overflow-y-auto">
                <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">
                  שאלות שנפתרו:
                </h3>
                {Object.keys(gameState.solvedQuestions).length === 0 ? (
                  <div className="text-slate-600 text-xs text-center py-6">טרם נפתרו שאלות.</div>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {Object.entries(gameState.solvedQuestions).map(([qId, winner]) => {
                      const q = questions.find(item => item.id === qId);
                      const sp = q ? members.find(m => m.id === q.speakerId) : null;
                      return (
                        <li key={qId} className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-slate-900">
                          <span className="truncate max-w-[150px] text-slate-300">
                            {q ? `״${q.text.substr(0, 18)}...״` : 'שאלה'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 font-medium">({sp?.name})</span>
                            {winner ? (
                              winner.split(',').map(wId => {
                                const contestant = settings.contestants.find(c => c.id === wId);
                                const contestantIndex = settings.contestants.findIndex(c => c.id === wId);
                                const colors = CONTESTANT_COLORS[contestantIndex % CONTESTANT_COLORS.length] || { text: 'text-slate-400' };
                                const badgeColorClass = colors.text.replace('text', 'bg') + '/20 ' + colors.text;
                                return (
                                  <span key={wId} className={`px-2 py-0.5 rounded font-bold text-[10px] ${badgeColorClass}`}>
                                    {contestant ? contestant.name : 'מתמודד'}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-800 text-slate-400">
                                אף אחד
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: FAMILY MEMBERS */}
        {activeTab === 'members' && (
          <div className="grid grid-cols-12 gap-6">
            {/* Add Member Form */}
            {/* Add/Edit Member Form */}
            <div className="col-span-12 lg:col-span-4 glass-panel p-6 rounded-3xl border border-slate-800">
              <h3 className="text-lg font-bold mb-4 text-emerald-400">
                {editingMemberId ? 'עריכת בן משפחה קיים' : 'הוספת בן משפחה חדש'}
              </h3>
              <form onSubmit={editingMemberId ? handleSaveEdit : handleAddMember} className="space-y-4">
                
                {/* Name */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">שם פרטי</label>
                  <input
                    type="text"
                    required
                    value={newMember.name}
                    onChange={e => setNewMember({ ...newMember, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                    placeholder="למשל: דניאל"
                  />
                </div>

                {/* Family Name */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">שם משפחה</label>
                  <input
                    type="text"
                    list="existing-family-names"
                    value={newMember.familyName || ''}
                    onChange={e => setNewMember({ ...newMember, familyName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                    placeholder="למשל: צברי"
                  />
                  <datalist id="existing-family-names">
                    {Array.from(new Set(members.map(m => m.familyName).filter(Boolean))).map(name => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>

                {/* Gender */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">מין</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewMember({ ...newMember, gender: 'male' })}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                        newMember.gender === 'male' ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      זכר
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMember({ ...newMember, gender: 'female' })}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                        newMember.gender === 'female' ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      נקבה
                    </button>
                  </div>
                </div>

                {settings.treeLayout !== 'none' && (
                  <>
                    {/* Parent Dropdown */}
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">שם ההורים (המקשר לעץ)</label>
                      <select
                        value={newMember.parentId}
                        onChange={e => setNewMember({ ...newMember, parentId: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">ללא הורה (סבא/סבתא מייסדי המשפחה)</option>
                        
                        {members.some(m => m.generation === 'grandparent') && (
                          <optgroup label="סבים וסבתות (מייסדי המשפחה)">
                            {renderParentOptions('grandparent')}
                          </optgroup>
                        )}
                        
                        {members.some(m => m.generation === 'parent') && (
                          <optgroup label="דור הילדים (בנים ובנות של המייסדים)">
                            {renderParentOptions('parent')}
                          </optgroup>
                        )}
                        
                        {members.some(m => m.generation === 'child') && (
                          <optgroup label="דור הנכדים">
                            {renderParentOptions('child')}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    {/* Spouse Dropdown */}
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">בן/בת זוג (אופציונלי)</label>
                      <select
                        value={newMember.spouseId || ''}
                        onChange={e => setNewMember({ ...newMember, spouseId: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">ללא בן/בת זוג</option>
                        {members
                          .filter(m => m.id !== editingMemberId && (!m.spouseId || m.id === newMember.spouseId))
                          .map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.generation === 'grandparent' ? 'סבא/ת' : m.generation === 'parent' ? 'ילד/ה' : m.generation === 'child' ? 'נכד/ה' : 'נין/ה'})
                            </option>
                          ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Image Upload */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">תמונה (אופציונלי)</label>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden">
                      {newMember.image ? (
                        <img src={newMember.image} alt="תצוגה מקדימה" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={18} className="text-slate-600" />
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleMemberImageUpload}
                      className="hidden"
                      id="member-photo-input"
                    />
                    <label
                      htmlFor="member-photo-input"
                      className="px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors"
                    >
                      <Upload size={14} />
                      <span>העלה תמונה</span>
                    </label>
                    {newMember.image && (
                      <button
                        type="button"
                        onClick={() => setNewMember(prev => ({ ...prev, image: null }))}
                        className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-bold rounded-lg transition-colors"
                      >
                        מחק תמונה
                      </button>
                    )}
                  </div>
                </div>

                {editingMemberId ? (
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-grow py-2 bg-emerald-500 text-slate-950 font-bold text-sm rounded-xl hover:bg-emerald-400 transition-colors flex items-center justify-center gap-1"
                    >
                      <Check size={16} />
                      <span>שמור שינויים</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white font-bold text-sm rounded-xl transition-colors"
                    >
                      בטל עריכה
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    className="w-full py-2 bg-emerald-500 text-slate-950 font-bold text-sm rounded-xl hover:bg-emerald-400 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus size={16} />
                    <span>הוסף לעץ המשפחתי</span>
                  </button>
                )}
              </form>
            </div>

            {/* Members List Table */}
            <div className="col-span-12 lg:col-span-8 glass-panel p-6 rounded-3xl border border-slate-800 max-h-[600px] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4 text-emerald-400 flex justify-between items-center">
                <span>רשימת בני משפחה ({members.length})</span>
                <span className="text-xs text-slate-500">עריכה ומחיקת נתונים</span>
              </h3>

              {members.length === 0 ? (
                <div className="text-center py-12 text-slate-600">אין בני משפחה רשומים. ייבא מקובץ Excel או הוסף ידנית.</div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-right text-xs">
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-2 font-bold w-12">תמונה</th>
                      <th className="pb-2 font-bold">שם</th>
                      {settings.treeLayout !== 'none' && <th className="pb-2 font-bold">דור</th>}
                      {settings.treeLayout !== 'none' && <th className="pb-2 font-bold">הורה שמופה</th>}
                      <th className="pb-2 font-bold w-16 text-center">פעולות</th>
                    </tr>
                  <tbody className="divide-y divide-slate-900">
                    {members.map(m => {
                      const isEditing = m.id === editingMemberId;
                      const parent = members.find(p => p.id === m.parentId);
                      
                      return (
                        <tr
                          key={m.id}
                          className={`hover:bg-slate-900/40 transition-colors ${
                            isEditing ? 'bg-emerald-950/20 border-y border-emerald-500/30' : ''
                          }`}
                        >
                          <td className="py-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                              {m.image ? (
                                <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-lg select-none font-normal">
                                  {m.gender === 'female' ? (
                                    m.generation === 'grandparent' ? '👵' :
                                    m.generation === 'parent' ? '👩' :
                                    m.generation === 'child' ? '👧' : '👶'
                                  ) : (
                                    m.generation === 'grandparent' ? '👴' :
                                    m.generation === 'parent' ? '👨' :
                                    m.generation === 'child' ? '👦' : '👶'
                                  )}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 font-bold text-slate-200">
                            <div>
                              <div className="font-bold">{m.name}</div>
                              {m.familyName && <div className="text-[10px] text-slate-400">{m.familyName}</div>}
                            </div>
                          </td>
                          {settings.treeLayout !== 'none' && (
                            <td className="py-2.5 text-slate-400">
                              {m.generation === 'grandparent' ? 'סבא/סבתא' :
                               m.generation === 'parent' ? 'ילד/ה' :
                               m.generation === 'child' ? 'נכד/ה' : 'נין/ה'}
                            </td>
                          )}
                          {settings.treeLayout !== 'none' && (
                            <td className="py-2.5 text-emerald-400 font-semibold">
                              {parent ? parent.name : '-'}
                            </td>
                          )}
                          <td className="py-2.5 text-center">
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => handleStartEdit(m)}
                                className={`p-1 rounded transition-colors ${
                                  isEditing
                                    ? 'text-slate-950 bg-emerald-500 hover:bg-emerald-400'
                                    : 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20'
                                }`}
                                title="ערוך"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteMember(m.id)}
                                className="p-1 text-rose-500 hover:text-rose-400 bg-rose-500/10 rounded hover:bg-rose-500/20 transition-colors"
                                title="מחק"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: QUESTIONS */}
        {activeTab === 'questions' && (
          <div className="grid grid-cols-12 gap-6">
            
            {/* Add Question Form */}
            <div className="col-span-12 lg:col-span-5 glass-panel p-6 rounded-3xl border border-slate-800">
              <h3 className="text-lg font-bold mb-4 text-emerald-400">הוספת שאלה (ציטוט)</h3>
              <form onSubmit={handleAddQuestion} className="space-y-4">
                
                {/* Text/Quote */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">המשפט / הציטוט</label>
                  <textarea
                    required
                    value={newQuestion.text}
                    onChange={e => setNewQuestion({ ...newQuestion, text: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-emerald-500 min-h-[80px]"
                    placeholder="למשל: סבא תמיד מביא לי ממתק מוחבא..."
                  />
                </div>

                {/* Speaker Dropdown */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">מי אמר את זה? (הדובר)</label>
                  <select
                    required
                    value={newQuestion.speakerId}
                    onChange={e => setNewQuestion({ ...newQuestion, speakerId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- בחר את בן המשפחה --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.generation === 'grandparent' ? 'סבא/ת' : m.generation === 'parent' ? 'ילד/ה' : m.generation === 'child' ? 'נכד/ה' : 'נין/ה'})
                      </option>
                    ))}
                  </select>
                </div>


                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-500 text-slate-950 font-bold text-sm rounded-xl hover:bg-emerald-400 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus size={16} />
                  <span>הוסף שאלת משחק</span>
                </button>
              </form>
            </div>

            {/* Questions List */}
            <div className="col-span-12 lg:col-span-7 glass-panel p-6 rounded-3xl border border-slate-800 max-h-[600px] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4 text-emerald-400">
                מאגר שאלות המשחק ({questions.length})
              </h3>

              {questions.length === 0 ? (
                <div className="text-center py-12 text-slate-600">אין שאלות במאגר. ייבא מ-Excel או הוסף ידנית.</div>
              ) : (
                <div className="space-y-3">
                  {questions.map(q => {
                    const sp = members.find(m => m.id === q.speakerId);
                    return (
                      <div key={q.id} className="bg-slate-900 border border-slate-800/80 p-4 rounded-2xl flex justify-between items-center group">
                        <div className="overflow-hidden mr-2">
                          <blockquote className="text-sm font-bold italic truncate text-slate-200">
                            ״{q.text}״
                          </blockquote>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            אומר: <strong className="text-emerald-400 font-semibold">{sp ? sp.name : 'לא משויך'}</strong>
                          </span>
                        </div>

                        <div className="flex gap-2 flex-shrink-0">
                          
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-400 bg-rose-500/10 rounded-lg hover:bg-rose-500/20 transition-colors"
                            title="מחק"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 4: SETTINGS & STYLING */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-12 gap-6">
            {/* Game settings & tree layout selection */}
            <div className="col-span-12 glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
              <h3 className="text-lg font-bold text-emerald-400">הגדרות המשחק</h3>
              
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-semibold">שם מנחה המשחק (השם המופיע במסך ההקרנה ובבקרת המנחה)</label>
                <input
                  type="text"
                  value={settings.hostName || ''}
                  onChange={(e) => updateSettings({ ...settings, hostName: e.target.value })}
                  placeholder="הקלד שם מנחה (לדוגמה: אלי, אמא)"
                  className="w-full max-w-md bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-2 font-semibold">סוג תצוגת לוח המשחק (מצב עץ יוחסין)</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => updateSettings({ ...settings, treeLayout: 'traditional' })}
                    className={`py-2.5 px-4 text-xs font-bold rounded-xl border transition-all flex justify-center items-center gap-2 ${
                      settings.treeLayout === 'traditional'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🌳 עץ יוחסין מסורתי</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => updateSettings({ ...settings, treeLayout: 'botanical' })}
                    className={`py-2.5 px-4 text-xs font-bold rounded-xl border transition-all flex justify-center items-center gap-2 ${
                      settings.treeLayout === 'botanical'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🌸 עץ יוחסין בוטני</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateSettings({ ...settings, treeLayout: 'none' })}
                    className={`py-2.5 px-4 text-xs font-bold rounded-xl border transition-all flex justify-center items-center gap-2 ${
                      settings.treeLayout === 'none'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>📋 ללא עץ יוחסין (רשימה)</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  * מצב ללא עץ מסתיר את שדות ההורים ובני הזוג בניהול ומציג כרטיסיית חשיפת דובר יוקרתית במסך המשחק.
                </p>
              </div>

              <div className="border-t border-slate-800 pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-sm text-slate-200">פרטי המתמודדים במשחק ({settings.contestants.length})</h4>
                  {settings.contestants.length < 4 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newId = `contestant_${Math.random().toString(36).substr(2, 9)}`;
                        const updated = [
                          ...settings.contestants,
                          { id: newId, name: `מתמודד/ת ${settings.contestants.length + 1}`, image: null }
                        ];
                        updateSettings({ ...settings, contestants: updated });
                      }}
                      className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <Plus size={14} />
                      <span>הוסף מתמודד</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {settings.contestants.map((c, index) => {
                    const colors = CONTESTANT_COLORS[index % CONTESTANT_COLORS.length];
                    return (
                      <div key={c.id} className="p-4 bg-slate-905/40 border border-slate-800 rounded-2xl space-y-4 relative group">
                        {settings.contestants.length > 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = settings.contestants.filter(item => item.id !== c.id);
                              updateSettings({ ...settings, contestants: updated });
                            }}
                            className="absolute top-3 left-3 p-1.5 text-rose-500 hover:text-rose-400 bg-rose-500/10 rounded-lg transition-colors"
                            title="הסר מתמודד"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}

                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${colors.text.replace('text', 'bg')}`}></span>
                          <h5 className="font-bold text-xs text-slate-200">מתמודד {index + 1}</h5>
                        </div>

                        <div className="grid grid-cols-12 gap-3 items-center">
                          <div className="col-span-8">
                            <label className="text-[10px] text-slate-400 block mb-1">שם השחקן/מתמודד</label>
                            <input
                              type="text"
                              value={c.name}
                              onChange={e => {
                                const updated = settings.contestants.map(item =>
                                  item.id === c.id ? { ...item, name: e.target.value } : item
                                );
                                // Keep grandpaName and grandmaName synced for backward compatibility
                                let grandpaName = settings.grandpaName;
                                let grandmaName = settings.grandmaName;
                                if (index === 0) grandpaName = e.target.value;
                                if (index === 1) grandmaName = e.target.value;

                                updateSettings({ 
                                  ...settings, 
                                  contestants: updated,
                                  grandpaName,
                                  grandmaName
                                });
                              }}
                              className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="col-span-4">
                            <label className="text-[10px] text-slate-400 block mb-1">תמונה</label>
                            <div className="flex items-center gap-2">
                              <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden">
                                {c.image ? (
                                  <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[9px] text-slate-600">ללא</span>
                                )}
                              </div>
                              <input
                                type="file"
                                accept="image/*"
                                id={`settings-img-${c.id}`}
                                className="hidden"
                                onChange={e => handleSettingsImageUpload(e, c.id)}
                              />
                              <label
                                htmlFor={`settings-img-${c.id}`}
                                className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[9px] font-bold cursor-pointer hover:bg-slate-800 text-slate-300"
                              >
                                החלף
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 5: EXCEL IMPORT/EXPORT & BACKUPS */}
        {activeTab === 'import' && (
          <div className="grid grid-cols-12 gap-6">
            
            {/* Excel Sheet import cards */}
            <div className="col-span-7 glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
              <h3 className="text-lg font-bold text-emerald-400">ייבוא מהיר מקובצי Excel</h3>
              
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-200">1. הורד תבנית Excel לדוגמה</h4>
                  <p className="text-[10px] text-slate-400 mt-1">בחר את התבנית בהתאם למצב התצוגה של המשחק. מצב רשימה לא ידרוש מילוי הורים ובני זוג.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExcelTemplateDownload('list')}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] rounded-xl flex items-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <Download size={12} />
                    <span>תבנית רשימה (ללא עץ)</span>
                  </button>
                  <button
                    onClick={() => handleExcelTemplateDownload('tree')}
                    className="px-3 py-2 bg-emerald-500 text-slate-950 font-bold text-[10px] rounded-xl flex items-center gap-1.5 hover:bg-emerald-400 transition-colors"
                  >
                    <Download size={12} />
                    <span>תבנית עץ יוחסין</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Import Members */}
                <div className="p-4 border border-slate-800 rounded-2xl bg-slate-900/40 text-center">
                  <span className="text-2xl block mb-2">👥</span>
                  <h4 className="text-xs font-bold text-slate-200 mb-1">ייבוא עץ משפחה</h4>
                  <p className="text-[9px] text-slate-500 mb-4">העלה קובץ עם עמודות שם, דור, שם הורה, ומין</p>
                  
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    id="excel-members-input"
                    className="hidden"
                    onChange={handleImportMembersExcel}
                  />
                  <label
                    htmlFor="excel-members-input"
                    className="px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-bold rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Upload size={12} />
                    <span>בחר קובץ בני משפחה</span>
                  </label>
                </div>

                {/* Import Questions */}
                <div className="p-4 border border-slate-800 rounded-2xl bg-slate-900/40 text-center">
                  <span className="text-2xl block mb-2">❓</span>
                  <h4 className="text-xs font-bold text-slate-200 mb-1">ייבוא שאלות משחק</h4>
                  <p className="text-[9px] text-slate-500 mb-4">העלה קובץ המכיל עמודות של משפט ומי אמר</p>
                  
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    id="excel-questions-input"
                    className="hidden"
                    onChange={handleImportQuestionsExcel}
                  />
                  <label
                    htmlFor="excel-questions-input"
                    className="px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-bold rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Upload size={12} />
                    <span>בחר קובץ שאלות</span>
                  </label>
                </div>
              </div>

              {/* Show warning messages log if exist */}
              {warnings.length > 0 && (
                <div className="p-4 bg-amber-950/20 border border-amber-500/20 rounded-2xl text-xs space-y-1">
                  <h5 className="font-bold text-amber-400">דוח ייבוא (התראות):</h5>
                  <div className="max-h-[100px] overflow-y-auto space-y-1 pr-1 font-mono text-[10px]">
                    {warnings.map((w, idx) => (
                      <div key={idx} className="text-amber-300">• {w}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* JSON Full System Backups */}
            <div className="col-span-5 glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
              <h3 className="text-lg font-bold text-emerald-400">גיבוי ושחזור מלא (JSON)</h3>
              <p className="text-xs text-slate-400">
                ייצא את כל המשחק המוגדר (אנשים, תמונות, שאלות, הגדרות) לקובץ גיבוי יחיד שניתן לטעון בכל מחשב אחר בשניות.
              </p>

              <div className="space-y-4 pt-2">
                {/* Export backup */}
                <button
                  onClick={handleExportBackup}
                  className="w-full py-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Download size={14} />
                  <span>ייצא קובץ גיבוי מלא (.json)</span>
                </button>

                {/* Import backup */}
                <div className="border border-slate-800 border-dashed p-4 rounded-xl text-center bg-slate-900/20">
                  <span className="text-xs text-slate-500 block mb-3">לשחזור והעלאת קובץ גיבוי קיים:</span>
                  <input
                    type="file"
                    accept=".json"
                    id="json-backup-input"
                    className="hidden"
                    onChange={handleImportBackup}
                  />
                  <label
                    htmlFor="json-backup-input"
                    className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-bold rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Upload size={12} />
                    <span>בחר קובץ גיבוי לשחזור</span>
                  </label>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 6: FAMILY STATISTICS */}
        {activeTab === 'stats' && (
          <div className="glass-panel p-6 rounded-3xl border border-slate-800">
            <h3 className="text-lg font-bold mb-6 text-emerald-400">סטטיסטיקת משפחות</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="pb-3 font-bold">שם משפחה</th>
                    <th className="pb-3 font-bold">מס׳ מבוגרים</th>
                    <th className="pb-3 font-bold">מס׳ ילדים</th>
                    <th className="pb-3 font-bold">סה״כ נפשות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {Object.entries(familyStats).map(([familyName, stats]) => (
                    <tr key={familyName} className="hover:bg-slate-900/40">
                      <td className="py-3 font-bold text-slate-200">{familyName}</td>
                      <td className="py-3 text-slate-400">{stats.adults}</td>
                      <td className="py-3 text-slate-400">{stats.children}</td>
                      <td className="py-3 font-bold text-emerald-400">{stats.total}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-700 font-bold">
                    <td className="py-3 text-emerald-400">סה״כ</td>
                    <td className="py-3 text-slate-300">
                      {Object.values(familyStats).reduce((sum, s) => sum + s.adults, 0)}
                    </td>
                    <td className="py-3 text-slate-300">
                      {Object.values(familyStats).reduce((sum, s) => sum + s.children, 0)}
                    </td>
                    <td className="py-3 text-emerald-400 text-lg">
                      {Object.values(familyStats).reduce((sum, s) => sum + s.total, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};
