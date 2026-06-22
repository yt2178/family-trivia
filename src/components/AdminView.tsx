import React, { useState, useEffect, useRef } from 'react';
import { db, FamilyMember, GameSettings, GameState, TriviaQuestion } from '../utils/db';
import { sync } from '../utils/sync';
import { excelHelper } from '../utils/excelHelper';
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
  Pencil
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

export const AdminView: React.FC = () => {
  // Tabs: 'control' | 'members' | 'questions' | 'settings' | 'import' | 'stats'
  const [activeTab, setActiveTab] = useState<'control' | 'members' | 'questions' | 'settings' | 'import' | 'stats'>('control');

  // Core Data State
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [settings, setSettings] = useState<GameSettings>(db.getSettings());
  const [gameState, setGameState] = useState<GameState>(db.getGameState());

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

  // Load Data
  useEffect(() => {
    const loadedMembers = db.getMembers();
    const loadedQuestions = db.getQuestions();
    const loadedSettings = db.getSettings();
    setMembers(loadedMembers);
    setQuestions(loadedQuestions);
    setSettings(loadedSettings);
    setGameState(db.getGameState());

    // Broadcast initial database state
    sync.sendMessage({
      type: 'DATABASE_SYNC',
      members: loadedMembers,
      questions: loadedQuestions,
      settings: loadedSettings
    });
  }, []);

  // Listen to remote client database requests
  useEffect(() => {
    const unsubscribe = sync.subscribe((msg) => {
      if (msg.type === 'REQUEST_DATABASE') {
        sync.sendMessage({
          type: 'DATABASE_SYNC',
          members: db.getMembers(),
          questions: db.getQuestions(),
          settings: db.getSettings()
        });
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
    sync.sendMessage({ type: 'SETTINGS_CHANGED', settings: newSettings });
    sync.sendMessage({ type: 'DATABASE_SYNC', members, questions, settings: newSettings });
  };

  // --- GAME CONTROLLER ACTIONS ---
  const handleStartGame = () => {
    const freshState = db.resetGame();
    updateGameState(freshState);
    showSuccess('המשחק אותחל וערבוב השאלות הושלם בהצלחה!');
  };

  const handleNextQuestion = () => {
    const total = gameState.shuffledQuestionIds.length;
    if (gameState.currentQuestionIndex < total) {
      const nextIndex = gameState.currentQuestionIndex + 1;
      const updated = {
        ...gameState,
        currentQuestionIndex: nextIndex,
        isRevealed: false,
      };
      updateGameState(updated);
    }
  };

  const handlePrevQuestion = () => {
    if (gameState.currentQuestionIndex > 0) {
      const prevIndex = gameState.currentQuestionIndex - 1;
      const updated = {
        ...gameState,
        currentQuestionIndex: prevIndex,
        isRevealed: false,
      };
      updateGameState(updated);
    }
  };

  const handleRevealAnswer = () => {
    updateGameState({
      ...gameState,
      isRevealed: true,
    });
  };

  const handleAssignPoints = (winner: 'grandpa' | 'grandma' | 'nobody') => {
    const currentQId = gameState.shuffledQuestionIds[gameState.currentQuestionIndex];
    if (!currentQId) return;

    const newScores = { ...gameState.scores };
    if (winner === 'grandpa') newScores.grandpa += 1;
    if (winner === 'grandma') newScores.grandma += 1;

    // Update solved questions mapping
    const newSolved = { ...gameState.solvedQuestions, [currentQId]: winner };

    const updatedState = {
      ...gameState,
      scores: newScores,
      solvedQuestions: newSolved,
      isRevealed: true, // Auto-reveal
    };

    updateGameState(updatedState);
    
    // Trigger confetti on the projector!
    sync.sendMessage({ type: 'TRIGGER_CONFETTI', winner });
  };



  // --- FAMILY MEMBER ACTIONS ---
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!newMember.name.trim()) {
      alert('נא להזין שם לבן המשפחה');
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

    // Automatically calculate generation based on parentId
    let generation: FamilyMember['generation'] = 'grandparent';
    if (newMember.parentId) {
      const parent = members.find(m => m.id === newMember.parentId);
      if (parent) {
        if (parent.generation === 'grandparent') generation = 'parent';
        else if (parent.generation === 'parent') generation = 'child';
        else if (parent.generation === 'child') generation = 'grandchild';
        else generation = 'great-grandchild';
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

    // If spouseId is specified, we must set the spouse's spouseId to this member's ID!
    if (spouseId) {
      updated = updated.map(m => {
        if (m.id === spouseId) {
          return { ...m, spouseId: id };
        }
        return m;
      });
      // Copy parentId from spouse to keep them grouped under the same parent
      const spouseNode = members.find(m => m.id === spouseId);
      if (spouseNode && spouseNode.parentId) {
        memberToAdd.parentId = spouseNode.parentId;
      }
    }

    setMembers(updated);
    db.saveMembers(updated);
    sync.sendMessage({ type: 'DATABASE_SYNC', members: updated, questions, settings });
    
    setNewMember({
      name: '',
      generation: 'grandchild',
      parentId: '',
      image: null,
      gender: 'male',
      familyName: '',
      spouseId: '',
    });
    showSuccess('בן המשפחה נוסף בהצלחה!');
  };

  const handleDeleteMember = (id: string) => {
    const updated = members.filter(m => m.id !== id);
    // Also clean parent pointers
    const cleaned = updated.map(m => m.parentId === id ? { ...m, parentId: null } : m);
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

    // Recalculate generation based on parentId
    let generation: FamilyMember['generation'] = 'grandparent';
    if (newMember.parentId) {
      const parent = members.find(p => p.id === newMember.parentId);
      if (parent) {
        if (parent.generation === 'grandparent') generation = 'parent';
        else if (parent.generation === 'parent') generation = 'child';
        else if (parent.generation === 'child') generation = 'grandchild';
        else generation = 'great-grandchild';
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

    // Set new spouse relationship
    if (spouseId) {
      updated = updated.map(m => {
        if (m.id === spouseId) {
          return { ...m, spouseId: editingMemberId };
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
    
    if (!newQuestion.speakerId) {
      alert('נא לבחור מי אמר את המשפט');
      return;
    }

    const id = 'q_' + Math.random().toString(36).substr(2, 9);
    const questionToAdd: TriviaQuestion = {
      id,
      text: newQuestion.text.trim(),
      speakerId: newQuestion.speakerId
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
        sync.sendMessage({ type: 'DATABASE_SYNC', members, questions: result.questions, settings });
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
  const handleSettingsImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, role: 'grandpa' | 'grandma') => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64);
      if (role === 'grandpa') {
        updateSettings({ ...settings, grandpaImage: compressed });
      } else {
        updateSettings({ ...settings, grandmaImage: compressed });
      }
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
      <header className="flex justify-between items-center border-b border-slate-800 pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-50 flex items-center gap-2">
            <span>לוח בקרת מנחה (Admin)</span>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded">
              מחובר להקרנה
            </span>
          </h1>
          <p className="text-xs text-slate-400">שלוט במשחק המוקרן על מסך גדול בזמן אמת</p>
          <div className="flex gap-3 mt-2 text-xs text-slate-400 font-medium">
            <span>סה״כ צאצאים בעץ: <strong className="text-emerald-400">85</strong></span>
            <span>|</span>
            <span>ילדים ונכדים: <strong className="text-emerald-400">55</strong></span>
            <span>|</span>
            <span>נינים: <strong className="text-emerald-400">30</strong></span>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
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
            <span>ניהול משפחה</span>
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
            <span>ערכות נושא</span>
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
            <div className="col-span-8 flex flex-col justify-between glass-panel p-6 rounded-3xl border border-slate-800">
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
                        <div className="grid grid-cols-3 gap-4">
                          <button
                            onClick={() => handleAssignPoints('grandpa')}
                            className="p-4 bg-sky-950/40 border border-sky-500/40 hover:bg-sky-900/40 transition-colors rounded-2xl flex flex-col items-center gap-2 group text-sky-100"
                          >
                            <Check size={28} className="text-sky-400 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-sm">{settings.grandpaName} צדק!</span>
                            <span className="text-[10px] text-sky-400/80">+1 נקודה וכחול Glow</span>
                          </button>
                          
                          <button
                            onClick={() => handleAssignPoints('grandma')}
                            className="p-4 bg-fuchsia-950/40 border border-fuchsia-500/40 hover:bg-fuchsia-900/40 transition-colors rounded-2xl flex flex-col items-center gap-2 group text-fuchsia-100"
                          >
                            <Check size={28} className="text-fuchsia-400 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-sm">{settings.grandmaName} צדקה!</span>
                            <span className="text-[10px] text-fuchsia-400/80">+1 נקודה וסגול Glow</span>
                          </button>

                          <button
                            onClick={() => handleAssignPoints('nobody')}
                            className="p-4 bg-slate-900 border border-slate-800 hover:bg-slate-800/80 transition-colors rounded-2xl flex flex-col items-center gap-2 group text-slate-300"
                          >
                            <X size={28} className="text-slate-500 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-sm">אף אחד לא צדק</span>
                            <span className="text-[10px] text-slate-500">חשיפת התשובה באפור</span>
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
                  <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800/60 border-dashed">
                    <p className="text-sm text-slate-400 mb-4">לחץ על הכפתור כדי להתחיל לנגן את השאלות במקרן</p>
                    <button
                      onClick={handleStartGame}
                      className="px-6 py-3 bg-emerald-500 text-slate-950 font-bold rounded-xl flex items-center gap-2 mx-auto hover:bg-emerald-400 transition-colors shadow-lg"
                    >
                      <Play size={18} fill="currentColor" />
                      <span>התחל משחק חדש</span>
                    </button>
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
            <div className="col-span-4 flex flex-col gap-6">
              {/* Scoreboard Monitor */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-800">
                <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">
                  ניקוד נוכחי
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-sky-950/20 border border-sky-500/20 rounded-2xl flex flex-col items-center">
                    <span className="text-xs text-sky-400 font-semibold">{settings.grandpaName}</span>
                    <div className="text-4xl font-extrabold text-sky-200 mt-2">{gameState.scores.grandpa}</div>
                  </div>
                  
                  <div className="p-4 bg-fuchsia-950/20 border border-fuchsia-500/20 rounded-2xl flex flex-col items-center">
                    <span className="text-xs text-fuchsia-400 font-semibold">{settings.grandmaName}</span>
                    <div className="text-4xl font-extrabold text-fuchsia-200 mt-2">{gameState.scores.grandma}</div>
                  </div>
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
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              winner === 'grandpa' ? 'bg-sky-500/20 text-sky-400' :
                              winner === 'grandma' ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {winner === 'grandpa' ? 'סבא' : winner === 'grandma' ? 'סבתא' : 'אף אחד'}
                            </span>
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
            <div className="col-span-4 glass-panel p-6 rounded-3xl border border-slate-800">
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
            <div className="col-span-8 glass-panel p-6 rounded-3xl border border-slate-800 max-h-[600px] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4 text-emerald-400 flex justify-between items-center">
                <span>רשימת בני משפחה ({members.length})</span>
                <span className="text-xs text-slate-500">עריכה ומחיקת נתונים</span>
              </h3>

              {members.length === 0 ? (
                <div className="text-center py-12 text-slate-600">אין בני משפחה רשומים. ייבא מקובץ Excel או הוסף ידנית.</div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-2 font-bold w-12">תמונה</th>
                      <th className="pb-2 font-bold">שם</th>
                      <th className="pb-2 font-bold">דור</th>
                      <th className="pb-2 font-bold">הורה שמופה</th>
                      <th className="pb-2 font-bold w-16 text-center">פעולות</th>
                    </tr>
                  </thead>
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
                          <td className="py-2.5 text-slate-400">
                            {m.generation === 'grandparent' ? 'סבא/סבתא' :
                             m.generation === 'parent' ? 'ילד/ה' :
                             m.generation === 'child' ? 'נכד/ה' : 'נין/ה'}
                          </td>
                          <td className="py-2.5 text-emerald-400 font-semibold">
                            {parent ? parent.name : '-'}
                          </td>
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
              )}
            </div>
          </div>
        )}

        {/* TAB 3: QUESTIONS */}
        {activeTab === 'questions' && (
          <div className="grid grid-cols-12 gap-6">
            
            {/* Add Question Form */}
            <div className="col-span-5 glass-panel p-6 rounded-3xl border border-slate-800">
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
            <div className="col-span-7 glass-panel p-6 rounded-3xl border border-slate-800 max-h-[600px] overflow-y-auto">
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
            {/* Player details */}
            <div className="col-span-12 glass-panel p-6 rounded-3xl border border-slate-800">
              <h3 className="text-lg font-bold mb-4 text-emerald-400">פרטי המתחרים (סבא וסבתא)</h3>
              
              <div className="grid grid-cols-2 gap-6">
                {/* Grandpa settings */}
                <div className="p-4 bg-sky-950/20 border border-sky-500/20 rounded-2xl space-y-4">
                  <h4 className="font-bold text-sm text-sky-400">הגדרות סבא</h4>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">שם השחקן</label>
                    <input
                      type="text"
                      value={settings.grandpaName}
                      onChange={e => updateSettings({ ...settings, grandpaName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-sky-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">תמונת סבא</label>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden">
                        {settings.grandpaImage ? (
                          <img src={settings.grandpaImage} alt="סבא" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-sky-500">ללא</span>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        id="grandpa-settings-img"
                        className="hidden"
                        onChange={e => handleSettingsImageUpload(e, 'grandpa')}
                      />
                      <label
                        htmlFor="grandpa-settings-img"
                        className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-slate-800"
                      >
                        החלף
                      </label>
                    </div>
                  </div>
                </div>

                {/* Grandma settings */}
                <div className="p-4 bg-fuchsia-950/20 border border-fuchsia-500/20 rounded-2xl space-y-4">
                  <h4 className="font-bold text-sm text-fuchsia-400">הגדרות סבתא</h4>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">שם השחקן</label>
                    <input
                      type="text"
                      value={settings.grandmaName}
                      onChange={e => updateSettings({ ...settings, grandmaName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-fuchsia-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">תמונת סבתא</label>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden">
                        {settings.grandmaImage ? (
                          <img src={settings.grandmaImage} alt="סבתא" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-fuchsia-500">ללא</span>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        id="grandma-settings-img"
                        className="hidden"
                        onChange={e => handleSettingsImageUpload(e, 'grandma')}
                      />
                      <label
                        htmlFor="grandma-settings-img"
                        className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-slate-800"
                      >
                        החלף
                      </label>
                    </div>
                  </div>
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
              
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-slate-200">1. הורד תבנית Excel לדוגמה</h4>
                  <p className="text-[10px] text-slate-400 mt-1">מלא את בני המשפחה והשאלות בדיוק לפי העמודות בעברית</p>
                </div>
                <button
                  onClick={handleExcelTemplateDownload}
                  className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 hover:bg-emerald-400 transition-colors"
                >
                  <Download size={14} />
                  <span>הורד תבנית Excel</span>
                </button>
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
