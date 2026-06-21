import { useState, useEffect } from 'react';
import { AdminView } from './components/AdminView';
import { GameView } from './components/GameView';
import { Sparkles, Tv, Settings as SettingsIcon, Play, HelpCircle, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

function App() {
  const [mode, setMode] = useState<'welcome' | 'admin' | 'game'>('welcome');

  useEffect(() => {
    const updateMode = () => {
      const params = new URLSearchParams(window.location.search);
      const m = params.get('mode');
      if (m === 'admin') {
        setMode('admin');
      } else if (m === 'game') {
        setMode('game');
      } else {
        setMode('welcome');
      }
    };

    updateMode();
    // Listen for state changes in history
    window.addEventListener('popstate', updateMode);
    return () => window.removeEventListener('popstate', updateMode);
  }, []);

  const launchWindow = (targetMode: 'admin' | 'game') => {
    try {
      const url = `${window.location.origin}${window.location.pathname}?mode=${targetMode}`;
      const newWindow = window.open(url, '_blank', 'width=1200,height=800');
      
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        alert('נראה שהדפדפן חסם את פתיחת החלון החדש. אנא אפשר חלונות קופצים ונסה שוב.');
      }
    } catch (error) {
      console.error('Failed to open window:', error);
      alert('שגיאה בפתיחת החלון. אנא נסה שוב.');
    }
  };

  if (mode === 'admin') {
    return <AdminView />;
  }

  if (mode === 'game') {
    return <GameView />;
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 overflow-hidden">
      
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-10 w-48 h-48 bg-fuchsia-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-3xl w-full text-center z-10 space-y-8"
      >
        {/* Logo and Title */}
        <div className="flex flex-col items-center space-y-3">
          <div className="inline-flex items-center justify-center p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-3xl shadow-xl animate-pulse">
            <Sparkles size={48} />
          </div>
          <div>
            <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 bg-clip-text text-transparent">
              מי אמר את זה?
            </h1>
            <p className="text-sm text-slate-400 font-semibold mt-1">
              שעשועון טריוויה משפחתי אינטראקטיבי המותאם למסך גדול
            </p>
          </div>
        </div>

        {/* Introduction text */}
        <p className="text-slate-300 max-w-xl mx-auto leading-relaxed text-sm">
          משחק תחרותי נוסטלגי ומצחיק בין סבא לסבתא! המערכת תומכת בעץ יוחסין משפחתי גדול, ייבוא קובצי Excel ושמירה אוטומטית מלאה.
        </p>

        {/* Double Launch Buttons */}
        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto pt-4">
          {/* Game view card */}
          <motion.div
            whileHover={{ scale: 1.03 }}
            className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col items-center text-center space-y-4 hover:border-sky-500/30 transition-all shadow-xl"
          >
            <div className="p-3 bg-sky-500/10 text-sky-400 rounded-2xl">
              <Tv size={36} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-sky-100">מסך 1 - מסך המשחק</h3>
              <p className="text-xs text-slate-400 mt-1">מיועד להקרנה על מקרן או טלוויזיה גדולה במהלך האירוע.</p>
            </div>
            <button
              onClick={() => launchWindow('game')}
              className="w-full py-3 bg-gradient-to-r from-sky-600 to-sky-500 text-slate-950 font-black text-sm rounded-xl hover:from-sky-500 hover:to-sky-400 transition-all shadow-lg shadow-sky-950/50 flex items-center justify-center gap-1.5"
            >
              <Play size={16} fill="currentColor" />
              <span>פתח מסך משחק להקרנה</span>
            </button>
          </motion.div>

          {/* Admin view card */}
          <motion.div
            whileHover={{ scale: 1.03 }}
            className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col items-center text-center space-y-4 hover:border-emerald-500/30 transition-all shadow-xl"
          >
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
              <SettingsIcon size={36} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-emerald-100">מסך 2 - מסך המנחה</h3>
              <p className="text-xs text-slate-400 mt-1">לוח בקרה סודי למחשב של המנחה לשליטה בנקודות ובשאלות.</p>
            </div>
            <button
              onClick={() => launchWindow('admin')}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-sm rounded-xl hover:from-emerald-400 hover:to-teal-300 transition-all shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-1.5"
            >
              <SettingsIcon size={16} />
              <span>פתח מסך ניהול ומנחה</span>
            </button>
          </motion.div>
        </div>

        {/* Quick Instructions Guide */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 max-w-xl mx-auto text-right text-xs space-y-3">
          <h4 className="font-bold text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 pb-2 mb-2">
            <HelpCircle size={16} />
            <span>מדריך הפעלה מהיר (ללא ידע טכני)</span>
          </h4>
          <ol className="list-decimal list-inside space-y-2 text-slate-300 pr-1">
            <li>לחץ על שני הכפתורים למעלה כדי לפתוח את שני המסכים בשני טאבים נפרדים.</li>
            <li>גרור את טאב <strong>מסך המשחק</strong> אל מסך הטלוויזיה או המקרן שלכם.</li>
            <li>השאר את <strong>מסך המנחה</strong> על המחשב שלך – כאן תראה את התשובות ותחלק נקודות!</li>
            <li>המערכת כבר טעונה עם משפחת דוגמה ושאלות להפעלה מיידית. תוכל לערוך הכל במסך הניהול.</li>
          </ol>
        </div>

        {/* Footer */}
        <footer className="text-[10px] text-slate-500 pt-8 border-t border-slate-900 flex justify-between max-w-md mx-auto">
          <span>פועל במצב מקומי ללא שרת - Local Storage</span>
          <span>שעשועון מי אמר מה? &copy; 2026</span>
        </footer>

      </motion.div>
    </div>
  );
}

export default App;
