import React, { useState, useRef, useCallback } from 'react';
import {
  BookOpen,
  CheckCircle,
  ArrowRight,
  Lightbulb,
  Sparkles,
  Crosshair
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

  React.useEffect(() => {
    try {
      localStorage.setItem('touch_typing_learned_lesson', 'true');
    } catch {}
  }, []);

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

  const handleNextDrill = () => {
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
  };

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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
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
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {LESSONS_DATA.map((lesson, idx) => (
              <button
                key={lesson.id}
                onClick={() => handleLessonChange(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedLessonIndex === idx
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/20'
                    : isDark
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                บทที่ {lesson.id}
              </button>
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
          <div className={`flex items-center gap-2 text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-ping" />
            <span>แบบฝึกหัดที่ {practiceIndex + 1} จาก {practiceList.length}</span>
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

            {drillCompleted && (
              <span
                className={`text-xs px-2.5 py-1 rounded-full border font-semibold flex items-center gap-1 ${
                  isDark
                    ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                ฝึกสำเร็จ! รับเหรียญศูนย์การเรียนรู้แล้ว
              </span>
            )}
            {practiceIndex < practiceList.length - 1 ? (
              <button
                onClick={handleNextDrill}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition-all"
              >
                <span>แบบฝึกหัดถัดไป</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : selectedLessonIndex < LESSONS_DATA.length - 1 ? (
              <button
                onClick={handleNextDrill}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-md transition-all"
              >
                <span>ไปบทที่ {selectedLessonIndex + 2}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Practice Typing Area */}
        <TypingArea
          key={`${selectedLessonIndex}_${practiceIndex}_${language}`}
          targetText={currentPracticeText}
          language={language}
          compact
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
