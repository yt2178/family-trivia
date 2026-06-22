import { useState, useEffect } from 'react';
import { AdminView } from './components/AdminView';
import { GameView } from './components/GameView';
import { Sparkles, Tv, Settings as SettingsIcon, Play, HelpCircle, Smartphone, QrCode, ArrowRight, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { rtdb } from './utils/firebase';
import { ref, onValue, off } from 'firebase/database';

function App() {
  const [mode, setMode] = useState<'welcome' | 'admin' | 'game'>('welcome');
  const [activeTab, setActiveTab] = useState<'cloud' | 'local'>('cloud');
  const [roomCode, setRoomCode] = useState<string>('');
  const [inputRoomCode, setInputRoomCode] = useState<string>('');
  const [lastRoomCode, setLastRoomCode] = useState<string | null>(null);

  // Helper to generate a random 4-letter room code
  const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars like O, I, 1, 0
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  useEffect(() => {
    // Load last connected room if exists, or generate a stable new one
    const savedCode = localStorage.getItem('last_connected_room');
    if (savedCode) {
      setLastRoomCode(savedCode);
      setRoomCode(savedCode);
    } else {
      const newCode = generateRoomCode();
      setRoomCode(newCode);
    }

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
    window.addEventListener('popstate', updateMode);
    return () => window.removeEventListener('popstate', updateMode);
  }, []);

  // Listen for admin/phone connection to automatically start the game on the projector screen
  useEffect(() => {
    if (mode !== 'welcome' || !roomCode || activeTab !== 'cloud') return;

    const roomRef = ref(rtdb, `rooms/${roomCode}/lastMessage`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        if (val && val.message) {
          const url = `${window.location.origin}${window.location.pathname}?mode=game&room=${roomCode}`;
          window.location.href = url;
        }
      }
    });

    return () => {
      off(roomRef);
    };
  }, [mode, roomCode, activeTab]);

  const launchCloudGame = () => {
    if (!roomCode) return;
    localStorage.setItem('last_connected_room', roomCode);
    const url = `${window.location.origin}${window.location.pathname}?mode=game&room=${roomCode}`;
    window.open(url, '_blank', 'width=1200,height=800');
  };

  const launchLocalGame = (targetMode: 'admin' | 'game') => {
    const url = `${window.location.origin}${window.location.pathname}?mode=${targetMode}`;
    window.open(url, '_blank', 'width=1200,height=800');
  };

  const handleJoinAsAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputRoomCode.trim()) return;
    const cleanCode = inputRoomCode.trim().toUpperCase();
    localStorage.setItem('last_connected_room', cleanCode);
    const url = `${window.location.origin}${window.location.pathname}?mode=admin&room=${cleanCode}`;
    window.location.href = url;
  };

  const regenerateCode = () => {
    setRoomCode(generateRoomCode());
  };

  if (mode === 'admin') {
    return <AdminView />;
  }

  if (mode === 'game') {
    return <GameView />;
  }

  const adminMobileUrl = `${window.location.origin}${window.location.pathname}?mode=admin&room=${roomCode}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(adminMobileUrl)}`;

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

        {/* Tab Selector */}
        <div className="flex bg-slate-900/60 p-1.5 rounded-2xl max-w-md mx-auto border border-slate-800">
          <button
            onClick={() => setActiveTab('cloud')}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'cloud'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone size={16} />
            <span>שליטה מהטלפון (ענן לייב)</span>
          </button>
          <button
            onClick={() => setActiveTab('local')}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'local'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tv size={16} />
            <span>משחק מקומי (מחשב אחד)</span>
          </button>
        </div>

        {/* Cloud Tab View */}
        {activeTab === 'cloud' && (
          <div className="max-w-2xl mx-auto glass-panel p-8 rounded-3xl border border-slate-800 space-y-6 hover:border-emerald-500/10 transition-all shadow-2xl relative overflow-hidden text-right">
            {/* Glowing background highlights */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="grid md:grid-cols-12 gap-8 items-center">
              
              {/* QR Code Column */}
              <div className="md:col-span-5 flex flex-col items-center space-y-3">
                <div className="relative p-3 bg-white rounded-2xl shadow-xl flex items-center justify-center border-4 border-slate-900 overflow-hidden">
                  <img
                    src={qrCodeUrl}
                    alt="סרוק להתחברות"
                    className="w-36 h-36 object-contain"
                  />
                </div>
                <span className="text-xs font-bold text-slate-400">סרקו בנייד להתחברות מיידית</span>
              </div>

              {/* Room Code & Info Column */}
              <div className="md:col-span-7 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-slate-100 flex items-center justify-end gap-2">
                    <span>חיבור שלט מנחה</span>
                    <Smartphone className="text-emerald-400" size={24} />
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    השאירו מסך זה פתוח במחשב (המחובר לטלוויזיה או למקרן). סרקו את הברקוד או הזינו את קוד החדר בטלפון, והמשחק יופעל כאן אוטומטית!
                  </p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-900 flex justify-between items-center">
                  <button
                    onClick={regenerateCode}
                    className="p-2 hover:bg-slate-800 rounded-xl text-slate-500 hover:text-emerald-400 transition-colors"
                    title="רענן קוד חדר"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <div className="text-left">
                    <span className="text-[9px] text-slate-500 block uppercase tracking-wider">קוד חדר נוכחי</span>
                    <span className="text-3xl font-black tracking-widest text-emerald-400 font-mono">
                      {roomCode}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 py-2.5 px-4 rounded-xl">
                  <span className="animate-pulse">ממתין לסריקה מהטלפון... ⏳</span>
                </div>
              </div>
            </div>

            {/* Manual controls (collapsed / small details at bottom) */}
            <div className="border-t border-slate-900 pt-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
              
              {/* Manual Room Entry Form */}
              <form onSubmit={handleJoinAsAdmin} className="flex gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  maxLength={4}
                  value={inputRoomCode}
                  onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                  placeholder="הקלד קוד חדר להתחברות ידנית"
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-center text-xs font-bold text-sky-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono w-40"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg font-bold transition-colors"
                >
                  התחבר כשלט
                </button>
              </form>

              {/* Manual screen launch */}
              <button
                onClick={launchCloudGame}
                className="text-slate-400 hover:text-white transition-colors underline text-xs font-semibold"
              >
                או: פתח ידנית את מסך ההקרנה
              </button>
            </div>

            {lastRoomCode && lastRoomCode !== roomCode && (
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('last_connected_room', lastRoomCode);
                  window.location.href = `${window.location.origin}${window.location.pathname}?mode=admin&room=${lastRoomCode}`;
                }}
                className="w-full py-2 bg-slate-900/40 border border-slate-800 hover:border-sky-500/20 text-xs text-sky-400 font-bold rounded-xl transition-all"
              >
                התחבר מחדש לחדר הקודם ({lastRoomCode})
              </button>
            )}
          </div>
        )}

        {/* Local Tab View */}
        {activeTab === 'local' && (
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto pt-2">
            {/* Game view card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col items-center text-center space-y-4 hover:border-sky-500/30 transition-all shadow-xl"
            >
              <div className="p-3 bg-sky-500/10 text-sky-400 rounded-2xl">
                <Tv size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-sky-100">מסך 1 - מסך המשחק</h3>
                <p className="text-xs text-slate-400 mt-1">מיועד להקרנה על מקרן או טלוויזיה גדולה.</p>
              </div>
              <button
                onClick={() => launchLocalGame('game')}
                className="w-full py-2.5 bg-gradient-to-r from-sky-600 to-sky-500 text-slate-950 font-black text-xs rounded-xl hover:from-sky-500 hover:to-sky-400 transition-all shadow-lg shadow-sky-950/50 flex items-center justify-center gap-1.5"
              >
                <Play size={14} fill="currentColor" />
                <span>פתח מסך משחק</span>
              </button>
            </motion.div>

            {/* Admin view card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col items-center text-center space-y-4 hover:border-emerald-500/30 transition-all shadow-xl"
            >
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
                <SettingsIcon size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-100">מסך 2 - מסך המנחה</h3>
                <p className="text-xs text-slate-400 mt-1">לוח בקרה במחשב השולט בנקודות ובשאלות.</p>
              </div>
              <button
                onClick={() => launchLocalGame('admin')}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-xs rounded-xl hover:from-emerald-400 hover:to-teal-300 transition-all shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-1.5"
              >
                <SettingsIcon size={14} />
                <span>פתח מסך מנחה</span>
              </button>
            </motion.div>
          </div>
        )}

        {/* Quick Instructions Guide */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 max-w-xl mx-auto text-right text-xs space-y-3">
          <h4 className="font-bold text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 pb-2 mb-2">
            <HelpCircle size={16} />
            <span>איך מתחברים מהטלפון בלייב? (חדש!)</span>
          </h4>
          <ol className="list-decimal list-inside space-y-2 text-slate-300 pr-1 leading-relaxed">
            <li>בחר בלשונית <strong>"שליטה מהטלפון (ענן לייב)"</strong> למעלה.</li>
            <li>לחץ על הכפתור הירוק במחשב כדי לפתוח את <strong>מסך ההקרנה</strong> וגרור אותו לטלוויזיה.</li>
            <li>סרוק את <strong>קוד ה-QR</strong> באמצעות המצלמה בטלפון שלכם (או היכנסו לאתר בטלפון והקלידו את קוד החדר).</li>
            <li>זהו! הטלפון שלכם הופך לשלט מנחה בלייב מכל מקום, ללא צורך בהרצת שרתים או הגדרות רשת!</li>
          </ol>
        </div>

        {/* Footer */}
        <footer className="text-[10px] text-slate-500 pt-8 border-t border-slate-900 flex justify-between max-w-md mx-auto">
          <span>תומך בסינכרון ענן Firebase בזמן אמת</span>
          <span>שעשועון מי אמר מה? &copy; 2026</span>
        </footer>

      </motion.div>
    </div>
  );
}

export default App;
