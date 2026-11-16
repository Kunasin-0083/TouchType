import { LevelConfig } from '../types';
import {
  THAI_HOME_ROW_KEYS,
  EN_HOME_ROW_KEYS,
  THAI_UPPER_ROW_KEYS,
  EN_UPPER_ROW_KEYS,
  THAI_LOWER_ROW_KEYS,
  EN_LOWER_ROW_KEYS,
  THAI_EASY_WORDS,
  EN_EASY_WORDS,
  THAI_MEDIUM_WORDS,
  EN_MEDIUM_WORDS,
  THAI_HARD_WORDS,
  EN_HARD_WORDS,
  THAI_SENTENCES,
  EN_SENTENCES,
  generateDrillText,
  getRandomSlice
} from './words';

export const LEVELS_CONFIG: LevelConfig[] = [
  {
    id: 1,
    titleTh: 'ด่าน 1: แป้นเหย้าพื้นฐาน (Home Row)',
    titleEn: 'Level 1: Home Row Basics',
    descriptionTh: 'ฝึกการวางนิ้วและกดปุ่มแป้นเหย้าทีละปุ่ม โดยไม่ก้มมองแป้นพิมพ์',
    descriptionEn: 'Practice primary finger positions on the home row keys without looking down.',
    category: 'home',
    targetKeysTh: THAI_HOME_ROW_KEYS,
    targetKeysEn: EN_HOME_ROW_KEYS,
    targetAccuracy: 80,
    minWpm: 12,
    timeLimitSeconds: 60,
    wordCount: 12
  },
  {
    id: 2,
    titleTh: 'ด่าน 2: การควบคุมนิ้ว (Finger Control)',
    titleEn: 'Level 2: Finger Dexterity',
    descriptionTh: 'ฝึกความคล่องตัวในการสลับนิ้วมือซ้ายและขวาบนแป้นเหย้าอย่างมีจังหวะ',
    descriptionEn: 'Develop dexterity by alternating left and right fingers on home row keys.',
    category: 'fingers',
    targetKeysTh: ['ฟ', 'ห', 'ก', 'ด', '่', 'า', 'ส', 'ว'],
    targetKeysEn: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';'],
    targetAccuracy: 82,
    minWpm: 15,
    timeLimitSeconds: 60,
    wordCount: 14
  },
  {
    id: 3,
    titleTh: 'ด่าน 3: แป้นแถวบน (Upper Row)',
    titleEn: 'Level 3: Upper Row Reach',
    descriptionTh: 'ฝึกเอื้อมนิ้วจากแป้นเหย้าขึ้นสู่แถวบน แล้วดึงนิ้วกลับแป้นเหย้าทันที',
    descriptionEn: 'Master reaching upward from the home row to the top row keys and returning.',
    category: 'upper',
    targetKeysTh: THAI_UPPER_ROW_KEYS,
    targetKeysEn: EN_UPPER_ROW_KEYS,
    targetAccuracy: 85,
    minWpm: 16,
    timeLimitSeconds: 60,
    wordCount: 14
  },
  {
    id: 4,
    titleTh: 'ด่าน 4: แป้นแถวล่าง (Lower Row)',
    titleEn: 'Level 4: Lower Row Reach',
    descriptionTh: 'ฝึกงอนิ้วลงสู่แป้นแถวล่างและเครื่องหมาย โดยรักษาระดับข้อมือให้นิ่ง',
    descriptionEn: 'Learn downward finger curl for lower row letters and punctuation.',
    category: 'lower',
    targetKeysTh: THAI_LOWER_ROW_KEYS,
    targetKeysEn: EN_LOWER_ROW_KEYS,
    targetAccuracy: 85,
    minWpm: 16,
    timeLimitSeconds: 60,
    wordCount: 14
  },
  {
    id: 5,
    titleTh: 'ด่าน 5: ผสมผสานทุกแถว (All Rows Mastery)',
    titleEn: 'Level 5: All Rows Mastery',
    descriptionTh: 'ฝึกพิมพ์ตัวอักษรผสมกันระหว่างแถวบน แถวเหย้า และแถวล่าง',
    descriptionEn: 'Combine letters across upper, home, and lower rows in rapid sequence.',
    category: 'all',
    targetKeysTh: [...THAI_HOME_ROW_KEYS, ...THAI_UPPER_ROW_KEYS, ...THAI_LOWER_ROW_KEYS],
    targetKeysEn: [...EN_HOME_ROW_KEYS, ...EN_UPPER_ROW_KEYS, ...EN_LOWER_ROW_KEYS],
    targetAccuracy: 85,
    minWpm: 18,
    timeLimitSeconds: 70,
    wordCount: 16
  },
  {
    id: 6,
    titleTh: 'ด่าน 6: คำศัพท์ระดับง่าย (Easy Words)',
    titleEn: 'Level 6: Easy Vocabulary',
    descriptionTh: 'ฝึกพิมพ์คำศัพท์สั้นที่ใช้บ่อยในชีวิตประจำวัน เพื่อสร้างความจำของคำ',
    descriptionEn: 'Type frequent short words to build muscle memory for full word shapes.',
    category: 'words_easy',
    targetKeysTh: [],
    targetKeysEn: [],
    targetAccuracy: 88,
    minWpm: 20,
    timeLimitSeconds: 60,
    wordCount: 16
  },
  {
    id: 7,
    titleTh: 'ด่าน 7: คำศัพท์ระดับกลาง (Medium Words)',
    titleEn: 'Level 7: Medium Vocabulary',
    descriptionTh: 'คำศัพท์ทางวิชาการและคอมพิวเตอร์ที่มีความยาวและสระผสมหลากหลาย',
    descriptionEn: 'Multi-syllable computer and academic terms with rich vowel combinations.',
    category: 'words_med',
    targetKeysTh: [],
    targetKeysEn: [],
    targetAccuracy: 90,
    minWpm: 24,
    timeLimitSeconds: 75,
    wordCount: 15
  },
  {
    id: 8,
    titleTh: 'ด่าน 8: คำศัพท์ระดับยาก (Hard Words)',
    titleEn: 'Level 8: Advanced Vocabulary',
    descriptionTh: 'คำศัพท์ยาว สระซับซ้อน ตัวการันต์ และอักษรควบกล้ำที่ท้าทาย',
    descriptionEn: 'Challenging, complex vocabulary testing finger accuracy under pressure.',
    category: 'words_hard',
    targetKeysTh: [],
    targetKeysEn: [],
    targetAccuracy: 90,
    minWpm: 26,
    timeLimitSeconds: 80,
    wordCount: 12
  },
  {
    id: 9,
    titleTh: 'ด่าน 9: ประโยคท้าทาย (Sentence Challenge)',
    titleEn: 'Level 9: Full Sentence Challenge',
    descriptionTh: 'ฝึกพิมพ์ประโยคเต็มที่มีการเว้นวรรคและเครื่องหมายวรรคตอนอย่างเป็นธรรมชาติ',
    descriptionEn: 'Type complete flowing sentences with natural spacing and punctuation.',
    category: 'sentences',
    targetKeysTh: [],
    targetKeysEn: [],
    targetAccuracy: 92,
    minWpm: 28,
    timeLimitSeconds: 90,
    wordCount: 4
  },
  {
    id: 10,
    titleTh: 'ด่าน 10: ประลองความเร็วสูงสุด (Speed & Accuracy Showdown)',
    titleEn: 'Level 10: Speed & Accuracy Showdown',
    descriptionTh: 'ด่านบอสสุดท้าย! ท้าทายความเร็วและความแม่นยำเพื่อชิงคะแนนสูงสุดบน Leaderboard',
    descriptionEn: 'The ultimate boss challenge! Push your speed and precision to the limit.',
    category: 'speed',
    targetKeysTh: [],
    targetKeysEn: [],
    targetAccuracy: 94,
    minWpm: 32,
    timeLimitSeconds: 90,
    wordCount: 6
  }
];

/**
 * Generate randomized target text for a level
 * Ensures dynamic freshness every time the user plays or replays
 */
export function generateLevelText(level: LevelConfig, language: 'th' | 'en'): string {
  switch (level.category) {
    case 'home':
      return language === 'th'
        ? generateDrillText(THAI_HOME_ROW_KEYS, 4, level.wordCount)
        : generateDrillText(EN_HOME_ROW_KEYS, 4, level.wordCount);

    case 'fingers':
      return language === 'th'
        ? generateDrillText(['ฟ', 'ห', 'ก', 'ด', '่', 'า', 'ส', 'ว'], 4, level.wordCount)
        : generateDrillText(['a', 's', 'd', 'f', 'j', 'k', 'l', ';'], 4, level.wordCount);

    case 'upper':
      return language === 'th'
        ? generateDrillText(['พ', 'ะ', 'ั', 'ี', 'ร', 'น', 'ย', 'บ', 'ล', 'า', 'ก', 'ด'], 4, level.wordCount)
        : generateDrillText(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's', 'd'], 4, level.wordCount);

    case 'lower':
      return language === 'th'
        ? generateDrillText(['ผ', 'ป', 'แ', 'อ', 'ิ', 'ื', 'ท', 'ม', 'า', 'ก', 'ด', 'ส'], 4, level.wordCount)
        : generateDrillText(['z', 'x', 'c', 'v', 'b', 'n', 'm', 'a', 's', 'd', 'f', 'j'], 4, level.wordCount);

    case 'all':
      return language === 'th'
        ? generateDrillText([...THAI_HOME_ROW_KEYS, ...THAI_UPPER_ROW_KEYS, ...THAI_LOWER_ROW_KEYS], 4, level.wordCount)
        : generateDrillText([...EN_HOME_ROW_KEYS, ...EN_UPPER_ROW_KEYS, ...EN_LOWER_ROW_KEYS], 4, level.wordCount);

    case 'words_easy':
      return getRandomSlice(language === 'th' ? THAI_EASY_WORDS : EN_EASY_WORDS, level.wordCount).join(' ');

    case 'words_med':
      return getRandomSlice(language === 'th' ? THAI_MEDIUM_WORDS : EN_MEDIUM_WORDS, level.wordCount).join(' ');

    case 'words_hard':
      return getRandomSlice(language === 'th' ? THAI_HARD_WORDS : EN_HARD_WORDS, level.wordCount).join(' ');

    case 'sentences':
    case 'speed': {
      const bank = language === 'th' ? THAI_SENTENCES : EN_SENTENCES;
      const count = level.category === 'sentences' ? 3 : 4;
      return getRandomSlice(bank, count).join(' ');
    }

    default:
      return language === 'th' ? 'การพิมพ์สัมผัสช่วยเพิ่มผลผลิต' : 'Touch typing improves productivity';
  }
}
