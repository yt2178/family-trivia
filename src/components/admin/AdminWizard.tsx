import React, { useState } from 'react';
import { useAdmin } from './AdminContext';
import { excelHelper } from '../../utils/excelHelper';
import { sync } from '../../utils/sync';
import { fileToBase64, compressImage } from '../../utils/imageHelper';
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
  Tv,
  Pencil
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
    setEditingMemberId,
    wizardHostName,
    setWizardHostName,
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
    handleStartEdit,
    handleSaveEdit,
    handleCancelEdit,
    handleAddQuestion,
    handleDeleteQuestion,
    handleImportMembersExcel,
    handleImportQuestionsExcel,
    handleAbsoluteReset,
    handleStartGame,
    setMembers,
    setQuestions,
    showSuccess,
    copyToClipboard,
    saveDraftToLocalStorage,
    setActiveTab
  } = useAdmin();

  const [wizardQuestionOrder, setWizardQuestionOrder] = useState<'sequential' | 'random'>(settings.questionOrder || 'random');

  const roomCode = sync.getRoomCode() || '';

  const handleWizardContestantCountChange = (count: number) => {
    setWizardContestantCount(count);
    saveDraftToLocalStorage(wizardHostName, count, wizardContestants, wizardQuestionTimer, wizardQuestionOrder, currentStep);
  };

  const handleWizardContestantNameChange = (index: number, name: string) => {
    const updated = [...wizardContestants];
    if (updated[index]) {
      updated[index] = { ...updated[index], name };
      setWizardContestants(updated);
      saveDraftToLocalStorage(wizardHostName, wizardContestantCount, updated, wizardQuestionTimer, wizardQuestionOrder, currentStep);
    }
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
          saveDraftToLocalStorage(wizardHostName, wizardContestantCount, updated, wizardQuestionTimer, wizardQuestionOrder, currentStep);
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
      saveDraftToLocalStorage(wizardHostName, wizardContestantCount, updated, wizardQuestionTimer, wizardQuestionOrder, currentStep);
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
      contestants: activeContestants,
      questionTimer: wizardQuestionTimer,
      questionOrder: wizardQuestionOrder,
      showNameBank: wizardShowNameBank,
      wizardStep: nextStep
    });
    saveDraftToLocalStorage(wizardHostName, wizardContestantCount, wizardContestants, wizardQuestionTimer, wizardQuestionOrder, nextStep, wizardShowNameBank);
  };

  const proceedBack = (prevStep: number) => {
    setWizardStepLocal(prevStep);
    updateSettings({
      ...settings,
      wizardStep: prevStep
    });
    saveDraftToLocalStorage(wizardHostName, wizardContestantCount, wizardContestants, wizardQuestionTimer, wizardQuestionOrder, prevStep, wizardShowNameBank);
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
        const slicedDefaults = defaultNames.slice(0, wizardContestantCount);
        const joinedDefaults = slicedDefaults.length === 2 
          ? 'כחול וסגול' 
          : slicedDefaults.join(', ').replace(/, ([^,]*)$/, ' ו-$1');
        setWizardConfirmModal({
          message: `לא בוצע שינוי בשמות המתמודדים. נאשר אותם לפי ברירת המחדל (${joinedDefaults}). תמיד ניתן יהיה לערוך זאת שוב בהמשך.\n\nהאם להמשיך?`,
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
          message: "⚠️ שים לב: לא נוספו כרגע שחקנים. אפשר יהיה תמיד להוסיף שחקנים בהמשך דרך ממשק עריכת החדר.\n\nאו שתוכלו להוריד פה את קובץ האקסל למילוי, למלא אותו ולהעלות אותו בהמשך:",
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
          message: "⚠️ שים לב: לא נוספו כרגע שאלות. אפשר יהיה תמיד להוסיף שאלות בהמשך דרך ממשק עריכת החדר.\n\nאו שתוכלו להוריד פה את קובץ האקסל למילוי, למלא אותו ולהעלות אותו בהמשך:",
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
      proceedBack(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (!settings.setupComplete) {
      const confirmSkip = window.confirm(
        "האם אתה בטוח שברצונך לדלג על תהליך ההגדרה?\n\nמסך ההקרנה לא יוכל לפעול בצורה תקינה כל עוד לא תשלים את הזנת השחקנים והשאלות באשף."
      );
      if (!confirmSkip) return;
    }
    updateSettings({ 
      ...settings, 
      setupComplete: true, 
      hostName: wizardHostName,
      questionTimer: wizardQuestionTimer,
      questionOrder: wizardQuestionOrder,
      showNameBank: wizardShowNameBank,
      contestants: wizardContestants.slice(0, wizardContestantCount),
      wizardStep: undefined 
    });
    const rCode = sync.getRoomCode();
    if (rCode) {
      localStorage.removeItem(`wizard_draft_${rCode}`);
      window.history.replaceState({}, '', `${window.location.origin}${window.location.pathname}?mode=admin&room=${rCode}&host=${encodeURIComponent(wizardHostName)}`);
    }
    setAdminSubMode('controller');
    setActiveTab('control');
  };

  const handleFinish = () => {
    try {
      updateSettings({ 
        ...settings, 
        setupComplete: true, 
        hostName: wizardHostName,
        questionTimer: wizardQuestionTimer,
        questionOrder: wizardQuestionOrder,
        showNameBank: wizardShowNameBank,
        contestants: wizardContestants.slice(0, wizardContestantCount),
        wizardStep: undefined 
      });
      const rCode = sync.getRoomCode();
      if (rCode) localStorage.removeItem(`wizard_draft_${rCode}`);
      setShowSuccessScreen(true);
    } catch (err: any) {
      console.error("Error in handleFinish:", err);
      alert("שגיאה בסיום הגדרת החדר: " + err.message);
    }
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
    const projectorUrl = `${window.location.origin}${window.location.pathname}?mode=game&room=${roomCode}&host=${encodeURIComponent(wizardHostName)}`;
    const controllerUrl = `${window.location.origin}${window.location.pathname}?mode=admin&room=${roomCode}&host=${encodeURIComponent(wizardHostName)}`;

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
              השלמתם את הגדרת המשחק עבור חדר <strong className="text-emerald-400 font-mono">{roomCode}</strong>.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl text-right text-xs space-y-2 leading-relaxed">
            <p className="text-amber-400 font-bold">⚠️ שימו לב - פרטי תוקף החדר:</p>
            <p className="text-slate-350">
              החדר והנתונים שבו יישמרו בענן של Firebase ויהיו זמינים למשך <strong className="underline font-bold">45 יום</strong> מהיום.
            </p>
          </div>

          <div className="space-y-4 relative z-10">
            {/* Projector Link */}
            <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col gap-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-300">📺 מסך ההקרנה הראשי (למחשב / מקרן)</span>
                <span className="text-[10px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded font-bold">מיועד למסך הגדול</span>
              </div>
              <p className="text-[11px] text-slate-400">הקישור שיוצג על המקרן ויציג את השאלות והניקוד בזמן אמת.</p>
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
            <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-300">🎮 שלט מנחה המשחק (לטלפון הנייד)</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">מיועד לטלפון</span>
              </div>
              <p className="text-[11px] text-slate-400">השלט הפרטי שלך להפעלת המשחק, חשיפת התשובות ועדכון הניקוד.</p>
              
              <div className="flex flex-col md:flex-row items-center gap-4">
                {/* QR Code */}
                <div className="bg-white p-2.5 rounded-xl border border-slate-800 flex-shrink-0 shadow-lg hover:scale-[1.02] transition-transform">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(controllerUrl)}`}
                    alt="סרוק שלט מנחה"
                    className="w-[120px] h-[120px]"
                  />
                </div>
                
                <div className="flex-grow w-full space-y-2">
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
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all active:scale-95 flex-shrink-0"
                    >
                      העתק קישור 📋
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold">* סרוק את קוד ה-QR כדי להפעיל מיידית את השלט מהטלפון הנייד שלך!</p>
                </div>
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
                const rCode = sync.getRoomCode();
                if (rCode) {
                  window.history.replaceState({}, '', `${window.location.origin}${window.location.pathname}?mode=admin&room=${rCode}&host=${encodeURIComponent(wizardHostName)}`);
                }
                // Automatically initialize and launch game state
                handleStartGame();
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
              {roomCode}
            </span>
          </h1>
          <p className="text-[10px] text-slate-400">הגדירו את החדר שלב-אחר-שלב ליצירת חוויית משחק מושלמת</p>
        </div>
        <div className="flex gap-2">
          {settings.setupComplete && (
            <button
              type="button"
              onClick={() => {
                updateSettings({ ...settings, setupComplete: true });
                setAdminSubMode('controller');
              }}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors font-bold px-2.5 py-1.5 rounded-lg border border-slate-850 bg-slate-900/30 flex items-center gap-1"
            >
              <span>ביטול וחזרה לשלט ◀️</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg border border-emerald-500/30 flex items-center gap-1 shadow-md shadow-emerald-900/20"
          >
            <span>🎮 עבור לשלט משחק</span>
          </button>
        </div>
      </div>

      {/* Stepper Progress Bar */}
      <div className="w-full max-w-xl mx-auto mb-8 relative">
        <div className="absolute top-4 left-0 right-0 h-[2px] bg-slate-850 -translate-y-1/2 z-0" />
        <div
          className="absolute top-4 right-0 h-[2px] bg-emerald-500/70 -translate-y-1/2 z-0 transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (stepTitles.length - 1)) * 100}%` }}
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
                      contestants: activeContestants,
                      questionTimer: wizardQuestionTimer,
                      questionOrder: wizardQuestionOrder,
                      showNameBank: wizardShowNameBank,
                      wizardStep: stepNum
                    });
                    saveDraftToLocalStorage(wizardHostName, wizardContestantCount, wizardContestants, wizardQuestionTimer, wizardQuestionOrder, stepNum, wizardShowNameBank);
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
                <h3 className="text-lg font-black text-slate-100">שלב 1: אישור פרטי המנחה</h3>
                <p className="text-xs text-slate-400 mt-1">אמת את שם המנחה כדי להתחיל בהגדרות המשחק</p>
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
                       saveDraftToLocalStorage(e.target.value, wizardContestantCount, wizardContestants, wizardQuestionTimer, wizardQuestionOrder, currentStep);
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
                {(() => {
                  const defaultNames = ['כחול', 'סגול', 'ירוק', 'כתום'];
                  const slicedDefaults = defaultNames.slice(0, wizardContestantCount);
                  const isDefault = wizardContestants.slice(0, wizardContestantCount).every((c, idx) => c.name === defaultNames[idx]);
                  if (!isDefault) return null;
                  const joinedDefaults = slicedDefaults.length === 2 
                    ? 'כחול וסגול' 
                    : slicedDefaults.join(', ').replace(/, ([^,]*)$/, ' ו-$1');
                  return (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-right text-[11px] text-amber-300 font-medium">
                      💡 לא בוצע שינוי בשמות המתמודדים - נאשר אותם לפי ברירת המחדל ({joinedDefaults}). תמיד ניתן יהיה לערוך זאת שוב בהמשך.
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Step 3: משתתפים */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="text-right">
                <h3 className="text-lg font-black text-slate-100">
                  שלב 3: הוספת שחקנים
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  הזן את שמות השחקנים או העלה מקובץ Excel
                </p>
              </div>
              
              {/* Excel Buttons - below description */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => excelHelper.downloadTemplate()}
                  className="flex-1 px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1"
                  title="הורד קובץ שחקנים למילוי"
                >
                  <Download size={12} />
                  <span>הורד תבנית Excel 📥</span>
                </button>
                <label className="flex-1 px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer">
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

              <form onSubmit={editingMemberId ? handleSaveEdit : handleAddMember} className="bg-slate-950/60 p-4 border border-slate-850 rounded-2xl space-y-3 text-right">
                {editingMemberId && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-400">✏️ עורך שחקן קיים...</span>
                    <button type="button" onClick={handleCancelEdit} className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1">
                      <X size={10} /> ביטול עריכה
                    </button>
                  </div>
                )}
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



                <div className="flex justify-end pt-1 gap-2">
                  {editingMemberId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black rounded-lg transition-colors flex items-center gap-1"
                    >
                      <X size={14} />
                      <span>ביטול</span>
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Plus size={14} />
                    <span>{editingMemberId ? 'שמור שינויים' : 'הוסף שחקן'}</span>
                  </button>
                </div>
              </form>

              <div>
                <h4 className="text-[10px] font-black text-slate-400 mb-1.5">שחקנים שהוספו ({members.length}):</h4>
                <div className="max-h-[220px] overflow-y-auto border border-slate-850 bg-slate-950/20 rounded-xl p-2 space-y-1.5">
                  {members.length === 0 ? (
                    <p className="text-[10px] text-slate-650 text-center py-4">טרם הוספו שחקנים. הוסף שחקן למעלה או העלה קובץ Excel.</p>
                  ) : (
                    members.map(m => {
                      const isBeingEdited = editingMemberId === m.id;
                      return (
                        <div key={m.id} className={`flex justify-between items-center border p-2 rounded-xl text-xs ${isBeingEdited ? 'bg-amber-950/30 border-amber-500/30' : 'bg-slate-950/70 border-slate-850'}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-base">{m.gender === 'female' ? '👩' : '👨'}</span>
                            <span className="font-bold text-slate-200">{m.name}</span>

                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(m)}
                              className="text-amber-400 hover:bg-amber-500/10 p-1 rounded transition-colors"
                              title="ערוך שחקן"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMember(m.id)}
                              className="text-rose-400 hover:bg-rose-500/10 p-1 rounded transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
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
              <div className="text-right">
                <h3 className="text-lg font-black text-slate-100">שלב 4: הכנסת שאלות וציטוטים</h3>
                <p className="text-xs text-slate-400 mt-0.5">הזן ציטוטים משפחתיים או העלה שאלות מקובץ Excel</p>
              </div>
              
              {/* Excel Buttons - below description */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => excelHelper.downloadQuestionsTemplate()}
                  className="flex-1 px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1"
                  title="הורד אבטיפוס שאלות למילוי"
                >
                  <Download size={12} />
                  <span>הורד תבנית שאלות 📥</span>
                </button>
                <label className="flex-1 px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer">
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
                <h3 className="text-lg font-black text-slate-100">שלב 5: הגדרת זמן (טיימר)</h3>
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
                      saveDraftToLocalStorage(wizardHostName, wizardContestantCount, wizardContestants, seconds, wizardQuestionOrder, currentStep);
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

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">סדר השאלות במשחק:</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setWizardQuestionOrder('random');
                        saveDraftToLocalStorage(wizardHostName, wizardContestantCount, wizardContestants, wizardQuestionTimer, 'random', currentStep);
                      }}
                      className={`p-3 text-xs font-bold rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 ${
                        wizardQuestionOrder === 'random'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/80 shadow-md shadow-emerald-950/10'
                          : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="text-xl">🎲</span>
                      <span className="font-black">סדר אקראי</span>
                      <span className="text-[9px] text-slate-500 font-normal">השאלות יופיעו בסדר מעורבב</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setWizardQuestionOrder('sequential');
                        saveDraftToLocalStorage(wizardHostName, wizardContestantCount, wizardContestants, wizardQuestionTimer, 'sequential', currentStep);
                      }}
                      className={`p-3 text-xs font-bold rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 ${
                        wizardQuestionOrder === 'sequential'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/80 shadow-md shadow-emerald-950/10'
                          : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="text-xl">📋</span>
                      <span className="font-black">סדר הכנסה</span>
                      <span className="text-[9px] text-slate-500 font-normal">השאלות יופיעו לפי סדר ההכנסה</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 bg-slate-950/30 p-3 rounded-lg leading-relaxed">
                    💡 בחר סדר אקראי למשחק מהנה יותר, או סדר הכנסה לשליטה מלאה בסדר השאלות.
                  </p>
                </div>

                <div className="border-t border-slate-850/60 pt-4 mt-4">
                  <label className="text-xs font-bold text-slate-300 block mb-2">בנק שמות בתחתית מסך ההקרנה:</label>
                  <div className="flex items-center justify-between bg-slate-900 border border-slate-850 p-4 rounded-xl">
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-200 block">הצגת בנק שמות קטן למטה 📋</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">יציג את כל השמות של בני המשפחה בקטן בתחתית מסך ההקרנה, ויסמן לבד את השמות שנבחרו/נחשפו</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={wizardShowNameBank}
                        onChange={e => {
                          const checked = e.target.checked;
                          setWizardShowNameBank(checked);
                          saveDraftToLocalStorage(wizardHostName, wizardContestantCount, wizardContestants, wizardQuestionTimer, wizardQuestionOrder, currentStep, checked);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-700 after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-slate-950" />
                    </label>
                  </div>
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

              <div className="bg-amber-500/10 border-2 border-amber-500/20 p-5 rounded-2xl text-right space-y-2.5 shadow-lg">
                <p className="text-sm md:text-base font-black text-amber-300 flex items-center gap-2">
                  <span>⚠️ שימו לב - שמרו את פרטי החדר!</span>
                </p>
                <p className="text-xs md:text-sm text-slate-200 leading-relaxed font-bold">
                  עליכם לזכור את <strong className="text-amber-400 underline font-black">מספר החדר ({roomCode})</strong> ואת <strong className="text-amber-400 underline font-black">שם המנחה ({wizardHostName})</strong>. אלו הם פרטי הזיהוי של החדר שלכם. ללא שני הפרטים האלה, לא תוכלו לחזור ולהתחבר לחדר זה בהמשך או להפעיל את מסך ההקרנה!
                </p>
              </div>

              {/* Absolute Reset */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleAbsoluteReset}
                  className="w-full py-2.5 border border-rose-500/30 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} />
                  <span>🗑️ איפוס מוחלט של החדר (מחיקה וחזרה לדף הבית)</span>
                </button>
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
            💡 אל דאגה! תוכלו לערוך ולשנות את כל הפרטים הללו גם בהמשך דרך מסך העריכה.
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
                    onClick={() => excelHelper.downloadTemplate()}
                    className="w-full py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-amber-500/20 text-amber-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download size={12} />
                    <span>הורד אבטיפוס Excel למילוי 📥</span>
                  </button>

                  <label className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center active:scale-95 shadow-md shadow-emerald-950/20">
                    <Upload size={12} />
                    <span>העלה קובץ Excel למילוי 📤</span>
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={(e) => {
                        handleWizardImportMembers(e);
                        setWizardConfirmModal(null);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {wizardConfirmModal.showExcelDownload === 'questions' && (
                <div className="flex flex-col gap-2 pt-1 pb-2">
                  <button
                    type="button"
                    onClick={() => excelHelper.downloadQuestionsTemplate()}
                    className="w-full py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-amber-500/20 text-amber-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download size={12} />
                    <span>הורד אבטיפוס Excel (שאלות) למילוי 📥</span>
                  </button>

                  <label className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center active:scale-95 shadow-md shadow-emerald-950/20">
                    <Upload size={12} />
                    <span>העלה קובץ Excel למילוי 📤</span>
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={(e) => {
                        handleWizardImportQuestions(e);
                        setWizardConfirmModal(null);
                      }}
                      className="hidden"
                    />
                  </label>
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
