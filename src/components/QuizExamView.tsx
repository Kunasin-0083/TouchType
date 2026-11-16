import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardCheck,
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Clock,
  Send,
  TrendingUp,
  BookOpen,
  Trophy,
  Edit3
} from 'lucide-react';
import { PRETEST_QUESTIONS, POSTTEST_QUESTIONS, QuizQuestion } from '../data/quizQuestions';
import { User, ScoreRecord } from '../types';
import { apiSaveScore, getLocalScores } from '../utils/googleSheets';
import { useTheme } from '../context/ThemeContext';

interface QuizExamViewProps {
  testType: 'pretest' | 'posttest';
  user: User | null;
  onNavigateTab?: (tab: string) => void;
  onViewLeaderboard: () => void;
}

const LOCAL_PRETEST_QUIZ_KEY = 'touch_typing_pretest_quiz_v2';
const LOCAL_POSTTEST_QUIZ_KEY = 'touch_typing_posttest_quiz_v2';

export const QuizExamView: React.FC<QuizExamViewProps> = ({
  testType,
  user,
  onNavigateTab,
  onViewLeaderboard
}) => {
  const { isDark } = useTheme();
  const questions: QuizQuestion[] = testType === 'pretest' ? PRETEST_QUESTIONS : POSTTEST_QUESTIONS;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [confirmIncompleteSubmit, setConfirmIncompleteSubmit] = useState(false);
  const [showPreSubmitSummary, setShowPreSubmitSummary] = useState(false);
  const [isEditingFromReview, setIsEditingFromReview] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState<'idle' | 'leaving' | 'entering'>('idle');
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const enterFrameRef = useRef<number | null>(null);

  const clearAdvanceTimers = () => {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (enterFrameRef.current) {
      window.cancelAnimationFrame(enterFrameRef.current);
      enterFrameRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearAdvanceTimers();
    };
  }, []);

  // Load prior pretest quiz score for Post-test comparison (scoped per student)
  const pretestStorageKey = user?.uid
    ? `${LOCAL_PRETEST_QUIZ_KEY}_${user.uid}`
    : LOCAL_PRETEST_QUIZ_KEY;
  const posttestStorageKey = user?.uid
    ? `${LOCAL_POSTTEST_QUIZ_KEY}_${user.uid}`
    : LOCAL_POSTTEST_QUIZ_KEY;

  const getStoredQuizScore = (key: string): { score: number; total: number; date: string } | null => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    if (user) {
      const match = getLocalScores().find(
        s =>
          (s.uid === user.uid || s.displayName === user.displayName) &&
          (s.gameMode === 'pretest' || s.testType === 'PRE_TEST') &&
          String(s.levelId || '').includes('quiz')
      );
      if (match) {
        return {
          score: Math.round(match.score / 100),
          total: match.totalCharacters || 10,
          date: match.createdAt
        };
      }
    }
    return null;
  };

  const priorPretest = getStoredQuizScore(pretestStorageKey);

  const currentQ = questions[currentIndex];
  const answeredCount = Object.keys(selectedAnswers).length;
  const isAllAnswered = answeredCount === questions.length;

  const transitionToStep = (applyStep: () => void) => {
    setTransitionPhase('leaving');
    transitionTimerRef.current = window.setTimeout(() => {
      applyStep();
      setTransitionPhase('entering');
      enterFrameRef.current = window.requestAnimationFrame(() => {
        enterFrameRef.current = window.requestAnimationFrame(() => {
          setTransitionPhase('idle');
        });
      });
    }, 200);
  };

  const handleSelectOption = (optionIndex: number) => {
    if (isSubmitted || transitionPhase === 'leaving') return;
    setConfirmIncompleteSubmit(false);

    const nextAnswers: Record<number, number> = {
      ...selectedAnswers,
      [currentQ.id]: optionIndex
    };
    setSelectedAnswers(nextAnswers);

    clearAdvanceTimers();

    // Hold briefly (360ms) so the selected answer highlight registers cleanly, then smoothly transition
    autoAdvanceTimerRef.current = window.setTimeout(() => {
      const allDone = questions.every(q => nextAnswers[q.id] !== undefined);
      transitionToStep(() => {
        if (isEditingFromReview) {
          setIsEditingFromReview(false);
          setShowPreSubmitSummary(true);
        } else if (allDone) {
          setShowPreSubmitSummary(true);
        } else if (currentIndex < questions.length - 1) {
          setCurrentIndex(currentIndex + 1);
        } else {
          const firstUnansweredIdx = questions.findIndex(q => nextAnswers[q.id] === undefined);
          if (firstUnansweredIdx !== -1) {
            setCurrentIndex(firstUnansweredIdx);
          }
        }
      });
    }, 360);
  };

  const handleNext = () => {
    clearAdvanceTimers();
    if (currentIndex < questions.length - 1) {
      transitionToStep(() => setCurrentIndex(currentIndex + 1));
    }
  };

  const handlePrev = () => {
    clearAdvanceTimers();
    if (currentIndex > 0) {
      transitionToStep(() => setCurrentIndex(currentIndex - 1));
    }
  };

  const handleSubmit = async (forceSubmit: boolean = false) => {
    if (!isAllAnswered && !forceSubmit) {
      setConfirmIncompleteSubmit(true);
      return;
    }
    setConfirmIncompleteSubmit(false);

    // Calculate score
    let correctCount = 0;
    questions.forEach(q => {
      if (selectedAnswers[q.id] === q.correctIndex) {
        correctCount += 1;
      }
    });

    setSubmittedScore(correctCount);
    setIsSubmitted(true);

    // Save to local storage for quick comparison
    const storageKey = testType === 'pretest' ? pretestStorageKey : posttestStorageKey;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          score: correctCount,
          total: questions.length,
          date: new Date().toISOString()
        })
      );
    } catch {
      // ignore
    }

    // Save to Google Sheets
    const record: ScoreRecord = {
      scoreId: 'quiz_' + Date.now().toString(36),
      uid: user ? user.uid : 'guest',
      displayName: user ? user.displayName : 'ผู้ทดสอบ ปวช.3',
      avatar: user?.avatar || '',
      avatarBg: user?.avatarBg || 'from-cyan-500 to-blue-600',
      gameMode: testType,
      testType: testType === 'pretest' ? 'PRE_TEST' : 'POST_TEST',
      language: 'th',
      levelId: `${testType}_quiz_voc3`,
      levelTitle:
        testType === 'pretest'
          ? 'ข้อสอบก่อนเรียน ปวช.3 (10 ข้อ)'
          : 'ข้อสอบหลังเรียน ปวช.3 (10 ข้อ)',
      score: correctCount * 100,
      totalCharacters: questions.length,
      correctCharacters: correctCount,
      incorrectCharacters: questions.length - correctCount,
      accuracy: Math.round((correctCount / questions.length) * 100),
      grossWpm: correctCount,
      netWpm: correctCount,
      timeTakenSeconds: elapsedSeconds,
      passed: correctCount >= 5,
      rankTier: correctCount >= 8 ? 'Master' : correctCount >= 5 ? 'Platinum' : 'Bronze',
      createdAt: new Date().toISOString()
    };

    await apiSaveScore(record);
  };

  const handleRetake = () => {
    clearAdvanceTimers();
    setTransitionPhase('idle');
    setSelectedAnswers({});
    setCurrentIndex(0);
    setIsSubmitted(false);
    setElapsedSeconds(0);
    setSubmittedScore(null);
    setShowReview(false);
    setShowPreSubmitSummary(false);
    setIsEditingFromReview(false);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // If exam has been submitted, show Result and Detailed Review
  if (isSubmitted && submittedScore !== null) {
    const scorePercent = Math.round((submittedScore / questions.length) * 100);
    const isPassed = submittedScore >= 5;

    let gradeText = '';
    let gradeBadgeClass = '';
    if (submittedScore >= 9) {
      gradeText = 'ยอดเยี่ยม (Excellent) 🌟';
      gradeBadgeClass = 'bg-amber-500/20 text-amber-500 border-amber-500/40';
    } else if (submittedScore >= 7) {
      gradeText = 'ดีมาก (Very Good) 👏';
      gradeBadgeClass = 'bg-cyan-500/20 text-cyan-500 border-cyan-500/40';
    } else if (submittedScore >= 5) {
      gradeText = 'ผ่านเกณฑ์มาตรฐาน (Passed) 👍';
      gradeBadgeClass = 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40';
    } else {
      gradeText = 'ควรทบทวนเนื้อหาเพิ่มเติม (Needs Review) 💡';
      gradeBadgeClass = 'bg-rose-500/20 text-rose-500 border-rose-500/40';
    }

    // Comparison with pretest if this is posttest
    const pretestScoreVal = priorPretest ? priorPretest.score : null;
    const progressDiff = pretestScoreVal !== null ? submittedScore - pretestScoreVal : null;

    return (
      <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
        {/* Score Summary Card */}
        <div
          className={`border rounded-3xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden transition-all duration-300 ${
            isDark
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-slate-200/90 shadow-slate-200/60'
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 flex items-center justify-center mx-auto mb-4">
            <Award className="w-8 h-8" />
          </div>

          <div
            className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mb-2 ${gradeBadgeClass}`}
          >
            {gradeText}
          </div>

          <h2 className={`text-2xl sm:text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
            ผลการทดสอบ{testType === 'pretest' ? 'ก่อนเรียน (Pre-test)' : 'หลังเรียน (Post-test)'} ปวช.3
          </h2>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            บันทึกคะแนนลง Google Sheets เรียบร้อยแล้ว
          </p>
          <div
            className={`mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border ${
              testType === 'pretest'
                ? 'bg-blue-500/15 border-blue-500/35 text-blue-500'
                : 'bg-amber-500/15 border-amber-500/35 text-amber-500'
            }`}
          >
            <span>
              {testType === 'pretest'
                ? '🛡️ ได้รับเหรียญปฐมนิเทศ (Pre-Test) บนหน้าโปรไฟล์แล้ว!'
                : '🎓 ได้รับเหรียญสำเร็จหลักสูตร (Post-Test) บนหน้าโปรไฟล์แล้ว!'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6 max-w-2xl mx-auto font-mono">
            <div
              className={`p-4 rounded-2xl border ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-sans`}>คะแนนที่ได้</span>
              <div className="text-3xl font-black text-cyan-500 mt-1">
                {submittedScore} <span className="text-sm font-normal text-slate-500">/ 10</span>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-sans`}>คิดเป็นร้อยละ</span>
              <div className="text-3xl font-black text-emerald-500 mt-1">
                {scorePercent}%
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-sans`}>ตอบถูกต้อง</span>
              <div className="text-3xl font-black text-blue-500 mt-1">
                {submittedScore} <span className="text-sm font-normal text-slate-500">ข้อ</span>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-sans`}>รูปแบบการทำ</span>
              <div className="text-xl sm:text-2xl font-black text-purple-500 mt-1">
                ไม่จำกัดเวลา
              </div>
            </div>
          </div>

          {/* Post-test vs Pre-test Comparison Card */}
          {testType === 'posttest' && pretestScoreVal !== null && (
            <div
              className={`p-5 rounded-2xl border mb-6 text-left max-w-2xl mx-auto ${
                isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-cyan-50/70 border-cyan-200'
              }`}
            >
              <h4 className="font-bold text-sm flex items-center gap-2 mb-3 text-cyan-600">
                <TrendingUp className="w-4 h-4" />
                <span>เปรียบเทียบผลสัมฤทธิ์ (Pre-test VS Post-test):</span>
              </h4>
              <div className="grid grid-cols-3 gap-3 text-center font-mono">
                <div>
                  <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-sans`}>ก่อนเรียน (Pre-test)</div>
                  <div className="text-xl font-bold text-slate-400 mt-1">{pretestScoreVal} / 10</div>
                </div>
                <div>
                  <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-sans`}>หลังเรียน (Post-test)</div>
                  <div className="text-xl font-bold text-cyan-500 mt-1">{submittedScore} / 10</div>
                </div>
                <div>
                  <div className="text-xs text-emerald-600 font-sans font-semibold">พัฒนาการความรู้</div>
                  <div className="text-xl font-black text-emerald-500 mt-1">
                    {progressDiff !== null && progressDiff > 0 ? `+${progressDiff}` : progressDiff} ข้อ
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button
              onClick={() => setShowReview(!showReview)}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs border transition-all ${
                showReview
                  ? 'bg-cyan-600 text-white border-cyan-600 shadow-md shadow-cyan-600/20'
                  : isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <span>{showReview ? 'ซ่อนเฉลยข้อสอบ' : 'ดูเฉลยละเอียดและคำอธิบาย (10 ข้อ)'}</span>
            </button>

            <button
              onClick={handleRetake}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs border transition-all ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
              <span>ทำข้อสอบใหม่อีกครั้ง</span>
            </button>

            {testType === 'pretest' && onNavigateTab && (
              <button
                onClick={() => onNavigateTab('lessons')}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5"
              >
                <span>ขั้นตอนถัดไป: ไปยังศูนย์การเรียนรู้</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {testType === 'posttest' && (
              <button
                onClick={onViewLeaderboard}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>ดูตารางอันดับ (Leaderboard)</span>
              </button>
            )}
          </div>
        </div>

        {/* Detailed Answer Review Section */}
        {showReview && (
          <div className="space-y-4 animate-fade-in">
            <h3 className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <BookOpen className="w-5 h-5 text-cyan-500" />
              <span>เฉลยคำตอบพร้อมคำอธิบายความรู้ ระดับ ปวช.3 (10 ข้อ)</span>
            </h3>

            {questions.map((q, idx) => {
              const userChoice = selectedAnswers[q.id];
              const isCorrect = userChoice === q.correctIndex;

              return (
                <div
                  key={q.id}
                  className={`border rounded-2xl p-5 transition-all ${
                    isCorrect
                      ? isDark
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : 'bg-emerald-50/70 border-emerald-300'
                      : isDark
                      ? 'bg-rose-950/20 border-rose-500/30'
                      : 'bg-rose-50/70 border-rose-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 mt-0.5 ${
                          isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {q.question}
                      </h4>
                    </div>

                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0 ${
                        isCorrect
                          ? 'bg-emerald-500/20 text-emerald-500'
                          : 'bg-rose-500/20 text-rose-500'
                      }`}
                    >
                      {isCorrect ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>ถูกต้อง (+1)</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          <span>ไม่ถูกต้อง (0)</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Options List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-3 text-xs">
                    {q.options.map((opt, optIdx) => {
                      const isUserSelected = userChoice === optIdx;
                      const isTheRightAnswer = q.correctIndex === optIdx;

                      let optClass = isDark
                        ? 'bg-slate-900/60 border-slate-800 text-slate-400'
                        : 'bg-white/80 border-slate-200 text-slate-600';

                      if (isTheRightAnswer) {
                        optClass = isDark
                          ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold'
                          : 'bg-emerald-100 border-emerald-400 text-emerald-900 font-bold';
                      } else if (isUserSelected && !isTheRightAnswer) {
                        optClass = isDark
                          ? 'bg-rose-950/60 border-rose-500 text-rose-300 line-through'
                          : 'bg-rose-100 border-rose-400 text-rose-900 line-through';
                      }

                      return (
                        <div
                          key={optIdx}
                          className={`p-2.5 rounded-xl border flex items-center justify-between ${optClass}`}
                        >
                          <span>{opt}</span>
                          {isTheRightAnswer && (
                            <span className="text-[10px] text-emerald-500 font-bold">คำตอบที่ถูกต้อง ✓</span>
                          )}
                          {isUserSelected && !isTheRightAnswer && (
                            <span className="text-[10px] text-rose-500 font-bold">คำตอบที่คุณเลือก ✕</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation Box */}
                  <div
                    className={`mt-2 p-3 rounded-xl border text-xs leading-relaxed ${
                      isDark
                        ? 'bg-slate-950/80 border-slate-800 text-slate-300'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="font-bold text-cyan-500 mr-1.5">💡 คำอธิบาย:</span>
                    <span>{q.explanation}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Active Exam Taking Screen
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Exam Header */}
      <div
        className={`border rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                testType === 'pretest'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
              }`}
            >
              {testType === 'pretest' ? '📋 ขั้นตอนที่ 1 • แบบทดสอบก่อนเรียน' : '🎓 ขั้นตอนที่ 5 • แบบทดสอบหลังเรียน'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-500 font-bold">
              เนื้อหา ปวช.3 (10 ข้อ)
            </span>
          </div>

          <h2 className={`text-xl font-black mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {testType === 'pretest'
              ? 'ข้อสอบก่อนเรียน: ทักษะการพิมพ์สัมผัสและงานเอกสาร ปวช.3'
              : 'ข้อสอบหลังเรียน: วัดผลสัมฤทธิ์และพัฒนาการ ปวช.3'}
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            เลือกคำตอบที่ถูกต้องที่สุด จากนั้นกดส่งข้อสอบเพื่อตรวจคะแนนและบันทึกผล
          </p>
        </div>

        {testType === 'pretest' && onNavigateTab && (
          <div className="flex items-center gap-3">
            {/* Quick jump to lessons if in pretest */}
            <button
              onClick={() => onNavigateTab('lessons')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              ข้ามไปศูนย์การเรียนรู้
            </button>
          </div>
        )}
      </div>

      {/* Progress Bar & Question Stepper */}
      <div
        className={`border rounded-3xl p-5 sm:p-6 shadow-lg transition-all duration-300 ${
          isDark
            ? 'bg-slate-900/95 border-slate-800 shadow-slate-950/50'
            : 'bg-white border-slate-200/90 shadow-slate-200/40'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${
                isDark
                  ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                  : 'bg-cyan-50 border-cyan-200 text-cyan-700'
              }`}
            >
              ข้อที่ {currentIndex + 1} / {questions.length}
            </span>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              เลือกข้อที่ต้องการทำได้ทันที
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono tabular-nums text-xs">
            <span
              className={`font-bold ${
                isAllAnswered
                  ? 'text-emerald-500'
                  : isDark
                  ? 'text-cyan-400'
                  : 'text-cyan-600'
              }`}
            >
              ตอบแล้ว {answeredCount}/{questions.length} ข้อ
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {Math.round((answeredCount / questions.length) * 100)}%
            </span>
          </div>
        </div>

        {/* Sleek Gradient Progress Track */}
        <div
          className={`w-full h-2.5 rounded-full overflow-hidden p-0.5 ${
            isDark ? 'bg-slate-950 border border-slate-800/80' : 'bg-slate-100 border border-slate-200'
          }`}
        >
          <div
            style={{ width: `${Math.max((answeredCount / questions.length) * 100, answeredCount > 0 ? 4 : 0)}%` }}
            className={`h-full rounded-full transition-all duration-500 ${
              isAllAnswered
                ? 'bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                : 'bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 shadow-[0_0_10px_rgba(6,182,212,0.45)]'
            }`}
          />
        </div>

        {/* 10-Step Question Grid */}
        <div
          className={`grid grid-cols-5 sm:grid-cols-10 gap-2 mt-4 pt-4 border-t ${
            isDark ? 'border-slate-800/80' : 'border-slate-200/80'
          }`}
        >
          {questions.map((q, idx) => {
            const isAnswered = selectedAnswers[q.id] !== undefined;
            const isCurrent = currentIndex === idx;

            let tileStyle = '';
            if (isCurrent) {
              tileStyle = isDark
                ? 'bg-gradient-to-b from-cyan-500 to-blue-600 border-cyan-300/60 text-white font-bold shadow-[0_4px_14px_-2px_rgba(6,182,212,0.55)] -translate-y-0.5'
                : 'bg-gradient-to-b from-cyan-500 to-blue-600 border-cyan-600 text-white font-bold shadow-[0_4px_12px_-2px_rgba(14,165,233,0.45)] -translate-y-0.5';
            } else if (isAnswered) {
              tileStyle = isDark
                ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-300 hover:bg-emerald-500/25 font-bold'
                : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 font-bold';
            } else {
              tileStyle = isDark
                ? 'bg-slate-950/90 border-slate-800 text-slate-400 hover:text-white hover:border-slate-600 hover:bg-slate-800/70'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:border-cyan-300 hover:bg-white';
            }

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  clearAdvanceTimers();
                  setTransitionPhase('idle');
                  setShowPreSubmitSummary(false);
                  setIsEditingFromReview(isAllAnswered);
                  setCurrentIndex(idx);
                }}
                title={`ข้อที่ ${idx + 1}${isAnswered ? ' (ตอบแล้ว)' : ' (ยังไม่ตอบ)'}`}
                className={`relative h-10 rounded-xl text-xs font-mono tabular-nums border flex items-center justify-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${tileStyle}`}
              >
                <span>{idx + 1}</span>
                {isAnswered && !isCurrent && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400"
                  />
                )}
                {isCurrent && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-white/85"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Subtle Legend */}
        <div className={`flex flex-wrap items-center justify-end gap-4 mt-3 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-b from-cyan-500 to-blue-600 inline-block" />
            <span>ข้อปัจจุบัน</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm border inline-block ${isDark ? 'bg-emerald-500/25 border-emerald-500/60' : 'bg-emerald-100 border-emerald-400'}`} />
            <span>ตอบแล้ว</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm border inline-block ${isDark ? 'bg-slate-950 border-slate-700' : 'bg-slate-100 border-slate-300'}`} />
            <span>ยังไม่ตอบ</span>
          </span>
        </div>
      </div>

      {/* Pre-Submit 10-Question Review & Edit Screen OR Active Question Card */}
      {showPreSubmitSummary ? (
        <div
          className={`border rounded-3xl p-6 sm:p-8 shadow-xl transition-all duration-300 ${
            isDark
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-slate-200/90 shadow-slate-200/50'
          }`}
        >
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b mb-5 ${isDark ? 'border-slate-800' : 'border-slate-200/80'}`}>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/35 text-emerald-500 mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ตอบครบทั้ง 10 ข้อแล้ว</span>
              </div>
              <h3 className={`text-lg sm:text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                ตรวจสอบและแก้ไขคำตอบก่อนส่ง
              </h3>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                หากต้องการเปลี่ยนคำตอบข้อใด สามารถกดปุ่ม "แก้ไข" ในข้อนั้นได้ทันที ก่อนกดยืนยันส่งข้อสอบ
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleSubmit(false)}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 shrink-0 transition-transform hover:scale-[1.02]"
            >
              <Send className="w-4 h-4" />
              <span>ยืนยันส่งข้อสอบ (ตรวจคะแนน)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {questions.map((q, idx) => {
              const choiceIdx = selectedAnswers[q.id];
              const choiceLabel = choiceIdx !== undefined ? ['ก', 'ข', 'ค', 'ง'][choiceIdx] : '-';
              const choiceText = choiceIdx !== undefined ? q.options[choiceIdx] : 'ยังไม่ได้เลือกคำตอบ';

              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-2xl border flex items-start justify-between gap-3 transition-colors ${
                    isDark
                      ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-50 border-slate-200 hover:border-cyan-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-500 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className={`text-xs font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        {q.question}
                      </span>
                    </div>
                    <div className={`text-xs pl-8 truncate ${isDark ? 'text-emerald-400' : 'text-emerald-700'} font-medium`}>
                      ตอบ {choiceLabel}. {choiceText}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setIsEditingFromReview(true);
                      setShowPreSubmitSummary(false);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border shrink-0 transition-colors ${
                      isDark
                        ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-300'
                        : 'bg-white hover:bg-cyan-50 border-slate-300 text-cyan-700'
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>แก้ไข</span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className={`flex flex-wrap items-center justify-between gap-3 mt-6 pt-5 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <button
              type="button"
              onClick={() => {
                setShowPreSubmitSummary(false);
                setIsEditingFromReview(true);
                setCurrentIndex(0);
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>กลับไปทบทวนข้อที่ 1</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(false)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-transform hover:scale-105"
            >
              <Send className="w-3.5 h-3.5" />
              <span>ยืนยันส่งข้อสอบ (ตรวจคะแนน)</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`border rounded-3xl p-6 sm:p-8 shadow-xl ${
            transitionPhase === 'entering'
              ? 'opacity-0 translate-x-3 transition-none'
              : transitionPhase === 'leaving'
              ? 'opacity-0 -translate-x-3 transition-all duration-200 ease-out'
              : 'opacity-100 translate-x-0 transition-all duration-300 ease-out'
          } ${
            isDark
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-slate-200/90 shadow-slate-200/50'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-cyan-500 text-white font-black text-xs flex items-center justify-center shadow-md shadow-cyan-500/20">
                {currentIndex + 1}
              </span>
              <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {isEditingFromReview
                  ? `กำลังแก้ไขคำตอบข้อที่ ${currentIndex + 1} (เลือกคำตอบใหม่เพื่อกลับหน้าสรุป)`
                  : `คำถามข้อที่ ${currentIndex + 1} · เลือกคำตอบเพื่อไปยังข้อถัดไปอัตโนมัติ`}
              </span>
            </div>

            {isAllAnswered && (
              <button
                type="button"
                onClick={() => {
                  clearAdvanceTimers();
                  setTransitionPhase('idle');
                  setIsEditingFromReview(false);
                  setShowPreSubmitSummary(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/25 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>กลับหน้าสรุปคำตอบก่อนส่ง</span>
              </button>
            )}
          </div>

          <h3 className={`text-base sm:text-lg font-bold mb-6 leading-relaxed ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {currentQ.question}
          </h3>

          {/* 4 Clickable Options */}
          <div className="space-y-3">
            {currentQ.options.map((option, optIdx) => {
              const isSelected = selectedAnswers[currentQ.id] === optIdx;

              return (
                <button
                  key={optIdx}
                  type="button"
                  onClick={() => handleSelectOption(optIdx)}
                  className={`w-full text-left p-4 rounded-2xl border text-sm transition-all duration-200 flex items-center justify-between ${
                    isSelected
                      ? isDark
                        ? 'border-cyan-400 bg-cyan-500/20 ring-2 ring-cyan-400/70 shadow-md font-semibold text-cyan-200 scale-[1.01]'
                        : 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-400/70 shadow-md font-semibold text-cyan-800 scale-[1.01]'
                      : isDark
                      ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-950'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-800 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? 'bg-cyan-500 text-white border-cyan-500'
                          : isDark
                          ? 'bg-slate-800 border-slate-700 text-slate-400'
                          : 'bg-slate-200 border-slate-300 text-slate-600'
                      }`}
                    >
                      {['ก', 'ข', 'ค', 'ง'][optIdx] || optIdx + 1}
                    </span>
                    <span>{option}</span>
                  </div>

                  {isSelected && (
                    <CheckCircle2 className="w-5 h-5 text-cyan-500 shrink-0 drop-shadow-sm ml-2" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Navigation Buttons */}
          <div className={`flex flex-wrap items-center justify-between gap-3 mt-8 pt-5 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                currentIndex === 0
                  ? 'opacity-40 cursor-not-allowed border-transparent'
                  : isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>ข้อย้อนกลับ</span>
            </button>

            <div className="flex items-center gap-2">
              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-600/20 transition-all hover:scale-105"
                >
                  <span>ข้อถัดไป</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => handleSubmit(false)}
                className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all ${
                  isAllAnswered
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/20 hover:scale-105'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>ส่งข้อสอบ (ตรวจคะแนน)</span>
              </button>
            </div>
          </div>

          {confirmIncompleteSubmit && !isAllAnswered && (
            <div
              className={`mt-4 p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                isDark
                  ? 'bg-amber-950/35 border-amber-500/40 text-amber-200'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              <span>
                คุณยังทำข้อสอบไม่ครบ ({answeredCount}/{questions.length} ข้อ) ต้องการส่งข้อสอบเลยหรือไม่?
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  ยืนยันส่งข้อสอบ
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmIncompleteSubmit(false)}
                  className={`px-3 py-1.5 rounded-lg border font-medium ${
                    isDark ? 'border-slate-700 text-slate-300' : 'border-amber-300 text-amber-800'
                  }`}
                >
                  ทำต่อ
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
