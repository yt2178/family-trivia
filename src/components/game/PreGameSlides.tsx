import React from 'react';
import { GameState, GameSettings, Contestant } from '../../utils/db';
import { CONTESTANT_COLORS } from '../GameView';

interface PreGameSlidesProps {
  gameState: GameState;
  settings: GameSettings;
  hostLabel: string;
  contestantNames: string;
}

export const PreGameSlides: React.FC<PreGameSlidesProps> = ({
  gameState,
  settings,
  hostLabel,
  contestantNames,
}) => {
  if (gameState.startStage === 'group_welcome') {
    return (
      <div className="space-y-4 w-full max-w-2xl animate-fade-in text-center relative z-10">
        <h2 className="text-2xl md:text-4xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent drop-shadow-md">
          ברוכים הבאים לכל המשתתפים! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial] select-none">🎉</span>
        </h2>
        {settings.groupName && (
          <div className="relative inline-block px-8 py-4 bg-slate-900/90 rounded-2xl border-2 border-amber-400/40 shadow-2xl backdrop-blur-md animate-pulse">
            <div className="absolute -inset-0.5 bg-amber-500/20 rounded-2xl blur opacity-60" />
            <span className="relative text-2xl md:text-4xl font-black bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent drop-shadow">
              {settings.groupName}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (gameState.startStage === 'contestants_welcome') {
    return (
      <div className="space-y-4 animate-fade-in text-center max-w-xl relative z-10">
        <h2 className="text-3xl md:text-5xl font-black text-amber-400 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)] select-none">
          ברוכים הבאים למתמודדים! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">🎙️</span>
        </h2>
        <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-2xl shadow-xl space-y-3">
          <p className="text-xl md:text-2xl font-black text-amber-300 leading-relaxed animate-pulse">
            🎯 האתגר מתחיל: מי יזהה ראשון מי עומד מאחורי המשפט?
          </p>
          <p className="text-slate-200 text-sm md:text-base font-bold">
            חדדו את החושים ונסו לנצח במהירות את המתחרים שלכם.
          </p>
        </div>
      </div>
    );
  }

  if (gameState.startStage === 'contestants_names') {
    return (
      <div className="space-y-6 animate-fade-in text-center relative z-10">
        <h2 className="text-3xl md:text-4xl font-black text-amber-400 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)]">
          קבלו את המתמודדים שלנו! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">📢</span>
        </h2>
        <div className="flex justify-center items-center gap-4 md:gap-8 flex-wrap py-2">
          {(settings.contestants || []).map((c: Contestant, idx: number) => {
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
    );
  }

  if (gameState.startStage === 'ready') {
    return (
      <div className="space-y-4 animate-fade-in text-center max-w-xl relative z-10">
        <h2 className="text-4xl md:text-6xl font-black text-emerald-400 drop-shadow-[0_0_35px_rgba(16,185,129,0.3)] animate-pulse">
          האם כולם מוכנים? <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">🤔</span>
        </h2>
        <p className="text-slate-300 text-sm md:text-base font-bold leading-relaxed">
          <strong className="text-amber-300 font-black">{hostLabel}</strong> יפעיל את המשחק מלוח הבקרה בעוד מספר רגעים... הכינו את עצמכם לסיבוב של נוסטלגיה וצחוק!
        </p>
      </div>
    );
  }

  if (gameState.startStage === 'contestants_photos') {
    return (
      <div className="space-y-6 w-full max-w-4xl animate-fade-in text-center relative z-10">
        <div className="space-y-1">
          <h2 className="text-3xl md:text-4xl font-black text-amber-400 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)]">
            קבלו את המתמודדים שלנו! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">📢</span>
          </h2>
          <p className="text-xl md:text-2xl font-black text-amber-300 drop-shadow-md select-none">
            בהצלחה לכולם! <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">👏</span>
          </p>
        </div>
        <div className="flex items-center justify-center gap-6 md:gap-12 flex-wrap py-4">
          {(settings.contestants || []).map((c: Contestant, idx: number) => {
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
    );
  }

  if (gameState.startStage === 'starting') {
    return (
      <div className="space-y-6 text-center relative z-10 animate-pulse">
        <h2 className="text-4xl font-black text-amber-400">המשחק מתחיל...</h2>
      </div>
    );
  }

  // Stage 1 / Default: Logo
  return (
    <div className="space-y-6 animate-fade-in text-center max-w-xl relative z-10">
      <div className="space-y-2">
        <h1 className="text-6xl md:text-8xl font-black bg-gradient-to-r from-emerald-400 via-teal-200 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(16,185,129,0.25)] select-none">
          מי אמר מה?
        </h1>
        <p className="text-amber-400 font-bold text-xl md:text-2xl">
          חידון הציטוטים {hostLabel ? `בהנחיית ${hostLabel}` : ''} <span className="not-italic inline-block [background:none] [-webkit-text-fill-color:initial]">🎙️</span>
        </p>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl text-center space-y-3 shadow-xl backdrop-blur-md">
        <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest border-b border-slate-800 pb-2">
          📌 הוראות למשתתפים:
        </h3>
        <p className="text-slate-200 text-sm leading-relaxed font-semibold">
          הקשיבו ל-<strong className="text-amber-300 font-black">{hostLabel}</strong>! כל אחד מבני המשפחה בתורו יגיד ציטוט או משפט, והמתחרים שלנו ({contestantNames}) יצטרכו לזהות מי אמר מה!
        </p>
      </div>
    </div>
  );
};
