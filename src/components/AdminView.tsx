import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sync } from '../utils/sync';

// Context Provider
import { AdminProvider, useAdmin } from './admin/AdminContext';

// Sub-components
import { AdminWizard } from './admin/AdminWizard';
import { ControlTab } from './admin/ControlTab';

// ──────────────────────────────────────────────────────────────────────────────
// Inner component: reads AdminContext, renders the appropriate UI
// ──────────────────────────────────────────────────────────────────────────────
const AdminViewInner: React.FC = () => {
  const {
    settings,
    adminSubMode,
    setAdminSubMode,
    isLoading,
    securityError,
    roomError,
    countdown,
    successMsg,
    gameScreenConnected,
    updateSettings,
    wizardConfirmModal,
    setWizardConfirmModal
  } = useAdmin();

  const [dismissedDisconnectAlert, setDismissedDisconnectAlert] = useState(false);
  const prevConnectedRef = useRef(gameScreenConnected);

  useEffect(() => {
    if (prevConnectedRef.current && !gameScreenConnected) {
      setDismissedDisconnectAlert(false);
    }
    prevConnectedRef.current = gameScreenConnected;
  }, [gameScreenConnected]);

  // ── Loading screen ──
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-50">
        <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-6" />
        <p className="text-slate-400 text-lg font-semibold">טוען נתוני חדר...</p>
      </div>
    );
  }

  // ── Security Error screen ──
  if (securityError) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center z-50" dir="rtl">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full animate-bounce">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-black text-rose-400">גישה חסומה (שגיאת אבטחה)</h2>
            <p className="text-slate-300 text-sm leading-relaxed font-semibold">
              שם המנחה בקישור חסר או אינו תואם למנחה שהגדיר חדר זה.
            </p>
            <p className="text-slate-450 text-xs">
              אנא התחברו מחדש דרך עמוד הבית עם מספר החדר ושם המנחה הנכונים.
            </p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('last_connected_room');
              window.location.href = `${window.location.origin}${window.location.pathname}`;
            }}
            className="w-full py-3 bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-350 font-bold text-sm rounded-xl transition-all cursor-pointer"
          >
            חזרה לדף הבית
          </button>
        </div>
      </div>
    );
  }

  // ── Room error screen ──
  if (roomError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-6 text-slate-100 p-6" dir="rtl">
        <div className="w-16 h-16 bg-rose-500/10 border-2 border-rose-500/30 rounded-full flex items-center justify-center">
          <span className="text-4xl">❌</span>
        </div>
        <h2 className="text-2xl font-bold text-rose-400">שגיאה בטעינת החדר</h2>
        <p className="text-slate-300 text-center max-w-md">{roomError}</p>
        <div className="flex items-center gap-2 text-slate-400">
          <span>מפנה לדף הבית תוך</span>
          <span className="text-2xl font-bold text-emerald-400">{countdown}</span>
          <span>שניות...</span>
        </div>
      </div>
    );
  }

  // ── Wizard mode (setup not complete) ──
  if (adminSubMode === 'wizard') {
    return <AdminWizard />;
  }

  // ── Remote Control Mode (pure controller screen for mobile/tablet) ──
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir="rtl">
      
      {/* ── Success toast notification ── */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 bg-emerald-500 text-slate-950 font-bold rounded-2xl shadow-lg shadow-emerald-900/40 text-sm"
          >
            ✅ {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Header Bar ── */}
      <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo / Title */}
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎮</span>
            <div>
              <h1 className="text-base font-black text-slate-100 leading-none">שלט מנחה המשחק</h1>
              <p className="text-[10px] text-slate-500 leading-none mt-0.5">
                חדר {sync.getRoomCode()} · מנחה: {settings.hostName || 'המנחה'}
              </p>
            </div>
          </div>

          {/* Connection indicator + actions */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${gameScreenConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-pulse'}`} />
              <span className={`text-[10px] font-bold ${gameScreenConnected ? 'text-slate-400' : 'text-rose-450'}`}>
                {gameScreenConnected ? 'מסך המשחק מחובר' : 'מסך ההקרנה התנתק ❌'}
              </span>
            </div>

            {/* Go to edit mode */}
            <button
              onClick={() => {
                updateSettings({ ...settings, setupComplete: false });
                setAdminSubMode('wizard');
              }}
              className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition-colors flex items-center gap-1.5"
            >
              <span>עבור למצב עריכה 📝</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Controller Panel ── */}
      <main className="max-w-7xl mx-auto p-4 md:p-6">
        <ControlTab />
      </main>

      {/* Top-level Confirmation Modal for active remote control view */}
      {wizardConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 text-right animate-fade-in" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -left-10 w-24 h-24 bg-amber-500/5 rounded-full blur-xl" />
            <h4 className="text-sm font-black text-amber-400 flex items-center gap-1.5">
              <span>⚠️ שימו לב</span>
            </h4>
            <p className="text-xs text-slate-350 leading-relaxed font-medium whitespace-pre-line">
              {wizardConfirmModal.message}
            </p>
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
      {/* Top-level Disconnection Warning Modal */}
      {!gameScreenConnected && !dismissedDisconnectAlert && adminSubMode === 'controller' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 text-right" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -left-10 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="text-center space-y-2">
              <span className="text-3xl">📡❌</span>
              <h4 className="text-base font-black text-rose-400">
                מסך ההקרנה התנתק
              </h4>
            </div>
            <p className="text-xs text-slate-350 leading-relaxed text-center font-medium">
              נראה שמסך ההקרנה (המקרן) של המשחק אינו מחובר לחדר כעת.
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed text-center">
              ודא שהמקרן פתוח בכתובת המשחק עם קוד החדר: <strong className="font-mono text-emerald-400">{sync.getRoomCode()}</strong> כדי שהמשתתפים יוכלו לראות את המשחק.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setDismissedDisconnectAlert(true)}
                className="w-full py-2.5 bg-rose-500 hover:bg-rose-455 text-slate-950 font-black text-xs rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg shadow-rose-950/20"
              >
                אישור והמשך לשלט 👍
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Public export: wraps the inner component with the context provider
// ──────────────────────────────────────────────────────────────────────────────
const AdminView: React.FC = () => (
  <AdminProvider>
    <AdminViewInner />
  </AdminProvider>
);

export default AdminView;
