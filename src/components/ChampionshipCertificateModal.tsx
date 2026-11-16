import React from 'react';
import {
  Trophy,
  Award,
  Sparkles,
  Zap,
  Target,
  Flame,
  Heart,
  RotateCcw,
  CheckCircle2,
  Share2,
  X
} from 'lucide-react';
import { ScoreRecord, User } from '../types';
import { useTheme } from '../context/ThemeContext';
import { UserAvatar } from './UserAvatar';

interface ChampionshipCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: ScoreRecord;
  onPlayAgain: () => void;
  onViewLeaderboard: () => void;
}

export const ChampionshipCertificateModal: React.FC<ChampionshipCertificateModalProps> = ({
  isOpen,
  onClose,
  record,
  onPlayAgain,
  onViewLeaderboard
}) => {
  const { isDark } = useTheme();

  if (!isOpen) return null;

  const isGM = record.rankTier?.includes('GM') || record.rankTier?.includes('Grandmaster');
  const isMaster = record.rankTier?.includes('Master') && !isGM;

  const modeTitle =
    record.championshipMode === 'speed_sprint'
      ? '⚡ Speed Sprint (60 วินาที)'
      : record.championshipMode === 'championship_endurance'
      ? '🏆 Championship Endurance (120 วินาที)'
      : '❤️ Sudden Death Survival (3 หัวใจ)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div
        className={`w-full max-w-2xl border-2 rounded-3xl p-6 sm:p-10 shadow-2xl relative transition-all duration-300 my-8 ${
          isDark
            ? 'bg-slate-900 border-amber-500/50 shadow-amber-500/10'
            : 'bg-white border-amber-400 shadow-amber-200/60'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-5 right-5 p-2 rounded-xl transition-colors ${
            isDark
              ? 'text-slate-400 hover:text-white hover:bg-slate-800'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Certificate Golden Header */}
        <div className="text-center relative pb-6 border-b border-amber-500/30">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black mb-3 border bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-500 border-amber-500/40">
            <Sparkles className="w-3.5 h-3.5" />
            <span>OFFICIAL RANKED ARENA CHAMPIONSHIP CERTIFICATE</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-500 bg-clip-text text-transparent">
            ใบประกาศนียบัตรเกียรติยศยอดฝีมือนักพิมพ์
          </h2>
          <p className={`text-xs mt-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            มอบให้เพื่อแสดงว่าผู้เข้าแข่งขันได้ผ่านการประลองจัดอันดับอย่างเป็นทางการ
          </p>

          {/* Player Identity with Avatar */}
          <div className="flex items-center justify-center gap-3.5 mt-5">
            <UserAvatar
              avatar={record.avatar}
              name={record.displayName}
              gradient={record.avatarBg || 'from-cyan-500 to-blue-600'}
              size="lg"
              className="ring-2 ring-amber-400"
            />

            <div className="text-left">
              <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {record.displayName}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30">
                  {record.rankTier}
                </span>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {modeTitle}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Big Score & Multipliers Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6 font-mono">
          {/* Typed Characters (พิมพ์ได้เท่าไหร่) */}
          <div
            className={`p-4 rounded-2xl border text-center relative overflow-hidden ${
              isDark
                ? 'bg-cyan-950/25 border-cyan-500/40 text-cyan-200'
                : 'bg-cyan-50/90 border-cyan-300 text-cyan-900'
            }`}
          >
            <span className="text-[11px] uppercase tracking-wider font-sans block opacity-80">พิมพ์ได้ทั้งหมด</span>
            <div className="text-3xl font-black text-cyan-500 mt-1">
              {record.correctCharacters}
              <span className="text-sm font-bold opacity-70">/{record.totalCharacters}</span>
            </div>
            <span className="text-[10px] text-cyan-500 font-sans block mt-0.5 font-semibold">
              ถูก {record.correctCharacters} ตัวอักษร
            </span>
          </div>

          {/* Net WPM (ความเร็วเท่าไหร่) */}
          <div
            className={`p-4 rounded-2xl border text-center ${
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className={`text-[11px] uppercase tracking-wider font-sans block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              ความเร็วในการพิมพ์
            </span>
            <div className={`text-3xl font-black mt-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              {record.netWpm}
            </div>
            <span className={`text-[10px] font-sans block mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Net WPM (Gross {record.grossWpm})
            </span>
          </div>

          {/* Incorrect Characters (พิมพ์ผิดไปเท่าไหร่) */}
          <div
            className={`p-4 rounded-2xl border text-center ${
              record.incorrectCharacters > 0
                ? isDark
                  ? 'bg-rose-950/25 border-rose-500/40 text-rose-200'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
                : isDark
                ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-200'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}
          >
            <span className={`text-[11px] uppercase tracking-wider font-sans block ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              พิมพ์ผิดทั้งหมด
            </span>
            <div className={`text-3xl font-black mt-1 ${record.incorrectCharacters > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {record.incorrectCharacters}
            </div>
            <span className={`text-[10px] font-sans block mt-0.5 font-bold ${record.incorrectCharacters > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {record.incorrectCharacters > 0 ? `ผิด ${record.incorrectCharacters} ตัว (-${record.incorrectCharacters * 15} แต้ม)` : 'ไม่มีคำผิดเลย! 🎉'}
            </span>
          </div>

          {/* Final Rank Score */}
          <div
            className={`p-4 rounded-2xl border text-center relative overflow-hidden ${
              isDark
                ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                : 'bg-amber-50/80 border-amber-300 text-amber-900'
            }`}
          >
            <span className="text-[11px] uppercase tracking-wider font-sans block opacity-80">คะแนนแรงก์ที่ได้</span>
            <div className="text-3xl font-black text-amber-500 mt-1">
              {record.score}
            </div>
            <span className="text-[10px] text-amber-600 font-sans block mt-0.5 font-bold">
              แม่นยำ {record.accuracy}%
            </span>
          </div>
        </div>

        {/* Detail Breakdown Stats */}
        <div
          className={`p-4 rounded-2xl border mb-6 text-xs flex flex-wrap items-center justify-between gap-3 ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>ความแม่นยำ:</span>
            <span className="font-bold text-emerald-500 font-mono">
              {record.accuracy}%{' '}
              ({record.accuracy >= 98
                ? 'x1.50 เกราะ'
                : record.accuracy >= 95
                ? 'x1.25 เกราะ'
                : record.accuracy >= 85
                ? 'x1.00 มาตรฐาน'
                : 'x0.50 ลดทอน'})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>คอมโบสูงสุด:</span>
            <span className="font-bold text-orange-500 font-mono">🔥 {record.maxCombo || 0}x</span>
          </div>

          <div className="flex items-center gap-2">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>เวลาที่ใช้:</span>
            <span className="font-bold font-mono">{record.timeTakenSeconds} วินาที</span>
          </div>

          <div className="flex items-center gap-1.5 text-emerald-500 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>บันทึกคะแนนแล้ว</span>
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <button
            onClick={onPlayAgain}
            className={`w-full sm:w-auto px-6 py-3 rounded-2xl font-bold text-xs border transition-all flex items-center justify-center gap-2 ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>ประลองใหม่อีกครั้ง (Retry)</span>
          </button>

          <button
            onClick={onViewLeaderboard}
            className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-xl shadow-amber-500/25 transition-all hover:scale-105 flex items-center justify-center gap-2"
          >
            <Trophy className="w-4 h-4" />
            <span>ดูตารางอันดับ (Leaderboard)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
