import React from 'react';
import { useAdmin, CONTESTANT_COLORS } from './AdminContext';
import { sync } from '../../utils/sync';
import { FamilyMember } from '../../utils/db';
import {
  Play,
  Check,
  X,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Users,
  Trash2
} from 'lucide-react';

export const ControlTab: React.FC = () => {
  const {
    gameState,
    settings,
    questions,
    members,
    gameScreenConnected,
    setActiveTab,
    handleStartGame,
    handleStartGameAfterContestantOrder,
    handleNextQuestion,
    handlePrevQuestion,
    handleRevealAnswer,
    handleAssignPoints,
    handleAbsoluteReset,
    handleTogglePause,
    nextQuestionTimer,
    showContestantOrderModal,
    setShowContestantOrderModal
  } = useAdmin();

  const shuffledIds = gameState.shuffledQuestionIds || [];
  const isGameLoaded = shuffledIds.length > 0;
  const activeQuestionId = shuffledIds[gameState.currentQuestionIndex];
  const activeQuestion = questions.find(q => q.id === activeQuestionId);
  const activeSpeaker = activeQuestion ? members.find(m => m.id === activeQuestion.speakerId) : null;

  // Function to get father's name
  const getFatherName = (member: FamilyMember | null): string | null => {
    if (!member || !member.parentId) return null;
    const father = members.find(m => m.id === member.parentId);
    return father?.name || null;
  };

  const fatherName = getFatherName(activeSpeaker);

  // Get next speakers for preview
  const nextSpeakers = shuffledIds.slice(gameState.currentQuestionIndex + 1, gameState.currentQuestionIndex + 4).map(qId => {
    const q = questions.find(question => question.id === qId);
    const speaker = q ? members.find(m => m.id === q.speakerId) : null;
    return speaker;
  }).filter(Boolean);

  return (
    <div className="grid grid-cols-12 gap-6 items-stretch">
      {/* Left side: Current Question Control */}
      <div className="col-span-12 lg:col-span-8 flex flex-col justify-between glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <h3 className="text-lg font-bold mb-4 text-emerald-400 flex items-center gap-2">
            <span>שליטה בסיבוב המשחק</span>
            {!isGameLoaded && (
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                טרם התחיל המשחק
              </span>
            )}
          </h3>

          {isGameLoaded && gameState.currentQuestionIndex < shuffledIds.length ? (
              <div>
                {/* Active quote */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-6">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                    המשפט המוקרן כעת:
                  </span>
                  <blockquote className="text-xl md:text-2xl font-bold italic mt-2 text-slate-100">
                    ״{activeQuestion?.text}״
                  </blockquote>
                </div>

                {/* Speaker Answer & Reveal State */}
                <div className="flex justify-between items-center bg-slate-900/60 p-4 rounded-xl border border-slate-800 mb-6">
                  <div>
                    <span className="text-xs text-slate-400 block">האדם שאמר את המשפט (התשובה הנכונה):</span>
                    <strong className="text-base text-amber-400 font-bold">
                      {activeSpeaker ? activeSpeaker.name : 'לא משויך'}
                      {fatherName && <span className="text-sm text-slate-400 font-normal mr-2">בן {fatherName}</span>}
                    </strong>
                  </div>

                  {/* Next Speakers Preview */}
                  {nextSpeakers.length > 0 && (
                    <div className="text-left">
                      <span className="text-[10px] text-slate-500 block mb-1">הדוברים הבאים:</span>
                      <div className="flex gap-1">
                        {nextSpeakers.map((speaker, idx) => (
                          <div key={speaker.id} className="bg-slate-800 px-2 py-1 rounded text-xs text-slate-300 font-medium">
                            {idx + 1}. {speaker.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleRevealAnswer}
                      disabled={gameState.isRevealed}
                      className={`px-4 py-2 font-bold text-xs rounded-lg transition-colors ${
                        gameState.isRevealed
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                          : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                      }`}
                      title="חשוף מי אמר את המשפט במסך ההקרנה"
                    >
                      {gameState.isRevealed ? 'התשובה גלויה במסך' : 'חשוף תשובה במסך'}
                    </button>
                  </div>
                </div>

                {/* Scoring Actions */}
                <div>
                  <span className="text-xs text-slate-400 block mb-3 font-semibold">
                    מי צדק במשחק המשפחה?
                  </span>
                  <div className={`grid gap-4 ${settings.contestants.length <= 2 ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'}`}>
                    {settings.contestants.map((c, index) => {
                      const colors = CONTESTANT_COLORS[index % CONTESTANT_COLORS.length];
                      const solvedVal = gameState.solvedQuestions[shuffledIds[gameState.currentQuestionIndex]];
                      const isWinner = solvedVal ? solvedVal.split(',').includes(c.id) : false;
                      return (
                        <button
                          key={c.id}
                          onClick={() => handleAssignPoints(c.id)}
                          className={`p-4 hover:scale-[1.02] active:scale-[0.98] transition-all rounded-2xl flex flex-col items-center gap-2 group relative border ${
                            isWinner
                              ? `${colors.border} bg-slate-900 shadow-lg shadow-${colors.text.split('-')[1]}-500/20`
                              : colors.bg
                          }`}
                        >
                          <Check size={28} className={`${isWinner ? colors.text : 'text-slate-500'} group-hover:scale-110 transition-transform`} />
                          <span className="font-bold text-sm">{c.name} {c.name.endsWith('ה') || c.name.endsWith('ת') ? 'צדקה!' : 'צדק!'}</span>
                          <span className="text-[10px] text-slate-400">{isWinner ? 'לחץ שוב לביטול' : `+1 נקודה ו-${colors.glow}`}</span>
                        </button>
                      );
                    })}

                    <button
                      onClick={() => handleAssignPoints('nobody')}
                      className="p-4 bg-slate-900 border border-slate-800 hover:bg-slate-800/80 transition-colors rounded-2xl flex flex-col items-center gap-2 group text-slate-300"
                      title="אף אחד לא צדק - חשוף באפור במסך"
                    >
                      <X size={28} className="text-slate-500 group-hover:scale-110 transition-transform" />
                      <span className="font-bold text-sm">אף אחד</span>
                      <span className="text-[10px] text-slate-500">חשיפה באפור</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : isGameLoaded ? (
              <div className="text-center py-10">
                <h4 className="text-xl font-bold text-amber-400 mb-2">🏆 המשחק הסתיים!</h4>
                <p className="text-xs text-slate-400">הגענו לסוף כל השאלות.</p>
              </div>
            ) : (
            <div className="text-center py-10">
              <p className="text-sm text-slate-400 mb-4">המשחק טרם התחיל. הוסף בני משפחה ושאלות דרך הלשוניות למעלה.</p>
              <button
                onClick={handleStartGame}
                disabled={members.length === 0 || questions.length === 0}
                className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 mx-auto hover:from-emerald-400 hover:to-teal-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-950/20"
              >
                <Play size={18} fill="currentColor" />
                <span>הפעל והתחל משחק 🚀</span>
              </button>
              {(members.length === 0 || questions.length === 0) && (
                <p className="text-[10px] text-amber-500/80 mt-2">
                  * יש להוסיף לפחות בן משפחה אחד ושאלה אחת כדי להפעיל את המשחק.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Prev / Next Pagination */}
        {isGameLoaded && (
          <div className="flex justify-between items-center border-t border-slate-800 pt-4 mt-6">
            <button
              onClick={handlePrevQuestion}
              disabled={gameState.currentQuestionIndex === 0}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-xs text-slate-400 font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronRight size={14} />
              <span>שאלה קודמת</span>
            </button>
            
            <div className="text-xs text-slate-500">
              שאלה {gameState.currentQuestionIndex + 1} מתוך {shuffledIds.length}
            </div>

            <button
              onClick={handleNextQuestion}
              disabled={gameState.currentQuestionIndex >= shuffledIds.length}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-sm font-black rounded-xl hover:from-emerald-400 hover:to-teal-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-emerald-950/20 transition-all"
            >
              {nextQuestionTimer > 0 ? (
                <span className="text-lg">{nextQuestionTimer}</span>
              ) : (
                <>
                  <span>שאלה הבאה</span>
                  <ChevronLeft size={18} />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Right side: Scores and Game Session Stats */}
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
        {/* Scoreboard Monitor */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">
            ניקוד נוכחי
          </h3>
          
          <div className={`grid gap-4 ${settings.contestants.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-2 xl:grid-cols-4'}`}>
            {settings.contestants.map((c, index) => {
              const colors = CONTESTANT_COLORS[index % CONTESTANT_COLORS.length];
              return (
                <div key={c.id} className={`p-4 bg-slate-900 border ${colors.border}/20 rounded-2xl flex flex-col items-center`}>
                  <span className={`text-xs ${colors.text} font-semibold truncate max-w-full`}>{c.name}</span>
                  <div className={`text-3xl md:text-4xl font-extrabold text-slate-200 mt-2`}>
                    {gameState.scores[c.id] || 0}
                  </div>
                </div>
              );
            })}
          </div>

          {isGameLoaded && (
            <button
              onClick={handleStartGame}
              className="w-full mt-4 py-2 border border-slate-800 hover:bg-slate-900 transition-colors text-slate-400 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={12} />
              <span>אפס והתחל משחק מחדש</span>
            </button>
          )}
          {isGameLoaded && (
            <button
              onClick={handleTogglePause}
              className="w-full mt-2 py-2 border border-amber-500/20 hover:bg-amber-950/30 transition-colors text-amber-400/70 hover:text-amber-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={12} />
              <span>{gameState.isPaused ? 'המשך משחק ▶️' : 'השהה משחק ⏸️'}</span>
            </button>
          )}
          <button
            onClick={handleAbsoluteReset}
            className="w-full mt-2 py-2 border border-rose-500/20 hover:bg-rose-950/30 transition-colors text-rose-400/70 hover:text-rose-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
          >
            <Trash2 size={12} />
            <span>🗑️ איפוס מוחלט של החדר</span>
          </button>
        </div>

        {/* Solved Status Sidebar */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex-grow max-h-[300px] overflow-y-auto">
          <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">
            שאלות שנפתרו:
          </h3>
          {Object.keys(gameState.solvedQuestions).length === 0 ? (
            <div className="text-slate-650 text-xs text-center py-6">טרם נפתרו שאלות.</div>
          ) : (
            <ul className="space-y-2 text-xs">
              {Object.entries(gameState.solvedQuestions).map(([qId, winner]) => {
                const q = questions.find(item => item.id === qId);
                const sp = q ? members.find(m => m.id === q.speakerId) : null;
                return (
                  <li key={qId} className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-slate-900">
                    <span className="truncate max-w-[150px] text-slate-300">
                      {q ? `״${q.text.substr(0, 18)}...״` : 'שאלה'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-medium">({sp?.name})</span>
                      {winner ? (
                        winner.split(',').map(wId => {
                          const contestant = settings.contestants.find(c => c.id === wId);
                          const contestantIndex = settings.contestants.findIndex(c => c.id === wId);
                          const colors = CONTESTANT_COLORS[contestantIndex % CONTESTANT_COLORS.length] || { text: 'text-slate-400' };
                          const badgeColorClass = colors.text.replace('text', 'bg') + '/20 ' + colors.text;
                          return (
                            <span key={wId} className={`px-2 py-0.5 rounded font-bold text-[10px] ${badgeColorClass}`}>
                              {contestant ? contestant.name : 'מתמודד'}
                            </span>
                          );
                        })
                      ) : (
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-800 text-slate-400">
                          אף אחד
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Contestant Order Modal */}
      {showContestantOrderModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full text-right">
            <h3 className="text-lg font-black text-emerald-400 mb-4 flex items-center gap-2">
              <Users size={20} />
              <span>סדר המתמודדים למשחק</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              מכיוון שבחרת סדר הכנסה לשאלות, וודא שסדר המתמודדים נכון לפני התחלת המשחק:
            </p>
            <div className="space-y-2 mb-6">
              {settings.contestants.map((c, index) => {
                const colors = CONTESTANT_COLORS[index % CONTESTANT_COLORS.length];
                return (
                  <div key={c.id} className={`p-3 bg-slate-950 border ${colors.border}/30 rounded-xl flex items-center gap-3`}>
                    <span className={`w-8 h-8 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center font-black text-sm`}>
                      {index + 1}
                    </span>
                    <span className={`text-sm font-bold ${colors.text}`}>{c.name}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowContestantOrderModal(false)}
                className="flex-1 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 font-bold text-sm rounded-xl hover:bg-slate-700 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={handleStartGameAfterContestantOrder}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-sm rounded-xl hover:from-emerald-400 hover:to-teal-300 transition-all shadow-lg shadow-emerald-950/20"
              >
                התחל משחך 🎮
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
