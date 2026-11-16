import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
  Award
} from 'lucide-react';
import { ScoreRecord } from '../types';
import { soundManager } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';

interface ResultModalProps {
  scoreRecord: ScoreRecord;
  targetAccuracy: number;
  minWpm: number;
  onPlayAgain: () => void;
  onNextLevel?: () => void;
  onViewLeaderboard: () => void;
  hasNextLevel?: boolean;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  scoreRecord,
  targetAccuracy,
  minWpm,
  onPlayAgain,
  onNextLevel,
  onViewLeaderboard,
  hasNextLevel
}) => {
  const isPassed = scoreRecord.passed;
  const { isDark } = useTheme();

  useEffect(() => {
    if (isPassed) {
      soundManager.playVictoryFanfare();
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {
        // ignore
      }
    }
  }, [isPassed]);

  // Personalized coaching recommendation in Thai
  const getFeedbackTip = () => {
    if (!isPassed) {
      if (scoreRecord.accuracy < targetAccuracy) {
        return 'คำแนะนำ: ชะลอความเร็วลงเล็กน้อย แล้วเน้นการเคาะนิ้วให้ตรงแป้นเป้าหมาย ความถูกต้องสำคัญกว่าความเร็วเสมอ!';
      }
      return 'คำแนะนำ: คุณทำความแม่นยำได้ดีแล้ว ลองผ่อนคลายกล้ามเนื้อข้อมือและเคาะอย่างต่อเนื่องเป็นจังหวะเพื่อเพิ่มความเร็ว';
    }
    if (scoreRecord.accuracy >= 95 && scoreRecord.netWpm >= 50) {
      return 'ยอดเยี่ยมระดับมืออาชีพ! นิ้วมือและกล้ามเนื้อของคุณจดจำตำแหน่งแป้นพิมพ์ได้อย่างสมบูรณ์แบบ';
    }
    return 'ยินดีด้วย! คุณผ่านเกณฑ์ตามมาตรฐานการพิมพ์สัมผัส พร้อมลุยด่านถัดไปหรือท้าทายสถิติสูงสุด';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className={`w-full max-w-xl border rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/60'
        }`}
      >
        {/* Glow background */}
        <div
          className={`absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none ${
            isPassed ? 'bg-cyan-500' : 'bg-rose-500'
          }`}
        />

        {/* Header Badge */}
        <div className="text-center mb-6">
          <div
            className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3 shadow-lg ${
              isPassed
                ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-amber-500/20'
                : 'bg-rose-500/20 text-rose-500 border border-rose-500/30'
            }`}
          >
            {isPassed ? <Trophy className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
          </div>
          <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {isPassed ? '🎉 ยินดีด้วย! ผ่านด่านแล้ว' : '💪 ยังไม่ผ่านเกณฑ์ พยายามใหม่อีกนิด'}
          </h2>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {scoreRecord.levelTitle} • {scoreRecord.language === 'th' ? '🇹🇭 ภาษาไทย' : '🇬🇧 ภาษาอังกฤษ'}
          </p>
          {isPassed && scoreRecord.gameMode === 'game' && (
            <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-500 text-xs font-bold">
              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 font-mono font-black flex items-center justify-center text-[11px]">
                {scoreRecord.levelId}
              </span>
              <span>ได้รับเหรียญตราด่านที่ {scoreRecord.levelId} บนหน้าโปรไฟล์แล้ว!</span>
            </div>
          )}
        </div>

        {/* Criteria status */}
        <div className="flex items-center justify-center gap-4 text-xs font-semibold mb-6">
          <span
            className={`px-3 py-1 rounded-full border flex items-center gap-1.5 ${
              scoreRecord.accuracy >= targetAccuracy
                ? isDark
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : isDark
                ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                : 'bg-rose-50 border-rose-300 text-rose-700'
            }`}
          >
            {scoreRecord.accuracy >= targetAccuracy ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            ความแม่นยำ: {scoreRecord.accuracy}% (เกณฑ์ {targetAccuracy}%)
          </span>
          <span
            className={`px-3 py-1 rounded-full border flex items-center gap-1.5 ${
              scoreRecord.netWpm >= minWpm
                ? isDark
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : isDark
                ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                : 'bg-rose-50 border-rose-300 text-rose-700'
            }`}
          >
            {scoreRecord.netWpm >= minWpm ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            ความเร็ว: {scoreRecord.netWpm} WPM (เกณฑ์ {minWpm} WPM)
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className={`p-3 rounded-2xl border text-center ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>คะแนนสุทธิ</span>
            <div className="text-xl sm:text-2xl font-black text-cyan-500 font-mono mt-0.5">
              {scoreRecord.score}
            </div>
          </div>
          <div className={`p-3 rounded-2xl border text-center ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Net WPM</span>
            <div className="text-xl sm:text-2xl font-black text-blue-500 font-mono mt-0.5">
              {scoreRecord.netWpm}
            </div>
          </div>
          <div className={`p-3 rounded-2xl border text-center ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Accuracy</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-500 font-mono mt-0.5">
              {scoreRecord.accuracy}%
            </div>
          </div>
          <div className={`p-3 rounded-2xl border text-center ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>เวลาที่ใช้</span>
            <div className="text-xl sm:text-2xl font-black text-purple-500 font-mono mt-0.5">
              {scoreRecord.timeTakenSeconds}s
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div
          className={`rounded-xl p-3 border text-xs mb-6 flex justify-around ${
            isDark ? 'bg-slate-950/60 border-slate-800/80 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <div>
            ถูก: <strong className="text-emerald-500">{scoreRecord.correctCharacters}</strong> ตัว
          </div>
          <div>
            ผิด: <strong className="text-rose-500">{scoreRecord.incorrectCharacters}</strong> ตัว
          </div>
          <div>
            ทั้งหมด: <strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>{scoreRecord.totalCharacters}</strong> ตัว
          </div>
        </div>

        {/* Coach tip box */}
        <div
          className={`p-3.5 rounded-xl border text-xs mb-6 flex items-start gap-2.5 ${
            isDark ? 'bg-blue-950/40 border-blue-900/60 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <Award className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{getFeedbackTip()}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onPlayAgain}
            className={`w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm border transition-colors ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-750 text-white border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>เล่นซ้ำ (สุ่มโจทย์ใหม่)</span>
          </button>

          {isPassed && hasNextLevel && onNextLevel && (
            <button
              onClick={onNextLevel}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-cyan-500/25 transition-all"
            >
              <span>ลุยด่านถัดไป</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onViewLeaderboard}
            className={`w-full sm:w-auto flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl font-semibold text-sm border transition-colors ${
              isDark
                ? 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border-cyan-800/60'
                : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border-cyan-300'
            }`}
          >
            <Trophy className="w-4 h-4 text-cyan-500" />
            <span>ดูอันดับ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
