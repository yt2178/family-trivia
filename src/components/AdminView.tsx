import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Settings,
  HelpCircle,
  FileSpreadsheet,
  LayoutGrid,
  Tv
} from 'lucide-react';

// Context Provider
import { AdminProvider, useAdmin } from './admin/AdminContext';

// Sub-components
import { AdminWizard } from './admin/AdminWizard';
import { ControlTab } from './admin/ControlTab';
import { MembersTab } from './admin/MembersTab';
import { QuestionsTab } from './admin/QuestionsTab';
import { SettingsTab } from './admin/SettingsTab';
import { ImportExportTab } from './admin/ImportExportTab';
import { StatsTab } from './admin/StatsTab';

// ──────────────────────────────────────────────────────────────────────────────
// Inner component: reads AdminContext, renders the appropriate UI
// ──────────────────────────────────────────────────────────────────────────────
const AdminViewInner: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    settings,
    members,
    questions,
    adminSubMode,
    setAdminSubMode,
    isLoading,
    successMsg,
    gameScreenConnected,
    showMidSetupNotice,
    setShowMidSetupNotice
  } = useAdmin();

  // ── Loading screen ──
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-50">
        <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-6" />
        <p className="text-slate-400 text-lg font-semibold">טוען נתוני חדר...</p>
      </div>
    );
  }

  // ── Wizard mode (setup not complete) ──
  if (adminSubMode === 'wizard') {
    return <AdminWizard />;
  }

  // ── Mid-setup notice (setup was started but not completed) ──
  if (showMidSetupNotice) {
    return (
      <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-sm flex items-center justify-center z-50 p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-slate-900 border border-amber-500/40 rounded-3xl p-8 text-center shadow-2xl shadow-amber-500/10"
        >
          <span className="text-5xl block mb-4">⏳</span>
          <h2 className="text-xl font-bold text-amber-400 mb-3">ההגדרה טרם הסתיימה</h2>
          <p className="text-slate-400 text-sm mb-6">
            נראה שהמנחה עדיין מגדיר את המשחק. האם ברצונך להמשיך מהשלב שנעצרת? או להיכנס ישירות לניהול?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowMidSetupNotice(false);
                setAdminSubMode('wizard');
              }}
              className="flex-1 py-3 bg-amber-500 text-slate-950 font-bold rounded-xl hover:bg-amber-400 transition-colors"
            >
              המשך הגדרה 📋
            </button>
            <button
              onClick={() => setShowMidSetupNotice(false)}
              className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 transition-colors"
            >
              כנס לניהול ✏️
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Main Admin Panel (setup complete, menu mode) ──
  const TAB_ITEMS: Array<{
    key: typeof activeTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    { key: 'control', label: 'בקרה', icon: <Tv size={16} /> },
    { key: 'members', label: 'בני משפחה', icon: <Users size={16} />, badge: members.length },
    { key: 'questions', label: 'שאלות', icon: <HelpCircle size={16} />, badge: questions.length },
    { key: 'settings', label: 'הגדרות', icon: <Settings size={16} /> },
    { key: 'import', label: 'ייבוא/ייצוא', icon: <FileSpreadsheet size={16} /> },
    { key: 'stats', label: 'סטטיסטיקה', icon: <LayoutGrid size={16} /> }
  ];

  const currentContestantNames = (settings.contestants || []).map(c => c.name).join(' VS ');

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
            <span className="text-2xl">🎭</span>
            <div>
              <h1 className="text-base font-black text-slate-100 leading-none">מי אמר מה?</h1>
              <p className="text-[10px] text-slate-500 leading-none mt-0.5">
                {currentContestantNames || 'ניהול משחק'}
                {settings.hostName ? ` · מנחה: ${settings.hostName}` : ''}
              </p>
            </div>
          </div>

          {/* Connection indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${gameScreenConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
            <span className="text-[10px] text-slate-400 hidden sm:block">
              {gameScreenConnected ? 'מסך המשחק מחובר' : 'ממתין לחיבור מסך'}
            </span>
          </div>

          {/* Edit room button (re-open wizard) */}
          <button
            onClick={() => setAdminSubMode('wizard')}
            className="px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Settings size={13} />
            <span className="hidden sm:block">ערוך חדר</span>
          </button>
        </div>
      </header>

      {/* ── Navigation Tabs ── */}
      <nav className="sticky top-[57px] z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800/60 px-4">
        <div className="max-w-7xl mx-auto flex gap-1 py-1 overflow-x-auto no-scrollbar">
          {TAB_ITEMS.map(tab => (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all relative ${
                activeTab === tab.key
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`px-1.5 py-0.5 text-[9px] rounded-full font-black ${
                  activeTab === tab.key ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Tab Content ── */}
      <main className="max-w-7xl mx-auto p-4 md:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === 'control' && <ControlTab />}
            {activeTab === 'members' && <MembersTab />}
            {activeTab === 'questions' && <QuestionsTab />}
            {activeTab === 'settings' && <SettingsTab />}
            {activeTab === 'import' && <ImportExportTab />}
            {activeTab === 'stats' && <StatsTab />}
          </motion.div>
        </AnimatePresence>
      </main>
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
