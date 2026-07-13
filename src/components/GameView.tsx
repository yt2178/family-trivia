import React, { useState, useEffect, useRef } from 'react';
import { db, FamilyMember, GameSettings, GameState, healGameState, ensureArray, TriviaQuestion, Contestant } from '../utils/db';
import { sync } from '../utils/sync';
import { audioHelper } from '../utils/audioHelper';
import { Trophy, Volume2, Award, Sparkles, RefreshCw, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { rtdb } from '../utils/firebase';
import { ref, set, onValue, off, get, onDisconnect } from 'firebase/database';

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

  // Tick down the start countdown - robust interval implementation to prevent skipping numbers
  useEffect(() => {
    if (startCountdownValue !== 10) return;

    audioHelper.startIntroMusic();
    audioHelper.play('countdown-tick');

    const interval = setInterval(() => {
      setStartCountdownValue(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          audioHelper.stopIntroMusic();
          audioHelper.play('game-start-boom');
          setTimeout(() => {
            setStartCountdownValue(null);
          }, 2200);
          return 0;
        }
        audioHelper.play('countdown-tick');
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [startCountdownValue === 10]);
  
  const hostLabel = settings.hostName || 'המנחה';
  
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

  // Suspense timer for winner reveal - Trigger Check
  useEffect(() => {
    const totalQ = (gameState.shuffledQuestionIds || []).length;
    const isGameOver = totalQ > 0 && gameState.currentQuestionIndex >= totalQ;
    
    if (isGameOver) {
      if (!hasTriggeredWinnerReveal && winnerRevealTimer === 0) {
        setWinnerRevealTimer(10); // 10 second suspense timer for maximum drama
        setHasTriggeredWinnerReveal(true);
      }
    } else {
      if (hasTriggeredWinnerReveal) {
        setHasTriggeredWinnerReveal(false);
        setWinnerRevealTimer(0);
      }
    }
  }, [gameState.currentQuestionIndex, gameState.shuffledQuestionIds, hasTriggeredWinnerReveal]);

  // Suspense timer for winner reveal - Tick Down - robust interval implementation to prevent skipping numbers
  useEffect(() => {
    if (winnerRevealTimer !== 10) return;

    audioHelper.startSuspenseMusic();
    audioHelper.play('countdown-tick');

    const interval = setInterval(() => {
      setWinnerRevealTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          audioHelper.stopSuspenseMusic();
          audioHelper.play('victory');
          return 0;
        }
        audioHelper.play('countdown-tick');
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [winnerRevealTimer === 10]);

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

            const storedHost = (fbSettings.hostName || '').trim();
            const urlHost = new URLSearchParams(window.location.search).get('host') || '';
            if (storedHost && urlHost.trim().toLowerCase() !== storedHost.toLowerCase()) {
              setSecurityError(true);
            }

            db.saveMembers(fbMembers);
            db.saveQuestions(fbQuestions);
            
            const currentSettings = db.getSettings();
            const mergedSettings = healSettings({ ...currentSettings, ...fbSettings });
            db.saveSettings(mergedSettings);
            
            const currentGameState = db.getGameState();
            const mergedState = healGameState({ ...currentGameState, ...fbState }, mergedSettings);
            db.saveGameState(mergedState);

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
      
      // Only set if room exists to avoid creating data for non-existent rooms
      get(roomRef).then((snapshot) => {
        if (snapshot.exists()) {
          unsubscribeConnected = onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
              set(statusRef, true);
              onDisconnect(statusRef).set(false);
            }
          });
        }
      }).catch(err => console.error("Error checking room existence:", err));
      
      return () => {
        if (unsubscribeConnected) unsubscribeConnected();
        const roomRef = ref(rtdb, `rooms/${roomCode}/database`);
        get(roomRef).then((snapshot) => {
          if (snapshot.exists()) {
            set(statusRef, false);
          }
        }).catch(err => console.error("Error checking room existence:", err));
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
                  <div className={`relative w-16 h-16 rounded-2xl border-2 ${colors.border}/45 p-0.5 bg-slate-900/60 shadow-xl overflow-hidden mb-2 flex items-center justify-center`}>
                    {c.image ? (
                      <img src={c.image} alt={c.name} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <div className={`w-full h-full ${colors.imageFallbackBg} flex items-center justify-center ${colors.text} rounded-xl`}>
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
                <div className={`relative w-24 h-24 rounded-3xl border-2 ${colors.border}/40 p-1 bg-slate-900/60 shadow-xl overflow-hidden mb-4 flex items-center justify-center`}>
                  {c.image ? (
                    <img src={c.image} alt={c.name} className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    <div className={`w-full h-full ${colors.imageFallbackBg} flex items-center justify-center ${colors.text} rounded-2xl`}>
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

  const isInitialSetup = (settings?.setupComplete === false || totalQuestions === 0 || !gameState.isPlaying) && gameState.currentQuestionIndex === 0;

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

  return (
    <div className="relative w-full min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 text-slate-100 flex flex-col p-6 overflow-hidden">
      {/* Canvas for Confetti */}
      <canvas ref={canvasRef} className="absolute inset-0 z-50 pointer-events-none w-full h-full" />

      {/* Floating Paused Overlay */}
      {settings.setupComplete === false && (() => {
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
            <div className="flex-grow min-h-[500px] flex flex-col items-center justify-center glass-panel rounded-3xl border border-slate-800 shadow-2xl bg-slate-950/40 p-8">
              <div className="text-center space-y-4">
                <h3 className="text-4xl font-extrabold text-amber-400">המשחק הסתיים! 🏆</h3>
                <p className="text-slate-400 text-sm">מיד נדע מי ניצח במשפחה...</p>
              </div>
            </div>
          ) : (
            <div className="flex-grow min-h-[500px] flex flex-col items-center justify-center glass-panel rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden bg-slate-950/40 p-8">
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
                      המשפחה מנסה לנחש! <strong className="font-black text-amber-400">{hostLabel}</strong> יחשוף את התשובה והדובר יתגלה...
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="revealed"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ type: "spring", stiffness: 100, damping: 15 }}
                    className="flex flex-col items-center text-center relative z-10 space-y-6"
                  >
                    {(() => {
                      const resolvedSpeakerId = (currentQuestion?.speakerId === 'general' || !currentQuestion?.speakerId)
                        ? (gameState.revealedSpeakers?.[currentQuestion?.id || ''] as string)
                        : currentQuestion?.speakerId;
                      const speaker = members.find(m => m.id === resolvedSpeakerId);
                      const speakerName = speaker ? speaker.name : 'פלוני אלמוני';
                      return (
                        <>
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
                        </>
                      );
                    })()}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Name Bank */}
          {settings.showNameBank && !isGameOver && (
            <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 shadow-lg text-right">
              <span className="text-[10px] text-slate-500 block mb-2 font-bold">בנק השמות של המשפחה:</span>
              <div className="flex flex-wrap gap-2 justify-center">
                {members.map(m => {
                  const isCurrentCorrect = currentQuestion && gameState.isRevealed && (
                    currentQuestion.speakerId === m.id || 
                    ((currentQuestion.speakerId === 'general' || !currentQuestion.speakerId) && gameState.revealedSpeakers?.[currentQuestion.id] === m.id)
                  );
                  
                  const wasSolvedInPast = Object.entries(gameState.solvedQuestions || {}).some(([qId, winnerId]) => {
                    const q = questions.find(question => question.id === qId);
                    if (!q) return false;
                    const speakerId = q.speakerId === 'general' || !q.speakerId ? gameState.revealedSpeakers?.[qId] : q.speakerId;
                    return speakerId === m.id;
                  });

                  const isHighlighted = isCurrentCorrect || wasSolvedInPast;

                  return (
                    <span
                      key={m.id}
                      className={`px-2.5 py-1 text-xs rounded-lg border font-bold transition-all ${
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
              className={`glass-panel p-10 w-full rounded-3xl border border-slate-800 text-center shadow-2xl relative overflow-hidden transition-all duration-500 ${
                winnerRevealTimer === 0 ? 'max-w-6xl' : 'max-w-2xl'
              }`}
            >
              {/* Confetti decoration */}
              <div className="absolute -top-16 -left-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              {winnerRevealTimer === 0 && (
                <div className={`grid gap-4 mb-8 ${(settings.contestants?.length || 0) <= 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'}`}>
                  {(settings.contestants || []).map((c, index) => {
                    const colors = CONTESTANT_COLORS[index % CONTESTANT_COLORS.length];
                    const score = gameState.scores[c.id] || 0;
                    return (
                      <div key={c.id} className="glass-panel p-6 rounded-3xl border border-slate-800 text-center relative overflow-hidden">
                        <div className={`absolute -top-12 -right-12 w-24 h-24 ${colors.accentGlow} opacity-50 rounded-full blur-2xl`} />
                        <div className={`w-16 h-16 rounded-2xl border-2 ${colors.border}/30 mx-auto mb-3 overflow-hidden flex items-center justify-center p-0.5`}>
                          {c.image ? (
                            <img src={c.image} alt={c.name} className="w-full h-full object-cover rounded-xl" />
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center ${colors.text}`}>
                              <Award size={24} />
                            </div>
                          )}
                        </div>
                        <h3 className="font-bold text-slate-200 truncate">{c.name}</h3>
                        <div className={`text-3xl font-black mt-2 ${colors.text}`}>{score} נק׳</div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl mb-8">
                {winnerRevealTimer > 0 ? (
                  // Suspense timer countdown
                  <div className="py-6 text-center space-y-4">
                    <h3 className="text-4xl md:text-5xl font-black flex items-center justify-center gap-4 animate-pulse text-amber-400">
                      <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent py-1 leading-normal">
                        המנצח הוא??!!!!
                      </span>
                      <span className="text-slate-100 font-normal select-none">🥁🤔</span>
                    </h3>
                    <div className="text-6xl font-extrabold text-emerald-400 animate-bounce">
                      {winnerRevealTimer}
                    </div>
                    <p className="text-sm text-slate-400">כמה שניות במתח ואז החשיפה...</p>
                  </div>
                ) : getGameWinner() === 'tie' ? (
                  <div>
                    <h3 className="text-2xl font-bold text-amber-400 flex items-center justify-center gap-2">
                      🤝 תיקו משפחתי מהמם!
                    </h3>
                    <p className="text-xs text-slate-400 mt-2">שניכם אלופים ושניכם מכירים את המשפחה מעולה</p>
                  </div>
                ) : (() => {
                  const winnerContestant = (settings.contestants || []).find(c => c.id === getGameWinner());
                  const winnerIndex = (settings.contestants || []).findIndex(c => c.id === getGameWinner());
                  const colors = CONTESTANT_COLORS[winnerIndex % CONTESTANT_COLORS.length] || CONTESTANT_COLORS[0];
                  const name = winnerContestant?.name || '';
                  const gender = winnerContestant?.gender || 'male';
                  const pronoun = gender === 'female' ? 'אלופת' : 'אלוף';
                  const greeting = gender === 'female' ? 'ברכות למנצחת שזוכרת הכל' : 'ברכות לגיבור שזיהה הכי הרבה משפטים';
                  return (
                    <div>
                      <h3 className={`text-2xl font-bold ${colors.text} flex items-center justify-center gap-2`}>
                        🏆 {name} {gender === 'female' ? 'היא' : 'הוא'} {pronoun} המשחק!
                      </h3>
                      <p className="text-xs text-slate-400 mt-2">{greeting}</p>
                    </div>
                  );
                })()}
              </div>

              {/* Family Members / Participants Gallery - scrollbar removed, size adjusts dynamically to fit up to 80+ members on screen */}
              {winnerRevealTimer === 0 && members.length > 0 && (() => {
                const avatarSize = members.length > 50 
                  ? 'w-9 h-9' 
                  : members.length > 30 
                    ? 'w-10 h-10' 
                    : 'w-12 h-12';
                const emojiSize = members.length > 50
                  ? 'text-base'
                  : members.length > 30
                    ? 'text-lg'
                    : 'text-xl';
                const cardWidth = members.length > 50 
                  ? 'w-12' 
                  : members.length > 30 
                    ? 'w-14' 
                    : 'w-16';
                const textSize = members.length > 50 
                  ? 'text-[8px]' 
                  : 'text-[10px]';
                const gapClass = members.length > 50 
                  ? 'gap-3.5' 
                  : 'gap-5';

                return (
                  <div className="mt-8 pt-6 border-t border-slate-800/80 text-right" dir="rtl">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 text-center">
                      משתתפי החידון המשפחתי:
                    </h4>
                    <div className={`flex flex-wrap justify-center ${gapClass} py-2 px-1`}>
                      {members.map(m => (
                        <div key={m.id} className={`flex flex-col items-center space-y-1.5 ${cardWidth} group`}>
                          <div className="relative">
                            <div className="absolute -inset-0.5 bg-gradient-to-tr from-emerald-500/30 to-teal-500/30 rounded-full blur opacity-40 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className={`relative ${avatarSize} rounded-full border border-slate-800 bg-slate-900 overflow-hidden flex items-center justify-center shadow-md`}>
                              {m.image ? (
                                <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className={`w-full h-full bg-gradient-to-b from-slate-800 to-slate-950 flex items-center justify-center ${emojiSize} select-none`}>
                                  {m.gender === 'female' ? '👩' : '👨'}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className={`${textSize} font-bold text-slate-355 truncate w-full text-center group-hover:text-emerald-450 transition-colors`} title={m.name}>
                            {m.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="text-xs text-slate-500 mt-6">
                <strong className="font-black text-amber-400">{hostLabel}</strong> יכול להתחיל מחדש את המשחק ממסך הניהול
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
            
            {startCountdownValue > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="text-center space-y-2 z-10 select-none"
              >
                <h2 className="text-2xl md:text-3xl font-black text-slate-400 uppercase tracking-widest">
                  המשחק מתחיל! 🎮
                </h2>
                <p className="text-lg md:text-xl font-bold text-emerald-400">
                  כולם מוכנים? 🤔
                </p>
              </motion.div>
            )}

            {/* Giant Animated Number or Growing Text */}
            <div className="h-96 flex items-center justify-center z-10 select-none">
              <AnimatePresence mode="wait">
                {startCountdownValue > 0 ? (
                  <motion.div
                    key={startCountdownValue}
                    initial={{ scale: 0.1, opacity: 0, rotate: -20 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 1.8, opacity: 0, rotate: 10 }}
                    transition={{ type: "spring", stiffness: 150, damping: 10 }}
                    className="text-9xl md:text-[14rem] font-black text-emerald-400 tracking-tighter drop-shadow-[0_0_80px_rgba(16,185,129,0.3)]"
                  >
                    {startCountdownValue}
                  </motion.div>
                ) : (
                  <motion.h1
                    initial={{ scale: 0.2, opacity: 0 }}
                    animate={{ scale: [0.2, 1.3, 3.0], opacity: [0, 1, 0] }}
                    transition={{ duration: 2.2, ease: "easeInOut" }}
                    className="text-7xl md:text-9xl font-black text-emerald-400 font-sans tracking-widest drop-shadow-[0_0_60px_rgba(16,185,129,0.6)] text-center whitespace-nowrap"
                  >
                    מתחילים! 🚀
                  </motion.h1>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
