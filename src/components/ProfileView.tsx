import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Layers,
  RefreshCw,
  CloudCheck,
  Sparkles,
  Building2,
  Check,
  TrendingUp,
  ArrowRight,
  Keyboard
} from 'lucide-react';
import { PrePostComparisonRecord, ScoreRecord, User, UserMedalProfile } from '../types';
import {
  CLASSROOM_OPTIONS,
  getLocalScores,
  getUserMedalProfile,
  getUserPrePostComparison,
  isRecordOwnedByUser,
  subscribeUserDataUpdates,
  apiSyncUserAccountData,
  apiUpdateStudentClassroom
} from '../utils/googleSheets';
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
  onUserUpdated?: (user: User) => void;
  onOpenGrandCelebration?: () => void;
  onNavigateTab?: (tab: string) => void;
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

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onOpenAuth,
  onOpenAvatarModal,
  onUserUpdated,
  onOpenGrandCelebration,
  onNavigateTab
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('all');
  const [dataRevision, setDataRevision] = useState(0);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Classroom selector state (preset + custom room)
  const [isSavingClassroom, setIsSavingClassroom] = useState(false);
  const [classroomNotice, setClassroomNotice] = useState<string | null>(null);
  const [isCustomRoomMode, setIsCustomRoomMode] = useState(false);
  const [customRoomInput, setCustomRoomInput] = useState('');

  const { isDark } = useTheme();

  // Realtime subscription to local + cross-tab + Sheets sync updates
  useEffect(() => {
    const unsubscribe = subscribeUserDataUpdates(() => {
      setDataRevision(prev => prev + 1);
    });
    return unsubscribe;
  }, []);

  const handleSyncFromGoogleSheet = useCallback(async (showFeedback: boolean = false) => {
    if (!user || user.username === 'guest') return;
    setIsSyncingSheet(true);
    try {
      const res = await apiSyncUserAccountData(user);
      if (
        res.updatedUser &&
        (res.updatedUser.classroom !== user.classroom ||
          res.updatedUser.avatar !== user.avatar ||
          res.updatedUser.avatarBg !== user.avatarBg)
      ) {
        onUserUpdated?.(res.updatedUser);
      }
      setDataRevision(prev => prev + 1);
      setLastSyncedAt(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      if (showFeedback) {
        setSyncMessage(
          res.syncedFromSheet
            ? 'ซิงค์ข้อมูล ห้องเรียน และเหรียญตรากับ Google Sheets ล่าสุดเรียบร้อยแล้ว'
            : 'แสดงข้อมูลล่าสุดจากในเครื่อง (รอการเชื่อมต่อ Google Sheets)'
        );
        window.setTimeout(() => setSyncMessage(null), 3500);
      }
    } finally {
      setIsSyncingSheet(false);
    }
  }, [user, onUserUpdated]);

  const handleUpdateClassroom = useCallback(
    async (nextRoomRaw: string) => {
      if (!user || user.username === 'guest') return;
      const cleanRoom = nextRoomRaw.trim();
      if (!cleanRoom) return;

      setIsSavingClassroom(true);
      setClassroomNotice(null);
      try {
        const res = await apiUpdateStudentClassroom(user, cleanRoom);
        onUserUpdated?.(res.user);
        setDataRevision(prev => prev + 1);
        setIsCustomRoomMode(false);
        setCustomRoomInput('');
        setLastSyncedAt(
          new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
        setClassroomNotice(
          res.syncedToSheet
            ? `อัปเดตห้องเรียน "${cleanRoom}" ลง Google Sheets เรียบร้อยแล้ว`
            : `บันทึกห้องเรียน "${cleanRoom}" แล้ว (จะซิงค์ไปยัง Google Sheets อัตโนมัติ)`
        );
        window.setTimeout(() => setClassroomNotice(null), 4000);
      } finally {
        setIsSavingClassroom(false);
      }
    },
    [user, onUserUpdated]
  );

  const availableClassroomOptions = useMemo(() => {
    const list: string[] = [...CLASSROOM_OPTIONS];
    if (user?.classroom && !list.includes(user.classroom)) {
      list.unshift(user.classroom);
    }
    return list;
  }, [user?.classroom]);

  // Auto-sync with Google Sheets when entering profile, switching accounts, returning to tab, and periodically (realtime)
  useEffect(() => {
    if (!user || user.username === 'guest') return;
    handleSyncFromGoogleSheet(false);

    const onFocus = () => handleSyncFromGoogleSheet(false);
    window.addEventListener('focus', onFocus);
    const pollTimer = window.setInterval(() => {
      handleSyncFromGoogleSheet(false);
    }, 20000);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(pollTimer);
    };
  }, [user, handleSyncFromGoogleSheet]);

  const allScores = useMemo(() => getLocalScores(), [dataRevision]);
  const savedMedalProfile: UserMedalProfile | null = useMemo(
    () => getUserMedalProfile(user),
    [user, dataRevision]
  );

  // Match scores belonging to the current user (by uid, studentId, username, or displayName) and exclude global demo seeds
  const userScores = useMemo(() => {
    const filtered = user
      ? allScores.filter(s => isRecordOwnedByUser(s, user))
      : allScores.filter(s => !s.uid.startsWith('seed_'));

    return [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [allScores, user]);

  // Dedicated Pre-Test vs Post-Test comparison record (synced with Google Sheets PrePostTests)
  const prePostComparison: PrePostComparisonRecord | null = useMemo(() => {
    if (!user) return null;
    return getUserPrePostComparison(user, userScores);
  }, [user, userScores, dataRevision]);

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
  const bestScore = Math.max(savedMedalProfile?.bestScore || 0, userScores.reduce((max, s) => Math.max(max, s.score), 0));
  const bestWpm = Math.max(savedMedalProfile?.bestWpm || 0, userScores.reduce((max, s) => Math.max(max, s.netWpm), 0));
  const bestAccuracy = Math.max(savedMedalProfile?.bestAccuracy || 0, userScores.reduce((max, s) => Math.max(max, s.accuracy), 0));

  // Recent rounds for the mini chart (respecting selected category)
  const chartSource = filteredHistory.length > 0 ? filteredHistory : userScores;
  const recentChart = [...chartSource].slice(0, 12).reverse();
  const maxWpmInRecent = Math.max(...recentChart.map(s => s.netWpm), 60);

  const savedAchIds = new Set(savedMedalProfile?.achievementIds || []);

  // Gamification Badges (merged with persisted achievements)
  const badges = [
    {
      title: 'ก้าวแรกสู่นักพิมพ์',
      desc: 'เล่นจบอย่างน้อย 1 ด่าน',
      achieved: totalPlayed >= 1 || savedAchIds.has('first_step'),
      icon: '🌱'
    },
    {
      title: 'แม่นยำดั่งจับวาง',
      desc: 'ทำความแม่นยำได้ 95% ขึ้นไป',
      achieved: bestAccuracy >= 95 || savedAchIds.has('sharpshooter_95'),
      icon: '🎯'
    },
    {
      title: 'ลมกรดติดสปีด',
      desc: 'ทำความเร็วทะลุ 40 WPM',
      achieved: bestWpm >= 40 || savedAchIds.has('speed_40'),
      icon: '⚡'
    },
    {
      title: 'ระดับมือโปร',
      desc: 'ผ่านครบ 5 ด่านขึ้นไป',
      achieved: passedCount >= 5 || savedAchIds.has('pro_5_passed'),
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

  const completionInfo = useMemo(
    () => getCurriculumCompletion(userScores, savedMedalProfile),
    [userScores, savedMedalProfile]
  );

  const earnedMedalsList = savedMedalProfile?.earnedMedals || [];
  const totalPossibleMedals = 19; // 1 Grand + 4 Activity + 10 Level + 4 Achievement

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
              seed={user?.uid || user?.studentId || user?.displayName || ''}
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
                <button
                  type="button"
                  onClick={() => onOpenGrandCelebration?.()}
                  title="คลิกเพื่อดูคำแสดงความยินดี 100%"
                  className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-400 text-xs font-black shadow-sm transition-colors cursor-pointer"
                >
                  <img
                    src={GRAND_MEDAL_IMAGE_PATH}
                    alt="100% Master"
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover"
                  />
                  <span>พิชิตครบ 100%</span>
                </button>
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
                    ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700'
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
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                <span>{user?.studentId ? 'สลับบัญชีผู้ใช้' : 'เข้าสู่ระบบ'}</span>
              </button>

              {user && user.username !== 'guest' && (
                <button
                  type="button"
                  onClick={() => handleSyncFromGoogleSheet(true)}
                  disabled={isSyncingSheet}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all disabled:opacity-60 ${
                    isDark
                      ? 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-500/30'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-spin' : ''}`} />
                  <span>{isSyncingSheet ? 'กำลังซิงค์ Google Sheets...' : 'ซิงค์ข้อมูล Google Sheets'}</span>
                </button>
              )}
            </div>

            {/* Classroom Selector (เลือก/เปลี่ยนห้องเรียนแบบ Realtime + ซิงค์ Google Sheets & หน้าครูผู้สอน) */}
            {user && user.username !== 'guest' && user.role !== 'teacher' && user.role !== 'admin' && (
              <div
                className={`mt-4 p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center gap-2.5 text-left ${
                  isDark
                    ? 'bg-slate-950/70 border-slate-800'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-500 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      เลือกห้องเรียนของคุณ
                    </div>
                    <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      อัปเดตลง Google Sheets และจัดกลุ่มในหน้าครูผู้สอนอัตโนมัติ
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                  {!isCustomRoomMode ? (
                    <select
                      aria-label="เลือกห้องเรียน"
                      value={user.classroom || 'ทั่วไป'}
                      disabled={isSavingClassroom}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setIsCustomRoomMode(true);
                          setCustomRoomInput(
                            user.classroom && user.classroom !== 'ทั่วไป' ? user.classroom : ''
                          );
                          return;
                        }
                        handleUpdateClassroom(val);
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60 ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-cyan-300'
                          : 'bg-white border-slate-300 text-cyan-700'
                      }`}
                    >
                      {availableClassroomOptions.map(room => (
                        <option key={room} value={room}>
                          ห้อง {room}
                        </option>
                      ))}
                      <option value="__custom__">+ ระบุชื่อห้องเรียนเอง...</option>
                    </select>
                  ) : (
                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        if (customRoomInput.trim()) {
                          handleUpdateClassroom(customRoomInput);
                        }
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        value={customRoomInput}
                        onChange={e => setCustomRoomInput(e.target.value)}
                        placeholder="เช่น ปวช.1/2 หรือ ปวส.1/1"
                        autoFocus
                        className={`w-40 px-2.5 py-1.5 rounded-xl border text-xs focus:outline-none focus:border-cyan-500 ${
                          isDark
                            ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                            : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                        }`}
                      />
                      <button
                        type="submit"
                        disabled={isSavingClassroom || !customRoomInput.trim()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>บันทึก</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomRoomMode(false);
                          setCustomRoomInput('');
                        }}
                        className={`px-2 py-1.5 rounded-xl text-xs font-semibold ${
                          isDark
                            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        ยกเลิก
                      </button>
                    </form>
                  )}

                  {isSavingClassroom && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-500">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>กำลังอัปเดต...</span>
                    </span>
                  )}

                  {classroomNotice && !isSavingClassroom && (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-semibold ${
                        isDark
                          ? 'bg-emerald-950/60 border-emerald-500/35 text-emerald-300'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{classroomNotice}</span>
                    </span>
                  )}
                </div>
              </div>
            )}
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

      {/* Dedicated Pre-Test vs Post-Test Score Comparison Card */}
      <div
        className={`border rounded-3xl p-6 sm:p-8 shadow-xl transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className={`text-lg font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <TrendingUp className="w-5 h-5 text-cyan-500" />
              <span>ผลการทดสอบและเปรียบเทียบ Pre-Test / Post-Test</span>
            </h3>
            <p className={`text-xs mt-1 flex items-center gap-1.5 flex-wrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <CloudCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>บันทึกคะแนนอัตโนมัติลง Google Sheets และส่งเข้าแดชบอร์ดครูผู้สอนเพื่อเปรียบเทียบพัฒนาการ</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start">
            {prePostComparison &&
            prePostComparison.pretestQuizScore !== null &&
            prePostComparison.posttestQuizScore !== null ? (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${
                  isDark
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>สอบครบทั้ง Pre-Test และ Post-Test แล้ว</span>
              </span>
            ) : prePostComparison && prePostComparison.pretestQuizScore !== null ? (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${
                  isDark
                    ? 'bg-sky-950/60 border-sky-500/40 text-sky-300'
                    : 'bg-sky-50 border-sky-300 text-sky-700'
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>ทำ Pre-Test แล้ว · รอทำ Post-Test</span>
              </span>
            ) : (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-slate-400'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <span>ยังไม่ได้ทำแบบทดสอบก่อนเรียน</span>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Panel 1: 10-Question Knowledge Quiz Exam */}
          {(() => {
            const preQuiz = prePostComparison?.pretestQuizScore ?? null;
            const postQuiz = prePostComparison?.posttestQuizScore ?? null;
            const totalQ = prePostComparison?.posttestQuizTotal || prePostComparison?.pretestQuizTotal || 10;
            const quizDiff =
              preQuiz !== null && postQuiz !== null ? postQuiz - preQuiz : null;
            const prePct = preQuiz !== null ? Math.round((preQuiz / totalQ) * 100) : 0;
            const postPct = postQuiz !== null ? Math.round((postQuiz / totalQ) * 100) : 0;

            return (
              <div
                className={`rounded-2xl border p-5 flex flex-col justify-between ${
                  isDark
                    ? 'bg-slate-950/70 border-slate-800'
                    : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-500 flex items-center justify-center">
                        <ClipboardCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          ข้อสอบความรู้ ปวช.3 (10 ข้อ)
                        </h4>
                        <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          เปรียบเทียบคะแนนก่อนเรียนและหลังเรียน
                        </p>
                      </div>
                    </div>

                    {quizDiff !== null && (
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono tabular-nums font-bold ${
                          quizDiff > 0
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : quizDiff < 0
                            ? 'bg-rose-500/15 text-rose-500'
                            : isDark
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {quizDiff > 0
                          ? `+${quizDiff} คะแนน (พัฒนาขึ้น)`
                          : quizDiff < 0
                          ? `${quizDiff} คะแนน (ควรทบทวน)`
                          : '0 คะแนน (เท่าเดิม)'}
                      </span>
                    )}
                  </div>

                  {/* 3 Metric Boxes */}
                  <div className="grid grid-cols-3 gap-2.5 mb-4 font-mono tabular-nums">
                    <div
                      className={`p-3 rounded-xl border ${
                        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className={`text-[11px] font-sans ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Pre-Test (ก่อนเรียน)
                      </div>
                      <div className={`text-xl font-black mt-1 ${preQuiz !== null ? 'text-sky-500' : 'text-slate-500'}`}>
                        {preQuiz !== null ? (
                          <>
                            {preQuiz}
                            <span className="text-xs font-normal opacity-65">/{totalQ}</span>
                          </>
                        ) : (
                          '-'
                        )}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        {preQuiz !== null
                          ? `${prePct}%${
                              prePostComparison?.pretestQuizDate
                                ? ` · ${new Date(prePostComparison.pretestQuizDate).toLocaleDateString('th-TH', {
                                    day: 'numeric',
                                    month: 'short'
                                  })}`
                                : ''
                            }`
                          : 'ยังไม่สอบ'}
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-xl border ${
                        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className={`text-[11px] font-sans ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Post-Test (หลังเรียน)
                      </div>
                      <div className={`text-xl font-black mt-1 ${postQuiz !== null ? 'text-amber-500' : 'text-slate-500'}`}>
                        {postQuiz !== null ? (
                          <>
                            {postQuiz}
                            <span className="text-xs font-normal opacity-65">/{totalQ}</span>
                          </>
                        ) : (
                          '-'
                        )}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        {postQuiz !== null
                          ? `${postPct}%${
                              prePostComparison?.posttestQuizDate
                                ? ` · ${new Date(prePostComparison.posttestQuizDate).toLocaleDateString('th-TH', {
                                    day: 'numeric',
                                    month: 'short'
                                  })}`
                                : ''
                            }`
                          : 'ยังไม่สอบ'}
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-xl border ${
                        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className={`text-[11px] font-sans ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        ผลต่างพัฒนาการ
                      </div>
                      <div
                        className={`text-xl font-black mt-1 ${
                          quizDiff === null
                            ? 'text-slate-500'
                            : quizDiff > 0
                            ? 'text-emerald-500'
                            : quizDiff < 0
                            ? 'text-rose-500'
                            : 'text-cyan-500'
                        }`}
                      >
                        {quizDiff !== null ? (quizDiff > 0 ? `+${quizDiff}` : `${quizDiff}`) : '-'}
                      </div>
                      <div className={`text-[10px] font-sans mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        {quizDiff !== null
                          ? `${postPct - prePct >= 0 ? '+' : ''}${postPct - prePct}%`
                          : 'รอสอบครบคู่'}
                      </div>
                    </div>
                  </div>

                  {/* Dual Visual Progress Comparison Bar */}
                  <div className="space-y-2 mb-4">
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>ก่อนเรียน (Pre-Test)</span>
                        <span className="font-mono tabular-nums font-bold text-sky-500">
                          {preQuiz !== null ? `${preQuiz}/${totalQ} (${prePct}%)` : 'ยังไม่มีคะแนน'}
                        </span>
                      </div>
                      <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                        <div
                          className="h-full rounded-full bg-sky-500 transition-all duration-500"
                          style={{ width: `${preQuiz !== null ? Math.max(prePct, 4) : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>หลังเรียน (Post-Test)</span>
                        <span className="font-mono tabular-nums font-bold text-amber-500">
                          {postQuiz !== null ? `${postQuiz}/${totalQ} (${postPct}%)` : 'ยังไม่มีคะแนน'}
                        </span>
                      </div>
                      <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            quizDiff !== null && quizDiff > 0
                              ? 'bg-gradient-to-r from-amber-500 to-emerald-500'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${postQuiz !== null ? Math.max(postPct, 4) : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Action Links */}
                {onNavigateTab && (
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-500/15">
                    <button
                      type="button"
                      onClick={() => onNavigateTab('pretest')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                        isDark
                          ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-sky-300'
                          : 'bg-white hover:bg-sky-50 border-slate-300 text-sky-700'
                      }`}
                    >
                      <span>{preQuiz !== null ? 'ทำ Pre-Test ใหม่' : 'เริ่มทำ Pre-Test'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('posttest')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                        isDark
                          ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-amber-300'
                          : 'bg-white hover:bg-amber-50 border-slate-300 text-amber-700'
                      }`}
                    >
                      <span>{postQuiz !== null ? 'ทำ Post-Test ใหม่' : 'ไปทำ Post-Test'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Panel 2: Practical Typing Pre-Test vs Post-Test */}
          {(() => {
            const preWpm = prePostComparison?.pretestTypingWpm ?? null;
            const preAcc = prePostComparison?.pretestTypingAccuracy ?? null;
            const postWpm = prePostComparison?.posttestTypingWpm ?? null;
            const postAcc = prePostComparison?.posttestTypingAccuracy ?? null;
            const wpmDiff =
              preWpm !== null && postWpm !== null ? postWpm - preWpm : null;
            const accDiff =
              preAcc !== null && postAcc !== null ? postAcc - preAcc : null;
            const maxWpmScale = Math.max(preWpm || 0, postWpm || 0, 40);

            return (
              <div
                className={`rounded-2xl border p-5 flex flex-col justify-between ${
                  isDark
                    ? 'bg-slate-950/70 border-slate-800'
                    : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                        <Keyboard className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          ทดสอบพิมพ์จับเวลาปฏิบัติ (Typing Test)
                        </h4>
                        <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          เปรียบเทียบความเร็ว (WPM) และความแม่นยำก่อน-หลังเรียน
                        </p>
                      </div>
                    </div>

                    {wpmDiff !== null && (
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono tabular-nums font-bold ${
                          wpmDiff > 0
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : wpmDiff < 0
                            ? 'bg-rose-500/15 text-rose-500'
                            : isDark
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {wpmDiff > 0 ? `+${wpmDiff} WPM` : `${wpmDiff} WPM`}
                      </span>
                    )}
                  </div>

                  {/* 3 Metric Boxes */}
                  <div className="grid grid-cols-3 gap-2.5 mb-4 font-mono tabular-nums">
                    <div
                      className={`p-3 rounded-xl border ${
                        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className={`text-[11px] font-sans ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Pre-Test พิมพ์
                      </div>
                      <div className={`text-xl font-black mt-1 ${preWpm !== null ? 'text-sky-500' : 'text-slate-500'}`}>
                        {preWpm !== null ? (
                          <>
                            {preWpm}
                            <span className="text-[11px] font-normal opacity-70 ml-0.5">WPM</span>
                          </>
                        ) : (
                          '-'
                        )}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        {preAcc !== null ? `แม่นยำ ${preAcc}%` : 'ยังไม่ทดสอบ'}
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-xl border ${
                        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className={`text-[11px] font-sans ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Post-Test พิมพ์
                      </div>
                      <div className={`text-xl font-black mt-1 ${postWpm !== null ? 'text-emerald-500' : 'text-slate-500'}`}>
                        {postWpm !== null ? (
                          <>
                            {postWpm}
                            <span className="text-[11px] font-normal opacity-70 ml-0.5">WPM</span>
                          </>
                        ) : (
                          '-'
                        )}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        {postAcc !== null ? `แม่นยำ ${postAcc}%` : 'ยังไม่ทดสอบ'}
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-xl border ${
                        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className={`text-[11px] font-sans ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        พัฒนาการพิมพ์
                      </div>
                      <div
                        className={`text-xl font-black mt-1 ${
                          wpmDiff === null
                            ? 'text-slate-500'
                            : wpmDiff > 0
                            ? 'text-emerald-500'
                            : wpmDiff < 0
                            ? 'text-rose-500'
                            : 'text-cyan-500'
                        }`}
                      >
                        {wpmDiff !== null ? (wpmDiff > 0 ? `+${wpmDiff}` : `${wpmDiff}`) : '-'}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        {accDiff !== null
                          ? `แม่นยำ ${accDiff > 0 ? `+${accDiff}%` : `${accDiff}%`}`
                          : 'รอครบ Pre & Post'}
                      </div>
                    </div>
                  </div>

                  {/* Dual WPM Comparison Bars */}
                  <div className="space-y-2 mb-4">
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>พิมพ์ก่อนเรียน (Pre-Test)</span>
                        <span className="font-mono tabular-nums font-bold text-sky-500">
                          {preWpm !== null ? `${preWpm} WPM · ${preAcc ?? 0}%` : 'ยังไม่มีผลทดสอบ'}
                        </span>
                      </div>
                      <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                        <div
                          className="h-full rounded-full bg-sky-500 transition-all duration-500"
                          style={{
                            width: `${preWpm !== null ? Math.max(Math.round((preWpm / maxWpmScale) * 100), 5) : 0}%`
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>พิมพ์หลังเรียน (Post-Test)</span>
                        <span className="font-mono tabular-nums font-bold text-emerald-500">
                          {postWpm !== null ? `${postWpm} WPM · ${postAcc ?? 0}%` : 'ยังไม่มีผลทดสอบ'}
                        </span>
                      </div>
                      <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{
                            width: `${postWpm !== null ? Math.max(Math.round((postWpm / maxWpmScale) * 100), 5) : 0}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`pt-3 border-t border-slate-500/15 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  สลับโหมดเป็น <strong>ทดสอบพิมพ์จับเวลาปฏิบัติ (Typing Test)</strong> ในหน้า Pre-Test หรือ Post-Test เพื่อบันทึกความเร็วเปรียบเทียบเพิ่มเติม
                </div>
              </div>
            );
          })()}
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

      {/* Earned Medals Realtime Summary Banner (แสดงสรุปเหรียญตราที่ได้รับแล้วทั้งหมดของบัญชีนี้) */}
      <div
        className={`border-2 rounded-3xl p-6 sm:p-7 shadow-xl transition-all duration-300 ${
          isDark
            ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 border-cyan-500/30'
            : 'bg-gradient-to-br from-white via-white to-cyan-50/50 border-cyan-200 shadow-slate-200/60'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`text-lg font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span>เหรียญตราที่ได้รับแล้วของคุณ (Earned Medals)</span>
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-amber-500/15 text-amber-500 border border-amber-500/30">
                {earnedMedalsList.length} / {totalPossibleMedals} เหรียญ
              </span>
            </div>
            <p className={`text-xs mt-1 flex items-center gap-1.5 flex-wrap ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              <CloudCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>บันทึกและซิงค์รายบุคคลลง Google Sheets แบบ Realtime เมื่อกลับเข้าบัญชีเดิมเหรียญตราทั้งหมดจะแสดงครบถ้วน</span>
              {lastSyncedAt && (
                <span className="font-mono text-[11px] text-emerald-500 font-semibold">
                  • อัปเดตล่าสุด {lastSyncedAt}
                </span>
              )}
            </p>
          </div>

          {syncMessage && (
            <span
              className={`text-xs px-3 py-1.5 rounded-xl border font-semibold shrink-0 ${
                isDark
                  ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-700'
              }`}
            >
              ✓ {syncMessage}
            </span>
          )}
        </div>

        {earnedMedalsList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {earnedMedalsList.map(medal => {
              const catStyle =
                medal.category === 'grand'
                  ? isDark
                    ? 'bg-emerald-950/40 border-emerald-400/50 text-emerald-200'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : medal.category === 'activity'
                  ? isDark
                    ? 'bg-blue-950/35 border-blue-500/40 text-blue-200'
                    : 'bg-blue-50/80 border-blue-200 text-blue-900'
                  : medal.category === 'level'
                  ? isDark
                    ? 'bg-cyan-950/35 border-cyan-500/35 text-cyan-200'
                    : 'bg-cyan-50/80 border-cyan-200 text-cyan-900'
                  : isDark
                  ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                  : 'bg-amber-50/80 border-amber-200 text-amber-900';

              const catLabel =
                medal.category === 'grand'
                  ? 'เกียรติยศ 100%'
                  : medal.category === 'activity'
                  ? 'เหรียญหมวดกิจกรรม'
                  : medal.category === 'level'
                  ? 'เหรียญด่านเกม'
                  : 'ความสำเร็จ';

              const isGrandMedalItem = medal.category === 'grand' && Boolean(onOpenGrandCelebration);

              return (
                <div
                  key={medal.id}
                  onClick={isGrandMedalItem ? () => onOpenGrandCelebration?.() : undefined}
                  role={isGrandMedalItem ? 'button' : undefined}
                  tabIndex={isGrandMedalItem ? 0 : undefined}
                  onKeyDown={
                    isGrandMedalItem
                      ? e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onOpenGrandCelebration?.();
                          }
                        }
                      : undefined
                  }
                  title={isGrandMedalItem ? 'คลิกเพื่อดูคำแสดงความยินดี 100%' : undefined}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${catStyle} ${
                    isGrandMedalItem ? 'cursor-pointer hover:scale-[1.01] hover:shadow-md' : ''
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-mono font-black shadow-sm ${
                      medal.category === 'level'
                        ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-lg'
                        : medal.category === 'grand'
                        ? 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white text-xl'
                        : isDark
                        ? 'bg-slate-900/90 text-xl'
                        : 'bg-white text-xl'
                    }`}
                  >
                    {medal.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wide opacity-75">
                        {catLabel}
                      </span>
                    </div>
                    <div className={`text-xs sm:text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {medal.title}
                    </div>
                    <div className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {isGrandMedalItem
                        ? 'คลิกเพื่อเปิดดูคำแสดงความยินดี 100%'
                        : `ได้รับเมื่อ ${new Date(medal.earnedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}`}
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className={`rounded-2xl border border-dashed p-6 text-center text-xs ${
              isDark
                ? 'bg-slate-950/40 border-slate-800 text-slate-400'
                : 'bg-slate-50 border-slate-300 text-slate-600'
            }`}
          >
            <p className="font-bold text-sm mb-1">ยังไม่มีเหรียญตราที่ได้รับในบัญชีนี้</p>
            <p>เริ่มทำแบบทดสอบก่อนเรียน (Pre-Test), ศูนย์การเรียนรู้ หรือผ่านด่านเกม 10 ด่าน เพื่อสะสมเหรียญตราแรกของคุณและบันทึกอัตโนมัติลง Google Sheets</p>
          </div>
        )}
      </div>

      {/* Activity Medals (Pretest, Learning Center, 10-Level Master, Posttest) & Numbered Level 1-10 Medals */}
      <MedalShowcase
        userScores={userScores}
        savedMedalProfile={savedMedalProfile}
        onOpenGrandCelebration={onOpenGrandCelebration}
        onNavigateTab={onNavigateTab}
      />

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
