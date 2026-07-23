import React from 'react';
import { motion } from 'framer-motion';
import { GameState, GameSettings, FamilyMember, Contestant } from '../../utils/db';
import { CONTESTANT_COLORS } from '../GameView';

interface EndGameSequenceProps {
  gameState: GameState;
  settings: GameSettings;
  members: FamilyMember[];
  winnerRevealTimer: number | null;
  hostLabel: string;
  getGameWinner: () => string;
}

export const EndGameSequence: React.FC<EndGameSequenceProps> = ({
  gameState,
  settings,
  members,
  winnerRevealTimer,
  hostLabel,
  getGameWinner,
}) => {
  if (winnerRevealTimer !== null && winnerRevealTimer > 0) {
    // High-Drama Suspense Countdown Screen
    return (
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
        <p className="text-slate-200 text-base md:text-xl font-bold tracking-wider animate-pulse">
          🔥 רגע האמת הגיע! מי המנצח האלוף?? 🏆
        </p>
      </div>
    );
  }

  const winnerId = getGameWinner();

  // Common calculations
  let maxScore = -1;
  (settings.contestants || []).forEach((c: Contestant) => {
    const score = gameState.scores[c.id] || 0;
    if (score > maxScore) maxScore = score;
  });
  const tiedContestants = (settings.contestants || []).filter((c: Contestant) => (gameState.scores[c.id] || 0) === maxScore);

  if (gameState.galleryRevealed) {
    // --- PHASE C: Full Family Gallery Screen ---
    const contestantsList = settings.contestants || [];
    const memberCount = members.length;
    
    let memberCols: number;
    let circleMaxW: string;
    let nameTextSize: string;

    if (memberCount <= 6) {
      memberCols = Math.min(memberCount || 1, 3);
      circleMaxW = 'max-w-[10rem] md:max-w-[12rem]';
      nameTextSize = 'text-sm md:text-lg';
    } else if (memberCount <= 12) {
      memberCols = 4;
      circleMaxW = 'max-w-[8.5rem] md:max-w-[10.5rem]';
      nameTextSize = 'text-xs md:text-base';
    } else if (memberCount <= 20) {
      memberCols = 5;
      circleMaxW = 'max-w-[7rem] md:max-w-[8.5rem]';
      nameTextSize = 'text-xs md:text-sm';
    } else if (memberCount <= 32) {
      memberCols = 7;
      circleMaxW = 'max-w-[5.8rem] md:max-w-[7rem]';
      nameTextSize = 'text-[0.75rem] md:text-xs';
    } else if (memberCount <= 48) {
      memberCols = 9;
      circleMaxW = 'max-w-[4.8rem] md:max-w-[5.8rem]';
      nameTextSize = 'text-[0.7rem] md:text-[0.75rem]';
    } else if (memberCount <= 70) {
      memberCols = 11;
      circleMaxW = 'max-w-[4rem] md:max-w-[4.8rem]';
      nameTextSize = 'text-[0.65rem] md:text-[0.7rem]';
    } else {
      memberCols = 13;
      circleMaxW = 'max-w-[3.5rem] md:max-w-[4.2rem]';
      nameTextSize = 'text-[0.6rem] md:text-[0.65rem]';
    }

    return (
      <div className="flex flex-col justify-between py-2 space-y-4 animate-fade-in text-center overflow-hidden h-full max-h-full">
        {/* Title & Subtitle */}
        <div className="space-y-1 shrink-0">
          <h2 className="text-3xl md:text-5xl font-black text-amber-400 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)] select-none">
            כל הכבוד לכל המשתתפים! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">👏</span>
          </h2>
          <p className="text-sm md:text-base text-slate-300 font-bold">
            תודה לכל המשתתפים שחלקו את הציטוטים, הצחוקים והזיכרונות! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">❤️</span>
          </p>
        </div>

        {/* Contestants Standalone VIP Row (Directly below thanks sentence) */}
        <div className="shrink-0 py-2.5 bg-slate-900/20 border border-slate-800/50 rounded-2xl p-2.5 md:p-3 max-w-4xl mx-auto w-full backdrop-blur-sm">
          <div className="text-[10px] md:text-xs font-black text-amber-400/80 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
            <span>👑 המתחרים 👑</span>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 md:gap-10 max-w-3xl mx-auto px-2">
            {contestantsList.map((c: Contestant, index: number) => {
              const colors = CONTESTANT_COLORS[index % CONTESTANT_COLORS.length] || CONTESTANT_COLORS[0];
              const score = gameState.scores[c.id] || 0;
              return (
                <div key={c.id} className="flex flex-col items-center gap-1 group">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28">
                    <div className={`absolute -inset-1 bg-gradient-to-tr ${colors.gradient} rounded-full blur opacity-75 group-hover:opacity-100 transition-opacity animate-pulse`} />
                    <div className="relative w-full h-full rounded-full border-2 border-slate-950 bg-slate-900 overflow-hidden flex items-center justify-center shadow-lg">
                      {c.image ? (
                        <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-b from-slate-800 to-slate-950 flex items-center justify-center text-xl md:text-3xl font-black ${colors.text}`}>
                          🏆
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm md:text-base font-black text-amber-300 truncate max-w-[8rem] sm:max-w-[10rem] text-center" title={c.name}>
                    {c.name}
                  </span>
                  <span className="text-[10px] sm:text-xs md:text-sm font-bold text-slate-100 bg-slate-950/80 px-2 py-0.5 rounded-full border border-slate-800/80 shadow-md">
                    {score} נק'
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Section: Responsive Auto-scaling Family Members Grid */}
        {members.length > 0 && (
          <div className="flex-grow flex flex-col justify-center min-h-0 py-2 overflow-hidden">
            <div className="text-[11px] md:text-xs font-bold text-emerald-400/80 mb-2 uppercase tracking-wider">
              בני המשפחה ששתפו את הציטוטים:
            </div>
            <div 
              className="w-full max-w-7xl mx-auto px-2 overflow-hidden justify-center items-center"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${memberCols}, minmax(0, 1fr))`,
                gap: '0.6rem',
                alignContent: 'center',
              }}
            >
              {members.map((m: FamilyMember) => (
                <div key={m.id} className="flex flex-col items-center gap-1 group min-w-0">
                  <div className={`relative w-full aspect-square ${circleMaxW} mx-auto`}>
                    <div className="absolute -inset-1 bg-gradient-to-tr from-emerald-500/40 to-teal-500/40 rounded-full blur-md opacity-50 group-hover:opacity-100 transition-opacity" />
                    <div className="relative w-full h-full rounded-full border-2 border-slate-700 bg-slate-900 overflow-hidden flex items-center justify-center shadow-lg">
                      {m.image ? (
                        <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-b from-slate-800 to-slate-950 flex items-center justify-center text-xl sm:text-3xl md:text-4xl select-none">
                          {m.gender === 'female' ? '👩' : '👨'}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`${nameTextSize} font-extrabold text-slate-100 truncate w-full text-center group-hover:text-emerald-400 transition-colors drop-shadow`} title={m.name}>
                    {m.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (gameState.teaserRevealed) {
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
            הכינו את עצמכם לרגע השיא... מיד {hostLabel} ייחשוף את...??? <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">🚀</span>
          </p>
        </div>
      </div>
    );
  }

  // --- PHASE A: Winner Solo Screen ---
  if (winnerId === 'tie') {
    return (
      <div className="flex flex-col items-center justify-center space-y-10 py-8 animate-fade-in text-center h-full">
        <h2 className="text-4xl md:text-6xl font-black text-amber-400 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)] select-none">
          תיקו דרמטי! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">🏆</span>
        </h2>
        <div className="flex justify-center gap-10 items-center flex-wrap">
          {tiedContestants.map((c: Contestant) => {
            const originalIdx = (settings.contestants || []).findIndex((x: Contestant) => x.id === c.id);
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
  }

  const winnerContestant = (settings.contestants || []).find((c: Contestant) => c.id === winnerId);
  const winnerIndex = (settings.contestants || []).findIndex((c: Contestant) => c.id === winnerId);
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
};
