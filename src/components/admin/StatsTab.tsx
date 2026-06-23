import React from 'react';
import { useAdmin } from './AdminContext';

export const StatsTab: React.FC = () => {
  const { members } = useAdmin();

  const getFamilyStats = () => {
    const familyGroups: Record<string, { adults: number; children: number; total: number }> = {};
    
    members.forEach(m => {
      const familyName = m.familyName || 'ללא משפחה';
      if (!familyGroups[familyName]) {
        familyGroups[familyName] = { adults: 0, children: 0, total: 0 };
      }
      
      if (m.generation === 'parent' || m.generation === 'grandparent') {
        familyGroups[familyName].adults++;
      } else {
        familyGroups[familyName].children++;
      }
      familyGroups[familyName].total++;
    });

    return familyGroups;
  };

  const familyStats = getFamilyStats();

  return (
    <div className="glass-panel p-6 rounded-3xl border border-slate-800">
      <h3 className="text-lg font-bold mb-6 text-emerald-400">סטטיסטיקת משפחות</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="pb-3 font-bold">שם משפחה</th>
              <th className="pb-3 font-bold">מס׳ מבוגרים</th>
              <th className="pb-3 font-bold">מס׳ ילדים</th>
              <th className="pb-3 font-bold">סה״כ נפשות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {Object.entries(familyStats).map(([familyName, stats]) => (
              <tr key={familyName} className="hover:bg-slate-900/40">
                <td className="py-3 font-bold text-slate-200">{familyName}</td>
                <td className="py-3 text-slate-400">{stats.adults}</td>
                <td className="py-3 text-slate-400">{stats.children}</td>
                <td className="py-3 font-bold text-emerald-400">{stats.total}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-700 font-bold">
              <td className="py-3 text-emerald-400">סה״כ</td>
              <td className="py-3 text-slate-300">
                {Object.values(familyStats).reduce((sum, s) => sum + s.adults, 0)}
              </td>
              <td className="py-3 text-slate-300">
                {Object.values(familyStats).reduce((sum, s) => sum + s.children, 0)}
              </td>
              <td className="py-3 text-emerald-400 text-lg">
                {Object.values(familyStats).reduce((sum, s) => sum + s.total, 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
