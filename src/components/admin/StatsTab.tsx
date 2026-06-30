import React from 'react';
import { useAdmin } from './AdminContext';

export const StatsTab: React.FC = () => {
  const { members } = useAdmin();

  const total = members.length;
  const males = members.filter(m => m.gender === 'male').length;
  const females = members.filter(m => m.gender === 'female').length;

  return (
    <div className="glass-panel p-6 rounded-3xl border border-slate-800 text-right">
      <h3 className="text-lg font-bold mb-6 text-emerald-400">סטטיסטיקת שחקנים</h3>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[10px] text-slate-500 font-bold mb-1">סה״כ שחקנים</div>
          <div className="text-3xl font-black text-emerald-400">{total}</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[10px] text-slate-500 font-bold mb-1">זכרים 👨</div>
          <div className="text-3xl font-black text-slate-200">{males}</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[10px] text-slate-500 font-bold mb-1">נקבות 👩</div>
          <div className="text-3xl font-black text-slate-200">{females}</div>
        </div>
      </div>
    </div>
  );
};
