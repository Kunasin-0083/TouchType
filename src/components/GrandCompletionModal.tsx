import React, { useEffect, useState } from 'react';
import {
  X,
  CheckCircle2,
  Crown,
  Award,
  BookOpen,
  ClipboardCheck,
  Gamepad2,
  GraduationCap,
  ArrowRight,
  Zap,
  Target,
  Medal
} from 'lucide-react';
import { ScoreRecord, User, UserMedalProfile } from '../types';
import { useTheme } from '../context/ThemeContext';
import { CurriculumCompletionInfo, GRAND_MEDAL_IMAGE_PATH } from './MedalShowcase';

interface GrandCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  completion: CurriculumCompletionInfo;
  userScores: ScoreRecord[];
  savedMedalProfile: UserMedalProfile | null;
  isOnProfileTab?: boolean;
  onGoToProfile?: () => void;
}

export const GrandCompletionModal: React.FC<GrandCompletionModalProps> = ({
  isOpen,
  onClose,
  user,
  completion,
  userScores,
  savedMedalProfile,
  isOnProfileTab = false,
  onGoToProfile
}) => {
  const { isDark } = useTheme();
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const bestWpm = Math.max(
    savedMedalProfile?.bestWpm || 0,
    userScores.reduce((max, s) => Math.max(max, s.netWpm), 0)
  );
  const bestAccuracy = Math.max(
    savedMedalProfile?.bestAccuracy || 0,
    userScores.reduce((max, s) => Math.max(max, s.accuracy), 0)
  );
  const earnedMedalsCount = savedMedalProfile?.earnedMedals?.length || 15;
  const studentDisplayName = user?.fullName || user?.displayName || 'นักเรียนคนเก่ง';

  const pillars = [
    {
      label: 'Pre-Test',
      status: 'ผ่านแล้ว',
      icon: <ClipboardCheck className="w-4 h-4 text-sky-500 shrink-0" />
    },
    {
      label: 'ศูนย์การเรียนรู้',
      status: 'สำเร็จแล้ว',
      icon: <BookOpen className="w-4 h-4 text-emerald-500 shrink-0" />
    },
    {
      label: 'เกม 10 ด่าน',
      status: `${completion.passedLevelsCount}/10 ด่าน`,
      icon: <Gamepad2 className="w-4 h-4 text-violet-500 shrink-0" />
    },
    {
      label: 'Post-Test',
      status: 'ผ่านแล้ว',
      icon: <GraduationCap className="w-4 h-4 text-amber-500 shrink-0" />
    }
  ];

  const completedDateText = savedMedalProfile?.updatedAt
    ? new Date(savedMedalProfile.updatedAt).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : new Date().toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="grand-completion-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in"
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl border shadow-2xl transition-colors duration-200 ${
          isDark
            ? 'bg-slate-900 border-emerald-500/40 text-slate-100'
            : 'bg-white border-emerald-300 text-slate-900'
        }`}
      >
        {/* Top celebratory hairline gradient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400" />

        {/* Subtle ambient emerald halo */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-56 rounded-full blur-3xl ${
            isDark ? 'bg-emerald-500/15' : 'bg-emerald-400/20'
          }`}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดหน้าต่างแสดงความยินดี"
          className={`absolute top-5 right-5 z-20 w-10 h-10 rounded-xl flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            isDark
              ? 'text-slate-400 hover:text-white hover:bg-slate-800'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-10 p-6 sm:p-8 text-center">
          {/* Grand Medal Emblem */}
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full p-1.5 bg-gradient-to-tr from-emerald-400 via-teal-300 to-amber-400 shadow-xl shadow-emerald-500/30">
                {!imgError ? (
                  <img
                    src={GRAND_MEDAL_IMAGE_PATH}
                    alt="เหรียญตราเกียรติยศ พิชิตหลักสูตรครบ 100%"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex flex-col items-center justify-center text-white">
                    <Crown className="w-12 h-12 mb-1" />
                    <span className="font-mono text-sm font-black tabular-nums">100%</span>
                  </div>
                )}
              </div>

              <div
                className={`absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg ring-4 ${
                  isDark ? 'ring-slate-900' : 'ring-white'
                }`}
              >
                <Crown className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Unboxed clean kicker metadata */}
          <div
            className={`flex flex-wrap items-center justify-center gap-2 text-xs font-semibold mb-2 ${
              isDark ? 'text-emerald-400' : 'text-emerald-700'
            }`}
          >
            <span>พิชิตหลักสูตรครบ 100%</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {completion.completedSteps} / {completion.totalSteps} ภารกิจสำเร็จสมบูรณ์
            </span>
          </div>

          {/* Main Congratulatory Title */}
          <h2
            id="grand-completion-title"
            className={`text-2xl sm:text-3xl font-black tracking-tight [text-wrap:balance] ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            ขอแสดงความยินดี! คุณผ่านครบทุกภารกิจแล้ว
          </h2>

          {/* Student Identity Metadata */}
          <div
            className={`mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            <span className="font-bold">{studentDisplayName}</span>
            {user?.studentId && (
              <>
                <span aria-hidden="true" className="opacity-50">·</span>
                <span className="font-mono tabular-nums text-xs sm:text-sm">
                  รหัส {user.studentId}
                </span>
              </>
            )}
            {user?.classroom && (
              <>
                <span aria-hidden="true" className="opacity-50">·</span>
                <span className="text-xs sm:text-sm">ห้อง {user.classroom}</span>
              </>
            )}
          </div>

          {/* Congratulatory Body Copy */}
          <p
            className={`mt-3 text-sm leading-relaxed max-w-md mx-auto ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            คุณได้ทำแบบทดสอบก่อนเรียน ศูนย์การเรียนรู้ ผ่านเกมฝึกพิมพ์ครบทั้ง 10 ด่าน
            และทำแบบทดสอบหลังเรียนเสร็จสมบูรณ์ครบถ้วนแล้ว
            ได้รับเหรียญตราเกียรติยศนักพิมพ์สัมผัสสมบูรณ์แบบ 100% เป็นที่เรียบร้อย
          </p>

          {/* 4 Completed Pillars Grid */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-left">
            {pillars.map(item => (
              <div
                key={item.label}
                className={`p-3 rounded-2xl border flex flex-col gap-1.5 ${
                  isDark
                    ? 'bg-emerald-950/30 border-emerald-500/35'
                    : 'bg-emerald-50/75 border-emerald-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  {item.icon}
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                </div>
                <div className={`text-xs font-bold leading-snug ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {item.label}
                </div>
                <div
                  className={`text-[11px] font-mono tabular-nums font-semibold ${
                    isDark ? 'text-emerald-300' : 'text-emerald-700'
                  }`}
                >
                  {item.status}
                </div>
              </div>
            ))}
          </div>

          {/* Hairline-separated Performance Summary */}
          <div
            className={`mt-6 pt-5 pb-1 border-t grid grid-cols-3 gap-4 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            <div className="flex flex-col items-center">
              <div className={`flex items-center gap-1 text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <Zap className="w-3.5 h-3.5 text-sky-500" />
                <span>ความเร็วสูงสุด</span>
              </div>
              <div className="font-mono tabular-nums text-lg font-black text-sky-500">
                {bestWpm} <span className="text-[11px] font-medium">WPM</span>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className={`flex items-center gap-1 text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <Target className="w-3.5 h-3.5 text-emerald-500" />
                <span>แม่นยำสูงสุด</span>
              </div>
              <div className="font-mono tabular-nums text-lg font-black text-emerald-500">
                {bestAccuracy}%
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className={`flex items-center gap-1 text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <Medal className="w-3.5 h-3.5 text-amber-500" />
                <span>เหรียญตรา</span>
              </div>
              <div className="font-mono tabular-nums text-lg font-black text-amber-500">
                {earnedMedalsCount} <span className="text-[11px] font-medium">เหรียญ</span>
              </div>
            </div>
          </div>

          <p className={`mt-4 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            บันทึกความสำเร็จถาวรลงโปรไฟล์และ Google Sheets แล้ว · {completedDateText}
          </p>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            {!isOnProfileTab && onGoToProfile && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoToProfile();
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <Award className="w-4 h-4" />
                <span>ดูเหรียญตราในหน้าโปรไฟล์</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                isOnProfileTab || !onGoToProfile
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                  : isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              <span>{isOnProfileTab || !onGoToProfile ? 'ปิดหน้าต่าง' : 'ไว้ดูทีหลัง'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
