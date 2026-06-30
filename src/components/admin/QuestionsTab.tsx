import React from 'react';
import { useAdmin } from './AdminContext';
import { Plus, Trash2, Pencil, X } from 'lucide-react';

export const QuestionsTab: React.FC = () => {
  const {
    settings,
    questions,
    members,
    newQuestion,
    setNewQuestion,
    handleAddQuestion,
    handleDeleteQuestion
  } = useAdmin();

  const isEditing = !!newQuestion.id;

  const handleStartEdit = (q: any) => {
    setNewQuestion({
      id: q.id,
      text: q.text,
      speakerId: q.speakerId === 'general' ? '' : q.speakerId
    });
  };

  const handleCancelEdit = () => {
    setNewQuestion({
      text: '',
      speakerId: ''
    });
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      
      {/* Add/Edit Question Form */}
      <div className="col-span-12 lg:col-span-5 glass-panel p-6 rounded-3xl border border-slate-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-emerald-400">
            {isEditing ? 'עריכת שאלה (ציטוט)' : 'הוספת שאלה (ציטוט)'}
          </h3>
          {isEditing && (
            <button
              onClick={handleCancelEdit}
              className="text-xs text-rose-450 hover:underline flex items-center gap-1 bg-rose-500/10 px-2.5 py-1 rounded-lg"
            >
              <X size={12} />
              <span>ביטול עריכה</span>
            </button>
          )}
        </div>
        <form onSubmit={handleAddQuestion} className="space-y-4">
          
          {/* Text/Quote */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">המשפט / הציטוט</label>
            <textarea
              required
              value={newQuestion.text}
              onChange={e => setNewQuestion({ ...newQuestion, text: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-emerald-500 min-h-[80px]"
              placeholder="למשל: סבא תמיד מביא לי ממתק מוחבא..."
            />
          </div>

          {/* Speaker Dropdown */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">מי אמר את זה? (הדובר)</label>
            <select
              value={newQuestion.speakerId}
              onChange={e => setNewQuestion({ ...newQuestion, speakerId: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="">-- ללא שיוך (שאלה כללית לכולם) --</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className={`w-full py-2 ${isEditing ? 'bg-amber-500 hover:bg-amber-400' : 'bg-emerald-500 hover:bg-emerald-400'} text-slate-950 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-1`}
          >
            {isEditing ? <Pencil size={16} /> : <Plus size={16} />}
            <span>{isEditing ? 'שמור שינויים' : 'הוסף שאלת משחק'}</span>
          </button>
        </form>
      </div>

      {/* Questions List */}
      <div className="col-span-12 lg:col-span-7 glass-panel p-6 rounded-3xl border border-slate-800 max-h-[600px] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4 text-emerald-400">
          מאגר שאלות המשחק ({questions.length})
        </h3>

        {questions.length === 0 ? (
          <div className="text-center py-12 text-slate-600">אין שאלות במאגר. ייבא מ-Excel או הוסף ידנית.</div>
        ) : (
          <div className="space-y-3">
            {questions.map(q => {
              const sp = members.find(m => m.id === q.speakerId);
              const isBeingEdited = newQuestion.id === q.id;
              return (
                <div 
                  key={q.id} 
                  className={`bg-slate-900 border ${isBeingEdited ? 'border-amber-500/50 shadow-md shadow-amber-950/20' : 'border-slate-800/80'} p-4 rounded-2xl flex justify-between items-center group transition-all`}
                >
                  <div className="overflow-hidden mr-2">
                    <blockquote className="text-sm font-bold italic truncate text-slate-200">
                      ״{q.text}״
                    </blockquote>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      אומר: <strong className="text-emerald-400 font-semibold">{sp ? sp.name : 'לא משויך'}</strong>
                    </span>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleStartEdit(q)}
                      className="p-1.5 text-amber-500 hover:text-amber-400 bg-amber-500/10 rounded-lg hover:bg-amber-500/20 transition-colors"
                      title="ערוך שאלה"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-400 bg-rose-500/10 rounded-lg hover:bg-rose-500/20 transition-colors"
                      title="מחק"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
