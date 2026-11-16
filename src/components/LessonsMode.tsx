import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  BookOpen,
  CheckCircle,
  ArrowRight,
  Lightbulb,
  Sparkles,
  Crosshair,
  CornerDownLeft,
  Keyboard
} from 'lucide-react';
import { Language, LessonConfig, ScoreRecord, User } from '../types';
import { LESSONS_DATA } from '../data/lessons';
import { TypingArea } from './TypingArea';
import { VirtualKeyboard } from './VirtualKeyboard';
import { useTheme } from '../context/ThemeContext';
import { saveLocalScore } from '../utils/googleSheets';

interface LessonsModeProps {
  language: Language;
  user?: User | null;
}

export const LessonsMode: React.FC<LessonsModeProps> = ({ language, user }) => {
  const [selectedLessonIndex, setSelectedLessonIndex] = useState(0);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [currentTargetChar, setCurrentTargetChar] = useState<string | null>(null);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [drillCompleted, setDrillCompleted] = useState(false);
  const { isDark } = useTheme();
  const practiceWorkspaceRef = useRef<HTMLDivElement>(null);

  const currentLesson: LessonConfig = LESSONS_DATA[selectedLessonIndex];
  const practiceList = language === 'th' ? currentLesson.practiceTextTh : currentLesson.practiceTextEn;
  const currentPracticeText = practiceList[practiceIndex] || practiceList[0];
  const targetKeys = language === 'th' ? currentLesson.keysTh : currentLesson.keysEn;

  const hasMoreDrillsInLesson = practiceIndex < practiceList.length - 1;
  const hasNextLesson = selectedLessonIndex < LESSONS_DATA.length - 1;
  const canAdvance = hasMoreDrillsInLesson || hasNextLesson;
  const nextLesson = hasNextLesson ? LESSONS_DATA[selectedLessonIndex + 1] : null;

  // Smoothly scroll so TypingArea + VirtualKeyboard sit centered in the viewport
  const centerPracticeWorkspace = useCallback(() => {
    const el = practiceWorkspaceRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const navOffset = 68;
    const availableHeight = window.innerHeight - navOffset;
    let targetScrollY: number;

    if (rect.height <= availableHeight) {
      targetScrollY = window.scrollY + rect.top - navOffset - (availableHeight - rect.height) / 2;
    } else {
      targetScrollY = window.scrollY + rect.top - navOffset - 8;
    }

    window.scrollTo({
      top: Math.max(0, targetScrollY),
      behavior: 'smooth'
    });
  }, []);

  const handleLessonChange = (index: number) => {
    setSelectedLessonIndex(index);
    setPracticeIndex(0);
    setDrillCompleted(false);
  };

  const handleDrillComplete = (metrics: {
    totalCharacters: number;
    correctCharacters: number;
    incorrectCharacters: number;
    accuracy: number;
    grossWpm: number;
    netWpm: number;
    timeTakenSeconds: number;
    cpm: number;
    finalScore: number;
  }) => {
    setDrillCompleted(true);

    const record: ScoreRecord = {
      scoreId: 'lesson_' + Date.now().toString(36),
      uid: user ? user.uid : 'guest',
      displayName: user ? user.displayName : 'ผู้เล่นทั่วไป (Guest)',
      avatar: user?.avatar || '',
      avatarBg: user?.avatarBg || 'from-cyan-500 to-blue-600',
      gameMode: 'lesson',
      testType: 'NONE',
      language,
      levelId: `lesson_${currentLesson.id}_${practiceIndex + 1}`,
      levelTitle: `${currentLesson.title} (แบบฝึกหัดที่ ${practiceIndex + 1})`,
      score: metrics.finalScore,
      totalCharacters: metrics.totalCharacters,
      correctCharacters: metrics.correctCharacters,
      incorrectCharacters: metrics.incorrectCharacters,
      accuracy: metrics.accuracy,
      grossWpm: metrics.grossWpm,
      netWpm: metrics.netWpm,
      timeTakenSeconds: metrics.timeTakenSeconds,
      passed: metrics.accuracy >= 80,
      createdAt: new Date().toISOString()
    };

    saveLocalScore(record);
  };

  const handleNextDrill = useCallback(() => {
    if (practiceIndex < practiceList.length - 1) {
      setPracticeIndex(prev => prev + 1);
      setDrillCompleted(false);
    } else if (selectedLessonIndex < LESSONS_DATA.length - 1) {
      setSelectedLessonIndex(prev => prev + 1);
      setPracticeIndex(0);
      setDrillCompleted(false);
    }
    setTimeout(() => {
      centerPracticeWorkspace();
    }, 60);
  }, [practiceIndex, practiceList.length, selectedLessonIndex, centerPracticeWorkspace]);

  // Allow pressing Enter immediately after finishing a drill/lesson to jump to the next drill or lesson
  useEffect(() => {
    if (!drillCompleted || !canAdvance) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        handleNextDrill();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [drillCompleted, canAdvance, handleNextDrill]);

  const enterHintText = hasMoreDrillsInLesson
    ? `ฝึกชุดที่ ${practiceIndex + 1} สำเร็จแล้ว! กด Enter ↵ เพื่อไปแบบฝึกหัดถัดไป`
    : nextLesson
    ? `จบบทที่ ${currentLesson.id} แล้ว! กด Enter ↵ เพื่อไปบทที่ ${nextLesson.id}${nextLesson.shortTitle ? ` (${nextLesson.shortTitle})` : ''} ได้เลย`
    : 'ยินดีด้วย! คุณฝึกครบทุกบทเรียนในศูนย์การเรียนรู้แล้ว';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header & Lesson Tabs */}
      <div
        className={`border rounded-3xl p-6 shadow-xl transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        <div className="flex flex-col gap-4 mb-6">
          <div>
            <div
              className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-1 ${
                isDark ? 'text-cyan-400' : 'text-cyan-600'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>ศูนย์การเรียนรู้การพิมพ์สัมผัส (Learning Center)</span>
            </div>
            <h1 className={`text-xl sm:text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {currentLesson.title}
            </h1>
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {currentLesson.subtitle}
            </p>
          </div>

          {/* Quick Lesson Switcher buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {LESSONS_DATA.map((lesson, idx) => (
              <button
                key={lesson.id}
                type="button"
                onClick={() => handleLessonChange(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedLessonIndex === idx
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                    : isDark
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/70'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                บทที่ {lesson.id}{lesson.shortTitle ? ` · ${lesson.shortTitle}` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Target Keys Strip */}
        <div
          className={`mb-5 px-4 py-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
            isDark
              ? 'bg-slate-950/60 border-slate-800/80'
              : 'bg-cyan-50/50 border-cyan-200/70'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            <Keyboard className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
            <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
              {currentLesson.fingerFocus}:
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {targetKeys.map((k, idx) => (
              <span
                key={`${k}-${idx}`}
                className={`inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-lg font-mono text-xs font-bold border shadow-2xs ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-cyan-300'
                    : 'bg-white border-slate-300 text-cyan-700'
                }`}
              >
                {k}
              </span>
            ))}
          </div>
        </div>

        {/* Lesson Theory & Keypoints */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <div
            className={`rounded-2xl p-4 border transition-colors ${
              isDark
                ? 'bg-slate-950/70 border-slate-800/80'
                : 'bg-slate-50 border-slate-200/80'
            }`}
          >
            <h3
              className={`text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${
                isDark ? 'text-cyan-300' : 'text-cyan-700'
              }`}
            >
              <Lightbulb className="w-4 h-4 text-cyan-500" />
              <span>สาระสำคัญและหลักการ</span>
            </h3>
            <ul className={`space-y-2 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {currentLesson.theory.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className={`rounded-2xl p-4 border transition-colors ${
              isDark
                ? 'bg-slate-950/70 border-slate-800/80'
                : 'bg-slate-50 border-slate-200/80'
            }`}
          >
            <h3
              className={`text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${
                isDark ? 'text-amber-300' : 'text-amber-700'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>จุดเน้นและการฝึกนิ้ว</span>
            </h3>
            <ul className={`space-y-2 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {currentLesson.keyPoints.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Interactive Practice Exercise Area (Centered together with VirtualKeyboard) */}
      <div ref={practiceWorkspaceRef} className="space-y-3 scroll-mt-20">
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 max-w-5xl mx-auto">
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`flex items-center gap-2 text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-ping" />
              <span>
                {practiceList.length > 1
                  ? `แบบฝึกหัดที่ ${practiceIndex + 1} จาก ${practiceList.length}`
                  : `แบบฝึกหัดประจำบทที่ ${currentLesson.id}`}
              </span>
            </div>

            {/* Drill selector pills inside current lesson (only if > 1 set) */}
            {practiceList.length > 1 && (
              <div className="flex items-center gap-1">
                {practiceList.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPracticeIndex(idx);
                      setDrillCompleted(false);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                      practiceIndex === idx
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : isDark
                        ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                        : 'bg-slate-200/80 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    ชุด {idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={centerPracticeWorkspace}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-cyan-700 border-slate-300 shadow-xs'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>จัดกึ่งกลางหน้าจอ</span>
            </button>

            {hasMoreDrillsInLesson ? (
              <button
                type="button"
                onClick={handleNextDrill}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-md transition-all ${
                  drillCompleted
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white ring-2 ring-emerald-400/50 animate-pulse'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                }`}
              >
                <span>แบบฝึกหัดถัดไป</span>
                {drillCompleted && (
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/20 border border-white/25 inline-flex items-center gap-0.5">
                    Enter <CornerDownLeft className="w-2.5 h-2.5" />
                  </kbd>
                )}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : nextLesson ? (
              <button
                type="button"
                onClick={handleNextDrill}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-md transition-all ${
                  drillCompleted
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white ring-2 ring-emerald-400/50 animate-pulse'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white'
                }`}
              >
                <span>ไปบทที่ {nextLesson.id}</span>
                {drillCompleted && (
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/20 border border-white/25 inline-flex items-center gap-0.5">
                    Enter <CornerDownLeft className="w-2.5 h-2.5" />
                  </kbd>
                )}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Completion Banner with Enter Key Hint */}
        {drillCompleted && (
          <div
            className={`max-w-5xl mx-auto px-4 py-3 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all ${
              isDark
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>{enterHintText}</span>
            </div>

            {canAdvance && (
              <button
                type="button"
                onClick={handleNextDrill}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all shrink-0"
              >
                <span>
                  {hasMoreDrillsInLesson
                    ? 'ไปแบบฝึกหัดถัดไป'
                    : `ไปบทที่ ${nextLesson?.id}`}
                </span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/20 border border-white/25 inline-flex items-center gap-0.5">
                  Enter <CornerDownLeft className="w-2.5 h-2.5" />
                </kbd>
              </button>
            )}
          </div>
        )}

        {/* Practice Typing Area */}
        <TypingArea
          key={`${selectedLessonIndex}_${practiceIndex}_${language}`}
          targetText={currentPracticeText}
          language={language}
          compact
          completionHint={canAdvance ? enterHintText : 'ฝึกครบทุกบทเรียนในศูนย์การเรียนรู้แล้ว!'}
          onInteract={centerPracticeWorkspace}
          onTargetCharChange={setCurrentTargetChar}
          onKeyPressed={setPressedKey}
          onComplete={handleDrillComplete}
        />

        {/* Keyboard Helper */}
        <VirtualKeyboard
          language={language}
          targetChar={currentTargetChar}
          pressedKey={pressedKey}
        />
      </div>
    </div>
  );
};
