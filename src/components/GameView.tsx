import React, { useState, useEffect, useRef } from 'react';
import { db, FamilyMember, GameSettings, GameState, healGameState, ensureArray, TriviaQuestion, Contestant } from '../utils/db';
import { sync } from '../utils/sync';
import { audioHelper } from '../utils/audioHelper';
import { Trophy, Volume2, Award, Sparkles, RefreshCw, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { rtdb } from '../utils/firebase';
import { ref, set, update, onValue, off, get, onDisconnect } from 'firebase/database';

function CountdownTimer({ duration, isRevealed, currentQuestionId, isPaused }: { duration: number; isRevealed: boolean; currentQuestionId: string; isPaused: boolean }) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    setTimeLeft(duration);
  }, [duration, currentQuestionId]);

  useEffect(() => {
    if (isRevealed || isPaused || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        const next = prev - 1;
        if (next === 5) {
          audioHelper.play('undo'); // Play warning buzzer at 5 seconds remaining
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRevealed, isPaused, timeLeft, currentQuestionId]);

  if (isRevealed) return null;

  const percentage = (timeLeft / duration) * 100;
  const isLowTime = timeLeft <= 5;

  return (
    <div className="w-full mt-4 space-y-1" dir="rtl">
      <div className="flex justify-between text-[10px] font-bold text-slate-400">
        <span>⏱️ נותר זמן: {timeLeft} שניות</span>
        {timeLeft === 0 && <span className="text-rose-400 animate-pulse font-black">⌛ נגמר הזמן!</span>}
      </div>
      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-[1px]">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ${
            isLowTime ? 'bg-gradient-to-r from-rose-600 to-rose-400 animate-pulse' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export const CONTESTANT_COLORS = [
  {
    bg: 'bg-sky-950/40 border-sky-500/40 hover:bg-sky-900/40 text-sky-100',
    text: 'text-sky-400',
    glow: 'שחקן כחול',
    border: 'border-sky-500',
    gradient: 'from-sky-600 to-sky-400',
    scoreBg: 'bg-sky-955/30',
    imageFallbackBg: 'bg-sky-955/40',
    accentGlow: 'bg-sky-500/10',
    shadowGlow: 'shadow-sky-500/20'
  },
  {
    bg: 'bg-fuchsia-950/40 border-fuchsia-500/40 hover:bg-fuchsia-900/40 text-fuchsia-100',
    text: 'text-fuchsia-400',
    glow: 'שחקן סגול',
    border: 'border-fuchsia-500',
    gradient: 'from-fuchsia-600 to-fuchsia-400',
    scoreBg: 'bg-fuchsia-955/30',
    imageFallbackBg: 'bg-fuchsia-955/40',
    accentGlow: 'bg-fuchsia-500/10',
    shadowGlow: 'shadow-fuchsia-500/20'
  },
  {
    bg: 'bg-amber-950/40 border-amber-500/40 hover:bg-amber-900/40 text-amber-100',
    text: 'text-amber-400',
    glow: 'שחקן כתום',
    border: 'border-amber-500',
    gradient: 'from-amber-600 to-amber-400',
    scoreBg: 'bg-amber-955/30',
    imageFallbackBg: 'bg-amber-955/40',
    accentGlow: 'bg-amber-500/10',
    shadowGlow: 'shadow-amber-500/20'
  },
  {
    bg: 'bg-emerald-950/40 border-emerald-500/40 hover:bg-emerald-900/40 text-emerald-100',
    text: 'text-emerald-400',
    glow: 'שחקן ירוק',
    border: 'border-emerald-500',
    gradient: 'from-emerald-600 to-emerald-400',
    scoreBg: 'bg-emerald-955/30',
    imageFallbackBg: 'bg-emerald-955/40',
    accentGlow: 'bg-emerald-500/10',
    shadowGlow: 'shadow-emerald-500/20'
  },
  {
    bg: 'bg-rose-950/40 border-rose-500/40 hover:bg-rose-900/40 text-rose-100',
    text: 'text-rose-400',
    glow: 'שחקן אדום',
    border: 'border-rose-500',
    gradient: 'from-rose-600 to-rose-400',
    scoreBg: 'bg-rose-955/30',
    imageFallbackBg: 'bg-rose-955/40',
    accentGlow: 'bg-rose-500/10',
    shadowGlow: 'shadow-rose-500/20'
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
    this.speedX = Math.random() * 2 - 1;
    this.speedY = Math.random() * 2.5 + 1.5;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 2 - 1;
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

const healSettings = (s: any): GameSettings => {
  const defaultSettings = db.getSettings();
  if (!s) return defaultSettings;
  const parsed = { ...s };
  parsed.contestants = ensureArray<Contestant>(parsed.contestants);
  if (parsed.contestants.length < 2) {
    parsed.contestants = [
      { id: 'contestant_1', name: 'כחול', image: null },
      { id: 'contestant_2', name: 'סגול', image: null }
    ];
  }
  if (parsed.hostName === undefined) {
    parsed.hostName = '';
  }
  if (parsed.showNameBank === undefined) {
    parsed.showNameBank = false;
  }
  if (parsed.showDetailedGalleryPage === undefined) {
    parsed.showDetailedGalleryPage = true;
  }
  return parsed;
};

export const GameView: React.FC = React.memo(() => {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [settings, setSettings] = useState<GameSettings>(healSettings(db.getSettings()));
  const [gameState, setGameState] = useState<GameState>(db.getGameState());
  const [isLoading, setIsLoading] = useState<boolean>(!!sync.getRoomCode());
  const [roomError, setRoomError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(5);
  const [startCountdownValue, setStartCountdownValue] = useState<number | null>(null);

  const startIntervalRef = useRef<any>(null);
  const winnerIntervalRef = useRef<any>(null);

  // Tick down the start countdown - robust interval implementation using useRef to prevent resetting when state changes
  useEffect(() => {
    if (startCountdownValue === 10) {
      if (startIntervalRef.current) {
        clearInterval(startIntervalRef.current);
      }

      audioHelper.startIntroMusic();
      audioHelper.play('countdown-tick');

      startIntervalRef.current = setInterval(() => {
        setStartCountdownValue(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(startIntervalRef.current);
            startIntervalRef.current = null;
            audioHelper.stopIntroMusic();
            audioHelper.play('game-start-boom');
            setTimeout(() => {
              setStartCountdownValue(null);
              setGameState(current => {
                if (current.startStage === 'starting') {
                  const updated = { ...current, startStage: 'in_game' as const };
                  sync.sendMessage({ type: 'STATE_CHANGED', state: updated });
                  return updated;
                }
                return current;
              });
            }, 2200);
            return 0;
          }
          audioHelper.play('countdown-tick');
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (startCountdownValue === null && startIntervalRef.current) {
        clearInterval(startIntervalRef.current);
        startIntervalRef.current = null;
      }
    };
  }, [startCountdownValue]);

  useEffect(() => {
    if (gameState.startStage === 'starting' && startCountdownValue === null) {
      setStartCountdownValue(10);
    }
  }, [gameState.startStage]);
  
  const hostLabel = settings.hostName || 'המנחה';
  const contestantNames = (settings.contestants || []).map(c => c.name).join(' ו-');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const particles = useRef<ConfettiParticle[]>([]);

  // Countdown for room error redirect
  useEffect(() => {
    if (roomError && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (roomError && countdown === 0) {
      window.location.href = window.location.origin + window.location.pathname;
    }
  }, [roomError, countdown]);

  const [winnerRevealTimer, setWinnerRevealTimer] = useState<number>(0);
  const [hasTriggeredWinnerReveal, setHasTriggeredWinnerReveal] = useState<boolean>(false);
  const [securityError, setSecurityError] = useState<boolean>(false);
  
  const [galleryTransitionTimer, setGalleryTransitionTimer] = useState<number | null>(null);
  const galleryIntervalRef = useRef<any>(null);

  // Suspense timer for winner reveal - Trigger Check
  useEffect(() => {
    const totalQ = (gameState.shuffledQuestionIds || []).length;
    const isGameOver = totalQ > 0 && gameState.currentQuestionIndex >= totalQ;
    
    if (isGameOver) {
      if (gameState.winnerRevealed) {
        setWinnerRevealTimer(0);
        if (gameState.galleryRevealed) {
          setGalleryTransitionTimer(0);
        }
        setHasTriggeredWinnerReveal(true);
      } else if (!hasTriggeredWinnerReveal && winnerRevealTimer === 0) {
        setWinnerRevealTimer(10); // 10 second suspense timer for maximum drama
        setHasTriggeredWinnerReveal(true);
      }
    } else {
      if (hasTriggeredWinnerReveal) {
        setHasTriggeredWinnerReveal(false);
        setWinnerRevealTimer(0);
      }
    }
  }, [gameState.currentQuestionIndex, gameState.shuffledQuestionIds, hasTriggeredWinnerReveal, gameState.winnerRevealed]);

  // Suspense timer for winner reveal - Tick Down - robust interval implementation using useRef to prevent resetting when state changes
  useEffect(() => {
    if (winnerRevealTimer === 10) {
      if (winnerIntervalRef.current) {
        clearInterval(winnerIntervalRef.current);
      }

      audioHelper.startSuspenseMusic();
      audioHelper.play('countdown-tick');

      winnerIntervalRef.current = setInterval(() => {
        setWinnerRevealTimer(prev => {
          if (prev <= 1) {
            clearInterval(winnerIntervalRef.current);
            winnerIntervalRef.current = null;
            audioHelper.stopSuspenseMusic();
            audioHelper.play('victory');
            
            // Countdown finished! Set winnerRevealed to true in Firebase DB
            const roomCode = sync.getRoomCode();
            if (roomCode) {
              const stateRef = ref(rtdb, `rooms/${roomCode}/database/state`);
              update(stateRef, {
                winnerRevealed: true
              }).catch(err => console.error("Failed to update winnerRevealed in DB:", err));
            }

            return 0;
          }
          audioHelper.play('countdown-tick');
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (winnerRevealTimer === 0 && winnerIntervalRef.current) {
        clearInterval(winnerIntervalRef.current);
        winnerIntervalRef.current = null;
      }
    };
  }, [winnerRevealTimer, gameState]);

  // Load initial data
  useEffect(() => {
    const initData = async () => {
      const roomCode = sync.getRoomCode();
      if (roomCode) {
        try {
          const data = await sync.fetchCurrentRoomDatabase();
          if (data) {
            const fbMembers = ensureArray<FamilyMember>(data.db?.members);
            const fbQuestions = ensureArray<TriviaQuestion>(data.db?.questions);
            const fbSettings = data.settings || data.db?.settings || {};
            const fbState = data.state || data.db?.state || {};

            db.saveMembers(fbMembers);
            db.saveQuestions(fbQuestions);
            
            const currentSettings = db.getSettings();
            const mergedSettings = healSettings({ ...currentSettings, ...fbSettings });
            db.saveSettings(mergedSettings);
            
            const currentGameState = db.getGameState();
            const mergedState = healGameState({ ...currentGameState, ...fbState }, mergedSettings);
            db.saveGameState(mergedState);

            const storedHostName = (mergedSettings.hostName || '').trim();
            const urlParams = new URLSearchParams(window.location.search);
            const urlHostName = (urlParams.get('host') || '').trim();

            if (storedHostName && urlHostName.toLowerCase() !== storedHostName.toLowerCase()) {
              setSecurityError(true);
              setIsLoading(false);
              return;
            }

            setMembers(fbMembers);
            setQuestions(fbQuestions);
            setSettings(mergedSettings);
            setGameState(mergedState);
            setIsLoading(false);
            return;
          } else {
            // Room doesn't exist, show error in app
            setRoomError('החדר לא קיים במערכת. אנא בדוק את מספר החדר ונסה שוב.');
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.error("Failed to load initial room database for GameView from Firebase, falling back to localStorage", e);
        }
      }

      // Local storage fallback
      setMembers(db.getMembers());
      setQuestions(db.getQuestions());
      setSettings(db.getSettings());
      setGameState(db.getGameState());
      setIsLoading(false);
    };

    initData();

    // Register game screen connection status in Firebase
    const roomCode = sync.getRoomCode();
    if (roomCode) {
      const statusRef = ref(rtdb, `rooms/${roomCode}/gameScreenConnected`);
      const roomRef = ref(rtdb, `rooms/${roomCode}/database`);
      const connectedRef = ref(rtdb, ".info/connected");
      let unsubscribeConnected: (() => void) | null = null;
      
      // Set game screen status directly to register connection presence instantly
      unsubscribeConnected = onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
          set(statusRef, true);
          onDisconnect(statusRef).set(false);
        }
      });
      
      const handleUnload = () => {
        set(statusRef, false);
      };
      window.addEventListener('beforeunload', handleUnload);

      return () => {
        window.removeEventListener('beforeunload', handleUnload);
        if (unsubscribeConnected) unsubscribeConnected();
        set(statusRef, false);
      };
    }
  }, []);

  // Real-time Firebase database listeners for GameView settings/state/members/questions
  useEffect(() => {
    const roomCode = sync.getRoomCode();
    if (!roomCode) return;

    // Listen to settings
    const settingsRef = ref(rtdb, `rooms/${roomCode}/database/settings`);
    const unsubscribeSettings = onValue(settingsRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const healedSettings = healSettings(val);
        db.saveSettings(healedSettings);
        setSettings(healedSettings);
      }
    });

    // Listen to state
    const stateRef = ref(rtdb, `rooms/${roomCode}/database/state`);
    const unsubscribeState = onValue(stateRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const healedState = healGameState(val, settings);
        db.saveGameState(healedState);
        setGameState(prev => {
          if (!prev.isRevealed && healedState.isRevealed) {
            playGameSound('reveal');
          }
          return healedState;
        });
      }
    });

    // Listen to members
    const membersRef = ref(rtdb, `rooms/${roomCode}/database/db/members`);
    const unsubscribeMembers = onValue(membersRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const arr = ensureArray<FamilyMember>(val);
        db.saveMembers(arr);
        setMembers(arr);
      }
    });

    // Listen to questions
    const questionsRef = ref(rtdb, `rooms/${roomCode}/database/db/questions`);
    const unsubscribeQuestions = onValue(questionsRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const arr = ensureArray<TriviaQuestion>(val);
        db.saveQuestions(arr);
        setQuestions(arr);
      }
    });

    return () => {
      unsubscribeSettings();
      unsubscribeState();
      unsubscribeMembers();
      unsubscribeQuestions();
    };
  }, []);

  const [isAudioSuspended, setIsAudioSuspended] = useState(false);
  const [isBgMusicMuted, setIsBgMusicMuted] = useState(false);

  // Sync mute state with AudioHelper
  useEffect(() => {
    audioHelper.setMute(isBgMusicMuted);
  }, [isBgMusicMuted]);

  // Background music effect
  useEffect(() => {
    const totalQ = (gameState.shuffledQuestionIds || []).length;
    const isGameOver = totalQ > 0 && gameState.currentQuestionIndex >= totalQ;
    
    // Play background music if game is active, not over, not paused, and countdown is finished
    const isRunning = gameState.isPlaying && !isGameOver && startCountdownValue === null && !gameState.isPaused;

    if (!isAudioSuspended && !isBgMusicMuted && isRunning) {
      audioHelper.startBackgroundMusic();
    } else {
      audioHelper.stopBackgroundMusic();
    }

    // Play calm pause music if game is active, not over, and is paused
    const isPausedMode = gameState.isPlaying && !isGameOver && gameState.isPaused;
    if (!isAudioSuspended && !isBgMusicMuted && isPausedMode) {
      audioHelper.startPauseMusic();
    } else {
      audioHelper.stopPauseMusic();
    }

    return () => {
      audioHelper.stopBackgroundMusic();
      audioHelper.stopPauseMusic();
    };
  }, [isAudioSuspended, isBgMusicMuted, gameState.isPlaying, startCountdownValue, gameState.isPaused]);

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
        const healedState = healGameState(msg.state, settings);
        setGameState(prev => {
          if (!prev.isRevealed && healedState.isRevealed) {
            playGameSound('reveal');
          }
          const totalQ = healedState.shuffledQuestionIds?.length || 0;
          const prevTotalQ = prev.shuffledQuestionIds?.length || 0;
          const prevGameOver = prevTotalQ > 0 && prev.currentQuestionIndex >= prevTotalQ;
          const newGameOver = totalQ > 0 && healedState.currentQuestionIndex >= totalQ;
          if (!prevGameOver && newGameOver) {
            playGameSound('winner');
          }
          return healedState;
        });
      } else if (msg.type === 'SETTINGS_CHANGED') {
        const healedSettings = healSettings(msg.settings);
        db.saveSettings(healedSettings);
        setSettings(healedSettings);
      } else if (msg.type === 'DATABASE_SYNC') {
        const healedSettings = healSettings(msg.settings);
        const fbMembers = ensureArray<FamilyMember>(msg.members);
        const fbQuestions = ensureArray<TriviaQuestion>(msg.questions);
        db.saveMembers(fbMembers);
        db.saveQuestions(fbQuestions);
        db.saveSettings(healedSettings);
        
        setMembers(fbMembers);
        setQuestions(fbQuestions);
        setSettings(healedSettings);
      } else if (msg.type === 'TRIGGER_CONFETTI') {
        if (msg.isUndo) {
          playGameSound('undo');
          particles.current.forEach(p => p.suckUp());
        } else {
          playGameSound('success');
          triggerConfetti(msg.winner);
        }
      } else if (msg.type === 'START_GAME_COUNTDOWN') {
        setStartCountdownValue(10);
      }
    });

    // Request full database sync from the active host (phone) when mounting if not in Firebase mode
    if (!sync.getRoomCode()) {
      sync.sendMessage({ type: 'REQUEST_DATABASE' });
    }

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
    const contestantIndex = settings.contestants?.findIndex(c => c.id === winner) ?? -1;
    if (contestantIndex === 0) {
      colors = ['#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#ffffff']; // Blue tones
    } else if (contestantIndex === 1) {
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
  const isGameLoaded = totalQuestions > 0;

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
          const totalQ = (prev.shuffledQuestionIds || []).length;
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
            const currentQId = (prev.shuffledQuestionIds || [])[prev.currentQuestionIndex];
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
          const totalQ = (prev.shuffledQuestionIds || []).length;
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
    
    (settings.contestants || []).forEach(c => {
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
    if (!settings?.contestants || settings.contestants.length === 0) return [];
    if (settings.contestants.length <= 2) return [settings.contestants[0]];
    if (settings.contestants.length === 3) return [settings.contestants[0]];
    return [settings.contestants[0], settings.contestants[1]]; // 4 players
  }, [settings?.contestants]);

  const rightContestants = React.useMemo(() => {
    if (!settings?.contestants || settings.contestants.length <= 1) return [];
    if (settings.contestants.length === 2) return [settings.contestants[1]];
    if (settings.contestants.length === 3) return [settings.contestants[1], settings.contestants[2]];
    return [settings.contestants[2], settings.contestants[3]]; // 4 players
  }, [settings?.contestants]);

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
                <div className={`absolute -top-12 -right-12 w-24 h-24 ${colors.accentGlow} rounded-full blur-2xl pointer-events-none`} />
                
                <div className="flex flex-col items-center text-center">
                  <div className={`relative w-16 h-16 rounded-full border-2 ${colors.border}/45 p-0.5 bg-slate-900/60 shadow-xl overflow-hidden mb-2 flex items-center justify-center`}>
                    {c.image ? (
                      <img src={c.image} alt={c.name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <div className={`w-full h-full ${colors.imageFallbackBg} flex items-center justify-center ${colors.text} rounded-full`}>
                        <Award size={28} className="opacity-80" />
                      </div>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-slate-100 truncate truncate-name max-w-[120px]">{c.name}</h2>
                </div>

                <div className="my-2 flex flex-col items-center">
                  <div className={`text-3xl font-black ${colors.text} ${colors.scoreBg} w-12 h-12 rounded-full border ${colors.border}/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.2)]`}>
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
                      className={`h-full bg-gradient-to-r ${colors.gradient} rounded-full`}
                    />
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={c.id} className="glass-panel p-4 rounded-3xl border border-slate-800/80 shadow-2xl relative overflow-hidden flex flex-col justify-between items-center h-full flex-grow">
              {/* Accent Glow */}
              <div className={`absolute -top-12 -right-12 w-32 h-32 ${colors.accentGlow} rounded-full blur-3xl pointer-events-none`} />

              <div className="flex flex-col items-center text-center">
                <div className={`relative w-24 h-24 rounded-full border-2 ${colors.border}/40 p-1 bg-slate-900/60 shadow-xl overflow-hidden mb-4 flex items-center justify-center`}>
                  {c.image ? (
                    <img src={c.image} alt={c.name} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <div className={`w-full h-full ${colors.imageFallbackBg} flex items-center justify-center ${colors.text} rounded-full`}>
                      <Award size={48} className="opacity-80" />
                    </div>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-slate-100 truncate truncate-name max-w-[180px]" title={c.name}>{c.name}</h2>
              </div>

              <div className="my-6 flex flex-col items-center">
                <span className="text-xs text-slate-400 mb-1">ניקוד</span>
                <div className={`text-5xl font-black ${colors.text} ${colors.scoreBg} w-20 h-20 rounded-full border ${colors.border}/30 flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.3)]`}>
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
                    className={`w-full bg-gradient-to-t ${colors.gradient} rounded-full`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };



  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 text-emerald-400" dir="rtl">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-bold">טוען נתוני חדר...</span>
      </div>
    );
  }

  if (securityError) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full animate-bounce">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-black text-rose-400">גישה חסומה (שגיאת אבטחה)</h2>
            <p className="text-slate-305 text-sm leading-relaxed font-semibold">
              שם המנחה בקישור חסר או אינו תואם למנחה שהגדיר חדר זה.
            </p>
            <p className="text-slate-400 text-xs font-medium">
              מסך ההקרנה דורש זיהוי מנחה תקין לצורכי אבטחת גישה.
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

  const isInitialSetup = (settings?.setupComplete === false && !gameState.startStage);

  // Pause screen when host is away
  if (gameState.isPaused && !isInitialSetup) {
    return (
      <div className="relative w-full min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 overflow-hidden">
        {/* Decorative blur elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
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
              className="inline-flex items-center justify-center p-6 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full shadow-xl"
            >
              <RefreshCw size={64} className="text-amber-400" />
            </motion.div>
            <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-amber-400 via-orange-300 to-yellow-400 bg-clip-text text-transparent">
              המשחק מושהה
            </h1>
            <p className="text-xl text-slate-300 mt-4">
              <strong className="font-black text-amber-400">{hostLabel}</strong> יחזור בקרוב...
            </p>
            <p className="text-sm text-slate-400">
              המשחק ימשיך מאיפה שהוא עצר
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isInitialSetup) {
    return (
      <div className="relative w-full min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 overflow-hidden">
        {/* Canvas for Confetti */}
        <canvas ref={canvasRef} className="absolute inset-0 z-50 pointer-events-none w-full h-full" />
        
        {/* Background Music Toggle Button */}
        {!isAudioSuspended && (
          <button
            onClick={() => setIsBgMusicMuted(prev => !prev)}
            className="fixed top-6 left-6 z-50 p-3 bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-emerald-400 rounded-full border border-slate-800/80 hover:border-emerald-500/30 transition-all duration-300 shadow-lg flex items-center justify-center backdrop-blur-sm"
            title={isBgMusicMuted ? "הפעל מוזיקת רקע" : "השתק מוזיקת רקע"}
          >
            {isBgMusicMuted ? <VolumeX size={20} /> : <Volume2 size={20} className="animate-pulse" />}
          </button>
        )}

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

          {/* Dynamic Contestants Display */}
          <div className={`flex flex-wrap items-center justify-center max-w-2xl mx-auto py-8 ${
            (settings.contestants || []).length <= 2 ? 'gap-8' : 'gap-4'
          }`}>
            {(settings.contestants || []).map((contestant, index) => {
              const colors = CONTESTANT_COLORS[index % CONTESTANT_COLORS.length];
              return (
                <React.Fragment key={contestant.id}>
                  {index > 0 && (settings.contestants || []).length <= 3 && (
                    <div className="text-center">
                      <span className="text-2xl font-black text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-2xl border border-amber-500/20 shadow-md">VS</span>
                    </div>
                  )}
                  <div className="flex flex-col items-center space-y-2">
                    <div className={`w-20 h-20 rounded-2xl border-2 ${colors.border} border-opacity-40 p-1 bg-slate-900/60 shadow-lg overflow-hidden flex items-center justify-center`}>
                      {contestant.image ? (
                        <img src={contestant.image} alt={contestant.name} className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center ${colors.text} rounded-xl`}>
                          <Award size={32} />
                        </div>
                      )}
                    </div>
                    <span className={`font-bold text-base ${colors.text}`}>{contestant.name}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Ready Check Title / Setup status */}
          {settings?.setupComplete === false ? (
            <div className="space-y-3">
              {gameState && gameState.currentQuestionIndex > 0 ? (
                // Game was already started and host entered edit mode
                <>
                  <h2 className="text-3xl font-extrabold text-amber-400 animate-pulse flex items-center justify-center gap-2">
                    <span>⏸️ המשחק מושהה זמנית</span>
                  </h2>
                  <p className="text-slate-300 text-base max-w-md mx-auto">
                    <strong className="font-black text-amber-400">{hostLabel}</strong> עורך כעת את פרטי המשחק. המשחק יימשך ברגע שהוא יסיים את העריכה.
                  </p>
                  <p className="text-emerald-400 text-sm font-black mt-2 animate-bounce">
                    המסך ייפתח אוטומטית ברגע שהוא ייסיים! 🚀
                  </p>
                </>
              ) : (
                // Initial setup phase
                <>
                  <h2 className="text-3xl font-extrabold text-amber-400 animate-pulse flex items-center justify-center gap-2">
                    <span>⏳ <strong className="font-black text-amber-400">{hostLabel}</strong> עדיין עורך את פרטי המשחק...</span>
                  </h2>
                  <p className="text-slate-300 text-base max-w-md mx-auto">
                    <strong className="font-black text-amber-400">{hostLabel}</strong> עורך כעת את <strong className="text-teal-400">שלב {settings.wizardStep || 1}: {
                      settings.wizardStep === 1 ? 'פרטי חדר' :
                      settings.wizardStep === 2 ? 'בחירת מתמודדים' :
                      settings.wizardStep === 3 ? 'הוספת שחקנים' :
                      settings.wizardStep === 4 ? 'הוספת שאלות וציטוטים' :
                      settings.wizardStep === 5 ? 'הגדרת טיימר' :
                      settings.wizardStep === 6 ? 'סיכום ואישור' : 'עריכת פרטי המשחק'
                    }</strong>.
                  </p>
                  <p className="text-emerald-400 text-sm font-black mt-2 animate-bounce">
                    המסך ייפתח אוטומטית ברגע שהוא ייסיים! 🚀
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-3xl font-extrabold text-amber-400 animate-pulse">
                האם כולם מוכנים?
              </h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                <strong className="font-black text-amber-400">{hostLabel}</strong> יפעיל את המשחק מלוח הבקרה בעוד מספר רגעים... הכינו את עצמכם לסיבוב של נוסטלגיה וצחוק!
              </p>
            </div>
          )}

          {/* Room Code & QR Code display */}
          {sync.getRoomCode() && (
            <div className="flex flex-col items-center gap-4 mt-6">
              <div className="inline-block bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-2xl">
                <span className="text-slate-400 text-xs ml-2">קוד חדר להתחברות:</span>
                <strong className="text-emerald-400 font-mono text-lg font-black tracking-widest">{sync.getRoomCode()}</strong>
              </div>
              
              {/* QR Code to connect remote */}
              <div className="bg-white p-3 rounded-2xl shadow-xl border-4 border-slate-900 inline-block animate-fade-in hover:scale-[1.02] transition-transform">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?mode=admin&room=${sync.getRoomCode()}&host=${encodeURIComponent(settings.hostName || '')}`)}`}
                  alt="שלט מנחה QR"
                  className="w-[140px] h-[140px]"
                />
                <div className="text-[10px] text-slate-800 font-black mt-1.5 text-center">
                  📱 סרוק להתחברות כשלט מנחה
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  const totalPlayers = members.length;
  const males = members.filter(m => m.gender === 'male').length;
  const females = members.filter(m => m.gender === 'female').length;
  const isPreGameStage = gameState.startStage && gameState.startStage !== 'in_game';

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 text-slate-100 flex flex-col p-6 overflow-hidden">
      {/* Canvas for Confetti */}
      <canvas ref={canvasRef} className="absolute inset-0 z-50 pointer-events-none w-full h-full" />

      {/* Floating Paused Overlay */}
      {settings.setupComplete === false && !gameState.startStage && (() => {
        const step = settings.wizardStep || 1;
        const stepNames: Record<number, { label: string; icon: string }> = {
          1: { label: 'פרטי חדר ומנחה',        icon: '🏠' },
          2: { label: 'הגדרת מתמודדים',         icon: '🏆' },
          3: { label: 'הוספת בני משפחה',        icon: '👨‍👩‍👧‍👦' },
          4: { label: 'שאלות וציטוטים',          icon: '💬' },
          5: { label: 'הגדרות טיימר',           icon: '⏱️' },
          6: { label: 'סיכום ואישור',           icon: '✅' },
        };
        const totalSteps = 6;
        const current = stepNames[step] || { label: 'עריכת פרטים', icon: '✏️' };
        return (
          <div className="fixed inset-0 z-[90] bg-slate-950/85 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div className="max-w-lg w-full glass-panel p-10 rounded-3xl border border-amber-500/25 shadow-2xl relative overflow-hidden space-y-7">
              {/* Glow blobs */}
              <div className="absolute -top-20 -left-20 w-56 h-56 bg-amber-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
              <div className="absolute -bottom-20 -right-20 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

              {/* Host badge */}
              <div className="relative z-10 flex flex-col items-center gap-3">
                <div className="inline-flex items-center justify-center p-4 bg-amber-500/10 border border-amber-500/25 rounded-3xl">
                  <span className="text-5xl">{current.icon}</span>
                </div>
                <h2 className="text-2xl font-black text-amber-400">⏸️ המשחק מושהה זמנית</h2>
                <p className="text-slate-300 text-sm leading-relaxed">
                  <strong className="font-black text-amber-400">{hostLabel}</strong> חוזר לשדרג את ההגדרות — המשחק יימשך בעוד רגע!
                </p>
              </div>

              {/* Current step display */}
              <div className="relative z-10 bg-slate-900/70 border border-slate-800 rounded-2xl px-5 py-4 space-y-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">שלב נוכחי בעריכה</span>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-2xl">{current.icon}</span>
                  <span className="text-lg font-black text-slate-100">שלב {step}: {current.label}</span>
                </div>
              </div>

              {/* Progress bar across all steps */}
              <div className="relative z-10 space-y-2">
                <div className="flex justify-between text-[9px] text-slate-600 font-bold px-0.5">
                  {Array.from({ length: totalSteps }, (_, i) => (
                    <span key={i} className={i + 1 <= step ? 'text-amber-400' : 'text-slate-700'}>
                      {i + 1}
                    </span>
                  ))}
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-750">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${(step / totalSteps) * 100}%` }}
                  />
                </div>
                <p className="text-emerald-400 text-xs font-black animate-bounce mt-1">
                  המסך יחזור אוטומטית ברגע שהעריכה תושלם! 🚀
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {isPreGameStage ? (
        // Clean Full-Screen Presentation View for Pre-game Stages
        <div className="flex-grow flex items-center justify-center z-10 w-full max-w-5xl mx-auto h-full min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={gameState.startStage}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
              className="w-full text-center space-y-4 md:space-y-6 glass-panel p-4 md:p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center max-h-[95vh] animate-fade-in"
            >
              {/* Glow blobs inside card */}
              <div className="absolute -top-20 -left-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
              <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

              {gameState.startStage === 'group_welcome' ? (
                // Stage 2: Group Welcome
                <div className="space-y-3 md:space-y-4 w-full max-w-2xl animate-fade-in text-center relative z-10">
                  <h2 className="text-2xl md:text-4xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent drop-shadow-md">
                    ברוכים הבאים לכל המשתתפים! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial] select-none">🎉</span>
                  </h2>
                  {settings.groupName && (
                    <div className="relative inline-block px-6 py-3 bg-gradient-to-b from-slate-900/80 to-slate-950/90 rounded-2xl border-2 border-emerald-500/30 shadow-2xl backdrop-blur-md animate-pulse">
                      <div className="absolute -inset-0.5 bg-emerald-500/10 rounded-2xl blur opacity-50" />
                      <span className="relative text-xl md:text-3xl font-black text-emerald-400 drop-shadow">
                        {settings.groupName}
                      </span>
                    </div>
                  )}
                  <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl text-right space-y-2 shadow-xl backdrop-blur-md max-w-xl mx-auto">
                    <h3 className="text-xs md:text-sm font-black text-emerald-400 uppercase tracking-widest border-b border-slate-800 pb-1.5">
                      📌 הוראות למשתתפים:
                    </h3>
                    <p className="text-slate-200 text-xs md:text-sm leading-relaxed font-semibold">
                      הקשיבו למנחה <strong className="text-amber-300 font-black">{hostLabel || 'המנחה'}</strong>! כל אחד מבני המשפחה בתורו יגיד ציטוט או משפט, והמתחרים שלנו ({contestantNames}) יצטרכו לזהות מי אמר מה!
                    </p>
                  </div>
                </div>
              ) : gameState.startStage === 'contestants_welcome' ? (
                // Stage 3: Contestants Welcome
                <div className="space-y-4 animate-fade-in text-center max-w-xl relative z-10">
                  <h2 className="text-3xl md:text-5xl font-black text-amber-400 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)] select-none">
                    ברוכים הבאים למתמודדים! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">🎙️</span>
                  </h2>
                  <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl shadow-xl">
                    <p className="text-lg md:text-xl font-black text-slate-100 leading-relaxed animate-pulse">
                      על כושר זיהוי מהיר וזריזות! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">⚡</span>
                    </p>
                    <p className="text-slate-400 text-xs md:text-sm mt-2 font-semibold">
                      מי יזהה הכי מהר מי אמר מה במשפחה?
                    </p>
                  </div>
                </div>
              ) : gameState.startStage === 'contestants_names' ? (
                // Stage 4: Contestants Names
                <div className="space-y-6 animate-fade-in text-center relative z-10">
                  <h2 className="text-3xl md:text-4xl font-black text-amber-400 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                    קבלו את המתמודדים שלנו! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">📢</span>
                  </h2>
                  <div className="flex justify-center items-center gap-4 md:gap-8 flex-wrap py-2">
                    {(settings.contestants || []).map((c, idx) => {
                      const colors = CONTESTANT_COLORS[idx % CONTESTANT_COLORS.length] || CONTESTANT_COLORS[0];
                      return (
                        <React.Fragment key={c.id}>
                          {idx > 0 && <span className="text-xl md:text-2xl text-slate-600 font-black">VS</span>}
                          <span className={`text-2xl md:text-4xl font-black ${colors.text} bg-slate-900/80 px-6 py-3 rounded-2xl border border-slate-800 shadow-xl`}>
                            {c.name}
                          </span>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              ) : gameState.startStage === 'ready' ? (
                // Stage 5: Ready
                <div className="space-y-4 animate-fade-in text-center max-w-xl relative z-10">
                  <h2 className="text-4xl md:text-6xl font-black text-emerald-400 drop-shadow-[0_0_35px_rgba(16,185,129,0.3)] animate-pulse">
                    האם כולם מוכנים? <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">🤔</span>
                  </h2>
                  <p className="text-slate-300 text-sm md:text-base font-bold leading-relaxed">
                    המנחה <strong className="text-amber-300 font-black">{hostLabel}</strong> יפעיל את המשחק מלוח הבקרה בעוד מספר רגעים... הכינו את עצמכם לסיבוב של נוסטלגיה וצחוק!
                  </p>
                </div>
              ) : gameState.startStage === 'contestants_photos' ? (
                // Stage 6: Contestants Photos & VS with Good Luck Greeting
                <div className="space-y-6 w-full max-w-4xl animate-fade-in text-center relative z-10">
                  <div className="space-y-1">
                    <h2 className="text-3xl md:text-4xl font-black text-amber-400 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                      קבלו את המתמודדים שלנו! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">📢</span>
                    </h2>
                    <p className="text-xl md:text-2xl font-black text-amber-300 drop-shadow-md select-none">
                      בהצלחה לכל המתמודדים! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">👏</span>
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-6 md:gap-12 flex-wrap py-4">
                    {(settings.contestants || []).map((c, idx) => {
                      const colors = CONTESTANT_COLORS[idx % CONTESTANT_COLORS.length] || CONTESTANT_COLORS[0];
                      return (
                        <React.Fragment key={c.id}>
                          {idx > 0 && <span className="text-3xl md:text-5xl text-slate-500 font-black self-center">VS</span>}
                          <div className="flex flex-col items-center space-y-3">
                            <div className="relative">
                              <div className={`absolute -inset-2 bg-gradient-to-tr ${colors.gradient} rounded-full blur opacity-65`} />
                              <div className="relative w-28 h-28 md:w-44 md:h-44 rounded-full border-4 border-slate-900 bg-slate-950 overflow-hidden flex items-center justify-center shadow-2xl">
                                {c.image ? (
                                  <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className={`w-full h-full bg-gradient-to-b from-slate-800 to-slate-950 flex items-center justify-center text-4xl md:text-6xl font-black ${colors.text}`}>
                                    🏆
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className={`text-xl md:text-3xl font-black ${colors.text} drop-shadow`}>
                              {c.name}
                            </span>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              ) : gameState.startStage === 'starting' ? (
                // Stage 7: Starting Countdown
                <div className="space-y-6 text-center relative z-10 animate-pulse">
                  <h2 className="text-4xl font-black text-amber-400">המשחק מתחיל...</h2>
                </div>
              ) : (
                // Stage 1 / default: Logo
                <div className="space-y-6 animate-fade-in text-center max-w-xl relative z-10">
                  <div className="space-y-2">
                    <h1 className="text-6xl md:text-8xl font-black bg-gradient-to-r from-emerald-400 via-teal-200 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(16,185,129,0.25)] select-none">
                      מי אמר מה?
                    </h1>
                    <p className="text-amber-400 font-bold text-xl md:text-2xl">
                      חידון הציטוטים המשפחתי {hostLabel ? `בהנחיית ${hostLabel}` : ''} 🎙️
                    </p>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl text-right space-y-3 shadow-xl backdrop-blur-md">
                    <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest border-b border-slate-800 pb-2">
                      📌 הוראות למשתתפים:
                    </h3>
                    <p className="text-slate-200 text-sm leading-relaxed font-semibold">
                      הקשיבו למנחה <strong className="text-amber-300 font-black">{hostLabel || 'המנחה'}</strong>! כל אחד מבני המשפחה בתורו יגיד ציטוט או משפט, והמתחרים שלנו ({contestantNames}) יצטרכו לזהות מי אמר מה!
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        // Active Game Layout (when gameState.startStage === 'in_game')
        <>
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
                        <span>סה״כ משתתפים: <strong className="text-emerald-400">{totalPlayers}</strong></span>
                        <span>|</span>
                        <span>זכרים: <strong className="text-emerald-400">{males}</strong></span>
                        <span>|</span>
                        <span>נקבות: <strong className="text-emerald-400">{females}</strong></span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {totalQuestions > 0 && !isGameOver && (
              <div className="flex items-center gap-3">
                {!isAudioSuspended && (
                  <button
                    onClick={() => setIsBgMusicMuted(prev => !prev)}
                    className="p-2 bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-emerald-400 rounded-xl border border-slate-800/80 hover:border-emerald-500/30 transition-all duration-300 shadow-md flex items-center justify-center backdrop-blur-sm cursor-pointer"
                    title={isBgMusicMuted ? "הפעל מוזיקת רקע" : "השתק מוזיקת רקע"}
                  >
                    {isBgMusicMuted ? <VolumeX size={16} /> : <Volume2 size={16} className="animate-pulse" />}
                  </button>
                )}
                <div className="glass-panel px-4 py-2 rounded-xl text-sm border border-slate-800">
                  <span className="text-slate-400">שאלה:</span>{' '}
                  <strong className="text-emerald-400 font-bold">{gameState.currentQuestionIndex + 1}</strong>
                  <span className="text-slate-500"> / {totalQuestions}</span>
                </div>
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
                    <div className="flex items-center gap-2 mb-2 select-none">
                      <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">
                        ציטוט משפחתי
                      </span>
                      {(currentQuestion.speakerId === 'general' || !currentQuestion.speakerId) ? (
                        <span className="text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/5">
                          שאלה כללית
                        </span>
                      ) : (
                        <span className="text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/5">
                          ציטוט משויך
                        </span>
                      )}
                    </div>
                    
                    {/* Large statement */}
                    <h3 className="text-2xl md:text-3xl font-extrabold text-center px-4 leading-relaxed text-slate-100 italic">
                      ״{currentQuestion.text}״
                    </h3>

                    {settings.questionTimer ? (
                      <CountdownTimer
                        duration={settings.questionTimer}
                        isRevealed={gameState.isRevealed}
                        currentQuestionId={currentQuestion.id}
                        isPaused={gameState.isPaused}
                      />
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Dynamic Family Tree, Speaker Reveal or Question Placeholder */}
              {isGameOver ? (
                <div className="flex-grow min-h-[250px] flex flex-col items-center justify-center glass-panel rounded-3xl border border-slate-800 shadow-2xl bg-slate-950/40 p-8">
                  <div className="text-center space-y-4">
                    <h3 className="text-4xl font-extrabold text-amber-400">המשחק הסתיים! 🏆</h3>
                    <p className="text-slate-400 text-sm">מיד נדע מי ניצח במשפחה...</p>
                  </div>
                </div>
              ) : (
                <div className="flex-grow min-h-[250px] flex flex-col items-center justify-center glass-panel rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden bg-slate-950/40 p-8">
                  {/* Blur decoration always present for rich aesthetics */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

                  <AnimatePresence mode="wait">
                    {!gameState.isRevealed && currentQuestion ? (
                      <motion.div
                        key="unrevealed"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col items-center text-center relative z-10"
                      >
                        <motion.div
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
                          המשפחה מנסה לנחש! <strong className="font-black text-amber-400">{hostLabel}</strong> יחשוף את התשובה והדובר יתגלה...
                        </p>
                      </motion.div>
                    ) : currentQuestion ? (
                      (() => {
                        const liveSpeakerId = gameState.revealedSpeakers?.[currentQuestion.id] as string;
                        const resolvedSpeakerId = liveSpeakerId || (
                          currentQuestion.speakerId === 'general' ? undefined : currentQuestion.speakerId
                        );
                        const speaker = members.find(m => m.id === resolvedSpeakerId);
                        const speakerName = speaker ? speaker.name : 'פלוני אלמוני';
                        return (
                          <motion.div
                            key={`revealed-${resolvedSpeakerId || 'unknown'}`}
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
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
                                  <img src={speaker.image} alt={speakerName} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-b from-slate-850 to-slate-950 flex items-center justify-center text-8xl select-none">
                                    {speaker ? (speaker.gender === 'female' ? '👩' : '👨') : '❓'}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <h2 className="text-5xl font-black bg-gradient-to-r from-emerald-400 via-teal-200 to-emerald-400 bg-clip-text text-transparent drop-shadow-md">
                                {speakerName}
                              </h2>
                            </div>

                            <p className="text-slate-400 text-sm max-w-sm italic">
                              ״אמר/ה את הציטוט בהתרגשות רבה!״
                            </p>
                          </motion.div>
                        );
                      })()
                    ) : (
                      // Standby placeholder when no question is active
                      <div className="space-y-4 text-center">
                        <h3 className="text-2xl font-bold text-slate-350">המשחק מוכן</h3>
                        <p className="text-slate-500 text-sm">המנחה יתחיל את השאלה הראשונה בעוד רגע...</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Name Bank */}
              {settings.showNameBank && !isGameOver && (
                <div className={`glass-panel ${members.length > 40 ? 'p-3' : 'p-4'} rounded-2xl border border-slate-800/80 shadow-lg text-right`}>
                  <span className="text-[10px] text-slate-500 block mb-2 font-bold">בנק השמות:</span>
                  <div className={`flex flex-wrap ${members.length > 40 ? 'gap-1.5' : 'gap-2'} justify-center`}>
                    {members.map(m => {
                      const currentLiveSpeakerId = currentQuestion ? gameState.revealedSpeakers?.[currentQuestion.id] : undefined;
                      const isCurrentCorrect = currentQuestion && gameState.isRevealed && (
                        currentLiveSpeakerId
                          ? currentLiveSpeakerId === m.id
                          : (currentQuestion.speakerId === 'general' ? false : currentQuestion.speakerId === m.id)
                      );
                      
                      const wasSolvedInPast = Object.entries(gameState.solvedQuestions || {}).some(([qId, winnerId]) => {
                        const q = questions.find(question => question.id === qId);
                        if (!q) return false;
                        const qLiveSpeakerId = gameState.revealedSpeakers?.[qId];
                        const speakerId = qLiveSpeakerId || (q.speakerId === 'general' ? undefined : q.speakerId);
                        return speakerId === m.id;
                      });

                      const isHighlighted = isCurrentCorrect || wasSolvedInPast;
                      const count = members.length;
                      const itemStyleClass = count > 60
                        ? 'px-1.5 py-0.5 text-[9px] rounded-md'
                        : count > 30
                          ? 'px-2 py-0.5 text-[10px] rounded-md'
                          : 'px-2.5 py-1 text-xs rounded-lg';

                      return (
                        <span
                          key={m.id}
                          className={`${itemStyleClass} border font-bold transition-all ${
                            isHighlighted
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                              : 'bg-slate-900/60 text-slate-500 border-slate-850'
                          }`}
                        >
                          {m.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
        </div>

        {/* Right Column (Contestants 3 & 4) */}
        {renderContestantColumn(rightContestants, leftContestants.length)}

      </div>
    </>
  )}

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
              className={`glass-panel w-full rounded-3xl border border-slate-800 text-center shadow-2xl relative overflow-hidden transition-all duration-500 ${
                winnerRevealTimer === 0
                  ? 'max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] flex flex-col justify-between p-4 md:p-6'
                  : 'max-w-2xl p-10'
              }`}
            >
              {/* Confetti decoration */}
              <div className="absolute -top-16 -left-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              {winnerRevealTimer > 0 ? (
                // High-Drama Suspense Countdown Screen
                <div className="py-12 flex flex-col items-center justify-center space-y-8 animate-fade-in">
                  <h2 className="text-4xl md:text-5xl font-black leading-normal flex items-center justify-center gap-2 select-none">
                    <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent animate-pulse drop-shadow">
                      המנצח הוא??!!!!
                    </span>
                    <span className="animate-pulse">🥁🤔</span>
                  </h2>
                  <motion.div
                    key={winnerRevealTimer}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: [1, 1.25, 1], opacity: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="text-8xl md:text-9xl font-black text-emerald-400 drop-shadow-[0_0_35px_rgba(16,185,129,0.4)] select-none font-mono"
                  >
                    {winnerRevealTimer}
                  </motion.div>
                  <p className="text-slate-400 text-sm font-semibold tracking-wider">
                    המתנה קצרה... מי אמר את הכי הרבה ציטוטים נכון?
                  </p>
                </div>
              ) : (
                galleryTransitionTimer === 0 ? (
                // Phase 2: Full Screen Festive Gallery Page
                (() => {
                  const count = members.length;
                  const contestantCount = (settings.contestants || []).length;

                  // Determine grid columns for members based on count
                  // Goal: fill the screen in rows without scrolling
                  let cols: number;
                  if (count > 120) cols = 20;
                  else if (count > 90) cols = 18;
                  else if (count > 70) cols = 15;
                  else if (count > 55) cols = 13;
                  else if (count > 40) cols = 11;
                  else if (count > 28) cols = 9;
                  else if (count > 18) cols = 7;
                  else if (count > 10) cols = 6;
                  else if (count > 6) cols = 5;
                  else cols = 4;

                  // Contestant row sizes (bigger, always visible)
                  let cImgSize: string;
                  if (contestantCount > 6) cImgSize = 'w-14 h-14';
                  else if (contestantCount > 4) cImgSize = 'w-20 h-20';
                  else cImgSize = 'w-28 h-28';

                  return (
                    <div className="flex-grow flex flex-col h-full min-h-0 animate-fade-in text-center overflow-hidden" style={{ gap: '0.4rem' }}>
                      <h2 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(245,158,11,0.2)] shrink-0 leading-tight py-0.5">
                        כל הכבוד לכל המשתתפים!
                      </h2>

                      {/* Contestants Row – always prominent */}
                      <div className="flex flex-wrap justify-center gap-4 pb-2 border-b border-slate-800/50 max-w-7xl mx-auto shrink-0">
                        {(settings.contestants || []).map((c, index) => {
                          const colors = CONTESTANT_COLORS[index % CONTESTANT_COLORS.length];
                          return (
                            <div key={c.id} className="flex flex-col items-center gap-1.5 group">
                              <div className="relative">
                                <div className={`absolute -inset-1 bg-gradient-to-tr ${colors.gradient || 'from-emerald-500 to-teal-400'} rounded-full blur opacity-55 group-hover:opacity-90 transition-opacity duration-300`} />
                                <div className={`relative ${cImgSize} rounded-full border-2 border-slate-900 bg-slate-900 overflow-hidden flex items-center justify-center shadow-xl`}>
                                  {c.image ? (
                                    <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className={`w-full h-full bg-gradient-to-b from-slate-850 to-slate-950 flex items-center justify-center text-xl font-black ${colors.text}`}>
                                      🏆
                                    </div>
                                  )}
                                </div>
                              </div>
                              <span className={`text-sm font-black ${colors.text} truncate max-w-[5rem] text-center`} title={c.name}>
                                {c.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Members Grid – fills remaining space, no scroll */}
                      <div
                        className="flex-grow min-h-0 w-full max-w-[100%] mx-auto"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                          gap: '0.25rem',
                          alignContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        {members.map(m => (
                          <div key={m.id} className="flex flex-col items-center gap-0.5 group min-w-0">
                            <div className="relative w-full aspect-square">
                              <div className="absolute -inset-0.5 bg-gradient-to-tr from-emerald-500/30 to-teal-500/30 rounded-full blur opacity-40 group-hover:opacity-100 transition-opacity duration-300" />
                              <div className="relative w-full h-full rounded-full border border-slate-800 bg-slate-900 overflow-hidden flex items-center justify-center shadow-md">
                                {m.image ? (
                                  <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-b from-slate-800 to-slate-950 flex items-center justify-center text-[70%] select-none">
                                    {m.gender === 'female' ? '👩' : '👨'}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className="text-[0.5rem] leading-tight font-bold text-slate-300 truncate w-full text-center group-hover:text-emerald-400 transition-colors" title={m.name}>
                              {m.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()

              ) : (
                // Phase 1: High-Celebration Winner Screen (Depends on settings.showDetailedGalleryPage toggle)
                (() => {
                  const winnerId = getGameWinner();
                  
                  // Common calculations
                  let maxScore = -1;
                  (settings.contestants || []).forEach(c => {
                    const score = gameState.scores[c.id] || 0;
                    if (score > maxScore) maxScore = score;
                  });
                  const tiedContestants = (settings.contestants || []).filter(c => (gameState.scores[c.id] || 0) === maxScore);
                  const nonWinners = (settings.contestants || []).filter(c => (gameState.scores[c.id] || 0) < maxScore);

                  if (gameState.galleryRevealed) {
                    // --- PHASE C: Full Family Gallery Screen ---
                    return (
                      <div className="flex flex-col justify-between py-4 space-y-4 animate-fade-in text-center overflow-hidden h-full">
                        <div className="space-y-1 shrink-0">
                          <h2 className="text-3xl md:text-5xl font-black text-amber-400 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)] select-none">
                            כל הכבוד לכל המשתתפים! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">👏</span>
                          </h2>
                          <p className="text-sm md:text-base text-slate-300 font-bold">
                            תודה לכל בני המשפחה שחלקו את הציטוטים, הצחוקים והזיכרונות! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">❤️</span>
                          </p>
                        </div>

                        {/* Responsive Auto-scaling Gallery Grid */}
                        <div className="flex-grow flex flex-col justify-center min-h-0 pt-2">
                          <div className="flex-grow overflow-y-auto flex flex-wrap justify-center items-center content-center gap-3 md:gap-4 py-2 px-4 max-w-7xl mx-auto">
                            {/* Non-winning contestants */}
                            {nonWinners.map(c => {
                              const originalIdx = (settings.contestants || []).findIndex(x => x.id === c.id);
                              const colors = CONTESTANT_COLORS[originalIdx % CONTESTANT_COLORS.length] || CONTESTANT_COLORS[0];
                              const score = gameState.scores[c.id] || 0;
                              return (
                                <div key={c.id} className="flex flex-col items-center gap-1 group shrink-0">
                                  <div className="relative">
                                    <div className={`absolute -inset-1 bg-gradient-to-tr ${colors.gradient} rounded-full blur opacity-60 group-hover:opacity-100 transition-opacity`} />
                                    <div className="relative w-[clamp(3rem,6vw,5.5rem)] h-[clamp(3rem,6vw,5.5rem)] rounded-full border-2 border-slate-900 bg-slate-900 overflow-hidden flex items-center justify-center shadow-lg">
                                      {c.image ? (
                                        <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className={`w-full h-full bg-gradient-to-b from-slate-800 to-slate-950 flex items-center justify-center text-xl font-black ${colors.text}`}>
                                          🏆
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <span className="text-[clamp(0.65rem,1.2vw,0.9rem)] font-black text-amber-300 truncate block max-w-[100px]" title={c.name}>
                                      {c.name}
                                    </span>
                                    <span className="text-[clamp(0.55rem,1vw,0.75rem)] font-bold text-slate-400 bg-slate-950/40 px-1.5 py-0.5 rounded border border-slate-800/40 inline-block mt-0.5">
                                      {score} נק'
                                    </span>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Regular family members */}
                            {members.map(m => (
                              <div key={m.id} className="flex flex-col items-center gap-1 group shrink-0">
                                <div className="relative">
                                  <div className="absolute -inset-0.5 bg-gradient-to-tr from-emerald-500/25 to-teal-500/25 rounded-full blur opacity-30 group-hover:opacity-100 transition-opacity" />
                                  <div className="relative w-[clamp(2.4rem,4.5vw,4.2rem)] h-[clamp(2.4rem,4.5vw,4.2rem)] rounded-full border border-slate-800 bg-slate-900 overflow-hidden flex items-center justify-center shadow-md">
                                    {m.image ? (
                                      <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full bg-gradient-to-b from-slate-800 to-slate-950 flex items-center justify-center text-[110%] select-none">
                                        {m.gender === 'female' ? '👩' : '👨'}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <span className="text-[clamp(0.6rem,1.1vw,0.85rem)] font-bold text-slate-300 truncate max-w-[80px] text-center group-hover:text-emerald-400 transition-colors" title={m.name}>
                                  {m.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  } else if (gameState.teaserRevealed) {
                    // --- PHASE B: Suspense Teaser Screen ---
                    return (
                      <div className="flex flex-col items-center justify-center space-y-8 py-10 animate-fade-in text-center h-full relative z-10">
                        <div className="inline-flex items-center justify-center p-6 bg-gradient-to-br from-amber-500/20 to-teal-500/20 border-2 border-amber-500/40 rounded-full shadow-2xl animate-bounce">
                          <span className="text-6xl select-none">🎁</span>
                        </div>
                        <div className="space-y-4 max-w-2xl">
                          <h2 className="text-4xl md:text-6xl font-black text-amber-400 drop-shadow-[0_0_35px_rgba(245,158,11,0.4)] select-none">
                            הפתעה מיוחדת לכל המשתתפים! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">✨</span>
                          </h2>
                          <p className="text-xl md:text-3xl font-black text-slate-100 leading-relaxed animate-pulse">
                            הכינו את עצמכם לרגע השיא... מיד המנחה ייחשוף את...??? <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">🚀</span>
                          </p>
                        </div>
                      </div>
                    );
                  } else {
                    // --- PHASE A: Winner Solo Screen ---
                    if (winnerId === 'tie') {
                      return (
                        <div className="flex flex-col items-center justify-center space-y-10 py-8 animate-fade-in text-center h-full">
                          <h2 className="text-4xl md:text-6xl font-black text-amber-400 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)] select-none">
                            תיקו דרמטי! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">🏆</span>
                          </h2>
                          <div className="flex justify-center gap-10 items-center flex-wrap">
                            {tiedContestants.map((c) => {
                              const originalIdx = (settings.contestants || []).findIndex(x => x.id === c.id);
                              const colors = CONTESTANT_COLORS[originalIdx % CONTESTANT_COLORS.length] || CONTESTANT_COLORS[0];
                              return (
                                <div key={c.id} className="flex flex-col items-center space-y-4">
                                  <div className="relative">
                                    <div className={`absolute -inset-2 bg-gradient-to-tr ${colors.gradient} rounded-full blur opacity-75`} />
                                    <div className="relative w-36 h-36 md:w-56 md:h-56 rounded-full border-4 border-slate-900 bg-slate-950 overflow-hidden flex items-center justify-center shadow-2xl">
                                      {c.image ? (
                                        <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className={`w-full h-full bg-gradient-to-b from-slate-800 to-slate-950 flex items-center justify-center text-4xl md:text-6xl font-black ${colors.text}`}>
                                          🏆
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`text-2xl md:text-4xl font-black ${colors.text}`}>{c.name}</span>
                                  <span className="text-lg md:text-2xl font-bold text-slate-300 bg-slate-900/60 px-4 py-1 rounded-full border border-slate-800">
                                    ניקוד: {maxScore}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    } else {
                      const winnerContestant = (settings.contestants || []).find(c => c.id === winnerId);
                      const winnerIndex = (settings.contestants || []).findIndex(c => c.id === winnerId);
                      const colors = CONTESTANT_COLORS[winnerIndex % CONTESTANT_COLORS.length] || CONTESTANT_COLORS[0];
                      const score = gameState.scores[winnerId] || 0;
                      const name = winnerContestant?.name || '';
                      const gender = winnerContestant?.gender || 'male';
                      const pronoun = gender === 'female' ? 'הזוכה היא' : 'הזוכה הוא';
                      const winnerNoun = gender === 'female' ? 'המנצחת הגדולה' : 'המנצח הגדול';
                      const greeting = gender === 'female'
                        ? 'ברכות לזוכה המאושרת ששיחקה כמו אלופה! 👑'
                        : 'ברכות למנצח הגדול ששיחק בכישרון יוצא דופן! 👑';

                      return (
                        <div className="flex flex-col items-center justify-center space-y-8 py-6 animate-fade-in text-center h-full">
                          <h2 className="text-4xl md:text-6xl font-black text-amber-400 drop-shadow-[0_0_35px_rgba(245,158,11,0.35)] select-none">
                            {pronoun}... <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">🎉</span>
                          </h2>
                          
                          <div className="flex flex-col items-center space-y-4">
                            <div className="relative">
                              <div className={`absolute -inset-4 bg-gradient-to-tr ${colors.gradient} rounded-full blur-xl opacity-80 animate-pulse`} />
                              <div className="relative w-40 h-40 md:w-56 md:h-56 rounded-full border-4 border-slate-900 bg-slate-950 overflow-hidden flex items-center justify-center shadow-2xl">
                                {winnerContestant?.image ? (
                                  <img src={winnerContestant.image} alt={name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className={`w-full h-full bg-gradient-to-b from-slate-800 to-slate-950 flex items-center justify-center text-5xl md:text-7xl font-black ${colors.text}`}>
                                    🏆
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className={`text-3xl md:text-6xl font-black ${colors.text} tracking-wide drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]`}>
                              {name}
                            </span>
                            <span className="text-lg md:text-2xl font-black text-amber-300 bg-slate-900/60 px-6 py-1.5 rounded-full border border-slate-800/80">
                              {winnerNoun} עם {score} נקודות! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">🏆</span>
                            </span>
                          </div>

                          <p className="text-lg md:text-xl font-black text-slate-200">
                            {greeting}
                          </p>
                        </div>
                      );
                    }
                  }
                })()
              ))}


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

      {/* Start Game Cinematic Reveal Transition Overlay */}
      <AnimatePresence>
        {startCountdownValue !== null && (
          <motion.div
            initial={{ backdropFilter: 'blur(30px)', backgroundColor: 'rgba(2, 6, 23, 0.95)' }}
            animate={{ 
              backdropFilter: startCountdownValue === 0 ? 'blur(0px)' : 'blur(20px)',
              backgroundColor: startCountdownValue === 0 ? 'rgba(2, 6, 23, 0)' : 'rgba(2, 6, 23, 0.95)'
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: startCountdownValue === 0 ? 2.2 : 0.5, ease: "easeOut" }}
            className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center ${
              startCountdownValue === 0 ? 'pointer-events-none' : ''
            }`}
          >
            {/* Visual heartbeat pulse in the background - show only during active numbers countdown */}
            {startCountdownValue > 0 && (
              <div className="absolute w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-3xl animate-pulse pointer-events-none" />
            )}
            
            {startCountdownValue >= 6 ? (
              // Stage 1 (Seconds 10 to 6): Welcome the contestants (Text only, NO photos)
              <motion.div 
                key="welcome-stage"
                initial={{ opacity: 0, scale: 0.9 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center space-y-12 z-10 select-none text-center"
              >
                <motion.h2 
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-4xl md:text-6xl font-black text-amber-400 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)] tracking-wider"
                >
                  קבלו את המתמודדים הבאים! 🎙️
                </motion.h2>
                <div className="flex items-center justify-center gap-8 md:gap-16 flex-wrap px-6">
                  {(settings.contestants || []).map((c, idx) => {
                    const colors = CONTESTANT_COLORS[idx % CONTESTANT_COLORS.length] || CONTESTANT_COLORS[0];
                    return (
                      <React.Fragment key={c.id}>
                        {idx > 0 && (
                          <motion.span 
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="text-3xl md:text-5xl font-black text-slate-500"
                          >
                            🆚
                          </motion.span>
                        )}
                        <motion.span 
                          initial={{ x: idx === 0 ? -50 : 50, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 70, delay: 0.2 + idx * 0.15 }}
                          className={`text-5xl md:text-8xl font-black ${colors.text} drop-shadow-[0_0_40px_rgba(255,255,255,0.15)] truncate max-w-[40vw] inline-block`}
                          title={c.name}
                        >
                          {c.name}
                        </motion.span>
                      </React.Fragment>
                    );
                  })}
                </div>
                <p className="text-slate-400 text-lg md:text-xl font-bold animate-pulse">
                  המשחק מוכן! כולם להכין את הניחושים... 🤔
                </p>
              </motion.div>
            ) : startCountdownValue > 0 ? (
              // Stage 2 (Seconds 5 to 1): Growing/Rising photos and Giant Countdown Number
              <motion.div 
                key="photos-stage"
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center space-y-8 z-10 select-none text-center"
              >
                <h2 className="text-2xl md:text-3xl font-black text-slate-400 uppercase tracking-widest animate-pulse">
                  המשחק מתחיל בעוד...
                </h2>
                
                <div className="flex items-center justify-center gap-10 md:gap-20">
                  {(settings.contestants || []).map((c, idx) => {
                    const colors = CONTESTANT_COLORS[idx % CONTESTANT_COLORS.length] || CONTESTANT_COLORS[0];
                    return (
                      <motion.div
                        key={c.id}
                        initial={{ y: 250, opacity: 0, scale: 0.5 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 85, damping: 15 }}
                        className="flex flex-col items-center space-y-3"
                      >
                        <div className="relative">
                          <div className={`absolute -inset-2 bg-gradient-to-tr ${colors.gradient} rounded-full blur opacity-65`} />
                          <div className="relative w-32 h-32 md:w-52 md:h-52 rounded-full border-4 border-slate-900 bg-slate-950 overflow-hidden flex items-center justify-center shadow-2xl">
                            {c.image ? (
                              <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center text-4xl md:text-6xl font-black ${colors.text}`}>
                                🏆
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={`text-2xl md:text-4xl font-black ${colors.text} drop-shadow`}>
                          {c.name}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Giant animated countdown number */}
                <div className="h-44 flex items-center justify-center">
                  <motion.div
                    key={startCountdownValue}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="text-8xl md:text-[10rem] font-black text-emerald-400 tracking-tighter drop-shadow-[0_0_80px_rgba(16,185,129,0.45)]"
                  >
                    {startCountdownValue}
                  </motion.div>
                </div>
              </motion.div>
            ) : (
              // Start go signal ("מתחילים!")
              <div className="h-96 flex items-center justify-center z-10 select-none">
                <AnimatePresence>
                  <motion.h1
                    key="start-go"
                    initial={{ scale: 0.2, opacity: 0 }}
                    animate={{ scale: [0.2, 1.3, 3.0], opacity: [0, 1, 0] }}
                    transition={{ duration: 2.2, ease: "easeInOut" }}
                    className="text-7xl md:text-9xl font-black text-emerald-400 font-sans tracking-widest drop-shadow-[0_0_60px_rgba(16,185,129,0.6)] text-center whitespace-nowrap"
                  >
                    מתחילים!
                  </motion.h1>
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
