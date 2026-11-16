import React, { useState, useEffect } from 'react';
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
  Sparkles,
  BookOpen,
  Trophy
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

  // Timer is disabled for quiz exam as requested (สอบไม่ต้องมีจับเวลา)
  useEffect(() => {
    // No timer interval
  }, []);

  // Load prior pretest quiz score for Post-test comparison
  const getStoredQuizScore = (key: string): { score: number; total: number; date: string } | null => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const priorPretest = getStoredQuizScore(LOCAL_PRETEST_QUIZ_KEY);

  const currentQ = questions[currentIndex];
  const answeredCount = Object.keys(selectedAnswers).length;
  const isAllAnswered = answeredCount === questions.length;

  const handleSelectOption = (optionIndex: number) => {
    if (isSubmitted) return;
    setSelectedAnswers(prev => ({
      ...prev,
      [currentQ.id]: optionIndex
    }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!isAllAnswered) {
      const confirmSubmit = window.confirm(
        `คุณยังทำข้อสอบไม่ครบ (${answeredCount}/${questions.length} ข้อ) ต้องการส่งข้อสอบเลยหรือไม่?`
      );
      if (!confirmSubmit) return;
    }

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
    const storageKey = testType === 'pretest' ? LOCAL_PRETEST_QUIZ_KEY : LOCAL_POSTTEST_QUIZ_KEY;
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
    setSelectedAnswers({});
    setCurrentIndex(0);
    setIsSubmitted(false);
    setElapsedSeconds(0);
    setSubmittedScore(null);
    setShowReview(false);
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
                  ? 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <span>{showReview ? 'ซ่อนเฉลยข้อสอบ' : 'ดูเฉลยละเอียดและคำอธิบาย (10 ข้อ)'}</span>
            </button>

            <button
              onClick={handleRetake}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs border transition-all ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
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

        <div className="flex items-center gap-3">
          {/* No Timer Badge (สอบไม่ต้องมีจับเวลา) */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
              isDark
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>ไม่จำกัดเวลา (ทำตามอัธยาศัย)</span>
          </div>

          {/* Quick jump to lessons if in pretest */}
          {testType === 'pretest' && onNavigateTab && (
            <button
              onClick={() => onNavigateTab('lessons')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              ข้ามไปศูนย์การเรียนรู้
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar & Question Jump Pills */}
      <div
        className={`border rounded-2xl p-4 transition-all duration-300 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between text-xs mb-2">
          <span className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            ข้อที่ {currentIndex + 1} จาก {questions.length} ข้อ
          </span>
          <span className="text-cyan-600 font-semibold font-mono">
            ตอบแล้ว {answeredCount} / {questions.length} ข้อ
          </span>
        </div>

        {/* Progress bar line */}
        <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
          <div
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-300"
          />
        </div>

        {/* Jump Numbers */}
        <div className="flex items-center justify-between gap-1.5 mt-3 pt-3 border-t border-slate-800/60 overflow-x-auto no-scrollbar">
          {questions.map((q, idx) => {
            const isAnswered = selectedAnswers[q.id] !== undefined;
            const isCurrent = currentIndex === idx;

            let btnClass = isDark
              ? 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
              : 'bg-slate-100 border-slate-200 text-slate-400 hover:border-slate-300';

            if (isAnswered) {
              btnClass = isDark
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold'
                : 'bg-cyan-100 border-cyan-400 text-cyan-800 font-bold';
            }

            if (isCurrent) {
              btnClass += ' ring-2 ring-cyan-400 scale-105';
            }

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`w-8 h-8 rounded-xl text-xs flex items-center justify-center border font-mono transition-all shrink-0 ${btnClass}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Current Question Card */}
      <div
        className={`border rounded-3xl p-6 sm:p-8 shadow-xl transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="w-8 h-8 rounded-xl bg-cyan-500 text-white font-black text-xs flex items-center justify-center shadow-md shadow-cyan-500/20">
            {currentIndex + 1}
          </span>
          <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            คำถามข้อที่ {currentIndex + 1}
          </span>
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
                className={`w-full text-left p-4 rounded-2xl border text-sm transition-all flex items-center justify-between ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-500/15 ring-2 ring-cyan-400 shadow-md font-semibold text-cyan-600 scale-[1.01]'
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
        <div className="flex items-center justify-between gap-3 mt-8 pt-5 border-t border-slate-800/80">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
              currentIndex === 0
                ? 'opacity-40 cursor-not-allowed border-transparent'
                : isDark
                ? 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
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
              onClick={handleSubmit}
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
      </div>
    </div>
  );
};
