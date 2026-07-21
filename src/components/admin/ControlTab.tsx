import React, { useState } from 'react';
import { useAdmin, CONTESTANT_COLORS } from './AdminContext';
import { sync, useConnectionStatus } from '../../utils/sync';
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
    updateGameState,
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
    handleAdvanceStartStage,
    nextQuestionTimer,
    showContestantOrderModal,
    setShowContestantOrderModal,
    handleTogglePause
  } = useAdmin();

  const isConnected = useConnectionStatus();

  const [showAllNextSpeakers, setShowAllNextSpeakers] = useState(false);
  const [showMidGameNotice, setShowMidGameNotice] = useState<boolean>(() => {
    return gameState.isPlaying && gameState.startStage === 'in_game';
  });

  const shuffledIds = gameState.shuffledQuestionIds || [];
  const hasQuestions = shuffledIds.length > 0;
  const isGameActive = gameState.startStage === 'in_game' && hasQuestions;
  const isGameLoaded = isGameActive;
  const activeQuestionId = shuffledIds[gameState.currentQuestionIndex];
  const activeQuestion = questions.find(q => q.id === activeQuestionId);
  const liveSpeakerId = activeQuestion ? gameState.revealedSpeakers?.[activeQuestion.id] : undefined;
  const activeSpeakerId = liveSpeakerId || (
    activeQuestion?.speakerId === 'general' ? undefined : activeQuestion?.speakerId
  );
  const activeSpeaker = activeSpeakerId ? members.find(m => m.id === activeSpeakerId) : null;

  // Get next speakers for preview
  const nextSpeakers = shuffledIds.slice(gameState.currentQuestionIndex + 1, gameState.currentQuestionIndex + 4).map(qId => {
    const q = questions.find(question => question.id === qId);
    const speaker = q ? members.find(m => m.id === q.speakerId) : null;
    return speaker;
  }).filter((speaker): speaker is FamilyMember => speaker !== null && speaker !== undefined);

  return (
    <div className="grid grid-cols-12 gap-6 items-stretch">
      {!isConnected && (
        <div className="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center animate-pulse">
          <span className="text-amber-400 text-xs font-bold">⚠️ חיבור האינטרנט נקטע. מנסה להתחבר מחדש... ⏳</span>
        </div>
      )}
      {/* Left side: Current Question Control */}
      <div className="col-span-12 lg:col-span-8 flex flex-col justify-between glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
              <span>שליטה בסיבוב המשחק</span>
              {!isGameLoaded && (
                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                  טרם התחיל המשחק
                </span>
              )}
            </h3>
            {isGameLoaded && (
              <button
                onClick={handleTogglePause}
                className={`px-4 py-2 text-xs font-black rounded-xl border flex items-center gap-2 transition-all active:scale-95 ${
                  gameState.isPaused
                    ? 'bg-amber-500 border-amber-400 text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-950/20 animate-pulse'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-rose-455'
                }`}
              >
                {gameState.isPaused ? (
                  <>
                    <Play size={14} fill="currentColor" />
                    <span>המשך משחק ▶️</span>
                  </>
                ) : (
                  <>
                    <span className="inline-block w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                    <span>עצור משחק</span>
                  </>
                )}
              </button>
            )}
          </div>

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
                    </strong>
                  </div>

                  {/* Next Speakers Preview */}
                  {nextSpeakers.length > 0 && (
                    <div className="text-left relative">
                      <div className="flex items-center gap-2 mb-1 justify-end">
                        <button
                          type="button"
                          onClick={() => setShowAllNextSpeakers(!showAllNextSpeakers)}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold underline flex items-center gap-0.5"
                          title="הצג את כל רשימת הדוברים בהמשך"
                        >
                          <span>פרט 🔍</span>
                        </button>
                        <span className="text-[10px] text-slate-500">הדוברים הבאים:</span>
                      </div>
                      <div className="flex gap-1">
                        {nextSpeakers.map((speaker, idx) => (
                          <div key={speaker.id} className="bg-slate-800 px-2 py-1 rounded text-xs text-slate-300 font-medium">
                            {idx + 1}. {speaker.name}
                          </div>
                        ))}
                      </div>

                      {/* Dropdown list of all upcoming speakers */}
                      {showAllNextSpeakers && (() => {
                        const allUpcomingSpeakers = shuffledIds.slice(gameState.currentQuestionIndex + 1).map(qId => {
                          const q = questions.find(question => question.id === qId);
                          return q ? members.find(m => m.id === q.speakerId) : null;
                        }).filter((speaker): speaker is FamilyMember => speaker !== null && speaker !== undefined);

                        return (
                          <div className="absolute left-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-2xl z-50 text-right">
                            <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-1.5">
                              <button
                                type="button"
                                onClick={() => setShowAllNextSpeakers(false)}
                                className="text-slate-400 hover:text-white text-[10px] font-bold"
                              >
                                ❌ סגור
                              </button>
                              <span className="text-xs font-black text-emerald-400">תור הדוברים בהמשך</span>
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-850">
                              {allUpcomingSpeakers.map((speaker, idx) => {
                                return (
                                  <div key={speaker.id + '-' + idx} className="flex justify-between items-center text-xs p-1 hover:bg-slate-800/40 rounded-lg">
                                    <span className="text-slate-500 font-mono text-[9px]">#{gameState.currentQuestionIndex + idx + 2}</span>
                                    <span className="font-bold text-slate-200">
                                      {speaker.name}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                </div>

                {/* Live Speaker Selection for All Questions */}
                {activeQuestion && (
                  <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl mb-6 text-right relative z-20">
                    <span className="text-xs text-amber-400 block mb-2 font-bold flex items-center gap-1.5">
                      <span>🎯 בחר/שנה את מי שאמר את הציטוט בלייב (אופציונלי):</span>
                    </span>
                    <select
                      value={liveSpeakerId || ''}
                      onChange={e => {
                        const mId = e.target.value;
                        const newRevealed = { ...(gameState.revealedSpeakers || {}), [activeQuestion.id]: mId };
                        updateGameState({
                          ...gameState,
                          revealedSpeakers: newRevealed,
                          // Keep the current reveal state: if already revealed, keep showing; otherwise don't auto-reveal
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs font-bold"
                    >
                      <option value="">
                        {activeQuestion.speakerId && activeQuestion.speakerId !== 'general'
                          ? `-- ברירת מחדל: ${members.find(m => m.id === activeQuestion.speakerId)?.name || 'לא ידוע'} --`
                          : '-- בחר בן משפחה מהרשימה --'}
                      </option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Scoring Actions */}
                <div>
                  <span className="text-xs text-slate-400 block mb-3 font-semibold">
                    מי צדק במשחק המשפחה?
                  </span>
                  <div className={`grid gap-4 ${(settings.contestants || []).length <= 2 ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'}`}>
                    {(settings.contestants || []).map((c, index) => {
                      const colors = CONTESTANT_COLORS[index % CONTESTANT_COLORS.length];
                      const solvedVal = gameState.solvedQuestions[shuffledIds[gameState.currentQuestionIndex]];
                      const isWinner = solvedVal ? solvedVal.split(',').includes(c.id) : false;
                      return (
                        <button
                          key={c.id}
                          onClick={() => handleAssignPoints(c.id)}
                          className={`p-4 hover:scale-[1.02] active:scale-[0.98] transition-all rounded-2xl flex flex-col items-center gap-2 group relative border ${
                            isWinner
                              ? `${colors.border} bg-slate-900 shadow-lg ${colors.shadowGlow}`
                              : colors.bg
                          }`}
                        >
                          <Check size={28} className={`${isWinner ? colors.text : 'text-slate-500'} group-hover:scale-110 transition-transform`} />
                          <span className="font-bold text-sm truncate-name">{c.name} {c.gender === 'female' ? 'צדקה!' : 'צדק!'}</span>
                          <span className="text-[10px] text-slate-400">{isWinner ? 'לחץ שוב לביטול' : `+1 נקודה ו-${colors.glow}`}</span>
                        </button>
                      );
                    })}

                    <button
                      onClick={() => handleAssignPoints('nobody')}
                      className={`p-4 transition-all rounded-2xl flex flex-col items-center gap-2 group border ${
                        gameState.solvedQuestions[shuffledIds[gameState.currentQuestionIndex]] === 'nobody'
                          ? 'border-rose-500/40 bg-slate-900 text-rose-450 shadow-lg shadow-rose-950/20'
                          : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-350'
                      }`}
                      title="אף אחד לא צדק - חשיפה ללא ניקוד"
                    >
                      <X size={28} className={`group-hover:scale-110 transition-transform ${gameState.solvedQuestions[shuffledIds[gameState.currentQuestionIndex]] === 'nobody' ? 'text-rose-450' : 'text-slate-550'}`} />
                      <span className="font-bold text-sm">אף אחד / חשוף תשובה</span>
                      <span className="text-[10px] text-slate-500">חשיפה באפור ללא ניקוד</span>
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
              <div className="text-center py-6 space-y-4">
                {/* Stage 1: Logo */}
                {(!gameState.startStage || gameState.startStage === 'logo') && (
                  <div className="space-y-4 max-w-lg mx-auto bg-slate-950/60 p-5 rounded-2xl border border-slate-850 text-right">
                    <h4 className="text-base font-black text-emerald-400">📺 מסך פתיחה: לוגו המשחק</h4>
                    <p className="text-xs text-slate-350 leading-relaxed">
                      מסך ההקרנה מציג כעת את לוגו המשחק "מי אמר מה?".
                    </p>
                    
                    {settings.questionOrder === 'sequential' && (
                      <div className="border-t border-slate-800 pt-3">
                        <span className="text-xs font-bold text-slate-200 block mb-2">📋 סדר הקראת המשתתפים (לפי סדר ההכנסה):</span>
                        <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-slate-900 rounded-xl border border-slate-800">
                          {members.map((m, idx) => (
                            <div key={m.id} className="text-xs text-slate-300 flex justify-between p-1">
                              <span>{idx + 1}. {m.name}</span>
                              <span className="text-[10px] text-slate-500">{m.gender === 'female' ? '👩' : '👨'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => handleAdvanceStartStage('group_welcome')}
                      disabled={members.length === 0 || questions.length === 0}
                      className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-950/20 text-sm cursor-pointer"
                    >
                      <span>המשך (ברוכים הבאים לכל המשתתפים) ➔</span>
                    </button>
                  </div>
                )}

                {/* Stage 2: Group Welcome */}
                {gameState.startStage === 'group_welcome' && (
                  <div className="space-y-4 max-w-lg mx-auto bg-slate-950/60 p-5 rounded-2xl border border-slate-850 text-right">
                    <h4 className="text-base font-black text-emerald-400">👋 ברוכים הבאים למשתתפים</h4>
                    <p className="text-xs text-slate-350 leading-relaxed">
                      מוקרן כעת במקרן: ברוכים הבאים לקבוצה {settings.groupName ? `"${settings.groupName}"` : ''}.
                    </p>
                    <button
                      onClick={() => handleAdvanceStartStage('contestants_welcome')}
                      className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 hover:from-emerald-400 hover:to-teal-300 transition-all shadow-lg text-sm"
                    >
                      <span>המשך (כושר זיהוי מהיר) ➔</span>
                    </button>
                  </div>
                )}

                {/* Stage 3: Contestants Welcome */}
                {gameState.startStage === 'contestants_welcome' && (
                  <div className="space-y-4 max-w-lg mx-auto bg-slate-950/60 p-5 rounded-2xl border border-slate-850 text-right">
                    <h4 className="text-base font-black text-amber-400">🎙️ ברוכים הבאים למתמודדים</h4>
                    <p className="text-xs text-slate-350 leading-relaxed">
                      מוקרן כעת במקרן: ברוכים הבאים ל-{settings.contestants?.length || 0} המתמודדים על כושר זיהוי מהיר (ללא תמונות).
                    </p>
                    <button
                      onClick={() => handleAdvanceStartStage('contestants_names')}
                      className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 hover:from-amber-400 hover:to-yellow-300 transition-all shadow-lg text-sm"
                    >
                      <span>המשך (קבלו את המתמודדים) ➔</span>
                    </button>
                  </div>
                )}

                {/* Stage 4: Contestants Names */}
                {gameState.startStage === 'contestants_names' && (
                  <div className="space-y-4 max-w-lg mx-auto bg-slate-950/60 p-5 rounded-2xl border border-slate-850 text-right">
                    <h4 className="text-base font-black text-amber-400">🎙️ שמות המתמודדים</h4>
                    <p className="text-xs text-slate-350 leading-relaxed">
                      מוקרן כעת במקרן: קבלו את המתמודדים {(settings.contestants || []).map(c => c.name).join(' ו-')} (ללא תמונות).
                    </p>
                    <button
                      onClick={() => handleAdvanceStartStage('ready')}
                      className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 hover:from-amber-400 hover:to-yellow-300 transition-all shadow-lg text-sm"
                    >
                      <span>המשך (מוכנים...) ➔</span>
                    </button>
                  </div>
                )}

                {/* Stage 5: Ready */}
                {gameState.startStage === 'ready' && (
                  <div className="space-y-4 max-w-lg mx-auto bg-slate-950/60 p-5 rounded-2xl border border-slate-850 text-right">
                    <h4 className="text-base font-black text-emerald-400">🤔 שלב ההיערכות: מוכנים...</h4>
                    <p className="text-xs text-slate-350 leading-relaxed">
                      מוקרן כעת במקרן: מוכנים...
                    </p>
                    <button
                      onClick={() => handleAdvanceStartStage('contestants_photos')}
                      className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 hover:from-emerald-400 hover:to-teal-300 transition-all shadow-lg text-sm"
                    >
                      <span>המשך (בהצלחה לכולם) ➔</span>
                    </button>
                  </div>
                )}

                {/* Stage 6: Contestants Photos */}
                {gameState.startStage === 'contestants_photos' && (
                  <div className="space-y-4 max-w-lg mx-auto bg-slate-950/60 p-5 rounded-2xl border border-slate-850 text-right">
                    <h4 className="text-base font-black text-emerald-400">📸 תמונות המתמודדים וברכת בהצלחה</h4>
                    <p className="text-xs text-slate-350 leading-relaxed">
                      מוקרן כעת במקרן: תמונות המתמודדים עם הכיתוב "בהצלחה לכולם👏".
                    </p>
                    <button
                      onClick={() => handleAdvanceStartStage('starting')}
                      className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 hover:from-emerald-400 hover:to-teal-300 transition-all shadow-lg text-sm"
                    >
                      <span>המשך (מתחילים!) ➔</span>
                    </button>
                  </div>
                )}

                {/* Stage 7: Starting Countdown */}
                {gameState.startStage === 'starting' && (
                  <div className="space-y-4 max-w-lg mx-auto bg-slate-950/60 p-5 rounded-2xl border border-slate-850 text-center">
                    <h4 className="text-base font-black text-amber-400">⏳ המשחק מתחיל...</h4>
                    <p className="text-sm text-slate-200 animate-pulse font-bold">
                      ספירה לאחור של 10 שניות פועלת כעת במקרן!
                    </p>
                  </div>
                )}

                {(members.length === 0 || questions.length === 0) ? (
                  <p className="text-[10px] text-amber-500/80 mt-2">
                    * יש להוסיף לפחות משתתף אחד ושאלה אחת כדי להפעיל את המשחק.
                  </p>
                ) : !gameScreenConnected ? (
                  <p className="text-[10px] text-amber-500/80 mt-2 animate-pulse">
                    * יש לפתוח ולחבר את מסך ההקרנה כדי להתחיל את המשחק.
                  </p>
                ) : null}
              </div>
            )}
        </div>

        {/* Prev / Next Pagination */}
        {isGameLoaded && (
          <div className="flex justify-between items-center border-t border-slate-800 pt-4 mt-6">
            <button
              onClick={handlePrevQuestion}
              disabled={gameState.currentQuestionIndex === 0}
              className="px-6 py-3.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-350 text-base font-black rounded-2xl active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
            >
              <ChevronRight size={20} />
              <span>שאלה קודמת</span>
            </button>
            
            <div className="text-xs text-slate-500">
              שאלה {gameState.currentQuestionIndex + 1} מתוך {shuffledIds.length}
            </div>

            <button
              onClick={handleNextQuestion}
              disabled={gameState.currentQuestionIndex >= shuffledIds.length}
              className="px-8 py-3.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-350 hover:via-teal-350 hover:to-emerald-400 text-slate-950 text-base font-black rounded-2xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all animate-pulse"
            >
              {nextQuestionTimer > 0 ? (
                <span className="text-lg font-mono font-black animate-ping">{nextQuestionTimer}</span>
              ) : (
                <>
                  <span>שאלה הבאה</span>
                  <ChevronLeft size={20} />
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
          
          <div className={`grid gap-4 ${(settings.contestants || []).length <= 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-2 xl:grid-cols-4'}`}>
            {(settings.contestants || []).map((c, index) => {
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

          {hasQuestions && (
            <button
              onClick={handleStartGame}
              className="w-full mt-4 py-2 border border-slate-800 hover:bg-slate-900 transition-colors text-slate-400 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={12} />
              <span>אפס והתחל משחק מחדש</span>
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
          {Object.keys(gameState.solvedQuestions || {}).length === 0 ? (
            <div className="text-slate-650 text-xs text-center py-6">טרם נפתרו שאלות.</div>
          ) : (
            <ul className="space-y-2 text-xs">
              {Object.entries(gameState.solvedQuestions || {}).map(([qId, winner]) => {
                const q = questions.find(item => item.id === qId);
                const sp = q ? members.find(m => m.id === q.speakerId) : null;
                return (
                  <li key={qId} className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-slate-900">
                    <span className="truncate max-w-[150px] text-slate-300">
                      {q ? `״${q.text.slice(0, 18)}...״` : 'שאלה'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-medium">({sp?.name})</span>
                      {winner ? (
                        winner.split(',').map(wId => {
                          const contestant = (settings.contestants || []).find(c => c.id === wId);
                          const contestantIndex = (settings.contestants || []).findIndex(c => c.id === wId);
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full text-right" dir="rtl">
            <h3 className="text-lg font-black text-emerald-400 mb-4 flex items-center gap-2">
              <Users size={20} />
              <span>סדר המשתתפים (בני המשפחה) למשחק</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              מכיוון שבחרת סדר הכנסה לשאלות, וודא שסדר המשתתפים (בני המשפחה) נכון לפני התחלת המשחק:
            </p>
            <div className="space-y-2 mb-6 max-h-[220px] overflow-y-auto border border-slate-850 p-2 rounded-2xl bg-slate-950/20">
              {members.map((m, index) => {
                return (
                  <div key={m.id} className="p-2.5 bg-slate-950 border border-slate-850/60 rounded-xl flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-black text-[10px]">
                      {index + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-200">{m.name}</span>
                    <span className="text-[10px] text-slate-500">{m.gender === 'female' ? '👩 נקבה' : '👨 זכר'}</span>
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
                התחל משחק 🎮
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mid-Game Reconnect Prompt Modal */}
      {showMidGameNotice && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-right" dir="rtl">
          <div className="max-w-md w-full glass-panel p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl relative overflow-hidden animate-fade-in">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

            <div className="text-center space-y-3 relative z-10">
              <div className="inline-flex items-center justify-center p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl shadow-xl animate-pulse">
                <span className="text-4xl">🎮</span>
              </div>
              <h2 className="text-2xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                המשחק כבר בעיצומו!
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed font-semibold">
                שמנו לב שקיים משחק פתוח ופעיל כעת בחדר זה.
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-2 relative z-10 text-xs text-slate-300 leading-relaxed font-medium">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400">שאלה נוכחית:</span>
                <strong className="text-emerald-400 font-bold text-sm">
                  שאלה {gameState.currentQuestionIndex + 1} מתוך {questions.length}
                </strong>
              </div>
              {activeQuestion && (
                <p className="italic text-slate-400 truncate pt-1">
                  ״{activeQuestion.text}״
                </p>
              )}
            </div>

            <div className="space-y-3 pt-2 relative z-10">
              <button
                type="button"
                onClick={() => setShowMidGameNotice(false)}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>להמשיך מאיפה שהפסקנו (שאלה {gameState.currentQuestionIndex + 1}) ➔</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleAdvanceStartStage('logo');
                  setShowMidGameNotice(false);
                }}
                className="w-full py-3 bg-slate-900 hover:bg-slate-850 text-rose-400 hover:text-rose-300 border border-rose-500/30 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>להתחיל משחק חדש מהתחלה 🔄</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
