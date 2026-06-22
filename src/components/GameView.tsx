import React, { useState, useEffect, useRef } from 'react';
import { db, FamilyMember, GameSettings, GameState } from '../utils/db';
import { sync } from '../utils/sync';
import { audioHelper } from '../utils/audioHelper';
import { FamilyTree } from './FamilyTree';
import { Trophy, Volume2, Award, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { rtdb } from '../utils/firebase';
import { ref, set } from 'firebase/database';

export const CONTESTANT_COLORS = [
  {
    bg: 'bg-sky-950/40 border-sky-500/40 hover:bg-sky-900/40 text-sky-100',
    text: 'text-sky-400',
    glow: 'שחקן כחול',
    border: 'border-sky-500'
  },
  {
    bg: 'bg-fuchsia-950/40 border-fuchsia-500/40 hover:bg-fuchsia-900/40 text-fuchsia-100',
    text: 'text-fuchsia-400',
    glow: 'שחקן סגול',
    border: 'border-fuchsia-500'
  },
  {
    bg: 'bg-amber-950/40 border-amber-500/40 hover:bg-amber-900/40 text-amber-100',
    text: 'text-amber-400',
    glow: 'שחקן כתום',
    border: 'border-amber-500'
  },
  {
    bg: 'bg-emerald-950/40 border-emerald-500/40 hover:bg-emerald-900/40 text-emerald-100',
    text: 'text-emerald-400',
    glow: 'שחקן ירוק',
    border: 'border-emerald-500'
  }
];

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

  suckUp() {
    this.speedY = -Math.abs(this.speedY) * 1.8; // fly upwards faster
    this.speedX = this.speedX * 0.4; // move less horizontally
  }

  update(height: number) {
    this.x += this.speedX;
    this.y += this.speedY;
    this.rotation += this.rotationSpeed;
    if (this.speedY > 0) {
      return this.y < height;
    } else {
      return this.y > -50;
    }
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

    // Register game screen connection status in Firebase
    const roomCode = sync.getRoomCode();
    if (roomCode) {
      const statusRef = ref(rtdb, `rooms/${roomCode}/gameScreenConnected`);
      set(statusRef, true);
      
      return () => {
        set(statusRef, false);
      };
    }
  }, []);

  const [isAudioSuspended, setIsAudioSuspended] = useState(false);

  useEffect(() => {
    const ctx = audioHelper.getContext();
    if (ctx) {
      setIsAudioSuspended(ctx.state === 'suspended');
      const handleStateChange = () => {
        setIsAudioSuspended(ctx.state === 'suspended');
      };
      ctx.addEventListener('statechange', handleStateChange);
      return () => ctx.removeEventListener('statechange', handleStateChange);
    }
  }, []);

  // Pure Web Audio API tone generator wrapper using audioHelper
  const playGameSound = (type: 'success' | 'undo' | 'reveal' | 'winner') => {
    audioHelper.play(type);
  };

  // Sync state and listen to broadcasts
  useEffect(() => {
    const unsubscribe = sync.subscribe((msg) => {
      if (msg.type === 'STATE_CHANGED') {
        setGameState(prev => {
          if (!prev.isRevealed && msg.state.isRevealed) {
            playGameSound('reveal');
          }
          const totalQ = msg.state.shuffledQuestionIds?.length || 0;
          const prevTotalQ = prev.shuffledQuestionIds?.length || 0;
          const prevGameOver = prevTotalQ > 0 && prev.currentQuestionIndex >= prevTotalQ;
          const newGameOver = totalQ > 0 && msg.state.currentQuestionIndex >= totalQ;
          if (!prevGameOver && newGameOver) {
            playGameSound('winner');
          }
          return msg.state;
        });
      } else if (msg.type === 'SETTINGS_CHANGED') {
        setSettings(msg.settings);
        const freshSettings = db.getSettings();
        setSettings(freshSettings);
      } else if (msg.type === 'DATABASE_SYNC') {
        db.saveMembers(msg.members);
        db.saveQuestions(msg.questions);
        db.saveSettings(msg.settings);
        
        setMembers(msg.members);
        setQuestions(msg.questions);
        setSettings(msg.settings);
      } else if (msg.type === 'TRIGGER_CONFETTI') {
        if (msg.isUndo) {
          playGameSound('undo');
          particles.current.forEach(p => p.suckUp());
        } else {
          playGameSound('success');
          triggerConfetti(msg.winner);
        }
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
  const triggerConfetti = (winner: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6']; // Gold, green, etc.
    const contestantIndex = settings.contestants.findIndex(c => c.id === winner);
    if (contestantIndex === 0 || winner === 'grandpa') {
      colors = ['#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#ffffff']; // Blue tones
    } else if (contestantIndex === 1 || winner === 'grandma') {
      colors = ['#d946ef', '#f472b6', '#f0abfc', '#fbcfe8', '#ffffff']; // Purple/pink tones
    } else if (contestantIndex === 2) {
      colors = ['#f59e0b', '#f97316', '#fb923c', '#ffedd5', '#ffffff']; // Orange tones
    } else if (contestantIndex === 3) {
      colors = ['#10b981', '#34d399', '#6ee7b7', '#d1fae5', '#ffffff']; // Green tones
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
        const oldW = canvas.width;
        const oldH = canvas.height;
        const newW = window.innerWidth;
        const newH = window.innerHeight;
        
        canvas.width = newW;
        canvas.height = newH;
        
        // Scale existing particle positions to avoid warp/clipping
        if (oldW > 0 && oldH > 0) {
          particles.current.forEach(p => {
            p.x = (p.x / oldW) * newW;
            p.y = (p.y / oldH) * newH;
          });
        }
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

  // Keyboard controls for projector screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (isGameOver || questions.length === 0) return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setGameState(prev => {
          const totalQ = prev.shuffledQuestionIds.length;
          if (prev.isRevealed) {
            const nextIndex = prev.currentQuestionIndex + 1;
            const isFinished = nextIndex >= totalQ;
            const updated = {
              ...prev,
              currentQuestionIndex: isFinished ? prev.currentQuestionIndex : nextIndex,
              isRevealed: false,
              isPlaying: !isFinished
            };
            sync.sendMessage({ type: 'STATE_CHANGED', state: updated });
            return updated;
          } else {
            const updated = {
              ...prev,
              isRevealed: true
            };
            const currentQId = prev.shuffledQuestionIds[prev.currentQuestionIndex];
            const q = questions.find(item => item.id === currentQId);
            if (q) {
              const updatedRevealed = { ...prev.revealedSpeakers, [q.speakerId]: true };
              updated.revealedSpeakers = updatedRevealed;
            }
            sync.sendMessage({ type: 'STATE_CHANGED', state: updated });
            audioHelper.play('reveal');
            return updated;
          }
        });
      } else if (e.key === 'ArrowRight') {
        setGameState(prev => {
          const totalQ = prev.shuffledQuestionIds.length;
          const nextIndex = prev.currentQuestionIndex + 1;
          if (nextIndex < totalQ) {
            const updated = {
              ...prev,
              currentQuestionIndex: nextIndex,
              isRevealed: false
            };
            sync.sendMessage({ type: 'STATE_CHANGED', state: updated });
            return updated;
          }
          return prev;
        });
      } else if (e.key === 'ArrowLeft') {
        setGameState(prev => {
          if (prev.currentQuestionIndex > 0) {
            const updated = {
              ...prev,
              currentQuestionIndex: prev.currentQuestionIndex - 1,
              isRevealed: false
            };
            sync.sendMessage({ type: 'STATE_CHANGED', state: updated });
            return updated;
          }
          return prev;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [questions, isGameOver]);

  // Determine winner
  const getGameWinner = () => {
    let maxScore = -1;
    let winnerId = 'tie';
    let isTie = false;
    
    settings.contestants.forEach(c => {
      const score = gameState.scores[c.id] || 0;
      if (score > maxScore) {
        maxScore = score;
        winnerId = c.id;
        isTie = false;
      } else if (score === maxScore) {
        isTie = true;
      }
    });

    return isTie ? 'tie' : winnerId;
  };

  // Split contestants into left and right columns
  const leftContestants = React.useMemo(() => {
    if (!settings.contestants || settings.contestants.length === 0) return [];
    if (settings.contestants.length <= 2) return [settings.contestants[0]];
    if (settings.contestants.length === 3) return [settings.contestants[0]];
    return [settings.contestants[0], settings.contestants[1]]; // 4 players
  }, [settings.contestants]);

  const rightContestants = React.useMemo(() => {
    if (!settings.contestants || settings.contestants.length <= 1) return [];
    if (settings.contestants.length === 2) return [settings.contestants[1]];
    if (settings.contestants.length === 3) return [settings.contestants[1], settings.contestants[2]];
    return [settings.contestants[2], settings.contestants[3]]; // 4 players
  }, [settings.contestants]);

  // Progress percentage helpers
  const getProgressPercent = (score: number) => {
    if (totalQuestions === 0) return 0;
    return Math.min(100, (score / totalQuestions) * 100);
  };

  const renderContestantColumn = (colContestants: typeof settings.contestants, startGlobalIndex: number) => {
    const isCompact = colContestants.length > 1;
    return (
      <div className="col-span-2 flex flex-col gap-4 justify-between h-full">
        {colContestants.map((c, index) => {
          const globalIndex = startGlobalIndex + index;
          const colors = CONTESTANT_COLORS[globalIndex % CONTESTANT_COLORS.length];
          const score = gameState.scores[c.id] || 0;
          const progress = getProgressPercent(score);

          if (isCompact) {
            return (
              <div key={c.id} className="glass-panel p-4 rounded-3xl border border-slate-800/80 shadow-2xl relative overflow-hidden flex flex-col justify-between items-center flex-grow">
                {/* Accent Glow */}
                <div className={`absolute -top-12 -right-12 w-24 h-24 bg-${colors.border.split('-')[1]}-500/10 rounded-full blur-2xl pointer-events-none`} />
                
                <div className="flex flex-col items-center text-center">
                  <div className={`relative w-16 h-16 rounded-2xl border-2 ${colors.border}/45 p-0.5 bg-slate-900/60 shadow-xl overflow-hidden mb-2 flex items-center justify-center`}>
                    {c.image ? (
                      <img src={c.image} alt={c.name} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <div className={`w-full h-full bg-${colors.border.split('-')[1]}-950/40 flex items-center justify-center ${colors.text} rounded-xl`}>
                        <Award size={28} className="opacity-80" />
                      </div>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-slate-100 truncate max-w-[120px]">{c.name}</h2>
                  <span className={`text-[9px] ${colors.text} font-semibold tracking-wider uppercase mt-0.5`}>{colors.glow}</span>
                </div>

                <div className="my-2 flex flex-col items-center">
                  <div className={`text-3xl font-black ${colors.text} bg-${colors.border.split('-')[1]}-955/30 w-12 h-12 rounded-full border ${colors.border}/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.2)]`}>
                    {score}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1 mt-1 w-full">
                  <span className="text-[8px] text-slate-400 font-bold">התקדמות: {Math.round(progress)}%</span>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-850 p-[1px]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ type: 'spring', stiffness: 60 }}
                      className={`h-full bg-gradient-to-r from-${colors.border.split('-')[1]}-600 to-${colors.border.split('-')[1]}-400 rounded-full`}
                    />
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={c.id} className="glass-panel p-4 rounded-3xl border border-slate-800/80 shadow-2xl relative overflow-hidden flex flex-col justify-between items-center h-full flex-grow">
              {/* Accent Glow */}
              <div className={`absolute -top-12 -right-12 w-32 h-32 bg-${colors.border.split('-')[1]}-500/10 rounded-full blur-3xl pointer-events-none`} />

              <div className="flex flex-col items-center text-center">
                <div className={`relative w-24 h-24 rounded-3xl border-2 ${colors.border}/40 p-1 bg-slate-900/60 shadow-xl overflow-hidden mb-4 flex items-center justify-center`}>
                  {c.image ? (
                    <img src={c.image} alt={c.name} className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    <div className={`w-full h-full bg-${colors.border.split('-')[1]}-955/40 flex items-center justify-center ${colors.text} rounded-2xl`}>
                      <Award size={48} className="opacity-80" />
                    </div>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-slate-100 truncate max-w-[180px]" title={c.name}>{c.name}</h2>
                <span className={`text-xs ${colors.text} font-semibold tracking-wider uppercase mt-1`}>{colors.glow}</span>
              </div>

              <div className="my-6 flex flex-col items-center">
                <span className="text-xs text-slate-400 mb-1">ניקוד</span>
                <div className={`text-5xl font-black ${colors.text} bg-${colors.border.split('-')[1]}-950/30 w-20 h-20 rounded-full border ${colors.border}/30 flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.3)]`}>
                  {score}
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 mt-2">
                <span className="text-[10px] text-slate-400 font-bold">התקדמות: {Math.round(progress)}%</span>
                <div className="w-6 h-36 bg-slate-900 rounded-full overflow-hidden border border-slate-800/80 p-[2.5px] flex flex-col justify-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${progress}%` }}
                    transition={{ type: 'spring', stiffness: 60 }}
                    className={`w-full bg-gradient-to-t from-${colors.border.split('-')[1]}-600 to-${colors.border.split('-')[1]}-400 rounded-full`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
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

  const totalDescendants = members.filter(m => m.generation !== 'grandparent').length;
  const childrenAndGrandchildren = members.filter(m => m.generation === 'parent' || m.generation === 'child' || m.generation === 'grandchild').length;
  const greatGrandchildren = members.filter(m => m.generation === 'great-grandchild').length;

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
                    <span>סה״כ צאצאים בעץ: <strong className="text-emerald-400">{totalDescendants}</strong></span>
                    <span>|</span>
                    <span>ילדים ונכדים: <strong className="text-emerald-400">{childrenAndGrandchildren}</strong></span>
                    <span>|</span>
                    <span>נינים: <strong className="text-emerald-400">{greatGrandchildren}</strong></span>
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
        
        {/* Left Column (Contestants 1 & 2) */}
        {renderContestantColumn(leftContestants, 0)}

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

          {/* Dynamic Family Tree, Speaker Reveal or Question Placeholder */}
          {!gameState.isRevealed && currentQuestion && !isGameOver ? (
            <div className="flex-grow min-h-[500px] flex flex-col items-center justify-center relative overflow-hidden">
              <motion.div
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: [0.9, 1.05, 0.9], rotate: [-5, 5, -5] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="text-9xl mb-6 select-none text-emerald-400 drop-shadow-[0_0_35px_rgba(16,185,129,0.3)] flex items-center justify-center"
              >
                ❓
              </motion.div>
              <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent mb-2">
                מי אמר את זה?
              </h2>
              <p className="text-slate-400 text-sm max-w-md text-center">
                המשפחה מנסה לנחש! המנחה יחשוף את התשובה והדובר יתגלה...
              </p>
            </div>
          ) : (
            <div className="flex-grow min-h-[500px] flex flex-col">
              {settings.treeLayout === 'none' ? (
                (() => {
                  const speaker = members.find(m => m.id === currentQuestion?.speakerId);
                  return (
                    <div className="flex-grow min-h-[500px] flex flex-col items-center justify-center glass-panel rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden bg-slate-950/40 p-8">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 100, damping: 15 }}
                        className="flex flex-col items-center text-center relative z-10 space-y-6"
                      >
                        <span className="text-emerald-400 text-sm font-bold uppercase tracking-widest px-4 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                          הדובר נחשף! 🎉
                        </span>

                        <div className="relative">
                          <div className="absolute -inset-2 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-full blur opacity-70 animate-pulse" />
                          <div className="relative w-44 h-44 rounded-full border-4 border-slate-900 bg-slate-900 overflow-hidden shadow-2xl flex items-center justify-center">
                            {speaker?.image ? (
                              <img src={speaker.image} alt={speaker.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-b from-slate-850 to-slate-950 flex items-center justify-center text-8xl select-none">
                                {speaker?.gender === 'female' ? '👵' : '👴'}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <h2 className="text-5xl font-black bg-gradient-to-r from-emerald-400 via-teal-200 to-emerald-400 bg-clip-text text-transparent drop-shadow-md">
                            {speaker?.name}
                          </h2>
                          {speaker?.familyName && (
                            <p className="text-xl text-slate-400 font-medium">{speaker.familyName}</p>
                          )}
                        </div>

                        <p className="text-slate-400 text-sm max-w-sm italic">
                          ״אמר/ה את הציטוט בהתרגשות רבה!״
                        </p>
                      </motion.div>
                    </div>
                  );
                })()
              ) : (
                <FamilyTree
                  members={members}
                  settings={settings}
                  solvedQuestions={gameState.solvedQuestions}
                  currentSpeakerId={currentQuestion?.speakerId || null}
                  isAnswerRevealed={gameState.isRevealed}
                  interactive={false}
                  revealedMembers={gameState.revealedSpeakers}
                />
              )}
            </div>
          )}
        </div>

        {/* Right Column (Contestants 3 & 4) */}
        {renderContestantColumn(rightContestants, leftContestants.length)}

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
              className="glass-panel p-10 max-w-2xl w-full rounded-3xl border border-slate-800 text-center shadow-2xl relative overflow-hidden"
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
              <div className={`grid gap-4 mb-8 ${settings.contestants.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'}`}>
                {settings.contestants.map((c, index) => {
                  const colors = CONTESTANT_COLORS[index % CONTESTANT_COLORS.length];
                  return (
                    <div key={c.id} className={`p-4 bg-slate-900 border ${colors.border}/20 rounded-2xl`}>
                      <span className={`text-xs ${colors.text} font-semibold`}>{c.name}</span>
                      <div className="text-3xl font-extrabold text-slate-200 mt-1">{(gameState.scores[c.id] || 0)} נק׳</div>
                    </div>
                  );
                })}
              </div>

              {/* Winner Declaration */}
              <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl mb-8">
                {getGameWinner() === 'tie' ? (
                  <div>
                    <h3 className="text-2xl font-bold text-amber-400 flex items-center justify-center gap-2">
                      🤝 תיקו משפחתי מהמם!
                    </h3>
                    <p className="text-xs text-slate-400 mt-2">שניכם אלופים ושניכם מכירים את המשפחה מעולה</p>
                  </div>
                ) : (() => {
                  const winnerContestant = settings.contestants.find(c => c.id === getGameWinner());
                  const winnerIndex = settings.contestants.findIndex(c => c.id === getGameWinner());
                  const colors = CONTESTANT_COLORS[winnerIndex % CONTESTANT_COLORS.length] || CONTESTANT_COLORS[0];
                  const name = winnerContestant?.name || '';
                  const pronoun = name.endsWith('ה') || name.endsWith('ת') ? 'אלופת' : 'אלוף';
                  const greeting = name.endsWith('ה') || name.endsWith('ת') ? 'ברכות למנצחת שזוכרת הכל' : 'ברכות לגיבור שזיהה הכי הרבה משפטים';
                  return (
                    <div>
                      <h3 className={`text-2xl font-bold ${colors.text} flex items-center justify-center gap-2`}>
                        🏆 {name} {name.endsWith('ה') || name.endsWith('ת') ? 'היא' : 'הוא'} {pronoun} המשחק!
                      </h3>
                      <p className="text-xs text-slate-400 mt-2">{greeting}</p>
                    </div>
                  );
                })()}
              </div>

              <div className="text-xs text-slate-500">
                המנחה יכול להתחיל מחדש את המשחק ממסך הניהול
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isAudioSuspended && (
        <button
          onClick={async () => {
            const success = await audioHelper.resume();
            if (success) {
              setIsAudioSuspended(false);
              audioHelper.play('success');
            }
          }}
          className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-full shadow-2xl border border-amber-300 transition-all duration-300 animate-bounce"
        >
          <Volume2 size={18} />
          <span>הפעל שמע 🔊</span>
        </button>
      )}
    </div>
  );
});
