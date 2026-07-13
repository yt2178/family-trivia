import * as XLSX from 'xlsx';
import { FamilyMember, TriviaQuestion } from './db';

const NAME_KEYS = ['שם', 'שם פרטי', 'שם משתמש', 'name', 'first name', 'firstname'];
const GENDER_KEYS = ['מין', 'gender', 'sex', 'מגדר'];

const QUESTION_TEXT_KEYS = ['משפט', 'ציטוט', 'שאלה', 'text', 'question', 'quote', 'sentence'];
const SPEAKER_KEYS = ['מי אמר', 'אומר', 'שם', 'דובר', 'speaker', 'name', 'author'];

const getValueByKeys = (row: any, keys: string[]): string => {
  if (!row || typeof row !== 'object') return '';
  const rowKeys = Object.keys(row);
  for (const k of keys) {
    const foundKey = rowKeys.find(rk => rk.trim().toLowerCase() === k.trim().toLowerCase());
    if (foundKey) {
      const val = row[foundKey];
      return val !== undefined && val !== null ? val.toString().trim() : '';
    }
  }
  return '';
};

const normalizeGender = (genderStr: string): 'male' | 'female' => {
  const clean = genderStr.trim().toLowerCase();
  if (
    clean === 'נקבה' ||
    clean === 'נ' ||
    clean === 'בת' ||
    clean === 'female' ||
    clean === 'f' ||
    clean === 'woman' ||
    clean === 'girl'
  ) {
    return 'female';
  }
  return 'male'; // Default
};



export interface ImportResult {
  success: boolean;
  membersAdded: number;
  questionsAdded: number;
  warnings: string[];
}

export const excelHelper = {
  // Parse Members Excel File
  async importMembers(file: File, existingMembers: FamilyMember[]): Promise<{ members: FamilyMember[], warnings: string[] }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json<any>(worksheet);

          const warnings: string[] = [];
          const importedMembers: FamilyMember[] = [];

          // Check for mandatory fields / columns
          if (rows.length > 0) {
            const firstRow = rows[0];
            const keys = Object.keys(firstRow).map(k => k.trim().toLowerCase());
            const hasNameCol = NAME_KEYS.some(nk => keys.includes(nk));
            if (!hasNameCol) {
              throw new Error('קובץ ה-Excel לא מכיל עמודת שם תקינה (שם או Name).');
            }
          }

          // Create members and assign IDs
          rows.forEach((row, index) => {
            const name = getValueByKeys(row, NAME_KEYS);
            const genderHeb = getValueByKeys(row, GENDER_KEYS);

            if (!name) {
              warnings.push(`שורה ${index + 2}: חסר שם לשחקן, שורה זו דולגה.`);
              return;
            }

            const cleanName = name.trim();
            const id = 'imported_' + Math.random().toString(36).substr(2, 9);
            const gender = normalizeGender(genderHeb);

            const newMember: FamilyMember = {
              id,
              name: cleanName,
              image: null,
              gender
            };

            importedMembers.push(newMember);
          });

          // Combine with existing members (prevent duplicate names)
          const finalMembers = [...existingMembers];
          importedMembers.forEach(newMember => {
            const duplicateIndex = finalMembers.findIndex(m => m.name.trim().toLowerCase() === newMember.name.toLowerCase());
            if (duplicateIndex !== -1) {
              finalMembers[duplicateIndex] = {
                ...finalMembers[duplicateIndex],
                gender: newMember.gender,
              };
              warnings.push(`עודכנו פרטים עבור שחקן קיים: "${newMember.name}"`);
            } else {
              finalMembers.push(newMember);
            }
          });

          resolve({ members: finalMembers, warnings });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  // Parse Questions Excel File
  async importQuestions(
    file: File, 
    members: FamilyMember[], 
    existingQuestions: TriviaQuestion[]
  ): Promise<{ questions: TriviaQuestion[], updatedMembers: FamilyMember[], warnings: string[] }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json<any>(worksheet);

          const warnings: string[] = [];
          const importedQuestions: TriviaQuestion[] = [];
          const tempMembers = [...members];

          // Create member map for fast lookup
          const memberMap: Record<string, string> = {};
          tempMembers.forEach(m => {
            memberMap[m.name.trim().toLowerCase()] = m.id;
          });

          // Check for column validations
          if (rows.length > 0) {
            const firstRow = rows[0];
            const keys = Object.keys(firstRow).map(k => k.trim().toLowerCase());
            const hasTextCol = QUESTION_TEXT_KEYS.some(tk => keys.includes(tk));
            if (!hasTextCol) {
              throw new Error('קובץ ה-Excel לא מכיל עמודת ציטוט/שאלה תקינה.');
            }
          }

          rows.forEach((row, index) => {
            const text = getValueByKeys(row, QUESTION_TEXT_KEYS);
            const speakerName = getValueByKeys(row, SPEAKER_KEYS);

            if (!text) {
              warnings.push(`שורה ${index + 2}: חסר משפט/ציטוט, שורה זו דולגה.`);
              return;
            }

            const cleanText = text.trim();
            let speakerId = '';

            if (speakerName) {
              const cleanSpeaker = speakerName.trim();
              speakerId = memberMap[cleanSpeaker.toLowerCase()] || '';

              if (!speakerId) {
                // Create placeholder/temporary member for missing speakers
                const newId = 'placeholder_' + Math.random().toString(36).substr(2, 9);
                const placeholderMember: FamilyMember = {
                  id: newId,
                  name: cleanSpeaker,
                  image: null,
                  gender: 'male'
                };
                tempMembers.push(placeholderMember);
                memberMap[cleanSpeaker.toLowerCase()] = newId;
                speakerId = newId;
                warnings.push(`שורה ${index + 2}: השחקן/משתתף "${cleanSpeaker}" לא נמצא ברשימה. נוצר משתתף זמני עבורו.`);
              }
            }

            importedQuestions.push({
              id: 'q_imported_' + Math.random().toString(36).substr(2, 9),
              text: cleanText,
              speakerId
            });
          });

          resolve({ questions: [...existingQuestions, ...importedQuestions], updatedMembers: tempMembers, warnings });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  // Download Excel Template
  downloadTemplate(): void {
    const workbook = XLSX.utils.book_new();

    // Set right-to-left view
    workbook.Workbook = {
      Views: [
        { RTL: true }
      ]
    };

    // Speakers list Template
    const membersData = [
      { 'שם': 'שלום', 'מין': 'זכר' },
      { 'שם': 'שלומית', 'מין': 'נקבה' },
      { 'שם': 'אריאל', 'מין': 'זכר' },
      { 'שם': 'אריאלה', 'מין': 'נקבה' }
    ];
    const membersSheet = XLSX.utils.json_to_sheet(membersData);
    XLSX.utils.book_append_sheet(workbook, membersSheet, 'שמות משתתפים');

    // Save/Download workbook
    XLSX.writeFile(workbook, 'משחק משפחתי שמות משתתפים.xlsx');
  },

  // Download dedicated Questions Template
  downloadQuestionsTemplate(): void {
    const workbook = XLSX.utils.book_new();

    // Set right-to-left view
    workbook.Workbook = {
      Views: [
        { RTL: true }
      ]
    };

    const questionsData = [
      { 'משפט': 'אני לא סובל בצל באוכל!', 'מי אמר': 'יוסי' },
      { 'משפט': 'בואו נשחק כדורגל בחצר', 'מי אמר': '' },
      { 'משפט': 'מי מהילדים הכי גבוה במשפחה?', 'מי אמר': '' },
      { 'משפט': 'כשהייתי קטן הלכתי לאיבוד בקניון במשך שלוש שעות!', 'מי אמר': 'אריאל' },
      { 'משפט': 'אני מכינה את החריימה הכי טעים בארץ!', 'מי אמר': 'אריאלה' },
      { 'משפט': 'מי אמר: "נו, מתי אוכלים?" בכל ארוחה משפחתית?', 'מי אמר': 'שלום' },
      { 'משפט': 'הייתי ב-20 הופעות של שלמה ארצי בחיים שלי!', 'מי אמר': 'שלומית' },
      { 'משפט': 'אני ישן תמיד עם גרביים, אפילו בקיץ הכי חם', 'מי אמר': 'יוסי' },
      { 'משפט': 'איזה מאכל סבתא מכינה רק בראש השנה?', 'מי אמר': '' },
      { 'משפט': 'מי הדמות המשפחתית שתמיד מאחרת לפחות בחצי שעה?', 'מי אמר': '' },
      { 'משפט': 'מי עשה רישיון נהיגה רק בטסט השביעי שלו?', 'מי אמר': 'אריאל' }
    ];
    const questionsSheet = XLSX.utils.json_to_sheet(questionsData);
    XLSX.utils.book_append_sheet(workbook, questionsSheet, 'שאלות וציטוטים');
    XLSX.writeFile(workbook, 'משחק משפחתי שאלות וציטוטים.xlsx');
  }
};
