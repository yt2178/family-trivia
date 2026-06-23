import React from 'react';
import { useAdmin } from './AdminContext';
import { Download, Upload } from 'lucide-react';

export const ImportExportTab: React.FC = () => {
  const {
    warnings,
    handleExcelTemplateDownload,
    handleImportMembersExcel,
    handleImportQuestionsExcel,
    handleExportBackup,
    handleImportBackup
  } = useAdmin();

  return (
    <div className="grid grid-cols-12 gap-6">
      
      {/* Excel Sheet import cards */}
      <div className="col-span-7 glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
        <h3 className="text-lg font-bold text-emerald-400">ייבוא מהיר מקובצי Excel</h3>
        
        <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h4 className="text-sm font-bold text-slate-200">1. הורד תבנית Excel לדוגמה</h4>
            <p className="text-[10px] text-slate-400 mt-1">בחר את התבנית בהתאם למצב התצוגה של המשחק. מצב רשימה לא ידרוש מילוי הורים ובני זוג.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExcelTemplateDownload('list')}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] rounded-xl flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              <Download size={12} />
              <span>תבנית רשימה (ללא עץ)</span>
            </button>
            <button
              onClick={() => handleExcelTemplateDownload('tree')}
              className="px-3 py-2 bg-emerald-500 text-slate-950 font-bold text-[10px] rounded-xl flex items-center gap-1.5 hover:bg-emerald-400 transition-colors"
            >
              <Download size={12} />
              <span>תבנית עץ יוחסין</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Import Members */}
          <div className="p-4 border border-slate-800 rounded-2xl bg-slate-900/40 text-center">
            <span className="text-2xl block mb-2">👥</span>
            <h4 className="text-xs font-bold text-slate-200 mb-1">ייבוא עץ משפחה</h4>
            <p className="text-[9px] text-slate-500 mb-4">העלה קובץ עם עמודות שם, דור, שם הורה, ומין</p>
            
            <input
              type="file"
              accept=".xlsx, .xls"
              id="excel-members-input"
              className="hidden"
              onChange={handleImportMembersExcel}
            />
            <label
              htmlFor="excel-members-input"
              className="px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-bold rounded-lg cursor-pointer inline-flex items-center gap-1.5"
            >
              <Upload size={12} />
              <span>בחר קובץ בני משפחה</span>
            </label>
          </div>

          {/* Import Questions */}
          <div className="p-4 border border-slate-800 rounded-2xl bg-slate-900/40 text-center">
            <span className="text-2xl block mb-2">❓</span>
            <h4 className="text-xs font-bold text-slate-200 mb-1">ייבוא שאלות משחק</h4>
            <p className="text-[9px] text-slate-500 mb-4">העלה קובץ המכיל עמודות של משפט ומי אמר</p>
            
            <input
              type="file"
              accept=".xlsx, .xls"
              id="excel-questions-input"
              className="hidden"
              onChange={handleImportQuestionsExcel}
            />
            <label
              htmlFor="excel-questions-input"
              className="px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-bold rounded-lg cursor-pointer inline-flex items-center gap-1.5"
            >
              <Upload size={12} />
              <span>בחר קובץ שאלות</span>
            </label>
          </div>
        </div>

        {/* Warning messages log */}
        {warnings.length > 0 && (
          <div className="p-4 bg-amber-950/20 border border-amber-500/20 rounded-2xl text-xs space-y-1">
            <h5 className="font-bold text-amber-400">דוח ייבוא (התראות):</h5>
            <div className="max-h-[100px] overflow-y-auto space-y-1 pr-1 font-mono text-[10px]">
              {warnings.map((w, idx) => (
                <div key={idx} className="text-amber-300">• {w}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* JSON Full System Backups */}
      <div className="col-span-5 glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
        <h3 className="text-lg font-bold text-emerald-400">גיבוי ושחזור מלא (JSON)</h3>
        <p className="text-xs text-slate-400">
          ייצא את כל המשחק המוגדר (אנשים, תמונות, שאלות, הגדרות) לקובץ גיבוי יחיד שניתן לטעון בכל מחשב אחר בשניות.
        </p>

        <div className="space-y-4 pt-2">
          {/* Export backup */}
          <button
            onClick={handleExportBackup}
            className="w-full py-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <Download size={14} />
            <span>ייצא קובץ גיבוי מלא (.json)</span>
          </button>

          {/* Import backup */}
          <div className="border border-slate-800 border-dashed p-4 rounded-xl text-center bg-slate-900/20">
            <span className="text-xs text-slate-500 block mb-3">לשחזור והעלאת קובץ גיבוי קיים:</span>
            <input
              type="file"
              accept=".json"
              id="json-backup-input"
              className="hidden"
              onChange={handleImportBackup}
            />
            <label
              htmlFor="json-backup-input"
              className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-bold rounded-lg cursor-pointer inline-flex items-center gap-1.5"
            >
              <Upload size={12} />
              <span>בחר קובץ גיבוי לשחזור</span>
            </label>
          </div>
        </div>
      </div>

    </div>
  );
};
