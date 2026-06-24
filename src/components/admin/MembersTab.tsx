import React from 'react';
import { useAdmin } from './AdminContext';
import {
  Check,
  Plus,
  Trash2,
  Upload,
  Image as ImageIcon,
  Pencil
} from 'lucide-react';

export const MembersTab: React.FC = () => {
  const {
    members,
    settings,
    newMember,
    setNewMember,
    editingMemberId,
    handleAddMember,
    handleSaveEdit,
    handleCancelEdit,
    handleStartEdit,
    handleDeleteMember,
    handleMemberImageUpload,
    renderParentOptions
  } = useAdmin();

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Add/Edit Member Form */}
      <div className="col-span-12 lg:col-span-4 glass-panel p-6 rounded-3xl border border-slate-800">
        <h3 className="text-lg font-bold mb-4 text-emerald-400">
          {editingMemberId ? 'עריכת בן משפחה קיים' : 'הוספת בן משפחה חדש'}
        </h3>
        <form onSubmit={editingMemberId ? handleSaveEdit : handleAddMember} className="space-y-4">
          
          {/* Name */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">שם פרטי</label>
            <input
              type="text"
              required
              value={newMember.name}
              onChange={e => setNewMember({ ...newMember, name: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
              placeholder="למשל: דניאל"
            />
          </div>

          {/* Family Name */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">שם משפחה</label>
            <input
              type="text"
              list="existing-family-names"
              value={newMember.familyName || ''}
              onChange={e => setNewMember({ ...newMember, familyName: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
              placeholder="למשל: צברי"
            />
            <datalist id="existing-family-names">
              {Array.from(new Set(members.map(m => m.familyName).filter(Boolean))).map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          {/* Gender */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">מין</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewMember({ ...newMember, gender: 'male' })}
                className={`py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                  newMember.gender === 'male' ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                זכר
              </button>
              <button
                type="button"
                onClick={() => setNewMember({ ...newMember, gender: 'female' })}
                className={`py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                  newMember.gender === 'female' ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                נקבה
              </button>
            </div>
          </div>

          {settings.treeLayout !== 'none' && (
            <>
              {/* Parent Selection - Dual Parent */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">שם ההורים (המקשר לעץ) - ניתן לבחור שני הורים</label>
                <div className="space-y-2 max-h-40 overflow-y-auto bg-slate-900 border border-slate-800 rounded-lg p-2">
                  {members.some(m => m.generation === 'grandparent') && (
                    <div>
                      <div className="text-[10px] text-slate-500 font-bold mb-1">סבים וסבתות (מייסדי המשפחה)</div>
                      {members.filter(m => m.generation === 'grandparent' && m.id !== editingMemberId).map(m => (
                        <label key={m.id} className="flex items-center gap-2 p-1 hover:bg-slate-800 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newMember.parentIds.includes(m.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewMember({ ...newMember, parentIds: [...newMember.parentIds, m.id] });
                              } else {
                                setNewMember({ ...newMember, parentIds: newMember.parentIds.filter(id => id !== m.id) });
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                          />
                          <span className="text-sm text-slate-300">{m.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  
                  {members.some(m => m.generation === 'parent') && (
                    <div>
                      <div className="text-[10px] text-slate-500 font-bold mb-1">דור הילדים (בנים ובנות של המייסדים)</div>
                      {members.filter(m => m.generation === 'parent' && m.id !== editingMemberId).map(m => (
                        <label key={m.id} className="flex items-center gap-2 p-1 hover:bg-slate-800 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newMember.parentIds.includes(m.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewMember({ ...newMember, parentIds: [...newMember.parentIds, m.id] });
                              } else {
                                setNewMember({ ...newMember, parentIds: newMember.parentIds.filter(id => id !== m.id) });
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                          />
                          <span className="text-sm text-slate-300">{m.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  
                  {members.some(m => m.generation === 'child') && (
                    <div>
                      <div className="text-[10px] text-slate-500 font-bold mb-1">דור הנכדים</div>
                      {members.filter(m => m.generation === 'child' && m.id !== editingMemberId).map(m => (
                        <label key={m.id} className="flex items-center gap-2 p-1 hover:bg-slate-800 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newMember.parentIds.includes(m.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewMember({ ...newMember, parentIds: [...newMember.parentIds, m.id] });
                              } else {
                                setNewMember({ ...newMember, parentIds: newMember.parentIds.filter(id => id !== m.id) });
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                          />
                          <span className="text-sm text-slate-300">{m.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Spouse Dropdown */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">בן/בת זוג (אופציונלי)</label>
                <select
                  value={newMember.spouseId || ''}
                  onChange={e => setNewMember({ ...newMember, spouseId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="">ללא בן/בת זוג</option>
                  {members
                    .filter(m => m.id !== editingMemberId && (!m.spouseId || m.id === newMember.spouseId))
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.generation === 'grandparent' ? 'סבא/ת' : m.generation === 'parent' ? 'ילד/ה' : m.generation === 'child' ? 'נכד/ה' : 'נין/ה'})
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}

          {/* Image Upload */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">תמונה (אופציונלי)</label>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden">
                {newMember.image ? (
                  <img src={newMember.image} alt="תצוגה מקדימה" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={18} className="text-slate-600" />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleMemberImageUpload}
                className="hidden"
                id="member-photo-input"
              />
              <label
                htmlFor="member-photo-input"
                className="px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <Upload size={14} />
                <span>העלה תמונה</span>
              </label>
              {newMember.image && (
                <button
                  type="button"
                  onClick={() => setNewMember(prev => ({ ...prev, image: null }))}
                  className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-bold rounded-lg transition-colors"
                >
                  מחק תמונה
                </button>
              )}
            </div>
          </div>

          {editingMemberId ? (
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-grow py-2 bg-emerald-500 text-slate-950 font-bold text-sm rounded-xl hover:bg-emerald-400 transition-colors flex items-center justify-center gap-1"
              >
                <Check size={16} />
                <span>שמור שינויים</span>
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white font-bold text-sm rounded-xl transition-colors"
              >
                בטל עריכה
              </button>
            </div>
          ) : (
            <button
              type="submit"
              className="w-full py-2 bg-emerald-500 text-slate-950 font-bold text-sm rounded-xl hover:bg-emerald-400 transition-colors flex items-center justify-center gap-1"
            >
              <Plus size={16} />
              <span>הוסף לעץ המשפחתי</span>
            </button>
          )}
        </form>
      </div>

      {/* Members List Table */}
      <div className="col-span-12 lg:col-span-8 glass-panel p-6 rounded-3xl border border-slate-800 max-h-[600px] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4 text-emerald-400 flex justify-between items-center">
          <span>רשימת בני משפחה ({members.length})</span>
          <span className="text-xs text-slate-500">עריכה ומחיקת נתונים</span>
        </h3>

        {members.length === 0 ? (
          <div className="text-center py-12 text-slate-600">אין בני משפחה רשומים. ייבא מקובץ Excel או הוסף ידנית.</div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2 font-bold w-12">תמונה</th>
                  <th className="pb-2 font-bold">שם</th>
                  {settings.treeLayout !== 'none' && <th className="pb-2 font-bold">דור</th>}
                  {settings.treeLayout !== 'none' && <th className="pb-2 font-bold">הורה שמופה</th>}
                  <th className="pb-2 font-bold w-16 text-center">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {members.map(m => {
                  const isEditing = m.id === editingMemberId;
                  const parent = members.find(p => p.id === m.parentId);
                  
                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="py-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                          {m.image ? (
                            <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg select-none font-normal">
                              {m.gender === 'female' ? (
                                m.generation === 'grandparent' ? '👵' :
                                m.generation === 'parent' ? '👩' :
                                m.generation === 'child' ? '👧' : '👶'
                              ) : (
                                m.generation === 'grandparent' ? '👴' :
                                m.generation === 'parent' ? '👨' :
                                m.generation === 'child' ? '👦' : '👶'
                              )}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 font-bold text-slate-200">
                        <div>
                          <div className="font-bold">{m.name}</div>
                          {m.familyName && <div className="text-[10px] text-slate-400">{m.familyName}</div>}
                        </div>
                      </td>
                      {settings.treeLayout !== 'none' && (
                        <td className="py-2.5 text-slate-400">
                          {m.generation === 'grandparent' ? 'סבא/סבתא' :
                           m.generation === 'parent' ? 'ילד/ה' :
                           m.generation === 'child' ? 'נכד/ה' : 'נין/ה'}
                        </td>
                      )}
                      {settings.treeLayout !== 'none' && (
                        <td className="py-2.5 text-emerald-400 font-semibold">
                          {parent ? parent.name : '-'}
                        </td>
                      )}
                      <td className="py-2.5 text-center">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => handleStartEdit(m)}
                            className="p-1 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded transition-colors"
                            title="ערוך"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteMember(m.id)}
                            className="p-1 text-rose-500 hover:text-rose-400 bg-rose-500/10 rounded hover:bg-rose-500/20 transition-colors"
                            title="מחק"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
