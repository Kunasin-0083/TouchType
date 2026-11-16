import React, { useState } from 'react';
import {
  ClipboardCheck,
  TrendingUp,
  Award,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  FileQuestion,
  Keyboard,
  Lock,
  Unlock
} from 'lucide-react';
import { Language, ScoreRecord, User } from '../types';
import {
  PRETEST_TEXT_TH,
  POSTTEST_TEXT_TH,
  PRETEST_TEXT_EN,
  POSTTEST_TEXT_EN
} from '../data/words';
import { TypingArea } from './TypingArea';
import { VirtualKeyboard } from './VirtualKeyboard';
import { QuizExamView } from './QuizExamView';
import { apiSaveScore } from '../utils/googleSheets';
import { getPosttestUnlockStatus } from './MedalShowcase';
import { useTheme } from '../context/ThemeContext';

interface TestModeProps {
  language: Language;
  user: User | null;
  onViewLeaderboard: () => void;
  specificType?: 'pretest' | 'posttest';
  onNavigateTab?: (tab: string) => void;
}

export const TestMode: React.FC<TestModeProps> = ({
  language,
  user,
  onViewLeaderboard,
  specificType = 'pretest',
  onNavigateTab
}) => {
  // Default format is 'quiz' as requested for 10-question Vocational Certificate Level 3 (ปวช.3) exam
  const [testFormat, setTestFormat] = useState<'quiz' | 'typing'>('quiz');
  const [activeTest, setActiveTest] = useState<'pretest' | 'posttest'>(specificType);
  const [resetCount, setResetCount] = useState(0);
  const [currentTargetChar, setCurrentTargetChar] = useState<string | null>(null);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<ScoreRecord | null>(null);
  const { isDark } = useTheme();

  const [unlockStatus, setUnlockStatus] = useState(() => getPosttestUnlockStatus(user));

  // Keep activeTest in sync with specificType and refresh unlock status
  React.useEffect(() => {
    if (specificType) {
      setActiveTest(specificType);
      setLatestResult(null);
      setCurrentTargetChar(null);
      setPressedKey(null);
      setUnlockStatus(getPosttestUnlockStatus(user));
    }
  }, [specificType, user]);

  const isPosttestLocked = activeTest === 'posttest' && !unlockStatus.isUnlocked;

  const testText = activeTest === 'pretest'
    ? (language === 'th' ? PRETEST_TEXT_TH : PRETEST_TEXT_EN)
    : (language === 'th' ? POSTTEST_TEXT_TH : POSTTEST_TEXT_EN);

  const handleTypingTestComplete = async (metrics: {
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
    const record: ScoreRecord = {
      scoreId: 'test_' + Date.now().toString(36),
      uid: user ? user.uid : 'guest',
      displayName: user ? user.displayName : 'ผู้ทดสอบ (Student)',
      avatar: user?.avatar || '',
      avatarBg: user?.avatarBg || 'from-cyan-500 to-blue-600',
      gameMode: activeTest,
      testType: activeTest === 'pretest' ? 'PRE_TEST' : 'POST_TEST',
      language: language,
      levelId: activeTest,
      levelTitle: activeTest === 'pretest' ? 'แบบทดสอบพิมพ์ก่อนเรียน (Pre-test)' : 'แบบทดสอบพิมพ์หลังเรียน (Post-test)',
      score: metrics.finalScore,
      totalCharacters: metrics.totalCharacters,
      correctCharacters: metrics.correctCharacters,
      incorrectCharacters: metrics.incorrectCharacters,
      accuracy: metrics.accuracy,
      grossWpm: metrics.grossWpm,
      netWpm: metrics.netWpm,
      timeTakenSeconds: metrics.timeTakenSeconds,
      passed: true,
      createdAt: new Date().toISOString()
    };

    setLatestResult(record);
    await apiSaveScore(record);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Format Switcher Bar (Quiz Exam 10 questions VS Practical Typing Test) */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2">
        <div
          className={`inline-flex items-center p-1 rounded-2xl border transition-colors ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-300'
          }`}
        >
          <button
            type="button"
            onClick={() => setTestFormat('quiz')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              testFormat === 'quiz'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/25'
                : isDark
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileQuestion className="w-3.5 h-3.5" />
            <span>ข้อสอบ 10 ข้อ ปวช.3 (Quiz Exam)</span>
          </button>

          <button
            type="button"
            onClick={() => setTestFormat('typing')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              testFormat === 'typing'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/25'
                : isDark
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>ทดสอบพิมพ์จับเวลาปฏิบัติ (Typing Test)</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-3 py-1 rounded-full border font-bold flex items-center gap-1.5 ${
              activeTest === 'pretest'
                ? isDark
                  ? 'bg-blue-950/60 border-blue-800 text-blue-300'
                  : 'bg-blue-50 border-blue-200 text-blue-700'
                : isPosttestLocked
                ? isDark
                  ? 'bg-amber-950/60 border-amber-800 text-amber-300'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
                : isDark
                ? 'bg-cyan-950/60 border-cyan-800 text-cyan-300'
                : 'bg-cyan-50 border-cyan-200 text-cyan-700'
            }`}
          >
            {activeTest === 'pretest' ? (
              <span>📋 Pre-test (ก่อนเรียน)</span>
            ) : isPosttestLocked ? (
              <>
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Post-test (ล็อคอยู่)</span>
              </>
            ) : (
              <>
                <Unlock className="w-3 h-3 text-emerald-400" />
                <span>🎓 Post-test (ปลดล็อคแล้ว)</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* If Post-test is locked, render the Requirement Checklist Screen */}
      {isPosttestLocked ? (
        <div className="max-w-2xl mx-auto py-4 animate-fade-in">
          <div
            className={`border-2 rounded-3xl p-6 sm:p-10 text-center shadow-2xl relative overflow-hidden transition-all ${
              isDark
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-slate-200/90 shadow-slate-200/60'
            }`}
          >
            {/* Lock Badge */}
            <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-500 shadow-xl shadow-amber-500/10 animate-bounce">
              <Lock className="w-10 h-10" />
            </div>

            <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 inline-block mb-3">
              🔒 แบบทดสอบหลังเรียนยังไม่ปลดล็อค (Locked)
            </span>

            <h2 className={`text-2xl sm:text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              ทำภารกิจการเรียนรู้ให้ครบเงื่อนไข
            </h2>
            <p className={`text-xs sm:text-sm mt-2 max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              เพื่อประเมินผลสัมฤทธิ์และวัดพัฒนาการตามหลักสูตรอย่างมีประสิทธิภาพ กรุณาทำกิจกรรมตามขั้นตอนดังนี้ก่อนเข้าสอบ:
            </p>

            {/* Checklist Cards */}
            <div className="space-y-3.5 my-6 text-left max-w-lg mx-auto">
              {/* Step 1: Pre-test */}
              <div
                className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                  unlockStatus.hasPretest
                    ? isDark
                      ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-300'
                      : 'bg-emerald-50/80 border-emerald-300 text-emerald-800'
                    : isDark
                    ? 'bg-slate-950/70 border-slate-800'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {unlockStatus.hasPretest ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-400 flex items-center justify-center text-[10px] font-bold text-slate-400">
                      1
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm">
                    1. ทำแบบทดสอบก่อนเรียน (Pre-test)
                  </div>
                  <div className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {unlockStatus.hasPretest
                      ? unlockStatus.pretestScore !== undefined
                        ? `✓ ทำเสร็จสิ้นแล้ว (คะแนน: ${unlockStatus.pretestScore}/10)`
                        : '✓ ทำแบบทดสอบก่อนเรียนเสร็จสิ้นแล้ว'
                      : 'ยังไม่ได้ทำแบบทดสอบก่อนเรียน'}
                  </div>
                </div>
                {!unlockStatus.hasPretest && (
                  <button
                    onClick={() => {
                      if (onNavigateTab) onNavigateTab('pretest');
                      setActiveTest('pretest');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shrink-0 shadow-sm transition-all"
                  >
                    ทำแบบทดสอบ
                  </button>
                )}
              </div>

              {/* Step 2: Learning Center */}
              <div
                className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                  unlockStatus.hasLesson
                    ? isDark
                      ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-300'
                      : 'bg-emerald-50/80 border-emerald-300 text-emerald-800'
                    : isDark
                    ? 'bg-slate-950/70 border-slate-800'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {unlockStatus.hasLesson ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-400 flex items-center justify-center text-[10px] font-bold text-slate-400">
                      2
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm">
                    2. ฝึกพิมพ์ในศูนย์การเรียนรู้ (Learning Center)
                  </div>
                  <div className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {unlockStatus.hasLesson
                      ? '✓ ฝึกพิมพ์บทเรียนในศูนย์การเรียนรู้เสร็จสิ้นแล้ว'
                      : 'ต้องพิมพ์แบบฝึกหัดในศูนย์การเรียนรู้ให้จบอย่างน้อย 1 ชุด'}
                  </div>
                </div>
                {!unlockStatus.hasLesson && (
                  <button
                    onClick={() => onNavigateTab && onNavigateTab('lessons')}
                    className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shrink-0 shadow-xs transition-all"
                  >
                    เข้าบทเรียน
                  </button>
                )}
              </div>

              {/* Step 3: All 10 Game Levels */}
              <div
                className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                  unlockStatus.hasAll10Levels
                    ? isDark
                      ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-300'
                      : 'bg-emerald-50/80 border-emerald-300 text-emerald-800'
                    : isDark
                    ? 'bg-slate-950/70 border-slate-800'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {unlockStatus.hasAll10Levels ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-400 flex items-center justify-center text-[10px] font-bold text-slate-400">
                      3
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm">
                      3. ผ่านโหมดเกมฝึกพิมพ์ครบทั้ง 10 ด่าน
                    </span>
                    <span className="text-xs font-mono font-bold text-cyan-500">
                      {unlockStatus.passedLevelsCount}/10 ด่าน
                    </span>
                  </div>
                  <div className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {unlockStatus.hasAll10Levels
                      ? '✓ ผ่านครบทั้ง 10 ด่านเรียบร้อยแล้ว'
                      : `ยังเหลือด่านที่ต้องผ่าน: ${unlockStatus.missingLevels.join(', ')}`}
                  </div>
                  {!unlockStatus.hasAll10Levels && (
                    <div className={`w-full h-1.5 rounded-full mt-2 overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                        style={{ width: `${(unlockStatus.passedLevelsCount / 10) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
                {!unlockStatus.hasAll10Levels && (
                  <button
                    onClick={() => onNavigateTab && onNavigateTab('game')}
                    className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shrink-0 shadow-xs transition-all"
                  >
                    โหมดเกม
                  </button>
                )}
              </div>
            </div>

            {/* Action Button */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {!unlockStatus.hasPretest ? (
                <button
                  onClick={() => {
                    if (onNavigateTab) onNavigateTab('pretest');
                    setActiveTest('pretest');
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <span>เริ่มทำแบบทดสอบก่อนเรียน (Pre-test) ทันที</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : !unlockStatus.hasLesson ? (
                <button
                  onClick={() => onNavigateTab && onNavigateTab('lessons')}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <span>ไปยังศูนย์การเรียนรู้ เพื่อฝึกพิมพ์ให้จบ</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => onNavigateTab && onNavigateTab('game')}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <span>ไปยังโหมดเกม 10 ด่าน (เหลือ {10 - unlockStatus.passedLevelsCount} ด่าน)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : testFormat === 'quiz' ? (
        /* Mode 1: 10-Question Quiz Exam (Default) */
        <QuizExamView
          key={`quiz-${activeTest}`}
          testType={activeTest}
          user={user}
          onNavigateTab={onNavigateTab}
          onViewLeaderboard={onViewLeaderboard}
        />
      ) : (
        /* Mode 2: Practical Typing Test */
        <div className="space-y-6 animate-fade-in">
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border rounded-2xl p-4 sm:p-5 transition-colors ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    activeTest === 'pretest'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                  }`}
                >
                  {activeTest === 'pretest' ? 'พิมพ์จับเวลาก่อนเรียน' : 'พิมพ์จับเวลาหลังเรียน'}
                </span>
                <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {activeTest === 'pretest' ? 'ทดสอบพิมพ์ปฏิบัติก่อนเรียน (Pre-test)' : 'ทดสอบพิมพ์ปฏิบัติหลังเรียน (Post-test)'}
                </h2>
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                พิมพ์ตามข้อความด้านล่างเพื่อประเมินความเร็ว (WPM) และความแม่นยำ (Accuracy)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLatestResult(null);
                  setCurrentTargetChar(null);
                  setPressedKey(null);
                  setResetCount(c => c + 1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                เริ่มทดสอบใหม่
              </button>
            </div>
          </div>

          {!latestResult ? (
            <>
              <TypingArea
                key={`typing-${activeTest}-${language}-${resetCount}`}
                targetText={testText}
                language={language}
                onTargetCharChange={setCurrentTargetChar}
                onKeyPressed={setPressedKey}
                onComplete={handleTypingTestComplete}
                onRestart={() => setResetCount(c => c + 1)}
              />

              <VirtualKeyboard
                language={language}
                targetChar={currentTargetChar}
                pressedKey={pressedKey}
              />
            </>
          ) : (
            <div
              className={`border rounded-3xl p-8 max-w-2xl mx-auto text-center shadow-2xl animate-fade-in ${
                isDark
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200/90 shadow-slate-200/60'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8" />
              </div>

              <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                บันทึกผลการทดสอบสำเร็จ!
              </h3>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {latestResult.levelTitle} • บันทึกลง Google Sheets เรียบร้อย
              </p>
              <div
                className={`mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border ${
                  activeTest === 'pretest'
                    ? 'bg-blue-500/15 border-blue-500/35 text-blue-500'
                    : 'bg-amber-500/15 border-amber-500/35 text-amber-500'
                }`}
              >
                <span>
                  {activeTest === 'pretest'
                    ? '🛡️ ได้รับเหรียญปฐมนิเทศ (Pre-Test) บนหน้าโปรไฟล์แล้ว!'
                    : '🎓 ได้รับเหรียญสำเร็จหลักสูตร (Post-Test) บนหน้าโปรไฟล์แล้ว!'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 my-6">
                <div
                  className={`p-4 rounded-2xl border ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Net WPM</span>
                  <div className="text-2xl font-black text-cyan-500 font-mono mt-1">
                    {latestResult.netWpm}
                  </div>
                </div>
                <div
                  className={`p-4 rounded-2xl border ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Accuracy</span>
                  <div className="text-2xl font-black text-emerald-500 font-mono mt-1">
                    {latestResult.accuracy}%
                  </div>
                </div>
                <div
                  className={`p-4 rounded-2xl border ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>เวลาที่ใช้</span>
                  <div className="text-2xl font-black text-blue-500 font-mono mt-1">
                    {latestResult.timeTakenSeconds}s
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setLatestResult(null);
                    setCurrentTargetChar(null);
                    setPressedKey(null);
                    setResetCount(c => c + 1);
                  }}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-colors border ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-750 text-white border-slate-700'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                  }`}
                >
                  ทดสอบใหม่อีกครั้ง
                </button>

                {activeTest === 'pretest' && onNavigateTab ? (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('lessons')}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>ขั้นตอนถัดไป: ไปยังศูนย์การเรียนรู้</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onViewLeaderboard}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>ดูตารางอันดับ (Leaderboard)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
