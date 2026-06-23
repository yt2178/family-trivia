import * as XLSX from 'xlsx';
import { FamilyMember, TriviaQuestion } from './db';

// Helper to map Hebrew generation name to system generation
const mapHebrewToGeneration = (heb: string): FamilyMember['generation'] => {
  const clean = heb.trim();
  if (clean.includes('סבא') || clean.includes('סבתא') || clean.includes('סבים')) {
    return 'grandparent';
  }
  if (clean.includes('ילד') || clean.includes('ילדה') || clean.includes('הורה')) {
    return 'parent';
  }
  if (clean.includes('נכד') || clean.includes('נכדה')) {
    return 'grandchild';
  }
  if (clean.includes('נין') || clean.includes('נינה')) {
    return 'great-grandchild';
  }
  // Default fallback
  return 'grandchild';
};

const NAME_KEYS = ['שם', 'שם פרטי', 'שם משתמש', 'name', 'first name', 'firstname'];
const FAMILY_NAME_KEYS = ['שם משפחה', 'משפחה', 'family name', 'familyname', 'lastname', 'last name'];
const GENERATION_KEYS = ['דור', 'generation', 'gen', 'דרגה'];
const PARENT_KEYS = ['שם הורה', 'הורה', 'הורים', 'parent', 'parent name', 'parentname', 'father', 'mother', 'אבא', 'אמא'];
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

const generationOrder: Record<FamilyMember['generation'], number> = {
  'grandparent': 0,
  'parent': 1,
  'child': 2,
  'grandchild': 2,
  'great-grandchild': 3
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
          const nameToIdMap: Record<string, string> = {};

          // Populate existing members map
          existingMembers.forEach(m => {
            nameToIdMap[m.name.trim().toLowerCase()] = m.id;
          });

          // Check for mandatory fields / columns
          if (rows.length > 0) {
            const firstRow = rows[0];
            const keys = Object.keys(firstRow).map(k => k.trim().toLowerCase());
            const hasNameCol = NAME_KEYS.some(nk => keys.includes(nk));
            if (!hasNameCol) {
              throw new Error('קובץ ה-Excel לא מכיל עמודת שם תקינה (שם או Name).');
            }
          }

          // Pass 1: Create members and assign IDs
          rows.forEach((row, index) => {
            const name = getValueByKeys(row, NAME_KEYS);
            const genHeb = getValueByKeys(row, GENERATION_KEYS);
            const genderHeb = getValueByKeys(row, GENDER_KEYS);
            const familyName = getValueByKeys(row, FAMILY_NAME_KEYS);

            if (!name) {
              warnings.push(`שורה ${index + 2}: חסר שם לבן המשפחה, שורה זו דולגה.`);
              return;
            }

            const cleanName = name.trim();
            const id = 'imported_' + Math.random().toString(36).substr(2, 9);
            const generation = genHeb ? mapHebrewToGeneration(genHeb) : 'grandchild';
            const gender = normalizeGender(genderHeb);

            const newMember: FamilyMember = {
              id,
              name: cleanName,
              generation,
              parentId: null,
              image: null,
              gender,
              familyName: familyName.trim()
            };

            importedMembers.push(newMember);
            nameToIdMap[cleanName.toLowerCase()] = id;
          });

          // Pass 2: Resolve parent links
          rows.forEach((row) => {
            const name = getValueByKeys(row, NAME_KEYS);
            const parentName = getValueByKeys(row, PARENT_KEYS);

            if (!name) return;

            const cleanName = name.trim();
            const member = importedMembers.find(m => m.name.toLowerCase() === cleanName.toLowerCase());

            if (member && parentName) {
              const cleanParentName = parentName.trim();
              const parentId = nameToIdMap[cleanParentName.toLowerCase()];

              if (parentId) {
                // Prevent self-parenting
                if (parentId === member.id) {
                  warnings.push(`עבור ${cleanName}: אדם אינו יכול להיות הורה של עצמו!`);
                } else {
                  member.parentId = parentId;
                }
              } else {
                warnings.push(`עבור ${cleanName}: לא נמצא הורה בשם "${cleanParentName}" בעץ המשפחה.`);
              }
            }
          });

          // Sort hierarchically: grandparent -> parent -> grandchild -> great-grandchild
          importedMembers.sort((a, b) => {
            const wA = generationOrder[a.generation] ?? 2;
            const wB = generationOrder[b.generation] ?? 2;
            return wA - wB;
          });

          // Combine with existing members (prevent duplicate names)
          const finalMembers = [...existingMembers];
          importedMembers.forEach(newMember => {
            const duplicateIndex = finalMembers.findIndex(m => m.name.trim().toLowerCase() === newMember.name.toLowerCase());
            if (duplicateIndex !== -1) {
              // Update existing member's properties
              finalMembers[duplicateIndex] = {
                ...finalMembers[duplicateIndex],
                generation: newMember.generation,
                gender: newMember.gender,
                parentId: newMember.parentId || finalMembers[duplicateIndex].parentId,
                familyName: newMember.familyName || finalMembers[duplicateIndex].familyName
              };
              warnings.push(`עודכנו פרטים עבור בן משפחה קיים: "${newMember.name}"`);
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
                  generation: 'grandchild',
                  parentId: null,
                  image: null,
                  gender: 'male',
                  familyName: ''
                };
                tempMembers.push(placeholderMember);
                memberMap[cleanSpeaker.toLowerCase()] = newId;
                speakerId = newId;
                warnings.push(`שורה ${index + 2}: בן המשפחה "${cleanSpeaker}" לא נמצא בעץ. נוצר משתתף זמני עבורו.`);
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
  downloadTemplate(mode: 'tree' | 'list' = 'tree'): void {
    const workbook = XLSX.utils.book_new();

    if (mode === 'tree') {
      // Sheet 1: Family Members Template
      const membersData = [
        { 'שם': 'יעקב', 'שם משפחה': 'כהן', 'דור': 'סבא/סבתא', 'שם הורה': '', 'מין': 'זכר' },
        { 'שם': 'שרה', 'שם משפחה': 'כהן', 'דור': 'סבא/סבתא', 'שם הורה': '', 'מין': 'נקבה' },
        { 'שם': 'דוד', 'שם משפחה': 'כהן', 'דור': 'ילד/ה', 'שם הורה': 'יעקב', 'מין': 'זכר' },
        { 'שם': 'רחל', 'שם משפחה': 'לוי', 'דור': 'ילד/ה', 'שם הורה': 'שרה', 'מין': 'נקבה' },
        { 'שם': 'יוסי', 'שם משפחה': 'כהן', 'דור': 'נכד/ה', 'שם הורה': 'דוד', 'מין': 'זכר' },
        { 'שם': 'שירה', 'שם משפחה': 'כהן', 'דור': 'נכד/ה', 'שם הורה': 'דוד', 'מין': 'נקבה' },
        { 'שם': 'נועם', 'שם משפחה': 'כהן', 'דור': 'נין/ה', 'שם הורה': 'יוסי', 'מין': 'זכר' }
      ];
      const membersSheet = XLSX.utils.json_to_sheet(membersData);
      XLSX.utils.book_append_sheet(workbook, membersSheet, 'בני משפחה');

      // Sheet 2: Questions Template
      const questionsData = [
        { 'משפט': 'סבא תמיד קונה לי ממתקים כשאמא לא רואה!', 'מי אמר': 'יוסי' },
        { 'משפט': 'אני הכי אוהבת את ארוחות השבת של סבתא שרה', 'מי אמר': 'רחל' },
        { 'משפט': 'אני רוצה ללמוד לנגן בגיטרה כמו דוד דוד', 'מי אמר': 'נועם' }
      ];
      const questionsSheet = XLSX.utils.json_to_sheet(questionsData);
      XLSX.utils.book_append_sheet(workbook, questionsSheet, 'שאלות המשחק');

      // Save/Download workbook
      XLSX.writeFile(workbook, 'תבנית_משחק_עץ_משפחה.xlsx');
    } else {
      // Sheet 1: Speakers list Template
      const membersData = [
        { 'שם': 'דוד', 'שם משפחה': 'כהן', 'מין': 'זכר' },
        { 'שם': 'שרה', 'שם משפחה': 'כהן', 'מין': 'נקבה' },
        { 'שם': 'משה', 'שם משפחה': 'לוי', 'מין': 'זכר' },
        { 'שם': 'יפה', 'שם משפחה': 'לוי', 'מין': 'נקבה' }
      ];
      const membersSheet = XLSX.utils.json_to_sheet(membersData);
      XLSX.utils.book_append_sheet(workbook, membersSheet, 'רשימת משתתפים');

      // Sheet 2: Questions Template
      const questionsData = [
        { 'משפט': 'אני הכי אוהב שוקולד בעולם!', 'מי אמר': 'דוד' },
        { 'משפט': 'מחר אנחנו נוסעים לטיול שנתי.', 'מי אמר': 'שרה' }
      ];
      const questionsSheet = XLSX.utils.json_to_sheet(questionsData);
      XLSX.utils.book_append_sheet(workbook, questionsSheet, 'שאלות המשחק');

      // Save/Download workbook
      XLSX.writeFile(workbook, 'תבנית_משחק_ללא_עץ.xlsx');
    }
  },

  // Download dedicated Questions Template
  downloadQuestionsTemplate(): void {
    const workbook = XLSX.utils.book_new();
    const questionsData = [
      { 'משפט': 'אני לא סובל בצל באוכל!', 'מי אמר': 'יוסי' },
      { 'משפט': 'בואו נשחק כדורגל בחצר', 'מי אמר': '' },
      { 'משפט': 'מי מהילדים הכי גבוה במשפחה?', 'מי אמר': '' }
    ];
    const questionsSheet = XLSX.utils.json_to_sheet(questionsData);
    XLSX.utils.book_append_sheet(workbook, questionsSheet, 'שאלות וציטוטים');
    XLSX.writeFile(workbook, 'תבנית_שאלות_וציטוטים.xlsx');
  }
};
