import React, { useState, useEffect, useRef } from 'react';
import { db, FamilyMember, GameSettings, GameState } from '../utils/db';
import { sync } from '../utils/sync';
import { FamilyTree } from './FamilyTree';
import { Trophy, Volume2, Award, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Confetti Particle Class for canvas
class ConfettiParticle {
  x: number;
  y: number;
  size: number;
  color: string;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;

  constructor(width: number, height: number, colors: string[]) {
    this.x = Math.random() * width;
    this.y = -20 - Math.random() * 100;
    this.size = Math.random() * 8 + 6;
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.speedX = Math.random() * 4 - 2;
    this.speedY = Math.random() * 5 + 3;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 4 - 2;
  }

  update(height: number) {
    this.x += this.speedX;
    this.y += this.speedY;
    this.rotation += this.rotationSpeed;
    return this.y < height;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

export const GameView: React.FC = React.memo(() => {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [settings, setSettings] = useState<GameSettings>(db.getSettings());
  const [gameState, setGameState] = useState<GameState>(db.getGameState());
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const particles = useRef<ConfettiParticle[]>([]);

  // Load initial data
  useEffect(() => {
    setMembers(db.getMembers());
    setQuestions(db.getQuestions());
    setSettings(db.getSettings());
    
    // Make sure we have a game state initialized
    const currentGameState = db.getGameState();
    setGameState(currentGameState);
  }, []);

  // Sync state and listen to broadcasts
  useEffect(() => {
    const unsubscribe = sync.subscribe((msg) => {
      if (msg.type === 'STATE_CHANGED') {
        setGameState(msg.state);
      } else if (msg.type === 'SETTINGS_CHANGED') {
        setSettings(msg.settings);
        // Reload settings
        const freshSettings = db.getSettings();
        setSettings(freshSettings);
      } else if (msg.type === 'DATABASE_SYNC') {
        // Save the received database to local storage so the computer is up-to-date!
        db.saveMembers(msg.members);
        db.saveQuestions(msg.questions);
        db.saveSettings(msg.settings);
        
        // Update local React states
        setMembers(msg.members);
        setQuestions(msg.questions);
        setSettings(msg.settings);
      } else if (msg.type === 'TRIGGER_CONFETTI') {
        triggerConfetti(msg.winner);
      }
    });

    // Request full database sync from the active host (phone) when mounting
    sync.sendMessage({ type: 'REQUEST_DATABASE' });

    return () => unsubscribe();
  }, []);

  // Update localStorage when local state updates from UI (just in case)
  useEffect(() => {
    db.saveGameState(gameState);
  }, [gameState]);

  // Confetti system
  const triggerConfetti = (winner: 'grandpa' | 'grandma' | 'nobody') => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6']; // Gold, green, etc.
    if (winner === 'grandpa') {
      colors = ['#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#ffffff']; // Blue tones
    } else if (winner === 'grandma') {
      colors = ['#d946ef', '#f472b6', '#f0abfc', '#fbcfe8', '#ffffff']; // Purple/pink tones
    }

    const newParticles: ConfettiParticle[] = [];
    for (let i = 0; i < 150; i++) {
      newParticles.push(new ConfettiParticle(canvas.width, canvas.height, colors));
    }
    particles.current = [...particles.current, ...newParticles];

    // Start loop if not already running
    if (!animationFrameRef.current) {
      runConfettiLoop();
    }
  };

  const runConfettiLoop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const activeParticles = particles.current.filter((p) =>
      p.update(canvas.height)
    );
    activeParticles.forEach((p) => p.draw(ctx));
    particles.current = activeParticles;

    if (particles.current.length > 0) {
      animationFrameRef.current = requestAnimationFrame(runConfettiLoop);
    } else {
      animationFrameRef.current = null;
    }
  };

  // Adjust canvas size on resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Get current active question details
  const currentQuestion = React.useMemo(() => {
    if (!gameState.shuffledQuestionIds || gameState.shuffledQuestionIds.length === 0) return null;
    const id = gameState.shuffledQuestionIds[gameState.currentQuestionIndex];
    return questions.find((q) => q.id === id) || null;
  }, [gameState.currentQuestionIndex, gameState.shuffledQuestionIds, questions]);

  const totalQuestions = gameState.shuffledQuestionIds?.length || 0;
  const isGameOver = totalQuestions > 0 && gameState.currentQuestionIndex >= totalQuestions;

  // Determine winner
  const getGameWinner = () => {
    if (gameState.scores.grandpa > gameState.scores.grandma) return 'grandpa';
    if (gameState.scores.grandma > gameState.scores.grandpa) return 'grandma';
    return 'tie';
  };

  // Progress percentage helpers
  const getProgressPercent = (score: number) => {
    if (totalQuestions === 0) return 0;
    return Math.min(100, (score / totalQuestions) * 100);
  };

  // Background Theme Styles
  const getThemeBackground = () => {
    switch (settings.theme) {
      case 'gold':
        return 'from-slate-950 via-amber-950/20 to-slate-950';
      case 'neon':
        return 'from-black via-zinc-950 to-black';
      case 'classic':
        return 'from-gray-950 via-slate-900 to-gray-950';
      case 'forest':
      default:
        return 'from-slate-950 via-emerald-950/10 to-slate-950';
    }
  };

  const isGameStarted = totalQuestions > 0;

  if (!isGameStarted) {
    return (
      <div className={`relative w-full min-h-screen bg-gradient-to-b ${getThemeBackground()} text-slate-100 flex flex-col items-center justify-center p-6 overflow-hidden`}>
        {/* Canvas for Confetti */}
        <canvas ref={canvasRef} className="absolute inset-0 z-50 pointer-events-none w-full h-full" />
        
        {/* Decorative blur elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl w-full text-center z-10 space-y-8 glass-panel p-12 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden"
        >
          {/* Logo/Icon */}
          <div className="flex flex-col items-center space-y-4">
            <motion.div 
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="inline-flex items-center justify-center p-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full shadow-xl"
            >
              <Sparkles size={64} className="text-emerald-400" />
            </motion.div>
            <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 bg-clip-text text-transparent">
              מי אמר את זה?
            </h1>
            <p className="text-lg text-slate-400 font-semibold">
              שעשועון טריוויה משפחתי חווייתי
            </p>
          </div>

          {/* Versus Visuals */}
          <div className="grid grid-cols-3 gap-4 items-center max-w-xl mx-auto py-8">
            {/* Grandpa */}
            <div className="flex flex-col items-center space-y-3">
              <div className="w-24 h-24 rounded-2xl border-2 border-sky-500/40 p-1 bg-slate-900/60 shadow-lg overflow-hidden flex items-center justify-center">
                {settings.grandpaImage ? (
                  <img src={settings.grandpaImage} alt={settings.grandpaName} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <div className="w-full h-full bg-sky-950/40 flex items-center justify-center text-sky-400 rounded-xl text-3xl">👴</div>
                )}
              </div>
              <span className="font-bold text-lg text-sky-200">{settings.grandpaName || 'סבא'}</span>
            </div>

            {/* VS */}
            <div className="text-center">
              <span className="text-3xl font-black text-amber-500 bg-amber-500/10 px-4 py-2 rounded-2xl border border-amber-500/20 shadow-md">VS</span>
            </div>

            {/* Grandma */}
            <div className="flex flex-col items-center space-y-3">
              <div className="w-24 h-24 rounded-2xl border-2 border-fuchsia-500/40 p-1 bg-slate-900/60 shadow-lg overflow-hidden flex items-center justify-center">
                {settings.grandmaImage ? (
                  <img src={settings.grandmaImage} alt={settings.grandmaName} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <div className="w-full h-full bg-fuchsia-950/40 flex items-center justify-center text-fuchsia-400 rounded-xl text-3xl">👵</div>
                )}
              </div>
              <span className="font-bold text-lg text-fuchsia-200">{settings.grandmaName || 'סבתא'}</span>
            </div>
          </div>

          {/* Ready Check Title */}
          <div className="space-y-3">
            <h2 className="text-3xl font-extrabold text-amber-400 animate-pulse">
              האם כולם מוכנים?
            </h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              המנחה יפעיל את המשחק מלוח הבקרה בעוד מספר רגעים... הכינו את עצמכם לסיבוב של נוסטלגיה וצחוק!
            </p>
            {sync.getRoomCode() && (
              <div className="inline-block mt-4 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-2xl">
                <span className="text-slate-400 text-xs ml-2">קוד חדר להתחברות:</span>
                <strong className="text-emerald-400 font-mono text-lg font-black tracking-widest">{sync.getRoomCode()}</strong>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`relative w-full min-h-screen bg-gradient-to-b ${getThemeBackground()} text-slate-100 flex flex-col p-6 overflow-hidden`}>
      {/* Canvas for Confetti */}
      <canvas ref={canvasRef} className="absolute inset-0 z-50 pointer-events-none w-full h-full" />

      {/* Header */}
      <header className="flex justify-between items-center mb-6 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-xl border border-emerald-500/20">
            <Sparkles size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
              מי אמר את זה?
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-slate-400">שעשועון טריוויה משפחתי</p>
              {sync.getRoomCode() && (
                <>
                  <span className="text-slate-600 text-[10px]">•</span>
                  <span className="text-xs text-emerald-400 font-bold">חדר: {sync.getRoomCode()}</span>
                </>
              )}
              {members.length > 0 && (
                <>
                  <span className="text-slate-600 text-[10px]">•</span>
                  <div className="flex gap-2 text-[10px] text-slate-400 font-medium bg-slate-900/40 border border-slate-800/40 px-2 py-0.5 rounded-md">
                    <span>סה״כ צאצאים בעץ: <strong className="text-emerald-400">85</strong></span>
                    <span>|</span>
                    <span>ילדים ונכדים: <strong className="text-emerald-400">55</strong></span>
                    <span>|</span>
                    <span>נינים: <strong className="text-emerald-400">30</strong></span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {totalQuestions > 0 && !isGameOver && (
          <div className="glass-panel px-4 py-2 rounded-xl text-sm border border-slate-800">
            <span className="text-slate-400">שאלה:</span>{' '}
            <strong className="text-emerald-400 font-bold">{gameState.currentQuestionIndex + 1}</strong>
            <span className="text-slate-500"> / {totalQuestions}</span>
          </div>
        )}
      </header>

      {/* Main Grid */}
      <div className="flex-grow grid grid-cols-12 gap-6 z-10 items-stretch">
        
        {/* Left Side: Grandpa */}
        <div className="col-span-2 flex flex-col justify-between glass-panel p-4 rounded-3xl border border-slate-800/80 shadow-2xl relative overflow-hidden">
          {/* Accent Glow */}
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Grandpa Profile */}
          <div className="flex flex-col items-center text-center">
            <div className="relative w-24 h-24 rounded-3xl border-2 border-sky-500/40 p-1 bg-slate-900/60 shadow-xl overflow-hidden mb-4 flex items-center justify-center">
              {settings.grandpaImage ? (
                <img src={settings.grandpaImage} alt={settings.grandpaName} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <div className="w-full h-full bg-sky-950/40 flex items-center justify-center text-sky-400 rounded-2xl">
                  <Award size={48} className="opacity-80" />
                </div>
              )}
            </div>
            <h2 className="text-2xl font-bold text-sky-100">{settings.grandpaName}</h2>
            <span className="text-xs text-sky-400 font-semibold tracking-wider uppercase mt-1">שחקן כחול</span>
          </div>

          {/* Grandpa Score */}
          <div className="my-6 flex flex-col items-center">
            <span className="text-xs text-slate-400 mb-1">ניקוד</span>
            <div className="text-5xl font-black text-sky-400 bg-sky-950/30 w-20 h-20 rounded-full border border-sky-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(14,165,233,0.15)]">
              {gameState.scores.grandpa}
            </div>
          </div>

          {/* Grandpa Progress Bar */}
          <div className="flex flex-col items-center gap-2 mt-2">
            <span className="text-[10px] text-slate-400 font-bold">התקדמות: {Math.round(getProgressPercent(gameState.scores.grandpa))}%</span>
            <div className="w-6 h-36 bg-slate-900 rounded-full overflow-hidden border border-slate-800/80 p-[2.5px] flex flex-col justify-end">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${getProgressPercent(gameState.scores.grandpa)}%` }}
                transition={{ type: 'spring', stiffness: 60 }}
                className="w-full bg-gradient-to-t from-sky-600 to-sky-400 rounded-full shadow-[0_0_12px_rgba(14,165,233,0.5)]"
              />
            </div>
          </div>
        </div>

        {/* Center Tree Panel */}
        <div className="col-span-8 flex flex-col gap-6">
          
          {/* Question Box (Quotes) */}
          <AnimatePresence mode="wait">
            {!isGameOver && currentQuestion && (
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="glass-panel p-6 rounded-3xl border border-slate-800 shadow-2xl flex flex-col justify-center items-center relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
                <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                  ציטוט משפחתי
                </span>
                
                {/* Large statement */}
                <h3 className="text-2xl md:text-3xl font-extrabold text-center px-4 leading-relaxed text-slate-100 italic">
                  ״{currentQuestion.text}״
                </h3>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dynamic Family Tree or Question Placeholder */}
          {!gameState.isRevealed && currentQuestion && !isGameOver ? (
            <div className="flex-grow min-h-[500px] flex flex-col items-center justify-center glass-panel rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden bg-slate-950/40">
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 via-transparent to-amber-500/5 pointer-events-none" />
              <motion.div
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: [0.9, 1.05, 0.9], rotate: [-5, 5, -5] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="w-40 h-40 rounded-full bg-slate-900 border-2 border-emerald-500/30 flex items-center justify-center text-7xl font-extrabold text-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.15)] mb-6 select-none"
              >
                ❓
              </motion.div>
              <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent mb-2">
                מי אמר את זה?
              </h2>
              <p className="text-slate-400 text-sm max-w-md text-center">
                המשפחה מנסה לנחש! המנחה יחשוף את התשובה והעץ יופיע עם פתרון החידה...
              </p>
            </div>
          ) : (
            <div className="flex-grow min-h-[500px]">
              <FamilyTree
                members={members}
                settings={settings}
                solvedQuestions={gameState.solvedQuestions}
                currentSpeakerId={currentQuestion?.speakerId || null}
                isAnswerRevealed={gameState.isRevealed}
                interactive={false}
                revealedMembers={gameState.revealedSpeakers}
              />
            </div>
          )}
        </div>

        {/* Right Side: Grandma */}
        <div className="col-span-2 flex flex-col justify-between glass-panel p-4 rounded-3xl border border-slate-800/80 shadow-2xl relative overflow-hidden">
          {/* Accent Glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Grandma Profile */}
          <div className="flex flex-col items-center text-center">
            <div className="relative w-24 h-24 rounded-3xl border-2 border-fuchsia-500/40 p-1 bg-slate-900/60 shadow-xl overflow-hidden mb-4 flex items-center justify-center">
              {settings.grandmaImage ? (
                <img src={settings.grandmaImage} alt={settings.grandmaName} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <div className="w-full h-full bg-fuchsia-950/40 flex items-center justify-center text-fuchsia-400 rounded-2xl">
                  <Award size={48} className="opacity-80" />
                </div>
              )}
            </div>
            <h2 className="text-2xl font-bold text-fuchsia-100">{settings.grandmaName}</h2>
            <span className="text-xs text-fuchsia-400 font-semibold tracking-wider uppercase mt-1">שחקן סגול</span>
          </div>

          {/* Grandma Score */}
          <div className="my-6 flex flex-col items-center">
            <span className="text-xs text-slate-400 mb-1">ניקוד</span>
            <div className="text-5xl font-black text-fuchsia-400 bg-fuchsia-950/30 w-20 h-20 rounded-full border border-fuchsia-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(217,70,239,0.15)]">
              {gameState.scores.grandma}
            </div>
          </div>

          {/* Grandma Progress Bar */}
          <div className="flex flex-col items-center gap-2 mt-2">
            <span className="text-[10px] text-slate-400 font-bold">התקדמות: {Math.round(getProgressPercent(gameState.scores.grandma))}%</span>
            <div className="w-6 h-36 bg-slate-900 rounded-full overflow-hidden border border-slate-800/80 p-[2.5px] flex flex-col justify-end">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${getProgressPercent(gameState.scores.grandma)}%` }}
                transition={{ type: 'spring', stiffness: 60 }}
                className="w-full bg-gradient-to-t from-fuchsia-600 to-fuchsia-400 rounded-full shadow-[0_0_12px_rgba(217,70,239,0.5)]"
              />
            </div>
          </div>
        </div>

      </div>

      {/* End Game Modal Overlay */}
      <AnimatePresence>
        {isGameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/90 z-40 flex items-center justify-center p-6 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass-panel p-10 max-w-lg w-full rounded-3xl border border-slate-800 text-center shadow-2xl relative overflow-hidden"
            >
              {/* Confetti decoration */}
              <div className="absolute -top-16 -left-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="inline-flex items-center justify-center p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full mb-6">
                <Trophy size={48} className="animate-bounce" />
              </div>

              <h2 className="text-4xl font-extrabold text-slate-100 mb-2">
                סיום המשחק!
              </h2>
              <p className="text-slate-400 text-sm mb-6">
                כל המשפטים נפתרו, והנה התוצאות הסופיות
              </p>

              {/* Score comparisons */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-sky-950/30 border border-sky-500/20 rounded-2xl">
                  <span className="text-xs text-sky-400 font-semibold">{settings.grandpaName}</span>
                  <div className="text-3xl font-extrabold text-sky-200 mt-1">{gameState.scores.grandpa} נק׳</div>
                </div>
                <div className="p-4 bg-fuchsia-950/30 border border-fuchsia-500/20 rounded-2xl">
                  <span className="text-xs text-fuchsia-400 font-semibold">{settings.grandmaName}</span>
                  <div className="text-3xl font-extrabold text-fuchsia-200 mt-1">{gameState.scores.grandma} נק׳</div>
                </div>
              </div>

              {/* Winner Declaration */}
              <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl mb-8">
                {getGameWinner() === 'grandpa' && (
                  <div>
                    <h3 className="text-2xl font-bold text-sky-400 flex items-center justify-center gap-2">
                      🏆 {settings.grandpaName} הוא אלוף המשחק!
                    </h3>
                    <p className="text-xs text-slate-400 mt-2">ברכות לסבא הגיבור שזיהה הכי הרבה משפטים</p>
                  </div>
                )}
                {getGameWinner() === 'grandma' && (
                  <div>
                    <h3 className="text-2xl font-bold text-fuchsia-400 flex items-center justify-center gap-2">
                      🏆 {settings.grandmaName} היא אלופת המשחק!
                    </h3>
                    <p className="text-xs text-slate-400 mt-2">ברכות לסבתא המנצחת שזוכרת הכל</p>
                  </div>
                )}
                {getGameWinner() === 'tie' && (
                  <div>
                    <h3 className="text-2xl font-bold text-amber-400 flex items-center justify-center gap-2">
                      🤝 תיקו משפחתי מהמם!
                    </h3>
                    <p className="text-xs text-slate-400 mt-2">שניכם אלופים ושניכם מכירים את המשפחה מעולה</p>
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-500">
                המנחה יכול להתחיל מחדש את המשחק ממסך הניהול
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
