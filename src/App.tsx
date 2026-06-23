import { useState, useEffect } from 'react';
import { AdminView } from './components/AdminView';
import { GameView } from './components/GameView';
import { Sparkles, Tv, Settings as SettingsIcon, Play, HelpCircle, Smartphone, QrCode, ArrowRight, RefreshCw, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { rtdb } from './utils/firebase';
import { ref, onValue, off, set, get, child } from 'firebase/database';
import { sync, useConnectionStatus } from './utils/sync';

function ConnectionStatusBadge() {
  const connected = useConnectionStatus();
  return (
    <div className={`fixed bottom-4 right-4 z-[9999] flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg border backdrop-blur-sm transition-all duration-300 ${
      connected 
        ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-400' 
        : 'bg-rose-950/80 border-rose-500/30 text-rose-400 animate-pulse'
    }`} dir="rtl">
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
      <span>{connected ? 'שרת מחובר 🟢' : 'אין חיבור לשרת 🔴'}</span>
    </div>
  );
}

function App() {
  const [mode, setMode] = useState<'welcome' | 'admin' | 'game'>('welcome');
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [roomCode, setRoomCode] = useState<string>('');
  const [inputRoomCode, setInputRoomCode] = useState<string>('');
  const [lastRoomCode, setLastRoomCode] = useState<string | null>(null);

  // Custom states for host name and room confirmation step
  const [hostName, setHostName] = useState<string>(() => localStorage.getItem('host_name') || '');
  const [isCheckingRoom, setIsCheckingRoom] = useState<boolean>(false);
  const [roomWarningCode, setRoomWarningCode] = useState<string | null>(null);
  const [treeLayoutChoice, setTreeLayoutChoice] = useState<'traditional' | 'none'>('traditional');
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    setCreateError(null);
    setJoinError(null);
    setRoomWarningCode(null);
  }, [activeTab]);

  // Join tab states
  const [joinHostName, setJoinHostName] = useState<string>('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinWaiting, setJoinWaiting] = useState<boolean>(false); // waiting for host to finish setup

  // Helper to generate a random numeric room code
  const generateRoomCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  useEffect(() => {
    // Load last connected room if exists, do not auto-generate on start if empty
    const savedCode = localStorage.getItem('last_connected_room');
    if (savedCode) {
      setLastRoomCode(savedCode);
      setRoomCode(savedCode);
      setInputRoomCode(savedCode);
    } else {
      setRoomCode('');
      setInputRoomCode('');
    }

    const updateMode = () => {
      const params = new URLSearchParams(window.location.search);
      const m = params.get('mode');
      const r = params.get('room');
      if (r) {
        const clean = r.trim().toUpperCase();
        if (clean !== '' && clean !== 'UNDEFINED' && clean !== 'NULL') {
          setRoomCode(clean);
        }
      }
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
    if (mode !== 'welcome' || !roomCode) return;

    const controllerStatusRef = ref(rtdb, `rooms/${roomCode}/controllerConnected`);
    
    // Reset stale remote connection state
    set(controllerStatusRef, false).catch(err => console.error("Error resetting stale remote connection status:", err));

    const unsubscribe = onValue(controllerStatusRef, (snapshot) => {
      if (snapshot.exists() && snapshot.val() === true) {
        const url = `${window.location.origin}${window.location.pathname}?mode=game&room=${roomCode}`;
        window.location.href = url;
      }
    });

    return () => {
      off(controllerStatusRef);
    };
  }, [mode, roomCode, activeTab]);

  // Listen for local BroadcastChannel controller connection
  useEffect(() => {
    if (mode !== 'welcome' || !roomCode) return;

    const unsubscribe = sync.subscribe((msg) => {
      if (msg.type === 'CONTROLLER_CONNECTED' && msg.roomCode === roomCode) {
        const url = `${window.location.origin}${window.location.pathname}?mode=game&room=${roomCode}`;
        window.location.href = url;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [mode, roomCode]);

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

  const checkRoomExists = async (code: string): Promise<boolean> => {
    try {
      const roomRef = ref(rtdb, `rooms/${code}/database`);
      const snapshot = await get(roomRef);
      return snapshot.exists();
    } catch (e) {
      console.error("Error checking room existence", e);
      return false;
    }
  };

  const proceedWithRoom = async (code: string, restoreExisting: boolean = false) => {
    const cleanCode = code.trim();
    const cleanName = hostName.trim() || 'המנחה';
    
    localStorage.setItem('last_connected_room', cleanCode);
    localStorage.setItem('host_name', cleanName);
    
    try {
      const hostNameRef = ref(rtdb, `rooms/${cleanCode}/database/settings/hostName`);
      await set(hostNameRef, cleanName);
    } catch (err) {
      console.error("Failed to write host name to Firebase", err);
    }
    
    if (!restoreExisting) {
      try {
        await set(ref(rtdb, `rooms/${cleanCode}/database`), {
          db: {
            members: [],
            questions: [],
            settings: {
              grandpaName: 'כחול',
              grandpaImage: null,
              grandmaName: 'סגול',
              grandmaImage: null,
              theme: 'classic',
              treeLayout: treeLayoutChoice,
              contestants: [
                { id: 'grandpa', name: 'כחול', image: null },
                { id: 'grandma', name: 'סגול', image: null }
              ],
              hostName: cleanName,
              setupComplete: false,
              wizardStep: 1,
              questionTimer: null
            }
          },
          settings: {
            grandpaName: 'כחול',
            grandpaImage: null,
            grandmaName: 'סגול',
            grandmaImage: null,
            theme: 'classic',
            treeLayout: treeLayoutChoice,
            contestants: [
              { id: 'grandpa', name: 'כחול', image: null },
              { id: 'grandma', name: 'סגול', image: null }
            ],
            hostName: cleanName,
            setupComplete: false,
            wizardStep: 1,
            questionTimer: null
          },
          state: {
            currentQuestionIndex: 0,
            scores: { grandpa: 0, grandma: 0 },
            solvedQuestions: {},
            revealedSpeakers: {},
            shuffledQuestionIds: [],
            isRevealed: false,
            isPlaying: false
          }
        });
        await set(ref(rtdb, `rooms/${cleanCode}/controllerConnected`), false);
        await set(ref(rtdb, `rooms/${cleanCode}/gameScreenConnected`), false);
        await set(ref(rtdb, `rooms/${cleanCode}/lastMessage`), null);
        
        localStorage.removeItem('family_game_members');
        localStorage.removeItem('family_game_questions');
        localStorage.setItem('family_game_settings', JSON.stringify({
          grandpaName: 'כחול',
          grandpaImage: null,
          grandmaName: 'סגול',
          grandmaImage: null,
          theme: 'classic',
          treeLayout: treeLayoutChoice,
          contestants: [
            { id: 'grandpa', name: 'כחול', image: null },
            { id: 'grandma', name: 'סגול', image: null }
          ],
          hostName: cleanName,
          setupComplete: false,
          wizardStep: 1,
          questionTimer: null
        }));
        localStorage.removeItem('family_game_state');
      } catch (err) {
        console.error("Failed to reset room database on server", err);
      }
    } else {
      try {
        const dbRef = ref(rtdb);
        const snapshot = await get(child(dbRef, `rooms/${cleanCode}/database`));
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data.db) {
            if (data.db.members) localStorage.setItem('family_game_members', JSON.stringify(data.db.members));
            if (data.db.questions) localStorage.setItem('family_game_questions', JSON.stringify(data.db.questions));
            if (data.db.settings) localStorage.setItem('family_game_settings', JSON.stringify(data.db.settings));
          }
          if (data.state) {
            localStorage.setItem('family_game_state', JSON.stringify(data.state));
          }
        }
      } catch (e) {
        console.error("Failed to sync restored database to localStorage", e);
      }
    }

    setRoomCode(cleanCode);
    setRoomWarningCode(null);
    
    // Redirect directly to host admin console (setup=true tells AdminView to open on members tab)
    const url = `${window.location.origin}${window.location.pathname}?mode=admin&room=${cleanCode}&setup=true`;
    window.location.href = url;
  };

  const handleConfirmRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = inputRoomCode.trim();
    if (!cleanCode) return;
    
    if (cleanCode.length !== 4) {
      setCreateError('נא להזין מספר חדר בן 4 ספרות בדיוק');
      return;
    }
    
    const cleanHost = hostName.trim();
    if (!cleanHost) {
      setCreateError('נא להזין את שם מנחה המשחק');
      return;
    }
    
    setIsCheckingRoom(true);
    setCreateError(null);
    try {
      const exists = await checkRoomExists(cleanCode);
      if (exists) {
        setCreateError(`חדר מספר ${cleanCode} כבר קיים במערכת! אנא בחרו מספר חדר אחר או לחצו על כפתור מספר אקראי.`);
      } else {
        await proceedWithRoom(cleanCode, false);
      }
    } catch (err) {
      console.error(err);
      setCreateError('שגיאת תקשורת בבדיקת החדר. נסה שוב.');
    } finally {
      setIsCheckingRoom(false);
    }
  };

  const handleGenerateRandomCode = async () => {
    setIsCheckingRoom(true);
    setCreateError(null);
    try {
      let code = generateRoomCode();
      let attempts = 0;
      while (attempts < 5) {
        const exists = await checkRoomExists(code);
        if (!exists) break;
        code = generateRoomCode();
        attempts++;
      }
      setInputRoomCode(code);
    } catch (e) {
      setInputRoomCode(generateRoomCode());
    } finally {
      setIsCheckingRoom(false);
    }
  };

  // Verify host name matches Firebase and room exists, then navigate
  const verifyAndJoin = async (): Promise<{ ok: boolean; settings?: any }> => {
    const cleanCode = inputRoomCode.trim();
    const cleanJoinName = joinHostName.trim();
    if (!cleanCode) { setJoinError('נא להזין מספר חדר'); return { ok: false }; }
    if (cleanCode.length !== 4) { setJoinError('נא להזין מספר חדר בן 4 ספרות בדיוק'); return { ok: false }; }
    if (!cleanJoinName) { setJoinError('נא להזין שם מנחה'); return { ok: false }; }
    setJoinError(null);
    setIsCheckingRoom(true);
    try {
      const snap = await get(ref(rtdb, `rooms/${cleanCode}/database`));
      if (!snap.exists()) {
        setJoinError('❌ אין חדר כזה — בדוק את המספר ונסה שוב');
        return { ok: false };
      }
      const data = snap.val();
      const storedName: string = (data?.settings?.hostName || data?.db?.settings?.hostName || '').trim();
      if (storedName && storedName.toLowerCase() !== cleanJoinName.toLowerCase()) {
        setJoinError('❌ שם המנחה שגוי — בדוק ונסה שוב');
        return { ok: false };
      }
      return { ok: true, settings: data?.settings || data?.db?.settings };
    } catch (e) {
      setJoinError('שגיאת תקשורת — נסה שוב');
      return { ok: false };
    } finally {
      setIsCheckingRoom(false);
    }
  };

  const handleJoinAsAdmin = async () => {
    const { ok } = await verifyAndJoin();
    if (!ok) return;
    const cleanCode = inputRoomCode.trim();
    localStorage.setItem('last_connected_room', cleanCode);
    
    // Fetch data from Firebase first to populate localStorage
    try {
      const roomDbRef = ref(rtdb, `rooms/${cleanCode}/database`);
      const snap = await get(roomDbRef);
      if (snap.exists()) {
        const data = snap.val();
        if (data.db) {
          if (data.db.members) localStorage.setItem('family_game_members', JSON.stringify(data.db.members));
          if (data.db.questions) localStorage.setItem('family_game_questions', JSON.stringify(data.db.questions));
          if (data.db.settings) localStorage.setItem('family_game_settings', JSON.stringify(data.db.settings));
        }
        if (data.state) {
          localStorage.setItem('family_game_state', JSON.stringify(data.state));
        }
      }
    } catch (e) {
      console.error("Failed to sync room data to localStorage on admin join", e);
    }
    
    window.location.href = `${window.location.origin}${window.location.pathname}?mode=admin&room=${cleanCode}`;
  };

  const handleOpenProjector = async () => {
    const { ok, settings: roomSettings } = await verifyAndJoin();
    if (!ok) return;
    const cleanCode = inputRoomCode.trim();
    // Check if host finished setup
    if (!roomSettings?.setupComplete) {
      setJoinError('');
      setJoinWaiting(true);
      // Listen for setupComplete to become true
      const settingsRef = ref(rtdb, `rooms/${cleanCode}/database/settings/setupComplete`);
      const unsub = onValue(settingsRef, (snap) => {
        if (snap.val() === true) {
          off(settingsRef);
          localStorage.setItem('last_connected_room', cleanCode);
          window.location.href = `${window.location.origin}${window.location.pathname}?mode=game&room=${cleanCode}`;
        }
      });
      return;
    }
    localStorage.setItem('last_connected_room', cleanCode);
    window.location.href = `${window.location.origin}${window.location.pathname}?mode=game&room=${cleanCode}`;
  };

  const regenerateCode = () => {
    const newCode = generateRoomCode();
    setRoomCode(newCode);
    setInputRoomCode(newCode);
    if (hostName) {
      const hostNameRef = ref(rtdb, `rooms/${newCode}/database/settings/hostName`);
      set(hostNameRef, hostName.trim()).catch(err => console.error(err));
    }
  };

  if (mode === 'admin') {
    return (
      <>
        <AdminView />
        <ConnectionStatusBadge />
      </>
    );
  }

  if (mode === 'game') {
    return (
      <>
        <GameView />
        <ConnectionStatusBadge />
      </>
    );
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
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'create'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus size={16} />
            <span>➕ צור חדר חדש</span>
          </button>
          <button
            onClick={() => setActiveTab('join')}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'join'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play size={16} />
            <span>🔌 התחבר לחדר קיים</span>
          </button>
        </div>

        {/* Create Room View */}
        {activeTab === 'create' && (
          <div className="max-w-2xl mx-auto glass-panel p-8 rounded-3xl border border-slate-800 space-y-6 hover:border-emerald-500/10 transition-all shadow-2xl relative overflow-hidden text-right">
            {/* Glowing background highlights */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

            <form onSubmit={handleConfirmRoom} className="space-y-6 relative z-10">
              <div className="text-center space-y-2 mb-4">
                <h3 className="text-2xl font-black text-slate-100 flex items-center justify-center gap-2">
                  <span>יצירת חדר משחק חדש</span>
                  <SettingsIcon className="text-emerald-400 animate-spin-slow" size={24} />
                </h3>
                <p className="text-xs text-slate-400">הזינו את שם מנחה המשחק ובחרו מספר חדר</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">1. שם מנחה המשחק:</label>
                  <input
                    type="text"
                    required
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    placeholder="הקלד שם מנחה (לדוגמה: אלי, אמא)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-emerald-500 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">2. בחרו מספר לחדר בן 4 ספרות:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      maxLength={4}
                      value={inputRoomCode}
                      onChange={(e) => {
                        setInputRoomCode(e.target.value.replace(/\D/g, '').slice(0, 4));
                        setCreateError(null);
                      }}
                      placeholder="הקלד מספר חדר בן 4 ספרות"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-center text-sm font-black text-emerald-400 placeholder-slate-650 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <button
                      type="button"
                      disabled={isCheckingRoom}
                      onClick={handleGenerateRandomCode}
                      className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw size={14} className={isCheckingRoom ? 'animate-spin' : ''} />
                      <span>בחר מספר אקראי</span>
                    </button>
                  </div>
                  
                  <p className="text-[11px] text-amber-400/90 leading-relaxed mt-2 bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl font-medium">
                    ⚠️ עליך לזכור את המספר כי פה יישמרו כל השאלות והתמונות שלכם. אם תשכח אותו, לא תוכל לגשת לחידון שלך ותצטרך ליצור חדר חדש מהתחלה, סתם חבל.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">3. מבנה המשחק (סוג הלוח):</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTreeLayoutChoice('traditional')}
                      className={`py-3 px-4 text-xs font-bold rounded-xl border transition-all flex flex-col items-center justify-center gap-1 ${
                        treeLayoutChoice === 'traditional'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500 shadow-md shadow-emerald-550/20'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="text-lg">🌳</span>
                      <span className="font-bold">עץ יוחסין משפחתי</span>
                      <span className="text-[9px] text-slate-500 font-normal">מחבר בני משפחה לדורות והורים</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setTreeLayoutChoice('none')}
                      className={`py-3 px-4 text-xs font-bold rounded-xl border transition-all flex flex-col items-center justify-center gap-1 ${
                        treeLayoutChoice === 'none'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500 shadow-md shadow-emerald-550/20'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="text-lg">📋</span>
                      <span className="font-bold">ללא עץ יוחסין (רשימה)</span>
                      <span className="text-[9px] text-slate-500 font-normal">מצב פשוט ללא הגדרת הורים ובני זוג</span>
                    </button>
                  </div>
                </div>
              </div>

              {createError && (
                <div className="bg-rose-500/10 border-2 border-rose-500/30 p-4 rounded-2xl text-right relative z-20">
                  <p className="text-xs font-bold text-rose-400">
                    ⚠️ {createError}
                  </p>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isCheckingRoom || !!createError}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{isCheckingRoom ? 'בודק זמינות חדר... ⏳' : 'צור חדר והתחל משחק 🎮'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Join Room View */}
        {activeTab === 'join' && (
          <div className="max-w-md mx-auto glass-panel p-8 rounded-3xl border border-slate-800 space-y-5 hover:border-emerald-500/10 transition-all shadow-2xl relative overflow-hidden text-right">
            <div className="absolute -top-24 -left-24 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="text-center space-y-1 mb-2">
              <h3 className="text-2xl font-black text-slate-100 flex items-center justify-center gap-2">
                <span>התחברות לחדר קיים</span>
                <Play className="text-emerald-400" size={24} />
              </h3>
              <p className="text-xs text-slate-400">הזינו מספר חדר ושם מנחה כדי להתחבר</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">מספר חדר:</label>
                <input
                  type="text"
                  maxLength={4}
                  value={inputRoomCode}
                  onChange={(e) => { setInputRoomCode(e.target.value.replace(/\D/g, '').slice(0, 4)); setJoinError(null); setJoinWaiting(false); }}
                  placeholder="הקלד מספר חדר בן 4 ספרות"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-center text-lg font-black text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              {/* Host name — required for auth */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">שם המנחה (לאימות):</label>
                <input
                  type="text"
                  value={joinHostName}
                  onChange={(e) => { setJoinHostName(e.target.value); setJoinError(null); setJoinWaiting(false); }}
                  placeholder="הקלד את שם המנחה שנרשם בעת יצירת החדר"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-sm font-bold"
                />
              </div>

              {/* Error message */}
              {joinError && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-2.5 text-xs text-rose-300 font-bold text-center">
                  {joinError}
                </div>
              )}

              {/* Waiting for host message */}
              {joinWaiting && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-amber-300 font-bold text-center space-y-1">
                  <p>⏳ המנחה עדיין עורך את פרטי המשחק...</p>
                  <p className="text-amber-400/70 font-normal">המסך ייפתח אוטומטית ברגע שהוא ייסיים!</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  disabled={isCheckingRoom}
                  onClick={handleJoinAsAdmin}
                  className="py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs rounded-xl transition-all shadow-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SettingsIcon size={16} />
                  <span>{isCheckingRoom ? '...' : 'התחבר כמנחה המשחק 👑'}</span>
                </button>

                <button
                  type="button"
                  disabled={isCheckingRoom || joinWaiting}
                  onClick={handleOpenProjector}
                  className="py-3 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-xs rounded-xl transition-all shadow-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Tv size={16} />
                  <span>{joinWaiting ? 'ממתין... ⏳' : 'מסך הקרנה 📺'}</span>
                </button>
              </div>
            </div>

            {lastRoomCode && !joinWaiting && (
              <div className="border-t border-slate-900 pt-4 flex flex-col gap-2">
                <p className="text-[10px] text-slate-500 text-center">חדר אחרון: <strong className="text-slate-400">{lastRoomCode}</strong></p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setInputRoomCode(lastRoomCode); setJoinError(null); }}
                    className="flex-1 py-2 bg-slate-900/40 border border-slate-800 hover:border-emerald-500/20 text-xs text-emerald-400 font-bold rounded-xl transition-all text-center"
                  >
                    טען חדר אחרון
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Instructions Guide */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 max-w-xl mx-auto text-right text-xs space-y-3">
          <h4 className="font-bold text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 pb-2 mb-2">
            <HelpCircle size={16} />
            <span>איך מתחילים לשחק ב-4 שלבים פשוטים? 🎮</span>
          </h4>
          <ol className="list-decimal list-inside space-y-2 text-slate-350 pr-1 leading-relaxed">
            <li><strong>הכנה מהטלפון:</strong> פתחו את הקישור בטלפון, לחצו <strong>"צור חדר חדש"</strong>, הזינו שם מנחה ומספר חדר ולחצו <strong>צור חדר</strong>.</li>
            <li><strong>הזנת תוכן:</strong> במסך המנחה בטלפון — הוסיפו את בני המשפחה, המתמודדים, השאלות והציטוטים (או ייבאו מקובץ Excel).</li>
            <li><strong>חיבור המחשב:</strong> לאחר שהכל מוכן, פתחו את הקישור במחשב (שמחובר לטלוויזיה/מקרן), בחרו <strong>"התחבר לחדר קיים"</strong> והזינו את אותו מספר חדר ← לחצו <strong>"פתח מסך הקרנה 📺"</strong>.</li>
            <li><strong>התחלת המשחק:</strong> חזרו לטלפון, התחברו שוב כשלט מנחה לאותו חדר, והתחילו לשחק!</li>
          </ol>
        </div>

        {/* Footer */}
        <footer className="text-[10px] text-slate-600 pt-8 border-t border-slate-900 flex justify-between max-w-md mx-auto w-full">
          <span>סנכרון ענן Firebase בזמן אמת</span>
          <span>שעשועון מי אמר מה? &copy; 2026</span>
        </footer>

      </motion.div>
      <ConnectionStatusBadge />
    </div>
  );
}

export default App;
