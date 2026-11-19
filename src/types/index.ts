export type Language = 'th' | 'en';

export type GameModeType = 'game' | 'lesson' | 'pretest' | 'posttest' | 'practice' | 'ranked';

export interface User {
  uid: string;
  username: string;
  studentId?: string;
  fullName?: string;
  classroom?: string;
  classroomUpdatedAt?: string;
  displayName: string;
  role?: 'student' | 'teacher' | 'admin';
  avatar?: string;
  avatarBg?: string;
  createdAt: string;
}

export interface ScoreRecord {
  scoreId: string;
  uid: string;
  displayName: string;
  classroom?: string;
  avatar?: string;
  avatarBg?: string;
  gameMode: GameModeType;
  testType: 'NONE' | 'PRE_TEST' | 'POST_TEST' | 'RANKED';
  language: Language;
  levelId: number | string;
  levelTitle: string;
  score: number;
  totalCharacters: number;
  correctCharacters: number;
  incorrectCharacters: number;
  accuracy: number;
  grossWpm: number;
  netWpm: number;
  timeTakenSeconds: number;
  passed: boolean;
  rankTier?: string;
  championshipMode?: 'speed_sprint' | 'championship_endurance' | 'sudden_death';
  maxCombo?: number;
  accuracyMultiplier?: number;
  createdAt: string;
  clientSessionId?: string;
}

export interface LevelConfig {
  id: number;
  titleTh: string;
  titleEn: string;
  descriptionTh: string;
  descriptionEn: string;
  category: 'home' | 'fingers' | 'upper' | 'lower' | 'all' | 'words_easy' | 'words_med' | 'words_hard' | 'sentences' | 'speed';
  targetKeysTh: string[];
  targetKeysEn: string[];
  targetAccuracy: number; // e.g. 85%
  minWpm: number; // minimum WPM to pass
  timeLimitSeconds: number;
  wordCount: number;
}

export interface LessonConfig {
  id: number;
  title: string;
  shortTitle?: string;
  subtitle: string;
  theory: string[];
  keyPoints: string[];
  fingerFocus: string;
  keysTh: string[];
  keysEn: string[];
  practiceTextTh: string[];
  practiceTextEn: string[];
}

export type FingerName =
  | 'left-pinky'
  | 'left-ring'
  | 'left-middle'
  | 'left-index'
  | 'thumb'
  | 'right-index'
  | 'right-middle'
  | 'right-ring'
  | 'right-pinky';

export interface KeyInfo {
  code: string;
  labelEn: string;
  shiftEn?: string;
  labelTh: string;
  shiftTh?: string;
  finger: FingerName;
  width?: number; // default 1
}

export interface EarnedMedalItem {
  id: string;
  category: 'grand' | 'activity' | 'level' | 'achievement';
  title: string;
  subtitle: string;
  icon: string;
  earnedAt: string;
}

export interface UserMedalProfile {
  accountKey: string;
  uid: string;
  studentId: string;
  displayName: string;
  fullName: string;
  classroom: string;
  hasPretest: boolean;
  hasLesson: boolean;
  hasPosttest: boolean;
  passedLevels: number[];
  hasAll10Levels: boolean;
  isGrandComplete: boolean;
  achievementIds: string[];
  earnedMedals: EarnedMedalItem[];
  totalMedalsCount: number;
  completionPercent: number;
  bestScore: number;
  bestWpm: number;
  bestAccuracy: number;
  updatedAt: string;
}

export interface PrePostComparisonRecord {
  accountKey: string;
  uid: string;
  studentId: string;
  displayName: string;
  fullName: string;
  classroom: string;
  pretestQuizScore: number | null;
  pretestQuizTotal: number;
  pretestQuizPercent: number | null;
  pretestQuizDate?: string;
  posttestQuizScore: number | null;
  posttestQuizTotal: number;
  posttestQuizPercent: number | null;
  posttestQuizDate?: string;
  quizScoreDiff: number | null;
  pretestTypingWpm: number | null;
  pretestTypingAccuracy: number | null;
  pretestTypingDate?: string;
  posttestTypingWpm: number | null;
  posttestTypingAccuracy: number | null;
  posttestTypingDate?: string;
  typingWpmDiff: number | null;
  typingAccuracyDiff: number | null;
  updatedAt: string;
}

