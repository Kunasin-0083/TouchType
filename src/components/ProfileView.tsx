import React, { useState, useMemo } from 'react';
import {
  Award,
  Zap,
  Target,
  CheckCircle2,
  Calendar,
  History,
  Medal,
  Flame,
  Trophy,
  ClipboardCheck,
  Gamepad2,
  BookOpen,
  Layers
} from 'lucide-react';
import { ScoreRecord, User } from '../types';
import { getLocalScores } from '../utils/googleSheets';
import { useTheme } from '../context/ThemeContext';
import { UserAvatar } from './UserAvatar';
import {
  MedalShowcase,
  getCurriculumCompletion,
  GRAND_MEDAL_IMAGE_PATH
} from './MedalShowcase';

interface ProfileViewProps {
  user: User | null;
  onOpenAuth: () => void;
  onOpenAvatarModal?: () => void;
}

type CategoryKey = 'all' | 'ranked' | 'tests' | 'game' | 'lesson';
type SpecificCategoryKey = Exclude<CategoryKey, 'all'>;

function getScoreCategory(s: ScoreRecord): SpecificCategoryKey {
  if (s.gameMode === 'ranked' || s.testType === 'RANKED') return 'ranked';
  if (
    s.gameMode === 'pretest' ||
    s.gameMode === 'posttest' ||
    s.testType === 'PRE_TEST' ||
    s.testType === 'POST_TEST'
  ) {
    return 'tests';
  }
  if (s.gameMode === 'lesson' || s.gameMode === 'practice') return 'lesson';
  return 'game';
}

const CATEGORY_META: Record<
  SpecificCategoryKey,
  {
    label: string;
    shortLabel: string;
    accentText: string;
    accentBg: string;
    accentBorder: string;
    icon: React.ReactNode;
  }
> = {
  ranked: {
    label: 'ประลองจัดอันดับ (Ranked Arena)',
    shortLabel: 'ประลองจัดอันดับ',
    accentText: 'text-amber-500',
    accentBg: 'bg-amber-500/10',
    accentBorder: 'border-amber-500/40',
    icon: <Trophy className="w-4 h-4" />
  },
  tests: {
    label: 'แบบทดสอบก่อน / หลังเรียน',
    shortLabel: 'แบบทดสอบก่อน/หลังเรียน',
    accentText: 'text-purple-500',
    accentBg: 'bg-purple-500/10',
    accentBorder: 'border-purple-500/40',
    icon: <ClipboardCheck className="w-4 h-4" />
  },
  game: {
    label: 'โหมดเกม 10 ด่าน',
    shortLabel: 'โหมดเกม 10 ด่าน',
    accentText: 'text-cyan-500',
    accentBg: 'bg-cyan-500/10',
    accentBorder: 'border-cyan-500/40',
    icon: <Gamepad2 className="w-4 h-4" />
  },
  lesson: {
    label: 'ศูนย์การเรียนรู้ (Lessons)',
    shortLabel: 'ศูนย์การเรียนรู้',
    accentText: 'text-emerald-500',
    accentBg: 'bg-emerald-500/10',
    accentBorder: 'border-emerald-500/40',
    icon: <BookOpen className="w-4 h-4" />
  }
};

export const ProfileView: React.FC<ProfileViewProps> = ({ user, onOpenAuth, onOpenAvatarModal }) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('all');
  const allScores = getLocalScores();
  const { isDark } = useTheme();

  // Match scores belonging to the current user (including guest <-> guest_default) and exclude global demo seeds
  const userScores = useMemo(() => {
    const filtered = user
      ? allScores.filter(
          s =>
            s.uid === user.uid ||
            s.displayName === user.displayName ||
            (user.uid === 'guest_default' && s.uid === 'guest')
        )
      : allScores.filter(s => !s.uid.startsWith('seed_'));

    return [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [allScores, user]);

  // Group all scores into categories and compute stats for each
  const categoryStats = useMemo(() => {
    const groups: Record<SpecificCategoryKey, ScoreRecord[]> = {
      ranked: [],
      tests: [],
      game: [],
      lesson: []
    };

    for (const s of userScores) {
      groups[getScoreCategory(s)].push(s);
    }

    const computeSummary = (records: ScoreRecord[]) => {
      const count = records.length;
      const passedCount = records.filter(r => r.passed).length;
      const bestScore = records.reduce((m, r) => Math.max(m, r.score), 0);
      const bestWpm = records.reduce((m, r) => Math.max(m, r.netWpm), 0);
      const avgWpm = count > 0 ? Math.round(records.reduce((sum, r) => sum + r.netWpm, 0) / count) : 0;
      const bestAccuracy = records.reduce((m, r) => Math.max(m, r.accuracy), 0);
      const avgAccuracy = count > 0 ? Math.round(records.reduce((sum, r) => sum + r.accuracy, 0) / count) : 0;
      return { count, passedCount, bestScore, bestWpm, avgWpm, bestAccuracy, avgAccuracy, records };
    };

    return {
      ranked: computeSummary(groups.ranked),
      tests: computeSummary(groups.tests),
      game: computeSummary(groups.game),
      lesson: computeSummary(groups.lesson)
    };
  }, [userScores]);

  const filteredHistory = useMemo(() => {
    if (selectedCategory === 'all') return userScores;
    return categoryStats[selectedCategory].records;
  }, [selectedCategory, userScores, categoryStats]);

  const totalPlayed = userScores.length;
  const passedCount = userScores.filter(s => s.passed).length;
  const bestScore = userScores.reduce((max, s) => Math.max(max, s.score), 0);
  const bestWpm = userScores.reduce((max, s) => Math.max(max, s.netWpm), 0);
  const bestAccuracy = userScores.reduce((max, s) => Math.max(max, s.accuracy), 0);

  // Recent rounds for the mini chart (respecting selected category)
  const chartSource = filteredHistory.length > 0 ? filteredHistory : userScores;
  const recentChart = [...chartSource].slice(0, 12).reverse();
  const maxWpmInRecent = Math.max(...recentChart.map(s => s.netWpm), 60);

  // Gamification Badges
  const badges = [
    {
      title: 'ก้าวแรกสู่นักพิมพ์',
      desc: 'เล่นจบอย่างน้อย 1 ด่าน',
      achieved: totalPlayed >= 1,
      icon: '🌱'
    },
    {
      title: 'แม่นยำดั่งจับวาง',
      desc: 'ทำความแม่นยำได้ 95% ขึ้นไป',
      achieved: bestAccuracy >= 95,
      icon: '🎯'
    },
    {
      title: 'ลมกรดติดสปีด',
      desc: 'ทำความเร็วทะลุ 40 WPM',
      achieved: bestWpm >= 40,
      icon: '⚡'
    },
    {
      title: 'ระดับมือโปร',
      desc: 'ผ่านครบ 5 ด่านขึ้นไป',
      achieved: passedCount >= 5,
      icon: '🏆'
    }
  ];

  const getItemBadge = (s: ScoreRecord) => {
    if (s.gameMode === 'pretest' || s.testType === 'PRE_TEST') {
      return { text: '📝 แบบทดสอบก่อนเรียน', cls: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
    }
    if (s.gameMode === 'posttest' || s.testType === 'POST_TEST') {
      return { text: '🎓 แบบทดสอบหลังเรียน', cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' };
    }
    if (s.gameMode === 'ranked' || s.testType === 'RANKED') {
      return { text: '🏆 ประลองจัดอันดับ', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' };
    }
    if (s.gameMode === 'lesson' || s.gameMode === 'practice') {
      return { text: '📚 ศูนย์การเรียนรู้', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' };
    }
    return { text: '🎮 โหมดเกม 10 ด่าน', cls: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30' };
  };

  const completionInfo = useMemo(() => getCurriculumCompletion(userScores), [userScores]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Profile Header Card */}
      <div
        className={`border rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          {/* Avatar display with click-to-change */}
          <div
            onClick={onOpenAvatarModal}
            className="cursor-pointer group relative hover:scale-105 transition-transform shrink-0"
            title="คลิกเพื่อเปลี่ยนรูปโปรไฟล์"
          >
            <UserAvatar
              avatar={user?.avatar}
              name={user?.displayName || user?.fullName || ''}
              gradient={user?.avatarBg || 'from-cyan-500 via-blue-600 to-indigo-600'}
              size="xl"
            />
            <div className="absolute inset-0 bg-slate-950/60 rounded-3xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-bold transition-opacity">
              เปลี่ยนรูป
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {user ? (user.fullName || user.displayName) : 'ผู้ใช้งานทั่วไป (Guest Player)'}
              </h1>
              {completionInfo.isGrandComplete && (
                <span className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-400 text-xs font-black shadow-sm">
                  <img
                    src={GRAND_MEDAL_IMAGE_PATH}
                    alt="100% Master"
                    className="w-5 h-5 rounded-full object-cover"
                  />
                  <span>พิชิตครบ 100%</span>
                </span>
              )}
              {user?.studentId && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-mono font-bold">
                  รหัส: {user.studentId}
                </span>
              )}
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-300'
                    : 'bg-slate-100 border-slate-300 text-slate-700'
                }`}
              >
                {user?.classroom || (user?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'นักเรียน')}
              </span>
            </div>

            <p className={`text-xs mt-1.5 flex items-center justify-center sm:justify-start gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {user
                    ? `สมัครเมื่อ ${new Date(user.createdAt).toLocaleDateString('th-TH')}`
                    : 'เข้าสู่ระบบด้วยรหัสนักเรียนเพื่อบันทึกประวัติการเล่นถาวร'}
                </span>
              </span>
              {user?.displayName && user.displayName !== user.fullName && (
                <span>• ชื่อในเกม: <strong>{user.displayName}</strong></span>
              )}
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <button
                type="button"
                onClick={onOpenAvatarModal}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-750 text-cyan-300 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-cyan-700 border-slate-300'
                }`}
              >
                <span>🎨 เปลี่ยนรูปโปรไฟล์</span>
              </button>

              <button
                type="button"
                onClick={onOpenAuth}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                <span>{user?.studentId ? 'สลับบัญชีผู้ใช้' : 'เข้าสู่ระบบ'}</span>
              </button>
            </div>
          </div>
        </div>

        {(!user || !user.studentId) && (
          <button
            onClick={onOpenAuth}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all hover:scale-105"
          >
            เข้าสู่ระบบ
          </button>
        )}
      </div>

      {/* 4 Core Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          className={`border rounded-3xl p-5 transition-all duration-300 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ทดสอบผ่าน / ทั้งหมด</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-black font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {passedCount} <span className="text-xs font-normal text-slate-500">/ {totalPlayed}</span>
          </div>
        </div>

        <div
          className={`border rounded-3xl p-5 transition-all duration-300 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>คะแนนสูงสุดรวม</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-500 font-mono">
            {bestScore}
          </div>
        </div>

        <div
          className={`border rounded-3xl p-5 transition-all duration-300 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ความเร็วสูงสุด</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-500 font-mono">
            {bestWpm} <span className="text-xs font-normal text-slate-500">WPM</span>
          </div>
        </div>

        <div
          className={`border rounded-3xl p-5 transition-all duration-300 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Accuracy สูงสุด</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-500 font-mono">
            {bestAccuracy}%
          </div>
        </div>
      </div>

      {/* Category Summary Grid (แบ่งสถิติตามหมวดหมู่) */}
      <div
        className={`border rounded-3xl p-6 sm:p-8 shadow-xl transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h3 className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <Layers className="w-5 h-5 text-cyan-500" />
              <span>สถิติทั้งหมดแยกตามหมวดหมู่ (Category Statistics)</span>
            </h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              บันทึกผลการทดสอบทั้งหมดไว้ครบถ้วน คลิกที่การ์ดหมวดหมู่เพื่อดูประวัติเฉพาะหมวดนั้น
            </p>
          </div>
          <span className={`text-xs font-mono px-3 py-1 rounded-full border self-start ${isDark ? 'bg-slate-950 border-slate-800 text-cyan-300' : 'bg-slate-100 border-slate-200 text-cyan-700'}`}>
            รวมทั้งหมด {totalPlayed} ครั้ง
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(['ranked', 'tests', 'game', 'lesson'] as SpecificCategoryKey[]).map(catKey => {
            const meta = CATEGORY_META[catKey];
            const stat = categoryStats[catKey];
            const isSelected = selectedCategory === catKey;

            return (
              <button
                key={catKey}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? 'all' : catKey)}
                className={`text-left p-4 rounded-2xl border-2 transition-all hover:scale-[1.01] ${
                  isSelected
                    ? `${meta.accentBorder} ${meta.accentBg} ring-2 ring-cyan-400/30`
                    : isDark
                    ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${meta.accentBg} ${meta.accentText}`}>
                    {meta.icon}
                  </div>
                  <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${meta.accentBg} ${meta.accentText}`}>
                    {stat.count} ครั้ง
                  </span>
                </div>

                <div className={`font-bold text-sm mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {meta.shortLabel}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div className={`p-2 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <span className="text-[10px] font-sans text-slate-400 block">สูงสุด</span>
                    <span className="text-xs font-black text-amber-500">{stat.bestScore}</span>
                  </div>
                  <div className={`p-2 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <span className="text-[10px] font-sans text-slate-400 block">WPM สูงสุด</span>
                    <span className="text-xs font-black text-blue-500">{stat.bestWpm}</span>
                  </div>
                  <div className={`p-2 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <span className="text-[10px] font-sans text-slate-400 block">แม่นยำเฉลี่ย</span>
                    <span className="text-xs font-black text-emerald-500">{stat.avgAccuracy}%</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Activity Medals (Pretest, Learning Center, 10-Level Master, Posttest) & Numbered Level 1-10 Medals */}
      <MedalShowcase userScores={userScores} />

      {/* Visual Progression Speed Chart (SVG/CSS) */}
      <div
        className={`border rounded-3xl p-6 sm:p-8 shadow-xl transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <Flame className="w-5 h-5 text-cyan-500" />
              <span>
                กราฟพัฒนาการความเร็วในการพิมพ์{' '}
                {selectedCategory !== 'all' ? `(${CATEGORY_META[selectedCategory].shortLabel})` : '(รวมทุกหมวดหมู่)'}
              </span>
            </h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              แสดงการพัฒนาความเร็วในแต่ละรอบการฝึกฝนและทดสอบย้อนหลัง
            </p>
          </div>
        </div>

        {recentChart.length > 0 ? (
          <div className="space-y-4">
            <div
              className={`h-44 flex items-end gap-2 sm:gap-3 pt-6 border-b ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              {recentChart.map((record, idx) => {
                const heightPercent = Math.max(15, Math.round((record.netWpm / maxWpmInRecent) * 100));
                return (
                  <div key={record.scoreId || idx} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                    {/* Tooltip */}
                    <div
                      className={`opacity-0 group-hover:opacity-100 absolute -top-8 border text-[10px] py-1 px-2 rounded-lg whitespace-nowrap transition-opacity pointer-events-none z-20 font-mono shadow-md ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-cyan-300'
                          : 'bg-white border-slate-300 text-cyan-700'
                      }`}
                    >
                      {record.netWpm} WPM ({record.accuracy}%)
                    </div>

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[40px] bg-gradient-to-t from-cyan-600 to-blue-500 rounded-t-lg group-hover:from-cyan-400 group-hover:to-blue-400 transition-all shadow-md shadow-cyan-500/10"
                    />

                    <span className="text-[10px] text-slate-500 font-mono truncate max-w-full">
                      #{idx + 1}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className={`flex items-center justify-between text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>รอบการเล่นก่อนหน้า ➔</span>
              <span>รอบล่าสุด 🎯</span>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 text-xs">
            ยังไม่มีประวัติการเล่นในหมวดหมู่นี้
          </div>
        )}
      </div>

      {/* Badges Section */}
      <div
        className={`border rounded-3xl p-6 sm:p-8 shadow-xl transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <Medal className="w-5 h-5 text-amber-500" />
          <span>เหรียญรางวัลความสำเร็จ (Achievements)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {badges.map((b, i) => (
            <div
              key={i}
              className={`p-4 rounded-2xl border transition-all ${
                b.achieved
                  ? isDark
                    ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                    : 'bg-amber-50 border-amber-300 text-amber-800'
                  : isDark
                  ? 'bg-slate-950/40 border-slate-800 text-slate-600 opacity-60'
                  : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60'
              }`}
            >
              <div className="text-3xl mb-2">{b.icon}</div>
              <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{b.title}</h4>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{b.desc}</p>
              <div className="mt-3">
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    b.achieved
                      ? 'bg-amber-500/20 text-amber-600 border border-amber-500/30'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {b.achieved ? 'ปลดล็อกแล้ว ✓' : 'ยังไม่ปลดล็อก'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full Categorized History List (ALL stored records, never truncated) */}
      <div
        className={`border rounded-3xl p-6 sm:p-8 shadow-xl transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <History className="w-5 h-5 text-cyan-500" />
              <span>ประวัติการทดสอบทั้งหมด ({filteredHistory.length} รายการ)</span>
            </h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              เก็บสถิติการทดสอบและฝึกพิมพ์ทั้งหมดแยกตามหมวดหมู่
            </p>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : isDark
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด ({userScores.length})
            </button>
            {(['ranked', 'tests', 'game', 'lesson'] as SpecificCategoryKey[]).map(catKey => (
              <button
                key={catKey}
                type="button"
                onClick={() => setSelectedCategory(catKey)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                  selectedCategory === catKey
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : isDark
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {CATEGORY_META[catKey].shortLabel} ({categoryStats[catKey].count})
              </button>
            ))}
          </div>
        </div>

        <div className={`divide-y ${isDark ? 'divide-slate-800/80' : 'divide-slate-200'}`}>
          {filteredHistory.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              ยังไม่มีประวัติการทดสอบในหมวดหมู่นี้
            </div>
          ) : (
            filteredHistory.map((score, idx) => {
              const badge = getItemBadge(score);
              return (
                <div key={score.scoreId || idx} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.cls}`}>
                        {badge.text}
                      </span>
                      <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {score.levelTitle}
                      </span>
                      {score.rankTier && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30">
                          {score.rankTier}
                        </span>
                      )}
                    </div>
                    <div className={`text-[11px] mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <span>{new Date(score.createdAt).toLocaleString('th-TH')}</span>
                      <span>• {score.language === 'th' ? '🇹🇭 ภาษาไทย' : '🇬🇧 EN'}</span>
                      <span>• เวลา {score.timeTakenSeconds}s</span>
                      <span>
                        • ถูก <strong className="text-emerald-500">{score.correctCharacters}</strong> / ผิด{' '}
                        <strong className="text-rose-500">{score.incorrectCharacters}</strong> ตัว
                      </span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right font-mono shrink-0">
                    <div className={`font-black text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`}>
                      {score.score} คะแนน
                    </div>
                    <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {score.netWpm} WPM • {score.accuracy}% Acc
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
