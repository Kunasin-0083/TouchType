import React from 'react';
import {
  CheckCircle2,
  Lock,
  Sparkles,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  Gamepad2,
  Crown
} from 'lucide-react';
import { ScoreRecord } from '../types';
import { LEVELS_CONFIG } from '../data/levels';
import { useTheme } from '../context/ThemeContext';

export const GRAND_MEDAL_IMAGE_PATH = '/assets/aistudio/_________________________________fc88b102.png';

export interface CurriculumCompletionInfo {
  pretestRecords: ScoreRecord[];
  lessonRecords: ScoreRecord[];
  posttestRecords: ScoreRecord[];
  passedLevelMap: Map<number, { bestWpm: number; bestScore: number; bestAccuracy: number }>;
  hasPretest: boolean;
  hasLesson: boolean;
  hasPosttest: boolean;
  passedLevelsCount: number;
  hasAll10Levels: boolean;
  completedSteps: number;
  totalSteps: number;
  completionPercent: number;
  isGrandComplete: boolean;
}

export function getCurriculumCompletion(userScores: ScoreRecord[]): CurriculumCompletionInfo {
  const pretestRecords = userScores.filter(
    s => s.gameMode === 'pretest' || s.testType === 'PRE_TEST'
  );
  const lessonRecords = userScores.filter(
    s => s.gameMode === 'lesson' || s.gameMode === 'practice'
  );
  const posttestRecords = userScores.filter(
    s => s.gameMode === 'posttest' || s.testType === 'POST_TEST'
  );
  const gamePassedRecords = userScores.filter(
    s => s.gameMode === 'game' && s.passed
  );

  const hasPretest = pretestRecords.length > 0;
  const hasLesson = lessonRecords.length > 0;
  const hasPosttest = posttestRecords.length > 0;

  const passedLevelMap = new Map<number, { bestWpm: number; bestScore: number; bestAccuracy: number }>();
  for (const r of gamePassedRecords) {
    const lvl = Number(r.levelId);
    if (!Number.isFinite(lvl) || lvl < 1 || lvl > 10) continue;
    const prev = passedLevelMap.get(lvl);
    if (!prev) {
      passedLevelMap.set(lvl, {
        bestWpm: r.netWpm,
        bestScore: r.score,
        bestAccuracy: r.accuracy
      });
    } else {
      passedLevelMap.set(lvl, {
        bestWpm: Math.max(prev.bestWpm, r.netWpm),
        bestScore: Math.max(prev.bestScore, r.score),
        bestAccuracy: Math.max(prev.bestAccuracy, r.accuracy)
      });
    }
  }

  const passedLevelsCount = passedLevelMap.size;
  const hasAll10Levels = passedLevelsCount === 10;

  const totalSteps = 13; // Pretest (1) + Learning Center (1) + 10 Game Levels (10) + Posttest (1)
  const completedSteps =
    (hasPretest ? 1 : 0) +
    (hasLesson ? 1 : 0) +
    passedLevelsCount +
    (hasPosttest ? 1 : 0);

  const completionPercent = Math.round((completedSteps / totalSteps) * 100);
  const isGrandComplete = hasPretest && hasLesson && hasAll10Levels && hasPosttest;

  return {
    pretestRecords,
    lessonRecords,
    posttestRecords,
    passedLevelMap,
    hasPretest,
    hasLesson,
    hasPosttest,
    passedLevelsCount,
    hasAll10Levels,
    completedSteps,
    totalSteps,
    completionPercent,
    isGrandComplete
  };
}

interface MedalShowcaseProps {
  userScores: ScoreRecord[];
}

export const MedalShowcase: React.FC<MedalShowcaseProps> = ({ userScores }) => {
  const { isDark } = useTheme();

  const {
    pretestRecords,
    lessonRecords,
    posttestRecords,
    passedLevelMap,
    hasPretest,
    hasLesson,
    hasPosttest,
    passedLevelsCount,
    hasAll10Levels,
    completedSteps,
    totalSteps,
    completionPercent,
    isGrandComplete
  } = getCurriculumCompletion(userScores);

  const bestPretestScore = pretestRecords.reduce((m, r) => Math.max(m, r.score), 0);
  const bestPosttestScore = posttestRecords.reduce((m, r) => Math.max(m, r.score), 0);

  // Distinct visual styling per level tier (1-10)
  const getLevelTierStyle = (levelId: number, unlocked: boolean) => {
    if (!unlocked) {
      return {
        ring: isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-100/80',
        medalGradient: isDark ? 'from-slate-800 to-slate-900' : 'from-slate-200 to-slate-300',
        numText: isDark ? 'text-slate-600' : 'text-slate-400',
        ribbon: isDark ? 'bg-slate-800' : 'bg-slate-300',
        badgeLabel: isDark ? 'text-slate-500' : 'text-slate-400'
      };
    }

    if (levelId <= 2) {
      return {
        ring: isDark ? 'border-cyan-500/50 bg-cyan-950/25' : 'border-cyan-300 bg-cyan-50/70',
        medalGradient: 'from-cyan-400 via-sky-500 to-blue-600',
        numText: 'text-white',
        ribbon: 'bg-cyan-600',
        badgeLabel: 'text-cyan-500'
      };
    }
    if (levelId <= 4) {
      return {
        ring: isDark ? 'border-indigo-500/50 bg-indigo-950/25' : 'border-indigo-300 bg-indigo-50/70',
        medalGradient: 'from-blue-400 via-indigo-500 to-violet-600',
        numText: 'text-white',
        ribbon: 'bg-indigo-600',
        badgeLabel: 'text-indigo-500'
      };
    }
    if (levelId <= 6) {
      return {
        ring: isDark ? 'border-emerald-500/50 bg-emerald-950/25' : 'border-emerald-300 bg-emerald-50/70',
        medalGradient: 'from-emerald-400 via-teal-500 to-green-600',
        numText: 'text-white',
        ribbon: 'bg-emerald-600',
        badgeLabel: 'text-emerald-500'
      };
    }
    if (levelId <= 8) {
      return {
        ring: isDark ? 'border-purple-500/50 bg-purple-950/25' : 'border-purple-300 bg-purple-50/70',
        medalGradient: 'from-purple-400 via-fuchsia-500 to-pink-600',
        numText: 'text-white',
        ribbon: 'bg-purple-600',
        badgeLabel: 'text-purple-500'
      };
    }
    return {
      ring: isDark ? 'border-amber-400/60 bg-amber-950/25' : 'border-amber-300 bg-amber-50/80',
      medalGradient: 'from-amber-300 via-yellow-400 to-orange-500',
      numText: 'text-slate-950',
      ribbon: 'bg-amber-600',
      badgeLabel: 'text-amber-500'
    };
  };

  const totalFunctionMedalsEarned =
    (hasPretest ? 1 : 0) +
    (hasLesson ? 1 : 0) +
    (hasAll10Levels ? 1 : 0) +
    (hasPosttest ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* 0. Grand 100% Completion Master Medal (Custom Uploaded Emblem) */}
      <div
        className={`relative overflow-hidden border-2 rounded-3xl p-6 sm:p-8 shadow-2xl transition-all duration-300 ${
          isGrandComplete
            ? isDark
              ? 'bg-gradient-to-br from-emerald-950/70 via-slate-900 to-teal-950/60 border-emerald-400/80 shadow-emerald-500/20'
              : 'bg-gradient-to-br from-emerald-50 via-white to-teal-50 border-emerald-400 shadow-emerald-200/70'
            : isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        {isGrandComplete && (
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        )}

        <div className="relative z-10 flex flex-col lg:flex-row items-center gap-6 sm:gap-8">
          {/* Custom Medal Image Display */}
          <div className="relative shrink-0 flex flex-col items-center">
            <div
              className={`relative w-36 h-36 sm:w-44 sm:h-44 rounded-full p-1.5 transition-all duration-500 ${
                isGrandComplete
                  ? 'bg-gradient-to-tr from-emerald-400 via-green-300 to-teal-500 shadow-2xl shadow-emerald-500/40 ring-4 ring-emerald-400/30'
                  : isDark
                  ? 'bg-slate-800 ring-2 ring-slate-700'
                  : 'bg-slate-200 ring-2 ring-slate-300'
              }`}
            >
              <img
                src={GRAND_MEDAL_IMAGE_PATH}
                alt="เหรียญตราเกียรติยศพิชิตหลักสูตรครบ 100%"
                className={`w-full h-full object-cover rounded-full transition-all duration-500 ${
                  isGrandComplete
                    ? 'brightness-105 contrast-105'
                    : 'grayscale opacity-40 blur-[1px]'
                }`}
              />

              {!isGrandComplete && (
                <div className="absolute inset-0 rounded-full bg-slate-950/45 flex flex-col items-center justify-center text-white">
                  <div className="w-11 h-11 rounded-2xl bg-slate-900/90 border border-slate-700 flex items-center justify-center mb-1.5 shadow-lg">
                    <Lock className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="font-mono text-sm font-black text-emerald-300">
                    {completionPercent}%
                  </span>
                </div>
              )}

              {isGrandComplete && (
                <span className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg ring-4 ring-white dark:ring-slate-900">
                  <Crown className="w-5 h-5" />
                </span>
              )}
            </div>
          </div>

          {/* Info & 100% Checklist */}
          <div className="flex-1 w-full text-center lg:text-left">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${
                  isGrandComplete
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-400/50'
                    : isDark
                    ? 'bg-slate-800 text-slate-300 border-slate-700'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {isGrandComplete ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>ปลดล็อกเหรียญตราสูงสุดแล้ว! (100% Complete)</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                    <span>เหรียญตราระดับสูงสุด (ต้องผ่านครบ 100%)</span>
                  </>
                )}
              </span>

              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                {completedSteps} / {totalSteps} ภารกิจ ({completionPercent}%)
              </span>
            </div>

            <h3 className={`text-xl sm:text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              เหรียญตราเกียรติยศ: นักพิมพ์สัมผัสสมบูรณ์แบบ 100%
            </h3>
            <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {isGrandComplete
                ? 'ขอแสดงความยินดี! คุณผ่านครบทุกด่านและทุกบททดสอบ 100% เต็มรูปแบบแล้ว เหรียญตรานี้แสดงอยู่บนโปรไฟล์ของคุณอย่างถาวร'
                : 'เงื่อนไขการรับเหรียญตรา: ต้องทำ Pre-Test, ศูนย์การเรียนรู้, ผ่านโหมดเกมครบทั้ง 10 ด่าน และทำ Post-Test ให้เสร็จสมบูรณ์ครบ 100%'}
            </p>

            {/* Progress Bar */}
            <div className="mt-4 mb-4">
              <div
                className={`w-full h-3 rounded-full overflow-hidden border ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-200 border-slate-300'
                }`}
              >
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-green-400 to-teal-400 transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>

            {/* 4-Step Condition Checklist */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div
                className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                  hasPretest
                    ? isDark
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : isDark
                    ? 'bg-slate-950/60 border-slate-800 text-slate-400'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                {hasPretest ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <div className="text-left leading-tight">
                  <div className="font-bold">Pre-Test</div>
                  <div className="text-[10px] opacity-80">{hasPretest ? 'ผ่านแล้ว' : 'ยังไม่ทำ'}</div>
                </div>
              </div>

              <div
                className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                  hasLesson
                    ? isDark
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : isDark
                    ? 'bg-slate-950/60 border-slate-800 text-slate-400'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                {hasLesson ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <div className="text-left leading-tight">
                  <div className="font-bold">ศูนย์การเรียนรู้</div>
                  <div className="text-[10px] opacity-80">{hasLesson ? 'สำเร็จแล้ว' : 'ยังไม่ทำ'}</div>
                </div>
              </div>

              <div
                className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                  hasAll10Levels
                    ? isDark
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : isDark
                    ? 'bg-slate-950/60 border-slate-800 text-slate-400'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                {hasAll10Levels ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <div className="text-left leading-tight">
                  <div className="font-bold">เกม 10 ด่าน</div>
                  <div className="text-[10px] opacity-80 font-mono">{passedLevelsCount}/10 ด่าน</div>
                </div>
              </div>

              <div
                className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                  hasPosttest
                    ? isDark
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : isDark
                    ? 'bg-slate-950/60 border-slate-800 text-slate-400'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                {hasPosttest ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <div className="text-left leading-tight">
                  <div className="font-bold">Post-Test</div>
                  <div className="text-[10px] opacity-80">{hasPosttest ? 'ผ่านแล้ว' : 'ยังไม่ทำ'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Distinct Activity Completion Medals (Pretest, Learning Center, 10-Level Master, Posttest) */}
      <div
        className={`border rounded-3xl p-6 sm:p-8 shadow-xl transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>เหรียญตราประจำหมวดการเรียนรู้ (Activity Medals)</span>
            </h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              ปลดล็อกเหรียญตราเฉพาะตัวเมื่อทำภารกิจในแต่ละโหมดสำเร็จ
            </p>
          </div>

          <span
            className={`text-xs font-mono font-bold px-3 py-1 rounded-full border self-start ${
              isDark
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-amber-50 border-amber-300 text-amber-700'
            }`}
          >
            ปลดล็อก {totalFunctionMedalsEarned} / 4 หมวด
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Medal 1: Pretest (Blue/Indigo Shield Crest) */}
          <div
            className={`relative rounded-2xl border-2 p-5 text-center transition-all ${
              hasPretest
                ? isDark
                  ? 'bg-blue-950/25 border-blue-500/50 shadow-lg shadow-blue-500/10'
                  : 'bg-blue-50/70 border-blue-300 shadow-sm'
                : isDark
                ? 'bg-slate-950/50 border-slate-800 opacity-65'
                : 'bg-slate-100/80 border-slate-200 opacity-65'
            }`}
          >
            {/* Unique Shield SVG Medallion */}
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center mb-3">
              <svg viewBox="0 0 80 80" className="w-20 h-20 drop-shadow-md">
                <defs>
                  <linearGradient id="pretestShieldGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={hasPretest ? '#38bdf8' : '#64748b'} />
                    <stop offset="100%" stopColor={hasPretest ? '#4f46e5' : '#334155'} />
                  </linearGradient>
                </defs>
                <path
                  d="M40 6 L70 18 V38 C70 57 56 69 40 75 C24 69 10 57 10 38 V18 Z"
                  fill="url(#pretestShieldGrad)"
                  stroke={hasPretest ? '#bae6fd' : '#475569'}
                  strokeWidth="3"
                />
                <path
                  d="M40 13 L63 22 V38 C63 52 52 62 40 67 C28 62 17 52 17 38 V22 Z"
                  fill="none"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="1.5"
                />
              </svg>
              <ClipboardCheck className="w-8 h-8 text-white absolute" />
              {hasPretest && (
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow ring-2 ring-white dark:ring-slate-900">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              )}
            </div>

            <h4 className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
              เหรียญปฐมนิเทศ (Pre-Test)
            </h4>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              ทำแบบทดสอบก่อนเรียนสำเร็จ
            </p>
            <div className="mt-3">
              {hasPretest ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-500 border border-blue-500/30">
                  ✓ ได้รับแล้ว ({pretestRecords.length} ครั้ง • สูงสุด {bestPretestScore})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-500/15 text-slate-400">
                  <Lock className="w-3 h-3" /> ยังไม่ได้รับ
                </span>
              )}
            </div>
          </div>

          {/* Medal 2: Learning Center (Emerald/Teal Rosette Starburst) */}
          <div
            className={`relative rounded-2xl border-2 p-5 text-center transition-all ${
              hasLesson
                ? isDark
                  ? 'bg-emerald-950/25 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'bg-emerald-50/70 border-emerald-300 shadow-sm'
                : isDark
                ? 'bg-slate-950/50 border-slate-800 opacity-65'
                : 'bg-slate-100/80 border-slate-200 opacity-65'
            }`}
          >
            {/* Unique Octagram Rosette SVG Medallion */}
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center mb-3">
              <svg viewBox="0 0 80 80" className="w-20 h-20 drop-shadow-md">
                <defs>
                  <linearGradient id="lessonRosetteGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={hasLesson ? '#34d399' : '#64748b'} />
                    <stop offset="100%" stopColor={hasLesson ? '#0d9488' : '#334155'} />
                  </linearGradient>
                </defs>
                <polygon
                  points="40,5 49,17 64,15 62,30 75,40 62,50 64,65 49,63 40,75 31,63 16,65 18,50 5,40 18,30 16,15 31,17"
                  fill="url(#lessonRosetteGrad)"
                  stroke={hasLesson ? '#a7f3d0' : '#475569'}
                  strokeWidth="2.5"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="21"
                  fill="none"
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth="1.5"
                />
              </svg>
              <BookOpen className="w-7 h-7 text-white absolute" />
              {hasLesson && (
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow ring-2 ring-white dark:ring-slate-900">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              )}
            </div>

            <h4 className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
              เหรียญนักเรียนรู้ (Learning Center)
            </h4>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              ฝึกพิมพ์ในศูนย์การเรียนรู้สำเร็จ
            </p>
            <div className="mt-3">
              {hasLesson ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                  ✓ ได้รับแล้ว (ฝึกจบ {lessonRecords.length} ชุด)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-500/15 text-slate-400">
                  <Lock className="w-3 h-3" /> ยังไม่ได้รับ
                </span>
              )}
            </div>
          </div>

          {/* Medal 3: 10-Level Game Master (Purple/Pink Hexagon Crest) */}
          <div
            className={`relative rounded-2xl border-2 p-5 text-center transition-all ${
              hasAll10Levels
                ? isDark
                  ? 'bg-purple-950/25 border-purple-500/50 shadow-lg shadow-purple-500/10'
                  : 'bg-purple-50/70 border-purple-300 shadow-sm'
                : passedLevelsCount > 0
                ? isDark
                  ? 'bg-slate-950/70 border-purple-500/30'
                  : 'bg-purple-50/30 border-purple-200'
                : isDark
                ? 'bg-slate-950/50 border-slate-800 opacity-65'
                : 'bg-slate-100/80 border-slate-200 opacity-65'
            }`}
          >
            {/* Unique Hexagon Crest SVG Medallion */}
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center mb-3">
              <svg viewBox="0 0 80 80" className="w-20 h-20 drop-shadow-md">
                <defs>
                  <linearGradient id="gameMasterHexGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={hasAll10Levels ? '#c084fc' : passedLevelsCount > 0 ? '#a855f7' : '#64748b'} />
                    <stop offset="100%" stopColor={hasAll10Levels ? '#db2777' : passedLevelsCount > 0 ? '#7e22ce' : '#334155'} />
                  </linearGradient>
                </defs>
                <polygon
                  points="40,6 70,23 70,57 40,74 10,57 10,23"
                  fill="url(#gameMasterHexGrad)"
                  stroke={hasAll10Levels ? '#f5d0fe' : '#475569'}
                  strokeWidth="3"
                />
                <polygon
                  points="40,13 63,27 63,53 40,67 17,53 17,27"
                  fill="none"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="1.5"
                />
              </svg>
              <Gamepad2 className="w-8 h-8 text-white absolute" />
              {hasAll10Levels && (
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow ring-2 ring-white dark:ring-slate-900">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              )}
            </div>

            <h4 className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
              เหรียญพิชิตเกม 10 ด่าน
            </h4>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              ผ่านด่านเกมฝึกพิมพ์ครบทุกด่าน (1-10)
            </p>
            <div className="mt-3">
              {hasAll10Levels ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  ✓ ครบทั้ง 10 ด่านแล้ว!
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  ความคืบหน้า: {passedLevelsCount} / 10 ด่าน
                </span>
              )}
            </div>
          </div>

          {/* Medal 4: Posttest (Golden Crowned Laurel Crest) */}
          <div
            className={`relative rounded-2xl border-2 p-5 text-center transition-all ${
              hasPosttest
                ? isDark
                  ? 'bg-amber-950/25 border-amber-400/60 shadow-lg shadow-amber-500/15'
                  : 'bg-amber-50/80 border-amber-400 shadow-sm'
                : isDark
                ? 'bg-slate-950/50 border-slate-800 opacity-65'
                : 'bg-slate-100/80 border-slate-200 opacity-65'
            }`}
          >
            {/* Unique Golden Ribboned Medallion SVG */}
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center mb-3">
              <svg viewBox="0 0 80 80" className="w-20 h-20 drop-shadow-md">
                <defs>
                  <linearGradient id="posttestGoldGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={hasPosttest ? '#fde047' : '#64748b'} />
                    <stop offset="50%" stopColor={hasPosttest ? '#f59e0b' : '#475569'} />
                    <stop offset="100%" stopColor={hasPosttest ? '#ea580c' : '#334155'} />
                  </linearGradient>
                </defs>
                <path
                  d="M27 52 L20 75 L32 68 L37 74 L40 56 Z"
                  fill={hasPosttest ? '#dc2626' : '#475569'}
                />
                <path
                  d="M53 52 L60 75 L48 68 L43 74 L40 56 Z"
                  fill={hasPosttest ? '#b91c1c' : '#334155'}
                />
                <circle
                  cx="40"
                  cy="34"
                  r="26"
                  fill="url(#posttestGoldGrad)"
                  stroke={hasPosttest ? '#fef08a' : '#475569'}
                  strokeWidth="3"
                />
                <circle
                  cx="40"
                  cy="34"
                  r="20"
                  fill="none"
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />
              </svg>
              <GraduationCap
                className={`w-7 h-7 absolute -translate-y-1.5 ${
                  hasPosttest ? 'text-slate-950' : 'text-white'
                }`}
              />
              {hasPosttest && (
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow ring-2 ring-white dark:ring-slate-900">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              )}
            </div>

            <h4 className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
              เหรียญสำเร็จหลักสูตร (Post-Test)
            </h4>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              ทำแบบทดสอบหลังเรียนสำเร็จ
            </p>
            <div className="mt-3">
              {hasPosttest ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30">
                  ✓ ได้รับแล้ว ({posttestRecords.length} ครั้ง • สูงสุด {bestPosttestScore})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-500/15 text-slate-400">
                  <Lock className="w-3 h-3" /> ยังไม่ได้รับ
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Numbered Level Medals 1-10 (โหมดเกม 10 ด่าน) */}
      <div
        className={`border rounded-3xl p-6 sm:p-8 shadow-xl transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <Gamepad2 className="w-5 h-5 text-cyan-500" />
              <span>เหรียญตราประจำด่าน โหมดเกม 10 ด่าน (Level 1 – 10 Medals)</span>
            </h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              ผ่านด่านใดจะได้รับเหรียญตราตัวเลขประจำด่านนั้นทันที (ด่านที่ 1 รับเหรียญเลข 1 จนถึงด่านที่ 10)
            </p>
          </div>

          <span
            className={`text-xs font-mono font-bold px-3 py-1 rounded-full border self-start ${
              isDark
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                : 'bg-cyan-50 border-cyan-300 text-cyan-700'
            }`}
          >
            ผ่านแล้ว {passedLevelsCount} / 10 ด่าน
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
          {LEVELS_CONFIG.map(level => {
            const stats = passedLevelMap.get(level.id);
            const unlocked = Boolean(stats);
            const style = getLevelTierStyle(level.id, unlocked);
            const shortTitle = level.titleTh.replace(/^ด่าน \d+:\s*/, '').replace(/\s*\(.*\)$/, '');

            return (
              <div
                key={level.id}
                className={`rounded-2xl border-2 p-4 flex flex-col items-center text-center transition-all ${
                  style.ring
                } ${unlocked ? 'hover:scale-[1.03] shadow-md' : 'opacity-65'}`}
              >
                {/* Numbered Medallion with ribbon */}
                <div className="relative flex flex-col items-center mb-2.5">
                  <div
                    className={`w-14 h-14 rounded-full bg-gradient-to-br ${style.medalGradient} flex items-center justify-center shadow-lg ring-2 ${
                      unlocked
                        ? 'ring-white/60 dark:ring-white/30'
                        : 'ring-slate-400/20'
                    }`}
                  >
                    <span className={`font-mono text-2xl font-black tracking-tight ${style.numText}`}>
                      {level.id}
                    </span>
                  </div>
                  <div className={`w-7 h-2.5 -mt-1 rounded-b-md ${style.ribbon} opacity-90`} />
                  {unlocked && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow ring-2 ring-white dark:ring-slate-900">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                <div className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  ด่านที่ {level.id}
                </div>
                <div className={`text-[10px] line-clamp-1 mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {shortTitle}
                </div>

                <div className="mt-2">
                  {unlocked && stats ? (
                    <span className={`text-[10px] font-mono font-bold ${style.badgeLabel}`}>
                      {stats.bestWpm} WPM • {stats.bestAccuracy}%
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500">
                      <Lock className="w-2.5 h-2.5" />
                      <span>ยังไม่ผ่าน</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
