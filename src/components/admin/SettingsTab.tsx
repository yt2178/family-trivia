import React from 'react';
import { useAdmin, CONTESTANT_COLORS } from './AdminContext';
import { Plus, Trash2 } from 'lucide-react';

export const SettingsTab: React.FC = () => {
  const {
    settings,
    updateSettings,
    handleSettingsImageUpload
  } = useAdmin();

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Game settings & tree layout selection */}
      <div className="col-span-12 glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
        <h3 className="text-lg font-bold text-emerald-400">הגדרות המשחק</h3>
        
        <div>
          <label className="text-xs text-slate-400 block mb-1 font-semibold">שם מנחה המשחק (השם המופיע במסך ההקרנה ובבקרת המנחה)</label>
          <input
            type="text"
            value={settings.hostName || ''}
            onChange={(e) => updateSettings({ ...settings, hostName: e.target.value })}
            placeholder="הקלד שם מנחה (לדוגמה: אלי, אמא)"
            className="w-full max-w-md bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-bold"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-2 font-semibold">סוג תצוגת לוח המשחק</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => updateSettings({ ...settings, treeLayout: 'traditional' })}
              className={`py-2.5 px-4 text-xs font-bold rounded-xl border transition-all flex justify-center items-center gap-2 ${
                settings.treeLayout === 'traditional'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>🌳 עץ יוחסין</span>
            </button>

            <button
              type="button"
              onClick={() => updateSettings({ ...settings, treeLayout: 'none' })}
              className={`py-2.5 px-4 text-xs font-bold rounded-xl border transition-all flex justify-center items-center gap-2 ${
                settings.treeLayout === 'none'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>📋 ללא עץ יוחסין (רשימה)</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            * מצב ללא עץ מסתיר את שדות ההורים ובני הזוג בניהול ומציג כרטיסיית חשיפת דובר יוקרתית במסך המשחק.
          </p>
        </div>

        <div className="border-t border-slate-800 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-sm text-slate-200">פרטי המתמודדים במשחק ({settings.contestants?.length || 0})</h4>
            {(settings.contestants?.length || 0) < 4 && (
              <button
                type="button"
                onClick={() => {
                  const newId = `contestant_${Math.random().toString(36).substr(2, 9)}`;
                  const updated = [
                    ...(settings.contestants || []),
                    { id: newId, name: `מתמודד/ת ${(settings.contestants?.length || 0) + 1}`, image: null }
                  ];
                  updateSettings({ ...settings, contestants: updated });
                }}
                className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
              >
                <Plus size={14} />
                <span>הוסף מתמודד</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(settings.contestants || []).map((c, index) => {
              const colors = CONTESTANT_COLORS[index % CONTESTANT_COLORS.length];
              return (
                <div key={c.id} className="p-4 bg-slate-905/40 border border-slate-800 rounded-2xl space-y-4 relative group">
                  {(settings.contestants?.length || 0) > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (settings.contestants || []).filter(item => item.id !== c.id);
                        updateSettings({ ...settings, contestants: updated });
                      }}
                      className="absolute top-3 left-3 p-1.5 text-rose-500 hover:text-rose-400 bg-rose-500/10 rounded-lg transition-colors"
                      title="הסר מתמודד"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${colors.text.replace('text', 'bg')}`}></span>
                    <h5 className="font-bold text-xs text-slate-200">מתמודד {index + 1}</h5>
                  </div>

                  <div className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-8">
                      <label className="text-[10px] text-slate-400 block mb-1">שם השחקן/מתמודד</label>
                      <input
                        type="text"
                        value={c.name}
                        onChange={e => {
                          const updated = (settings.contestants || []).map(item =>
                            item.id === c.id ? { ...item, name: e.target.value } : item
                          );
                          let grandpaName = settings.grandpaName;
                          let grandmaName = settings.grandmaName;
                          if (index === 0) grandpaName = e.target.value;
                          if (index === 1) grandmaName = e.target.value;

                          updateSettings({ 
                            ...settings, 
                            contestants: updated,
                            grandpaName,
                            grandmaName
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="col-span-4">
                      <label className="text-[10px] text-slate-400 block mb-1">תמונה</label>
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden">
                          {c.image ? (
                            <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[9px] text-slate-600">ללא</span>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          id={`settings-img-${c.id}`}
                          className="hidden"
                          onChange={e => handleSettingsImageUpload(e, c.id)}
                        />
                        <label
                          htmlFor={`settings-img-${c.id}`}
                          className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[9px] font-bold cursor-pointer hover:bg-slate-800 text-slate-300"
                        >
                          החלף
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
