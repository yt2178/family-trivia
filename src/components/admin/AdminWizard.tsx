import React from 'react';
import { useAdmin } from './AdminContext';
import { excelHelper } from '../../utils/excelHelper';
import { sync } from '../../utils/sync';
import {
  Settings,
  Play,
  Check,
  X,
  Plus,
  Trash2,
  Download,
  Upload,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Tv
} from 'lucide-react';

export const AdminWizard: React.FC = () => {
  const {
    settings,
    members,
    questions,
    gameState,
    gameScreenConnected,
    newMember,
    setNewMember,
    newQuestion,
    setNewQuestion,
    editingMemberId,
    wizardHostName,
    setWizardHostName,
    wizardTreeLayout,
    setWizardTreeLayout,
    wizardContestantCount,
    setWizardContestantCount,
    wizardQuestionTimer,
    setWizardQuestionTimer,
    wizardContestants,
    setWizardContestants,
    wizardStepLocal,
    setWizardStepLocal,
    adminSubMode,
    setAdminSubMode,
    showSuccessScreen,
    setShowSuccessScreen,
    wizardConfirmModal,
    setWizardConfirmModal,
    showMidSetupNotice,
    setShowMidSetupNotice,
    updateSettings,
    handleAddMember,
    handleDeleteMember,
    handleAddQuestion,
    handleDeleteQuestion,
    handleImportMembersExcel,
    handleImportQuestionsExcel,
    setMembers,
    setQuestions,
    showSuccess,
    copyToClipboard,
    saveDraftToLocalStorage
  } = useAdmin();

  const roomCode = sync.getRoomCode() || '';

  const handleWizardContestantCountChange = (count: number) => {
    setWizardContestantCount(count);
    saveDraftToLocalStorage(wizardHostName, wizardTreeLayout, count, wizardContestants, wizardQuestionTimer, currentStep);
  };

  const handleWizardContestantNameChange = (index: number, name: string) => {
    const updated = [...wizardContestants];
    if (updated[index]) {
      updated[index] = { ...updated[index], name };
      setWizardContestants(updated);
      saveDraftToLocalStorage(wizardHostName, wizardTreeLayout, wizardContestantCount, updated, wizardQuestionTimer, currentStep);
    }
  };

  // Convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Compress image to save LocalStorage quota
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

  const handleWizardContestantImageChange = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        const compressed = await compressImage(base64);
        const updated = [...wizardContestants];
        if (updated[index]) {
          updated[index] = { ...updated[index], image: compressed };
          setWizardContestants(updated);
          saveDraftToLocalStorage(wizardHostName, wizardTreeLayout, wizardContestantCount, updated, wizardQuestionTimer, currentStep);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleRemoveContestantImage = (index: number) => {
    const updated = [...wizardContestants];
    if (updated[index]) {
      updated[index] = { ...updated[index], image: null };
      setWizardContestants(updated);
      saveDraftToLocalStorage(wizardHostName, wizardTreeLayout, wizardContestantCount, updated, wizardQuestionTimer, currentStep);
    }
  };

  // Use context handlers directly for Excel import in wizard steps
  const handleWizardImportMembers = handleImportMembersExcel;
  const handleWizardImportQuestions = handleImportQuestionsExcel;

  const currentStep = wizardStepLocal || settings.wizardStep || 1;

  const proceedToStep = (nextStep: number) => {
    setWizardStepLocal(nextStep);
    const activeContestants = wizardContestants.slice(0, wizardContestantCount);
    updateSettings({
      ...settings,
      hostName: wizardHostName,
      treeLayout: wizardTreeLayout,
      contestants: activeContestants,
      grandpaName: activeContestants[0]?.name || 'כחול',
      grandmaName: activeContestants[1]?.name || 'סגול',
      grandpaImage: activeContestants[0]?.image || null,
      grandmaImage: activeContestants[1]?.image || null,
      questionTimer: wizardQuestionTimer,
      wizardStep: nextStep
    });
    saveDraftToLocalStorage(wizardHostName, wizardTreeLayout, wizardContestantCount, wizardContestants, wizardQuestionTimer, nextStep);
  };

  const handleNext = () => {
    const nextStep = currentStep + 1;

    if (currentStep === 1) {
      if (!wizardHostName.trim()) {
        alert('נא להזין שם מנחה');
        return;
      }
      proceedToStep(nextStep);
      return;
    }

    if (currentStep === 2) {
      const defaultNames = ['כחול', 'סגול', 'ירוק', 'כתום'];
      const isDefault = wizardContestants.slice(0, wizardContestantCount).every(
        (c, idx) => c.name === defaultNames[idx]
      );
      if (isDefault) {
        setWizardConfirmModal({
          message: "לא בוצע שינוי בשמות המתמודדים. נאשר אותם לפי ברירת המחדל (כחול וסגול). תמיד ניתן יהיה לערוך זאת שוב בהמשך.\n\nהאם להמשיך?",
          onConfirm: () => {
            setWizardConfirmModal(null);
            proceedToStep(nextStep);
          }
        });
        return;
      }
    }

    if (currentStep === 3) {
      if (members.length === 0) {
        setWizardConfirmModal({
          message: "⚠️ שים לב: לא נוספו כרגע שחקנים. אפשר יהיה תמיד להוסיף שחקנים בהמשך דרך ממשק עריכת החדר (בוויזארד).\n\nאו שתוכלו להוריד פה את קובץ האקסל לדוגמה, למלא אותו ולהעלות אותו בהמשך:",
          showExcelDownload: 'players',
          onConfirm: () => {
            setWizardConfirmModal(null);
            proceedToStep(nextStep);
          }
        });
        return;
      }
    }

    if (currentStep === 4) {
      if (questions.length === 0) {
        setWizardConfirmModal({
          message: "⚠️ שים לב: לא נוספו כרגע שאלות. אפשר יהיה תמיד להוסיף שאלות בהמשך דרך ממשק עריכת החדר (בוויזארד).\n\nאו שתוכלו להוריד פה את קובץ האקסל לדוגמה, למלא אותו ולהעלות אותו בהמשך:",
          showExcelDownload: 'questions',
          onConfirm: () => {
            setWizardConfirmModal(null);
            proceedToStep(nextStep);
          }
        });
        return;
      }
    }

    if (currentStep < 6) {
      proceedToStep(nextStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setWizardStepLocal(prevStep);

      const activeContestants = wizardContestants.slice(0, wizardContestantCount);
      updateSettings({
        ...settings,
        hostName: wizardHostName,
        treeLayout: wizardTreeLayout,
        contestants: activeContestants,
        grandpaName: activeContestants[0]?.name || 'כחול',
        grandmaName: activeContestants[1]?.name || 'סגול',
        grandpaImage: activeContestants[0]?.image || null,
        grandmaImage: activeContestants[1]?.image || null,
        questionTimer: wizardQuestionTimer,
        wizardStep: prevStep
      });
      saveDraftToLocalStorage(wizardHostName, wizardTreeLayout, wizardContestantCount, wizardContestants, wizardQuestionTimer, prevStep);
    }
  };

  const handleSkip = () => {
    const confirmSkip = window.confirm(
      "האם אתה בטוח שברצונך לדלג על תהליך הרישום?\n\nעליך יהיה להזין את כל הפרטים (מתמודדים, שחקנים ושאלות) בתוך שלט המנחה המלא. מסך ההקרנה לא יוכל לפעול כל עוד לא תשלים את הגדרת המשחק ותסיים את הגדרת החדר."
    );
    if (confirmSkip) {
      const activeContestants = wizardContestants.slice(0, wizardContestantCount);
      updateSettings({ 
        ...settings, 
        hostName: wizardHostName,
        treeLayout: wizardTreeLayout,
        contestants: activeContestants,
        grandpaName: activeContestants[0]?.name || 'כחול',
        grandmaName: activeContestants[1]?.name || 'סגול',
        grandpaImage: activeContestants[0]?.image || null,
        grandmaImage: activeContestants[1]?.image || null,
        questionTimer: wizardQuestionTimer,
        setupComplete: true, 
        wizardStep: undefined 
      });
      const rCode = sync.getRoomCode();
      if (rCode) localStorage.removeItem(`wizard_draft_${rCode}`);
      setAdminSubMode('controller');
      setActiveTab('control');
    }
  };

  const handleFinish = () => {
    const activeContestants = wizardContestants.slice(0, wizardContestantCount);
    updateSettings({ 
      ...settings, 
      hostName: wizardHostName,
      treeLayout: wizardTreeLayout,
      contestants: activeContestants,
      grandpaName: activeContestants[0]?.name || 'כחול',
      grandmaName: activeContestants[1]?.name || 'סגול',
      grandpaImage: activeContestants[0]?.image || null,
      grandmaImage: activeContestants[1]?.image || null,
      questionTimer: wizardQuestionTimer,
      setupComplete: true, 
      wizardStep: undefined 
    });
    const rCode = sync.getRoomCode();
    if (rCode) localStorage.removeItem(`wizard_draft_${rCode}`);
    setShowSuccessScreen(true);
  };

  if (showMidSetupNotice) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col justify-center items-center text-right" dir="rtl">
        <div className="max-w-md w-full glass-panel p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="text-center space-y-3 relative z-10">
            <div className="inline-flex items-center justify-center p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl shadow-xl animate-pulse">
              <span className="text-3xl">⏳</span>
            </div>
            <h2 className="text-2xl font-black bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
              שנייה, אתה באמצע עריכה!
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed font-semibold">
              שמנו לב שלא סיימת להכניס את כל הפרטים עבור חדר המשחק שלך.
            </p>
          </div>

          <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl space-y-2 relative z-10 text-xs text-slate-400 leading-relaxed font-medium" dir="rtl">
            <p>השלבים שנותרו לך להשלים:</p>
            <ul className="list-disc list-inside space-y-1 pr-2">
              <li>הגדרת שחקנים ועץ משפחתי 👥</li>
              <li>הוספת שאלות, ציטוטים ורמזים 📝</li>
              <li>הגדרת טיימר מענה לשאלות ⏱️</li>
            </ul>
          </div>

          <div className="pt-2 relative z-10">
            <button
              type="button"
              onClick={() => setShowMidSetupNotice(false)}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>המשך לעריכת החדר 🛠️</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showSuccessScreen) {
    const projectorUrl = `${window.location.origin}${window.location.pathname}?mode=game&room=${roomCode}`;
    const controllerUrl = `${window.location.origin}${window.location.pathname}?mode=admin&room=${roomCode}`;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col justify-center items-center text-right" dir="rtl">
        <div className="max-w-xl w-full glass-panel p-8 rounded-3xl border border-emerald-500/30 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="text-center space-y-3 relative z-10">
            <div className="inline-flex items-center justify-center p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full animate-bounce">
              <Check size={36} />
            </div>
            <h2 className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              החדר נשמר בהצלחה! 🎉
            </h2>
            <p className="text-sm text-slate-400 font-medium">
              השלמתם את הגדרת המשחק עבור חדר <strong className="text-emerald-400 font-mono">#{roomCode}</strong>.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl text-right text-xs space-y-2 leading-relaxed">
            <p className="text-amber-400 font-bold">⚠️ שימו לב - פרטי תוקף החדר:</p>
            <p className="text-slate-350">
              החדר והנתונים שבו יישמרו בענן של Firebase ויהיו זמינים למשך <strong className="underline font-bold">30 יום</strong> מהיום.
            </p>
          </div>

          <div className="space-y-4 relative z-10">
            {/* Projector Link */}
            <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col gap-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-300">📺 מסך ההקרנה הראשי (למחשב / טלוויזיה)</span>
                <span className="text-[10px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded font-bold">מיועד למסך הגדול</span>
              </div>
              <p className="text-[11px] text-slate-400">הקישור שיוצג על הטלוויזיה ויציג את השאלות והניקוד בזמן אמת.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={projectorUrl}
                  className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-[10px] font-mono text-left text-slate-400 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(projectorUrl, 'מסך ההקרנה')}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl transition-all active:scale-95"
                >
                  העתק קישור 📋
                </button>
              </div>
            </div>

            {/* Controller Link */}
            <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col gap-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-300">🎮 שלט מנחה המשחק (לטלפון הנייד)</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">מיועד לטלפון</span>
              </div>
              <p className="text-[11px] text-slate-400">השלט הפרטי שלך להפעלת המשחק, חשיפת התשובות ועדכון הניקוד.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={controllerUrl}
                  className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-[10px] font-mono text-left text-slate-400 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(controllerUrl, 'שלט המנחה')}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all active:scale-95"
                >
                  העתק קישור 📋
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 relative z-10">
            <button
              type="button"
              onClick={() => {
                setShowSuccessScreen(false);
                setAdminSubMode('controller');
                setActiveTab('control');
              }}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 active:scale-95"
            >
              <span>כניסה לשלט המנחה והפעלת המשחק 🚀</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (adminSubMode === 'menu') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col justify-center items-center text-right" dir="rtl">
        <div className="max-w-xl w-full glass-panel p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="text-center space-y-2 relative z-10">
            <h2 className="text-2xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              בחירת מצב מנחה - חדר #{roomCode}
            </h2>
            <p className="text-xs text-slate-400">
              ברוכים הבאים לחדר המשחק של <strong className="text-amber-400">{settings.hostName || 'המנחה'}</strong>. מה ברצונך לעשות כעת?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 relative z-10">
            <button
              type="button"
              onClick={() => {
                setAdminSubMode('controller');
                setActiveTab('control');
              }}
              className="p-6 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/30 rounded-2xl flex flex-col items-center justify-between text-center gap-3 transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] group shadow-xl"
            >
              <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-full group-hover:scale-110 transition-transform">
                <Play size={32} fill="currentColor" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-100">הפעלת משחק (שלט) 🎮</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">שלוט בשאלות, חשוף את התשובות ועדכן את הניקוד בזמן אמת.</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setAdminSubMode('wizard');
                setWizardStepLocal(1);
              }}
              className="p-6 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-sky-500/30 rounded-2xl flex flex-col items-center justify-between text-center gap-3 transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] group shadow-xl"
            >
              <div className="p-4 bg-sky-500/10 text-sky-400 rounded-full group-hover:scale-110 transition-transform">
                <Settings size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-100">עריכת הגדרות ושאלות 📝</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">הוספה ושינוי של מתמודדים, משתתפים ושאלות בעזרת מדריך השלבים.</p>
              </div>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-900 text-center relative z-10">
            <button
              type="button"
              onClick={() => {
                window.location.href = window.location.origin + window.location.pathname;
              }}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs text-slate-400 font-black rounded-xl transition-all active:scale-95 inline-flex items-center gap-1.5"
            >
              ◀️ יציאה לדף הבית
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <span>{settings.setupComplete ? 'עריכת חדר משחק' : 'הגדרת חדר משחק חדש'}</span>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded font-mono">
              #{roomCode}
            </span>
          </h1>
          <p className="text-[10px] text-slate-400">הגדירו את החדר שלב-אחר-שלב ליצירת חוויית משחק מושלמת</p>
        </div>
        <div className="flex gap-2">
          {settings.setupComplete && (
            <button
              type="button"
              onClick={() => setAdminSubMode('menu')}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors font-bold px-2.5 py-1.5 rounded-lg border border-slate-850 bg-slate-900/30 flex items-center gap-1"
            >
              <span>ביטול וחזרה ◀️</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-slate-500 hover:text-rose-400 transition-colors font-bold px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-rose-950 bg-slate-900/30 flex items-center gap-1"
          >
            <span>דלג לממשק מלא ⏭️</span>
          </button>
        </div>
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
                  onClick={() => {
                    setWizardStepLocal(stepNum);
                    const activeContestants = wizardContestants.slice(0, wizardContestantCount);
                    updateSettings({
                      ...settings,
                      hostName: wizardHostName,
                      treeLayout: wizardTreeLayout,
                      contestants: activeContestants,
                      grandpaName: activeContestants[0]?.name || 'כחול',
                      grandmaName: activeContestants[1]?.name || 'סגול',
                      grandpaImage: activeContestants[0]?.image || null,
                      grandmaImage: activeContestants[1]?.image || null,
                      questionTimer: wizardQuestionTimer,
                      wizardStep: stepNum
                    });
                    saveDraftToLocalStorage(wizardHostName, wizardTreeLayout, wizardContestantCount, wizardContestants, wizardQuestionTimer, stepNum);
                  }}
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
                    value={wizardHostName}
                    onChange={(e) => {
                      setWizardHostName(e.target.value);
                      saveDraftToLocalStorage(e.target.value, wizardTreeLayout, wizardContestantCount, wizardContestants, wizardQuestionTimer, currentStep);
                    }}
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
                      onClick={() => {
                        setWizardTreeLayout('traditional');
                        saveDraftToLocalStorage(wizardHostName, 'traditional', wizardContestantCount, wizardContestants, wizardQuestionTimer, currentStep);
                      }}
                      className={`p-4 text-xs font-bold rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 ${
                        wizardTreeLayout === 'traditional'
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
                      onClick={() => {
                        setWizardTreeLayout('none');
                        saveDraftToLocalStorage(wizardHostName, 'none', wizardContestantCount, wizardContestants, wizardQuestionTimer, currentStep);
                      }}
                      className={`p-4 text-xs font-bold rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 ${
                        wizardTreeLayout === 'none'
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
                          wizardContestantCount === num
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
                  {wizardContestants.slice(0, wizardContestantCount).map((c, idx) => {
                    const theme = CONTESTANT_THEMES[idx % CONTESTANT_THEMES.length];
                    return (
                      <div key={c.id} className={`flex items-center gap-3 p-3 bg-slate-950/70 border ${theme.border} rounded-2xl`}>
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
                {wizardContestants.slice(0, wizardContestantCount).every((c, idx) => c.name === ['כחול', 'סגול', 'ירוק', 'כתום'][idx]) && (
                  <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-right text-[11px] text-amber-300 font-medium">
                    💡 לא בוצע שינוי בשמות המתמודדים - נאשר אותם לפי ברירת המחדל (כחול וסגול). תמיד ניתן יהיה לערוך זאת שוב בהמשך.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: משתתפים */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="text-right flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-black text-slate-100">
                    {wizardTreeLayout === 'traditional' ? 'שלב 3: הוספת שחקנים (בני משפחה)' : 'שלב 3: הוספת שחקנים'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {wizardTreeLayout === 'traditional' ? 'הזן את שמות בני המשפחה או העלה מקובץ Excel' : 'הזן את שמות השחקנים או העלה מקובץ Excel'}
                  </p>
                </div>
                
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => excelHelper.downloadTemplate(wizardTreeLayout === 'traditional' ? 'tree' : 'list')}
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

                {wizardTreeLayout === 'traditional' ? (
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
                          <option key={m.id} value={m.id}>{m.name} ({m.generation === 'grandparent' ? 'סבא/ת' : m.generation === 'parent' ? 'הורה' : m.generation === 'child' ? 'נכד' : 'נין'})</option>
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
                ) : wizardTreeLayout === 'botanical' ? (
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
                ) : null}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Plus size={14} />
                    <span>{wizardTreeLayout === 'traditional' ? 'הוסף שחקן משפחה' : 'הוסף שחקן'}</span>
                  </button>
                </div>
              </form>

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
                            {wizardTreeLayout === 'traditional' && (
                              <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-medium">
                                {m.generation === 'grandparent' ? 'דור 1' : m.generation === 'parent' ? 'דור 2' : m.generation === 'child' ? 'דור 3' : 'דור 4'}
                              </span>
                            )}
                            {wizardTreeLayout === 'traditional' && (
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
                
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => excelHelper.downloadQuestionsTemplate()}
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
                <h3 className="text-lg font-black text-slate-100">שלב 5: הגגרות זמן (טיימר)</h3>
                <p className="text-xs text-slate-400 mt-1">הגדר האם תהיה הגבלת זמן מענה לכל שאלה על מסך ההקרנה</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">מגבלת זמן למענה על שאלה:</label>
                  <select
                    value={wizardQuestionTimer === undefined || wizardQuestionTimer === null ? 'unlimited' : wizardQuestionTimer.toString()}
                    onChange={e => {
                      const val = e.target.value;
                      const seconds = val === 'unlimited' ? null : parseInt(val);
                      setWizardQuestionTimer(seconds);
                      saveDraftToLocalStorage(wizardHostName, wizardTreeLayout, wizardContestantCount, wizardContestants, seconds, currentStep);
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

          {/* Step 6: סיכום */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div className="text-right">
                <h3 className="text-lg font-black text-slate-100">שלב 6: סיכום והשלמת הגדרת החדר!</h3>
                <p className="text-xs text-slate-400 mt-1">בדוק שכל הפרטים נכונים ושמור את פרטי הכניסה של החדר</p>
              </div>

              <div className="bg-slate-950/70 border border-slate-850 p-5 rounded-2xl text-right space-y-3.5 relative overflow-hidden">
                <div className="absolute -top-16 -left-16 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl" />
                
                <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                  <span className="text-xs text-slate-400">שם מנחה המשחק:</span>
                  <strong className="text-xs text-slate-200 font-bold">{wizardHostName}</strong>
                </div>

                <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                  <span className="text-xs text-slate-400">מספר חדר (לשיתוף והתחברות):</span>
                  <strong className="text-sm text-emerald-400 font-mono font-black">{roomCode}</strong>
                </div>

                <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                  <span className="text-xs text-slate-400">סוג לוח:</span>
                  <span className="text-xs text-slate-200 font-bold">
                    {wizardTreeLayout === 'traditional' ? '🌳 עץ יוחסין משפחתי' : '📋 רשימה פשוטה'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                    <span className="text-[10px] text-slate-500 block font-bold">מתמודדים</span>
                    <strong className="text-base text-sky-400 font-black">{wizardContestantCount}</strong>
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

              <div className="bg-amber-500/10 border-2 border-amber-500/20 p-4 rounded-2xl text-right space-y-2">
                <p className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <span>⚠️ שימו לב - שמרו את פרטי החדר!</span>
                </p>
                <p className="text-[10px] text-slate-400 leading-relaxed font-bold">
                  עליכם לזכור את <strong className="text-amber-400 underline">מספר החדר ({roomCode})</strong> ואת <strong className="text-amber-400 underline">שם המנחה ({wizardHostName})</strong>. אלו הם פרטי הזיהוי של החדר שלכם. ללא שני הפרטים האלה, לא תוכלו לחזור ולהתחבר לחדר זה בהמשך או להפעיל את מסך ההקרנה!
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

        {/* Custom Confirmation Modal */}
        {wizardConfirmModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 text-right" dir="rtl">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-10 -left-10 w-24 h-24 bg-amber-500/5 rounded-full blur-xl" />
              <h4 className="text-sm font-black text-amber-400 flex items-center gap-1.5">
                <span>⚠️ שימו לב</span>
              </h4>
              <p className="text-xs text-slate-350 leading-relaxed font-medium whitespace-pre-line">
                {wizardConfirmModal.message}
              </p>

              {wizardConfirmModal.showExcelDownload === 'players' && (
                <div className="flex flex-col gap-2 pt-1 pb-2">
                  <button
                    type="button"
                    onClick={() => excelHelper.downloadTemplate('list')}
                    className="w-full py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-amber-500/20 text-amber-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download size={12} />
                    <span>הורד אבטיפוס Excel (רשימה) 📥</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => excelHelper.downloadTemplate('tree')}
                    className="w-full py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-amber-500/20 text-amber-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download size={12} />
                    <span>הורד אבטיפוס Excel (עץ משפחתי) 📥</span>
                  </button>
                </div>
              )}

              {wizardConfirmModal.showExcelDownload === 'questions' && (
                <div className="pt-1 pb-2">
                  <button
                    type="button"
                    onClick={() => excelHelper.downloadQuestionsTemplate()}
                    className="w-full py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-amber-500/20 text-amber-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download size={12} />
                    <span>הורד אבטיפוס Excel (שאלות) 📥</span>
                  </button>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={wizardConfirmModal.onConfirm}
                  className="flex-[2] py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all active:scale-95 cursor-pointer"
                >
                  אישור והמשך
                </button>
                <button
                  type="button"
                  onClick={() => setWizardConfirmModal(null)}
                  className="flex-1 py-2 bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-400 text-xs font-black rounded-xl transition-all active:scale-95 cursor-pointer"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
