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

const mapGenerationToHebrew = (gen: FamilyMember['generation']): string => {
  switch (gen) {
    case 'grandparent': return 'סבא/סבתא';
    case 'parent': return 'ילד/ה';
    case 'child': return 'נכד/ה (דור ביניים)'; // support if needed
    case 'grandchild': return 'נכד/ה';
    case 'great-grandchild': return 'נין/ה';
  }
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
            nameToIdMap[m.name.trim()] = m.id;
          });

          // Pass 1: Create members and assign IDs
          rows.forEach((row, index) => {
            const name = row['שם'] || row['Name'];
            const genHeb = row['דור'] || row['Generation'];
            const genderHeb = row['מין'] || row['Gender'] || '';
            const familyName = row['שם משפחה'] || row['Family Name'] || row['FamilyName'] || '';

            if (!name) {
              warnings.push(`שורה ${index + 2}: חסר שם לבן המשפחה, שורה זו דולגה.`);
              return;
            }

            const cleanName = name.toString().trim();
            const id = 'imported_' + Math.random().toString(36).substr(2, 9);
            const generation = genHeb ? mapHebrewToGeneration(genHeb.toString()) : 'grandchild';
            const gender = genderHeb.toString().includes('נקבה') || genderHeb.toString().includes('בת') ? 'female' : 'male';

            const newMember: FamilyMember = {
              id,
              name: cleanName,
              generation,
              parentId: null,
              image: null,
              gender: gender as 'male' | 'female',
              familyName: familyName.toString().trim()
            };

            importedMembers.push(newMember);
            nameToIdMap[cleanName] = id;
          });

          // Pass 2: Resolve parent links
          rows.forEach((row) => {
            const name = row['שם'] || row['Name'];
            const parentName = row['שם הורה'] || row['הורה'] || row['Parent Name'] || row['Parent'];

            if (!name) return;

            const cleanName = name.toString().trim();
            const member = importedMembers.find(m => m.name === cleanName);

            if (member && parentName) {
              const cleanParentName = parentName.toString().trim();
              const parentId = nameToIdMap[cleanParentName];

              if (parentId) {
                member.parentId = parentId;
              } else {
                warnings.push(`עבור ${cleanName}: לא נמצא הורה בשם "${cleanParentName}" בעץ המשפחה.`);
              }
            }
          });

          // Combine with existing members (prevent duplicate names)
          const finalMembers = [...existingMembers];
          importedMembers.forEach(newMember => {
            const duplicateIndex = finalMembers.findIndex(m => m.name.trim() === newMember.name);
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
  async importQuestions(file: File, members: FamilyMember[], existingQuestions: TriviaQuestion[]): Promise<{ questions: TriviaQuestion[], warnings: string[] }> {
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

          // Create member map for fast lookup
          const memberMap: Record<string, string> = {};
          members.forEach(m => {
            memberMap[m.name.trim().toLowerCase()] = m.id;
          });

          rows.forEach((row, index) => {
            const text = row['משפט'] || row['ציטוט'] || row['שאלה'] || row['Text'] || row['Question'];
            const speakerName = row['מי אמר'] || row['אומר'] || row['שם'] || row['Speaker'] || row['Name'];

            if (!text) {
              warnings.push(`שורה ${index + 2}: חסר משפט/ציטוט, שורה זו דולגה.`);
              return;
            }
            if (!speakerName) {
              warnings.push(`שורה ${index + 2}: חסר שם האומר עבור המשפט "${text.toString().substr(0, 15)}...", שורה זו דולגה.`);
              return;
            }

            const cleanText = text.toString().trim();
            const cleanSpeaker = speakerName.toString().trim();
            const speakerId = memberMap[cleanSpeaker.toLowerCase()];

            if (!speakerId) {
              warnings.push(`שורה ${index + 2}: בן המשפחה "${cleanSpeaker}" לא נמצא בעץ היוחסין. השאלה יובאה אך יש לשייך אותה ידנית.`);
            }

            importedQuestions.push({
              id: 'q_imported_' + Math.random().toString(36).substr(2, 9),
              text: cleanText,
              speakerId: speakerId || '' // Empty if not matched
            });
          });

          resolve({ questions: [...existingQuestions, ...importedQuestions], warnings });
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
  }
};
