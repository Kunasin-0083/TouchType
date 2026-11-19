import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Download,
  UserPlus,
  BookOpen,
  TrendingUp,
  CheckCircle2,
  Lock,
  Eye,
  X,
  Trash2,
  ArrowUpDown,
  BarChart3,
  ListChecks,
  Award,
  Clock,
  Activity,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FileSpreadsheet,
  Copy,
  Check,
  ClipboardCheck,
  Keyboard,
  KeyRound,
  EyeOff,
  UserX,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import { PrePostComparisonRecord, ScoreRecord, User, UserMedalProfile } from '../types';
import {
  APPS_SCRIPT_CODE_TEMPLATE,
  SHEET_ID,
  getLocalUsers,
  getLocalScores,
  getAllSavedUserMedalProfiles,
  getAllSavedPrePostComparisons,
  getSavedClassroomForUser,
  apiFetchTeacherDashboardData,
  apiRegisterStudent,
  updateStudentClassroom,
  clearStudentScores,
  apiTeacherUpdateUserPassword,
  apiTeacherDeleteUser,
  isRecordOwnedByUser,
  subscribeUserDataUpdates
} from '../utils/googleSheets';
import { LEVELS_CONFIG } from '../data/levels';
import { getCurriculumCompletion, CurriculumCompletionInfo } from './MedalShowcase';
import { UserAvatar } from './UserAvatar';
import { useTheme } from '../context/ThemeContext';

interface TeacherDashboardProps {
  currentUser: User | null;
}

type DashboardView = 'students' | 'prepost' | 'development' | 'summary';
type CompletionFilter = 'all' | 'complete_100' | 'in_progress' | 'not_started';
type PrePostFilter = 'all' | 'paired' | 'pre_only' | 'not_tested' | 'improved';
type SortField = 'name' | 'completion' | 'wpm' | 'accuracy' | 'growth' | 'recent';

interface StudentSummary {
  uid: string;
  studentId: string;
  fullName: string;
  displayName: string;
  classroom: string;
  avatar: string;
  avatarBg: string;
  scores: ScoreRecord[];
  completion: CurriculumCompletionInfo;
  medalProfile: UserMedalProfile | null;
  totalMedalsCount: number;
  pretestQuizScore: number | null;
  posttestQuizScore: number | null;
  examDelta: number | null;
  pretestQuizDate: string | null;
  posttestQuizDate: string | null;
  pretestTypingWpm: number | null;
  pretestTypingAccuracy: number | null;
  posttestTypingWpm: number | null;
  posttestTypingAccuracy: number | null;
  typingTestWpmDelta: number | null;
  typingTestAccDelta: number | null;
  prePostComparison: PrePostComparisonRecord | null;
  rankedBestScore: number;
  firstWpm: number;
  latestWpm: number;
  avgWpm: number;
  bestWpm: number;
  wpmGrowth: number;
  firstAccuracy: number;
  latestAccuracy: number;
  avgAccuracy: number;
  accuracyGrowth: number;
  lastActiveAt: string | null;
  chronologicalTyping: ScoreRecord[];
}

const PRESET_CLASSROOMS = ['ปวช.3/1', 'ปวช.3/2', 'ปวช.3/3', 'ปวช.3/4', 'ปวช.1', 'ปวช.2'];
const AUTO_REFRESH_INTERVAL_MS = 15000;

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'ยังไม่เคยเข้าฝึก';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return '-';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'เมื่อสักครู่';
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ชม. ที่แล้ว`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`;
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = () => {
  const { isDark } = useTheme();
  const [viewMode, setViewMode] = useState<DashboardView>('students');
  const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all');
  const [prePostFilter, setPrePostFilter] = useState<PrePostFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Realtime sync state
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [syncNoticeNeedsScript, setSyncNoticeNeedsScript] = useState(false);
  const syncNoticeTimerRef = useRef<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Remote snapshots merged from Google Sheets
  const [remoteUsers, setRemoteUsers] = useState<User[]>([]);
  const [remoteScores, setRemoteScores] = useState<ScoreRecord[]>([]);
  const [remoteMedalProfiles, setRemoteMedalProfiles] = useState<UserMedalProfile[]>([]);
  const [remotePrePostComparisons, setRemotePrePostComparisons] = useState<PrePostComparisonRecord[]>([]);
  const isSyncingRef = useRef(false);

  // Student Detail Modal
  const [selectedStudentUid, setSelectedStudentUid] = useState<string | null>(null);
  const [confirmResetUid, setConfirmResetUid] = useState<string | null>(null);

  // Teacher Admin: Change Password Modal
  const [passwordTargetStudent, setPasswordTargetStudent] = useState<StudentSummary | null>(null);
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [showNewPass, setShowNewPass] = useState(true);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Teacher Admin: Delete User Modal
  const [deleteTargetStudent, setDeleteTargetStudent] = useState<StudentSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Add Student Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newStudentId, setNewStudentId] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newClassroom, setNewClassroom] = useState('ปวช.3/1');
  const [newPassword, setNewPassword] = useState('1234');
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Google Sheet Apps Script Modal
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const showSyncNotice = useCallback((message: string, needsScriptUpdate = false, durationMs = 4500) => {
    if (syncNoticeTimerRef.current) {
      window.clearTimeout(syncNoticeTimerRef.current);
      syncNoticeTimerRef.current = null;
    }
    setSyncNotice(message);
    setSyncNoticeNeedsScript(needsScriptUpdate);
    if (!needsScriptUpdate) {
      syncNoticeTimerRef.current = window.setTimeout(() => {
        setSyncNotice(null);
        setSyncNoticeNeedsScript(false);
        syncNoticeTimerRef.current = null;
      }, durationMs);
    }
  }, []);

  const syncTeacherData = useCallback(async (showFeedback: boolean = false) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    if (showFeedback) setSyncNotice(null);

    try {
      const snapshot = await apiFetchTeacherDashboardData();
      setRemoteUsers(snapshot.users);
      setRemoteScores(snapshot.scores);
      setRemoteMedalProfiles(snapshot.medalProfiles);
      setRemotePrePostComparisons(snapshot.prePostComparisons || []);
      setLastSyncedAt(snapshot.syncedAt);
      setRefreshTick(t => t + 1);

      if (showFeedback) {
        setSyncNotice(
          snapshot.syncedFromSheet
            ? 'อัปเดตข้อมูลนักเรียนทุกห้องและสถิติล่าสุดจาก Google Sheets เรียบร้อยแล้ว'
            : 'อัปเดตข้อมูลล่าสุดในเครื่องเรียบร้อยแล้ว'
        );
        setTimeout(() => setSyncNotice(null), 3500);
      }
    } catch {
      if (showFeedback) {
        setSyncNotice('ไม่สามารถเชื่อมต่อ Google Sheets ได้ในขณะนี้ (แสดงข้อมูลล่าสุดในเครื่อง)');
        setTimeout(() => setSyncNotice(null), 3500);
      }
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  // 1. Sync immediately on mount + listen for instant realtime local/cross-tab updates
  useEffect(() => {
    syncTeacherData(false);

    const unsubscribe = subscribeUserDataUpdates(() => {
      setRefreshTick(prev => prev + 1);
      setLastSyncedAt(new Date().toISOString());
    });

    const handleVisibilityOrFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        syncTeacherData(false);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [syncTeacherData]);

  // 2. Continuous background polling (every 15s while autoSyncEnabled is ON and tab is visible)
  useEffect(() => {
    if (!autoSyncEnabled) return;
    const intervalId = window.setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        syncTeacherData(false);
      }
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [autoSyncEnabled, syncTeacherData]);

  // Merge local + remote users using newest classroom timestamp so student profile room edits reflect immediately
  const allMergedUsers = useMemo(() => {
    const local = getLocalUsers();
    const map = new Map<string, User>();
    const getKey = (u: User) => String(u.studentId || u.username || u.uid || '').trim().toLowerCase();

    local.forEach(u => {
      const k = getKey(u);
      if (k) map.set(k, u);
    });
    remoteUsers.forEach(ru => {
      const k = getKey(ru);
      if (!k) return;
      const existing = map.get(k);
      if (!existing) {
        map.set(k, ru);
      } else {
        const vault = getSavedClassroomForUser(existing);
        const existingTs = existing.classroomUpdatedAt
          ? new Date(existing.classroomUpdatedAt).getTime()
          : vault?.updatedAt
          ? new Date(vault.updatedAt).getTime()
          : 0;
        const remoteTs = ru.classroomUpdatedAt
          ? new Date(ru.classroomUpdatedAt).getTime()
          : ru.createdAt
          ? new Date(ru.createdAt).getTime()
          : 0;

        let resolvedRoom = existing.classroom || ru.classroom || 'ทั่วไป';
        let resolvedRoomAt = existing.classroomUpdatedAt || ru.classroomUpdatedAt;

        if (ru.classroom && remoteTs > existingTs) {
          resolvedRoom = ru.classroom;
          resolvedRoomAt = ru.classroomUpdatedAt || ru.createdAt;
        } else if (existing.classroom && existingTs >= remoteTs && existingTs > 0) {
          resolvedRoom = existing.classroom;
          resolvedRoomAt = existing.classroomUpdatedAt || vault?.updatedAt;
        } else if ((!existing.classroom || existing.classroom === 'ทั่วไป') && ru.classroom) {
          resolvedRoom = ru.classroom;
          resolvedRoomAt = ru.classroomUpdatedAt || ru.createdAt;
        }

        map.set(k, {
          ...existing,
          avatar: ru.avatar || existing.avatar,
          avatarBg: ru.avatarBg || existing.avatarBg,
          classroom: resolvedRoom,
          classroomUpdatedAt: resolvedRoomAt,
          fullName: existing.fullName || ru.fullName || existing.displayName
        });
      }
    });
    return Array.from(map.values());
  }, [remoteUsers, refreshTick]);

  // Merge local + remote medal profiles
  const medalProfileByKey = useMemo(() => {
    const map = new Map<string, UserMedalProfile>();
    const localMap = getAllSavedUserMedalProfiles();
    Object.values(localMap).forEach(p => {
      const k = String(p.accountKey || p.studentId || p.uid || '').trim().toLowerCase();
      if (k) map.set(k, p);
    });
    remoteMedalProfiles.forEach(p => {
      const k = String(p.accountKey || p.studentId || p.uid || '').trim().toLowerCase();
      if (!k) return;
      const prev = map.get(k);
      if (!prev || (p.totalMedalsCount || 0) >= (prev.totalMedalsCount || 0)) {
        map.set(k, p);
      }
    });
    return map;
  }, [remoteMedalProfiles, refreshTick]);

  // Merge local + remote Pre-Test vs Post-Test comparison records
  const prePostByKey = useMemo(() => {
    const map = new Map<string, PrePostComparisonRecord>();
    const mergeRecord = (rec: PrePostComparisonRecord) => {
      const k = String(rec.accountKey || rec.studentId || rec.uid || '').trim().toLowerCase();
      if (!k) return;
      const prev = map.get(k);
      if (!prev) {
        map.set(k, rec);
        return;
      }
      const prevTs = prev.updatedAt ? new Date(prev.updatedAt).getTime() : 0;
      const nextTs = rec.updatedAt ? new Date(rec.updatedAt).getTime() : 0;
      const newer = nextTs >= prevTs ? rec : prev;
      const older = nextTs >= prevTs ? prev : rec;
      const pretestQuizScore = newer.pretestQuizScore ?? older.pretestQuizScore ?? null;
      const posttestQuizScore = newer.posttestQuizScore ?? older.posttestQuizScore ?? null;
      const pretestTypingWpm = newer.pretestTypingWpm ?? older.pretestTypingWpm ?? null;
      const pretestTypingAccuracy = newer.pretestTypingAccuracy ?? older.pretestTypingAccuracy ?? null;
      const posttestTypingWpm = newer.posttestTypingWpm ?? older.posttestTypingWpm ?? null;
      const posttestTypingAccuracy = newer.posttestTypingAccuracy ?? older.posttestTypingAccuracy ?? null;
      map.set(k, {
        ...older,
        ...newer,
        pretestQuizScore,
        pretestQuizTotal: newer.pretestQuizTotal || older.pretestQuizTotal || 10,
        pretestQuizPercent:
          pretestQuizScore !== null ? Math.round((pretestQuizScore / (newer.pretestQuizTotal || 10)) * 100) : null,
        pretestQuizDate: newer.pretestQuizDate || older.pretestQuizDate || undefined,
        posttestQuizScore,
        posttestQuizTotal: newer.posttestQuizTotal || older.posttestQuizTotal || 10,
        posttestQuizPercent:
          posttestQuizScore !== null ? Math.round((posttestQuizScore / (newer.posttestQuizTotal || 10)) * 100) : null,
        posttestQuizDate: newer.posttestQuizDate || older.posttestQuizDate || undefined,
        quizScoreDiff:
          pretestQuizScore !== null && posttestQuizScore !== null
            ? posttestQuizScore - pretestQuizScore
            : null,
        pretestTypingWpm,
        pretestTypingAccuracy,
        pretestTypingDate: newer.pretestTypingDate || older.pretestTypingDate || undefined,
        posttestTypingWpm,
        posttestTypingAccuracy,
        posttestTypingDate: newer.posttestTypingDate || older.posttestTypingDate || undefined,
        typingWpmDiff:
          pretestTypingWpm !== null && posttestTypingWpm !== null
            ? posttestTypingWpm - pretestTypingWpm
            : null,
        typingAccuracyDiff:
          pretestTypingAccuracy !== null && posttestTypingAccuracy !== null
            ? posttestTypingAccuracy - pretestTypingAccuracy
            : null
      });
    };

    getAllSavedPrePostComparisons().forEach(mergeRecord);
    remotePrePostComparisons.forEach(mergeRecord);
    return map;
  }, [remotePrePostComparisons, refreshTick]);

  // Combine local & synced scores, excluding demo seed_* records
  const allRealScores = useMemo(() => {
    const local = getLocalScores();
    const map = new Map<string, ScoreRecord>();
    const addRecord = (r: ScoreRecord) => {
      if (!r || !r.scoreId) return;
      if (String(r.uid || '').startsWith('seed_')) return;
      if (
        (r.gameMode as string) === 'profile_avatar' ||
        (r.testType as string) === 'AVATAR_UPDATE' ||
        (r.gameMode as string) === 'profile_classroom' ||
        (r.testType as string) === 'CLASSROOM_UPDATE'
      ) {
        return;
      }
      map.set(r.scoreId, r);
    };
    remoteScores.forEach(addRecord);
    local.forEach(addRecord);
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [remoteScores, refreshTick]);

  // Build unified student roster with development metrics & medals
  const studentSummaries: StudentSummary[] = useMemo(() => {
    const registeredStudents = allMergedUsers.filter(
      u => u.role !== 'teacher' && u.role !== 'admin' && u.username?.toLowerCase() !== 'teacher'
    );

    const rosterMap = new Map<string, User>();
    const getRosterKey = (u: { studentId?: string; username?: string; uid?: string }) =>
      String(u.studentId || u.username || u.uid || '').trim().toLowerCase();

    registeredStudents.forEach(u => {
      const key = getRosterKey(u);
      if (key) rosterMap.set(key, u);
    });

    // Include students discovered in UserMedals
    medalProfileByKey.forEach((mp, key) => {
      if (key === 'teacher' || String(mp.uid || '').startsWith('teacher_')) return;
      if (!rosterMap.has(key)) {
        rosterMap.set(key, {
          uid: mp.uid || `std_${key}`,
          username: key,
          studentId: mp.studentId || key,
          fullName: mp.fullName || mp.displayName || key,
          classroom: mp.classroom || 'ทั่วไป',
          displayName: mp.displayName || mp.fullName || key,
          role: 'student',
          avatar: '',
          avatarBg: 'from-cyan-500 to-blue-600',
          createdAt: mp.updatedAt || new Date().toISOString()
        });
      }
    });

    // Include students discovered in PrePostTests
    prePostByKey.forEach((pp, key) => {
      if (key === 'teacher' || String(pp.uid || '').startsWith('teacher_')) return;
      if (!rosterMap.has(key)) {
        rosterMap.set(key, {
          uid: pp.uid || `std_${key}`,
          username: key,
          studentId: pp.studentId || key,
          fullName: pp.fullName || pp.displayName || key,
          classroom: pp.classroom || 'ทั่วไป',
          displayName: pp.displayName || pp.fullName || key,
          role: 'student',
          avatar: '',
          avatarBg: 'from-cyan-500 to-blue-600',
          createdAt: pp.updatedAt || new Date().toISOString()
        });
      }
    });

    // Include students discovered in Scores
    allRealScores.forEach(s => {
      if (!s.uid || s.uid === 'guest' || s.uid === 'guest_default') return;
      if (s.uid.startsWith('teacher_')) return;
      const alreadyExists = Array.from(rosterMap.values()).some(u => isRecordOwnedByUser(s, u));
      if (!alreadyExists) {
        const cleanSid = s.uid.replace(/^std_/, '').split('_')[0];
        const key = cleanSid.toLowerCase();
        const savedVaultRoom = getSavedClassroomForUser({
          uid: s.uid,
          studentId: cleanSid,
          username: key,
          displayName: s.displayName
        });
        rosterMap.set(key, {
          uid: s.uid,
          username: cleanSid.toLowerCase(),
          studentId: cleanSid,
          fullName: s.displayName,
          classroom: savedVaultRoom?.classroom || s.classroom || 'ทั่วไป',
          classroomUpdatedAt: savedVaultRoom?.updatedAt || s.createdAt,
          displayName: s.displayName,
          role: 'student',
          avatar: s.avatar || '',
          avatarBg: s.avatarBg || 'from-cyan-500 to-blue-600',
          createdAt: s.createdAt
        });
      }
    });

    return Array.from(rosterMap.values()).map(student => {
      const scores = allRealScores.filter(s => isRecordOwnedByUser(s, student));
      const accKey = String(student.studentId || student.username || student.uid || '').trim().toLowerCase();
      const medalProfile = medalProfileByKey.get(accKey) || null;
      const prePostComparison =
        prePostByKey.get(accKey) ||
        prePostByKey.get(String(student.uid || '').trim().toLowerCase()) ||
        null;

      const completion = getCurriculumCompletion(scores, medalProfile);

      const quizPre = completion.pretestRecords.find(r => String(r.levelId || '').includes('quiz'));
      const quizPost = completion.posttestRecords.find(r => String(r.levelId || '').includes('quiz'));
      const scorePreVal = quizPre
        ? quizPre.totalCharacters === 10 && quizPre.correctCharacters >= 0 && quizPre.correctCharacters <= 10
          ? quizPre.correctCharacters
          : Math.round(quizPre.score / 100)
        : null;
      const scorePostVal = quizPost
        ? quizPost.totalCharacters === 10 && quizPost.correctCharacters >= 0 && quizPost.correctCharacters <= 10
          ? quizPost.correctCharacters
          : Math.round(quizPost.score / 100)
        : null;

      const pretestQuizScore = prePostComparison?.pretestQuizScore ?? scorePreVal;
      const posttestQuizScore = prePostComparison?.posttestQuizScore ?? scorePostVal;
      const examDelta =
        pretestQuizScore !== null && posttestQuizScore !== null
          ? posttestQuizScore - pretestQuizScore
          : null;
      const pretestQuizDate = prePostComparison?.pretestQuizDate || quizPre?.createdAt || null;
      const posttestQuizDate = prePostComparison?.posttestQuizDate || quizPost?.createdAt || null;

      // Practical typing Pre-Test vs Post-Test
      const typingPre = completion.pretestRecords.find(r => !String(r.levelId || '').includes('quiz') && r.netWpm > 0);
      const typingPost = completion.posttestRecords.find(r => !String(r.levelId || '').includes('quiz') && r.netWpm > 0);
      const pretestTypingWpm = prePostComparison?.pretestTypingWpm ?? (typingPre ? typingPre.netWpm : null);
      const pretestTypingAccuracy = prePostComparison?.pretestTypingAccuracy ?? (typingPre ? typingPre.accuracy : null);
      const posttestTypingWpm = prePostComparison?.posttestTypingWpm ?? (typingPost ? typingPost.netWpm : null);
      const posttestTypingAccuracy = prePostComparison?.posttestTypingAccuracy ?? (typingPost ? typingPost.accuracy : null);
      const typingTestWpmDelta =
        pretestTypingWpm !== null && posttestTypingWpm !== null
          ? posttestTypingWpm - pretestTypingWpm
          : null;
      const typingTestAccDelta =
        pretestTypingAccuracy !== null && posttestTypingAccuracy !== null
          ? posttestTypingAccuracy - pretestTypingAccuracy
          : null;

      const typingOnly = scores.filter(s => !String(s.levelId || '').includes('quiz') && s.netWpm > 0);
      const chronologicalTyping = [...typingOnly].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      const firstWpm = chronologicalTyping.length > 0 ? chronologicalTyping[0].netWpm : 0;
      const latestWpm =
        chronologicalTyping.length > 0
          ? chronologicalTyping[chronologicalTyping.length - 1].netWpm
          : 0;
      const avgWpm = typingOnly.length
        ? Math.round(typingOnly.reduce((acc, s) => acc + s.netWpm, 0) / typingOnly.length)
        : medalProfile?.bestWpm || 0;
      const bestWpm = typingOnly.length
        ? Math.max(...typingOnly.map(s => s.netWpm))
        : medalProfile?.bestWpm || 0;
      const wpmGrowth = chronologicalTyping.length >= 2 ? latestWpm - firstWpm : 0;

      const firstAccuracy = chronologicalTyping.length > 0 ? chronologicalTyping[0].accuracy : 0;
      const latestAccuracy =
        chronologicalTyping.length > 0
          ? chronologicalTyping[chronologicalTyping.length - 1].accuracy
          : 0;
      const avgAccuracy = typingOnly.length
        ? Math.round(typingOnly.reduce((acc, s) => acc + s.accuracy, 0) / typingOnly.length)
        : medalProfile?.bestAccuracy || 0;
      const accuracyGrowth =
        chronologicalTyping.length >= 2 ? latestAccuracy - firstAccuracy : 0;

      const rankedScores = scores.filter(s => s.gameMode === 'ranked' || s.testType === 'RANKED');
      const rankedBestScore = rankedScores.length
        ? Math.max(...rankedScores.map(s => s.score))
        : 0;

      const computedMedalsCount =
        (completion.hasPretest ? 1 : 0) +
        (completion.hasLesson ? 1 : 0) +
        (completion.hasAll10Levels ? 1 : 0) +
        (completion.hasPosttest ? 1 : 0) +
        (completion.isGrandComplete ? 1 : 0) +
        completion.passedLevelsCount;
      const totalMedalsCount = Math.max(computedMedalsCount, medalProfile?.totalMedalsCount || 0);

      const lastActiveAt =
        scores[0]?.createdAt || prePostComparison?.updatedAt || medalProfile?.updatedAt || null;

      // Pick latest non-empty avatar across user profile + score rows
      const latestAvatarFromScores = scores.find(
        s => s.avatar && (s.avatar.startsWith('data:image') || s.avatar.startsWith('http'))
      );

      const latestScoreWithRoom = scores.find(s => s.classroom && s.classroom.trim());
      const vaultRoom = getSavedClassroomForUser(student);
      const studentRoomTs = student.classroomUpdatedAt ? new Date(student.classroomUpdatedAt).getTime() : 0;
      const medalRoomTs = medalProfile?.updatedAt ? new Date(medalProfile.updatedAt).getTime() : 0;
      const vaultRoomTs = vaultRoom?.updatedAt ? new Date(vaultRoom.updatedAt).getTime() : 0;

      let resolvedClassroom =
        student.classroom ||
        medalProfile?.classroom ||
        prePostComparison?.classroom ||
        latestScoreWithRoom?.classroom ||
        'ทั่วไป';
      let bestRoomTs = studentRoomTs;
      if (vaultRoom?.classroom && vaultRoomTs >= bestRoomTs) {
        resolvedClassroom = vaultRoom.classroom;
        bestRoomTs = vaultRoomTs;
      }
      if (medalProfile?.classroom && medalRoomTs > bestRoomTs) {
        resolvedClassroom = medalProfile.classroom;
      }

      return {
        uid: student.uid,
        studentId: student.studentId || student.username,
        fullName: student.fullName || student.displayName,
        displayName: student.displayName,
        classroom: resolvedClassroom,
        avatar: student.avatar || latestAvatarFromScores?.avatar || '',
        avatarBg: student.avatarBg || latestAvatarFromScores?.avatarBg || 'from-cyan-500 to-blue-600',
        scores,
        completion,
        medalProfile,
        totalMedalsCount,
        pretestQuizScore,
        posttestQuizScore,
        examDelta,
        pretestQuizDate,
        posttestQuizDate,
        pretestTypingWpm,
        pretestTypingAccuracy,
        posttestTypingWpm,
        posttestTypingAccuracy,
        typingTestWpmDelta,
        typingTestAccDelta,
        prePostComparison,
        rankedBestScore,
        firstWpm,
        latestWpm,
        avgWpm,
        bestWpm,
        wpmGrowth,
        firstAccuracy,
        latestAccuracy,
        avgAccuracy,
        accuracyGrowth,
        lastActiveAt,
        chronologicalTyping
      };
    });
  }, [allMergedUsers, allRealScores, medalProfileByKey, prePostByKey]);

  // Helper to compute KPI summary for any subset of students
  const computeStats = useCallback((list: StudentSummary[]) => {
    const total = list.length;
    const active = list.filter(s => s.scores.length > 0 || s.totalMedalsCount > 0).length;
    const done100 = list.filter(s => s.completion.isGrandComplete).length;
    const totalSessions = list.reduce((sum, s) => sum + s.scores.length, 0);
    const totalMedals = list.reduce((sum, s) => sum + s.totalMedalsCount, 0);
    const avgCompletion = total
      ? Math.round(list.reduce((sum, s) => sum + s.completion.completionPercent, 0) / total)
      : 0;

    const typingList = list.filter(s => s.avgWpm > 0);
    const avgWpm = typingList.length
      ? Math.round(typingList.reduce((sum, s) => sum + s.avgWpm, 0) / typingList.length)
      : 0;
    const topWpm = typingList.length
      ? Math.max(...typingList.map(s => s.bestWpm))
      : 0;
    const avgAccuracy = typingList.length
      ? Math.round(typingList.reduce((sum, s) => sum + s.avgAccuracy, 0) / typingList.length)
      : 0;

    const growthList = list.filter(s => s.chronologicalTyping.length >= 2);
    const avgWpmGrowth = growthList.length
      ? Math.round(growthList.reduce((sum, s) => sum + s.wpmGrowth, 0) / growthList.length)
      : null;

    const preList = list.filter(s => s.pretestQuizScore !== null);
    const postList = list.filter(s => s.posttestQuizScore !== null);
    const avgPre = preList.length
      ? Number((preList.reduce((s, m) => s + (m.pretestQuizScore || 0), 0) / preList.length).toFixed(1))
      : null;
    const avgPost = postList.length
      ? Number((postList.reduce((s, m) => s + (m.posttestQuizScore || 0), 0) / postList.length).toFixed(1))
      : null;

    const paired = list.filter(s => s.examDelta !== null);
    const avgDelta = paired.length
      ? Number((paired.reduce((s, m) => s + (m.examDelta || 0), 0) / paired.length).toFixed(1))
      : null;
    const improvedExamCount = paired.filter(s => (s.examDelta || 0) > 0).length;

    const preTypingList = list.filter(s => s.pretestTypingWpm !== null);
    const postTypingList = list.filter(s => s.posttestTypingWpm !== null);
    const pairedTyping = list.filter(s => s.typingTestWpmDelta !== null);
    const avgPreTypingWpm = preTypingList.length
      ? Math.round(preTypingList.reduce((s, m) => s + (m.pretestTypingWpm || 0), 0) / preTypingList.length)
      : null;
    const avgPostTypingWpm = postTypingList.length
      ? Math.round(postTypingList.reduce((s, m) => s + (m.posttestTypingWpm || 0), 0) / postTypingList.length)
      : null;
    const avgTypingWpmDelta = pairedTyping.length
      ? Math.round(pairedTyping.reduce((s, m) => s + (m.typingTestWpmDelta || 0), 0) / pairedTyping.length)
      : null;

    return {
      total,
      active,
      done100,
      totalSessions,
      totalMedals,
      avgCompletion,
      avgWpm,
      topWpm,
      avgAccuracy,
      avgWpmGrowth,
      preCount: preList.length,
      postCount: postList.length,
      pairedCount: paired.length,
      avgPre,
      avgPost,
      avgDelta,
      improvedExamCount,
      avgPreTypingWpm,
      avgPostTypingWpm,
      avgTypingWpmDelta
    };
  }, []);

  // Classroom list with full aggregated stats per room
  const classroomCards = useMemo(() => {
    const roomSet = new Set<string>(PRESET_CLASSROOMS);
    studentSummaries.forEach(s => {
      roomSet.add(s.classroom || 'ทั่วไป');
    });

    const orderedRooms: string[] = [];
    PRESET_CLASSROOMS.forEach(r => {
      if (roomSet.has(r)) orderedRooms.push(r);
    });
    Array.from(roomSet)
      .sort((a, b) => a.localeCompare(b, 'th'))
      .forEach(r => {
        if (!orderedRooms.includes(r)) orderedRooms.push(r);
      });

    return orderedRooms.map(room => {
      const members = studentSummaries.filter(s => (s.classroom || 'ทั่วไป') === room);
      const stats = computeStats(members);
      return { room, members, stats };
    });
  }, [studentSummaries, computeStats]);

  // All-students combined stats & currently scoped room stats
  const allStudentsStats = useMemo(() => computeStats(studentSummaries), [studentSummaries, computeStats]);

  const roomStudents = useMemo(() => {
    if (selectedClassroom === 'all') return studentSummaries;
    return studentSummaries.filter(s => (s.classroom || 'ทั่วไป') === selectedClassroom);
  }, [studentSummaries, selectedClassroom]);

  const scopedStats = useMemo(
    () => (selectedClassroom === 'all' ? allStudentsStats : computeStats(roomStudents)),
    [selectedClassroom, allStudentsStats, roomStudents, computeStats]
  );

  // Filtered & sorted rows for the student table
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = roomStudents.filter(s => {
      if (completionFilter === 'complete_100' && !s.completion.isGrandComplete) return false;
      if (
        completionFilter === 'in_progress' &&
        (s.completion.isGrandComplete || s.scores.length === 0)
      ) {
        return false;
      }
      if (completionFilter === 'not_started' && s.scores.length > 0) return false;

      if (q) {
        const hay = `${s.studentId} ${s.fullName} ${s.displayName} ${s.classroom}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      let diff = 0;
      if (sortField === 'name') {
        diff = a.fullName.localeCompare(b.fullName, 'th');
      } else if (sortField === 'completion') {
        diff = a.completion.completionPercent - b.completion.completionPercent;
      } else if (sortField === 'wpm') {
        diff = a.bestWpm - b.bestWpm;
      } else if (sortField === 'accuracy') {
        diff = a.avgAccuracy - b.avgAccuracy;
      } else if (sortField === 'growth') {
        diff = a.wpmGrowth - b.wpmGrowth;
      } else if (sortField === 'recent') {
        const ta = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        const tb = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        diff = ta - tb;
      }
      return sortAsc ? diff : -diff;
    });
  }, [roomStudents, completionFilter, searchQuery, sortField, sortAsc]);

  // Filtered students for dedicated Pre-Test vs Post-Test comparison view
  const filteredPrePostStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return roomStudents
      .filter(s => {
        const hasPre = s.pretestQuizScore !== null || s.pretestTypingWpm !== null;
        const hasPost = s.posttestQuizScore !== null || s.posttestTypingWpm !== null;
        if (prePostFilter === 'paired' && !(hasPre && hasPost)) return false;
        if (prePostFilter === 'pre_only' && !(hasPre && !hasPost)) return false;
        if (prePostFilter === 'not_tested' && (hasPre || hasPost)) return false;
        if (
          prePostFilter === 'improved' &&
          !((s.examDelta !== null && s.examDelta > 0) || (s.typingTestWpmDelta !== null && s.typingTestWpmDelta > 0))
        ) {
          return false;
        }
        if (q) {
          const hay = `${s.studentId} ${s.fullName} ${s.displayName} ${s.classroom}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Put paired students with highest improvement first, then tested, then alphabetically
        const aPaired = a.examDelta !== null ? 2 : a.pretestQuizScore !== null || a.posttestQuizScore !== null ? 1 : 0;
        const bPaired = b.examDelta !== null ? 2 : b.pretestQuizScore !== null || b.posttestQuizScore !== null ? 1 : 0;
        if (aPaired !== bPaired) return bPaired - aPaired;
        if (a.examDelta !== null && b.examDelta !== null && a.examDelta !== b.examDelta) {
          return b.examDelta - a.examDelta;
        }
        return a.fullName.localeCompare(b.fullName, 'th');
      });
  }, [roomStudents, prePostFilter, searchQuery]);

  // Grouped students by classroom (used when viewing "ทุกห้องเรียน")
  const groupedFilteredByClassroom = useMemo(() => {
    const groups = new Map<string, StudentSummary[]>();
    filteredStudents.forEach(student => {
      const room = student.classroom || 'ทั่วไป';
      const arr = groups.get(room) || [];
      arr.push(student);
      groups.set(room, arr);
    });

    const ordered: { room: string; students: StudentSummary[]; stats: ReturnType<typeof computeStats> }[] = [];
    classroomCards.forEach(({ room }) => {
      const list = groups.get(room);
      if (list && list.length > 0) {
        ordered.push({ room, students: list, stats: computeStats(list) });
      }
    });
    return ordered;
  }, [filteredStudents, classroomCards, computeStats]);

  // 10-Level summary scoped to selected classroom
  const levelSummary = useMemo(() => {
    const uidSet = new Set(roomStudents.map(s => s.uid));
    const nameSet = new Set(roomStudents.map(s => s.displayName));
    const scopedScores = allRealScores.filter(
      r => uidSet.has(r.uid) || nameSet.has(r.displayName)
    );

    return LEVELS_CONFIG.map(lvl => {
      const records = scopedScores.filter(
        s => s.gameMode === 'game' && Number(s.levelId) === lvl.id
      );
      const attempts = records.length;
      const passes = records.filter(r => r.passed).length;
      const passRate = attempts > 0 ? Math.round((passes / attempts) * 100) : 0;
      const avgWpm = attempts > 0
        ? Math.round(records.reduce((sum, r) => sum + r.netWpm, 0) / attempts)
        : 0;
      return {
        id: lvl.id,
        titleTh: lvl.titleTh,
        attempts,
        passes,
        passRate,
        avgWpm
      };
    });
  }, [roomStudents, allRealScores]);

  const selectedStudent = useMemo(
    () => studentSummaries.find(s => s.uid === selectedStudentUid) || null,
    [studentSummaries, selectedStudentUid]
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'name');
    }
  };

  const handleChangeStudentClassroom = (student: StudentSummary, nextRoom: string) => {
    const updated = updateStudentClassroom(student.uid, nextRoom, student.studentId, {
      uid: student.uid,
      username: student.studentId || student.uid,
      studentId: student.studentId,
      fullName: student.fullName,
      displayName: student.displayName,
      avatar: student.avatar,
      avatarBg: student.avatarBg,
      role: 'student'
    });
    if (updated) {
      const updatedAt = updated.classroomUpdatedAt || new Date().toISOString();
      setRemoteUsers(prev =>
        prev.map(u =>
          u.uid === student.uid || u.studentId === student.studentId
            ? { ...u, classroom: nextRoom, classroomUpdatedAt: updatedAt }
            : u
        )
      );
      setRemoteMedalProfiles(prev =>
        prev.map(m =>
          m.uid === student.uid || m.studentId === student.studentId
            ? { ...m, classroom: nextRoom, updatedAt }
            : m
        )
      );
      setRefreshTick(t => t + 1);
      setSyncNotice(`ย้าย ${student.fullName} ไปยังห้อง ${nextRoom} และอัปเดตลง Google Sheets เรียบร้อยแล้ว`);
      setTimeout(() => setSyncNotice(null), 3500);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'รหัสนักเรียน',
      'ชื่อ-นามสกุล',
      'ชื่อเล่น',
      'ห้องเรียน',
      'Pre-test (/10)',
      'Post-test (/10)',
      'พัฒนาการสอบ (+/-)',
      'ศูนย์การเรียนรู้ (ชุด)',
      'ผ่านด่านเกม (/10)',
      'ความคืบหน้า (%)',
      'WPM ครั้งแรก',
      'WPM ล่าสุด',
      'WPM สูงสุด',
      'พัฒนาการ WPM (+/-)',
      'แม่นยำเฉลี่ย (%)',
      'เหรียญตรา (เหรียญ)',
      'กิจกรรมล่าสุด'
    ];

    const escapeCsv = (val: string | number) => {
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredStudents.map(s => [
      s.studentId,
      s.fullName,
      s.displayName,
      s.classroom,
      s.pretestQuizScore !== null ? s.pretestQuizScore : s.completion.hasPretest ? 'ทำแล้ว' : '-',
      s.posttestQuizScore !== null ? s.posttestQuizScore : s.completion.hasPosttest ? 'ทำแล้ว' : '-',
      s.examDelta !== null ? (s.examDelta >= 0 ? `+${s.examDelta}` : `${s.examDelta}`) : '-',
      s.completion.lessonRecords.length,
      `${s.completion.passedLevelsCount}/10`,
      s.completion.completionPercent,
      s.firstWpm || '-',
      s.latestWpm || '-',
      s.bestWpm || '-',
      s.chronologicalTyping.length >= 2
        ? s.wpmGrowth >= 0
          ? `+${s.wpmGrowth}`
          : `${s.wpmGrowth}`
        : '-',
      s.avgAccuracy,
      s.totalMedalsCount,
      s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleString('th-TH') : '-'
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const roomSuffix = selectedClassroom === 'all' ? 'ทุกห้อง' : selectedClassroom.replace('/', '-');
    link.download = `รายงานพัฒนาการ_${roomSuffix}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPrePostCsv = () => {
    const headers = [
      'รหัสนักเรียน',
      'ชื่อ-นามสกุล',
      'ห้องเรียน',
      'ข้อสอบ Pre-Test (/10)',
      'ข้อสอบ Pre-Test (%)',
      'วันที่ทำ Pre-Test',
      'ข้อสอบ Post-Test (/10)',
      'ข้อสอบ Post-Test (%)',
      'วันที่ทำ Post-Test',
      'ผลต่างข้อสอบ (+/-)',
      'พิมพ์ปฏิบัติ Pre (WPM)',
      'พิมพ์ปฏิบัติ Pre (แม่นยำ%)',
      'พิมพ์ปฏิบัติ Post (WPM)',
      'พิมพ์ปฏิบัติ Post (แม่นยำ%)',
      'ผลต่าง WPM (+/-)',
      'สถานะเปรียบเทียบ'
    ];

    const escapeCsv = (val: string | number) => {
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredPrePostStudents.map(s => {
      const status =
        s.examDelta !== null
          ? s.examDelta > 0
            ? 'พัฒนาขึ้น'
            : s.examDelta < 0
            ? 'ควรทบทวน'
            : 'เท่าเดิม'
          : s.pretestQuizScore !== null
          ? 'รอทำ Post-Test'
          : 'ยังไม่สอบ';

      return [
        s.studentId,
        s.fullName,
        s.classroom,
        s.pretestQuizScore !== null ? s.pretestQuizScore : '-',
        s.pretestQuizScore !== null ? `${Math.round((s.pretestQuizScore / 10) * 100)}%` : '-',
        s.pretestQuizDate ? new Date(s.pretestQuizDate).toLocaleString('th-TH') : '-',
        s.posttestQuizScore !== null ? s.posttestQuizScore : '-',
        s.posttestQuizScore !== null ? `${Math.round((s.posttestQuizScore / 10) * 100)}%` : '-',
        s.posttestQuizDate ? new Date(s.posttestQuizDate).toLocaleString('th-TH') : '-',
        s.examDelta !== null ? (s.examDelta > 0 ? `+${s.examDelta}` : `${s.examDelta}`) : '-',
        s.pretestTypingWpm !== null ? s.pretestTypingWpm : '-',
        s.pretestTypingAccuracy !== null ? `${s.pretestTypingAccuracy}%` : '-',
        s.posttestTypingWpm !== null ? s.posttestTypingWpm : '-',
        s.posttestTypingAccuracy !== null ? `${s.posttestTypingAccuracy}%` : '-',
        s.typingTestWpmDelta !== null
          ? s.typingTestWpmDelta > 0
            ? `+${s.typingTestWpmDelta}`
            : `${s.typingTestWpmDelta}`
          : '-',
        status
      ];
    });

    const csvContent =
      '\uFEFF' +
      [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const roomSuffix = selectedClassroom === 'all' ? 'ทุกห้อง' : selectedClassroom.replace('/', '-');
    link.download = `เปรียบเทียบ_PrePost_${roomSuffix}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setIsAdding(true);

    try {
      const res = await apiRegisterStudent({
        studentId: newStudentId,
        fullName: newFullName,
        displayName: newDisplayName || newFullName.split(' ')[0] || newStudentId,
        classroom: newClassroom,
        password: newPassword || '1234',
        role: 'student',
        autoLogin: false
      });

      if (res.success) {
        setNewStudentId('');
        setNewFullName('');
        setNewDisplayName('');
        setNewPassword('1234');
        setIsAddModalOpen(false);
        setRefreshTick(t => t + 1);
        setSyncNotice(`เพิ่มนักเรียน ${res.user?.fullName} เข้าห้อง ${newClassroom} เรียบร้อยแล้ว`);
        setTimeout(() => setSyncNotice(null), 3500);
      } else {
        setAddError(res.message || 'ไม่สามารถเพิ่มนักเรียนได้');
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleResetStudentProgress = (student: StudentSummary) => {
    clearStudentScores(student.uid, student.displayName);
    setRemoteScores(prev => prev.filter(r => !isRecordOwnedByUser(r, student as unknown as User)));
    setConfirmResetUid(null);
    setRefreshTick(t => t + 1);
  };

  const openPasswordModal = (student: StudentSummary) => {
    setPasswordTargetStudent(student);
    setNewPassInput('');
    setConfirmPassInput('');
    setShowNewPass(true);
    setPasswordError(null);
  };

  const handleGenerateRandomPassword = () => {
    const randomPin = String(Math.floor(100000 + Math.random() * 900000));
    setNewPassInput(randomPin);
    setConfirmPassInput(randomPin);
    setShowNewPass(true);
    setPasswordError(null);
  };

  const handleUpdateUserPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetStudent) return;

    const cleanPass = newPassInput.trim();
    const cleanConfirm = confirmPassInput.trim();
    if (cleanPass.length < 4) {
      setPasswordError('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      return;
    }
    if (cleanPass !== cleanConfirm) {
      setPasswordError('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setPasswordError(null);
    setIsUpdatingPassword(true);
    try {
      const res = await apiTeacherUpdateUserPassword(
        {
          uid: passwordTargetStudent.uid,
          username: passwordTargetStudent.studentId,
          studentId: passwordTargetStudent.studentId,
          displayName: passwordTargetStudent.displayName,
          fullName: passwordTargetStudent.fullName,
          classroom: passwordTargetStudent.classroom,
          avatar: passwordTargetStudent.avatar,
          avatarBg: passwordTargetStudent.avatarBg,
          role: 'student'
        },
        cleanPass
      );

      if (!res.success) {
        setPasswordError(res.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
        return;
      }

      setPasswordTargetStudent(null);
      setNewPassInput('');
      setConfirmPassInput('');
      setRefreshTick(t => t + 1);
      showSyncNotice(res.message, Boolean(res.needsScriptUpdate), 5500);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const openDeleteUserModal = (student: StudentSummary) => {
    setDeleteTargetStudent(student);
    setDeleteError(null);
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteTargetStudent) return;
    const target = deleteTargetStudent;
    setDeleteError(null);
    setIsDeletingUser(true);

    try {
      const res = await apiTeacherDeleteUser({
        uid: target.uid,
        username: target.studentId,
        studentId: target.studentId,
        displayName: target.displayName,
        fullName: target.fullName,
        classroom: target.classroom,
        role: 'student'
      });

      if (!res.success) {
        setDeleteError(res.message || 'ไม่สามารถลบบัญชีผู้ใช้นี้ได้');
        return;
      }

      const targetUidLower = target.uid.trim().toLowerCase();
      const targetSidLower = target.studentId.trim().toLowerCase();
      const matchesTargetIds = (u?: { uid?: string; studentId?: string; username?: string; accountKey?: string }) => {
        if (!u) return false;
        const uUid = String(u.uid || '').trim().toLowerCase();
        const uSid = String(u.studentId || '').trim().toLowerCase();
        const uUser = String(u.username || '').trim().toLowerCase();
        const uAcc = String(u.accountKey || '').trim().toLowerCase();
        return (
          (targetUidLower && (uUid === targetUidLower || uAcc === targetUidLower)) ||
          (targetSidLower &&
            (uSid === targetSidLower ||
              uUser === targetSidLower ||
              uAcc === targetSidLower ||
              uUid === `std_${targetSidLower}`))
        );
      };

      setRemoteUsers(prev => prev.filter(u => !matchesTargetIds(u)));
      setRemoteScores(prev => prev.filter(s => !isRecordOwnedByUser(s, target as unknown as User)));
      setRemoteMedalProfiles(prev => prev.filter(m => !matchesTargetIds(m)));
      setRemotePrePostComparisons(prev => prev.filter(p => !matchesTargetIds(p)));

      if (selectedStudentUid === target.uid) {
        setSelectedStudentUid(null);
        setConfirmResetUid(null);
      }

      setDeleteTargetStudent(null);
      setRefreshTick(t => t + 1);
      showSyncNotice(res.message, Boolean(res.needsScriptUpdate), 5500);
    } finally {
      setIsDeletingUser(false);
    }
  };

  const surfaceClass = isDark
    ? 'bg-slate-900 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  const mutedTextClass = isDark ? 'text-slate-400' : 'text-slate-600';

  const activeRoomsCount = classroomCards.filter(c => c.members.length > 0).length;

  const renderStudentRow = (student: StudentSummary) => {
    const comp = student.completion;
    const postUnlocked = comp.hasPretest && comp.hasLesson && comp.hasAll10Levels;

    return (
      <tr
        key={student.uid}
        className={`transition-colors ${
          isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/90'
        }`}
      >
        <td className="py-3.5 px-4">
          <div className="flex items-center gap-3">
            <UserAvatar
              avatar={student.avatar}
              name={student.displayName}
              seed={student.uid || student.studentId}
              gradient={student.avatarBg}
              size="sm"
            />
            <div className="min-w-0">
              <div className="font-semibold truncate max-w-[200px]">
                {student.fullName}
              </div>
              <div className={`text-[11px] font-mono tabular-nums flex items-center gap-1.5 ${mutedTextClass}`}>
                <span>{student.studentId}</span>
                <span>·</span>
                <span className="text-cyan-500 font-sans font-semibold">{student.classroom}</span>
              </div>
            </div>
          </div>
        </td>

        <td className="py-3.5 px-3 text-center font-mono tabular-nums whitespace-nowrap">
          <div className="inline-flex items-center gap-1">
            <span className={student.pretestQuizScore !== null ? 'font-bold text-cyan-500' : mutedTextClass}>
              {student.pretestQuizScore !== null ? student.pretestQuizScore : comp.hasPretest ? '✓' : '-'}
            </span>
            <span className={mutedTextClass}>→</span>
            {student.posttestQuizScore !== null ? (
              <span className="font-bold text-amber-500">{student.posttestQuizScore}</span>
            ) : comp.hasPosttest ? (
              <span className="text-emerald-500 font-medium">✓</span>
            ) : !postUnlocked ? (
              <Lock className={`w-3 h-3 ${mutedTextClass}`} />
            ) : (
              <span className="text-cyan-500 text-[11px] font-sans font-semibold">พร้อม</span>
            )}
          </div>
          {student.examDelta !== null && (
            <div
              className={`text-[10px] font-bold mt-0.5 ${
                student.examDelta > 0
                  ? 'text-emerald-500'
                  : student.examDelta < 0
                  ? 'text-rose-500'
                  : mutedTextClass
              }`}
            >
              {student.examDelta > 0 ? `+${student.examDelta} ข้อ` : `${student.examDelta} ข้อ`}
            </div>
          )}
        </td>

        <td className="py-3.5 px-3 whitespace-nowrap">
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <div className={`w-16 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                <div
                  className={`h-full transition-all ${
                    comp.hasAll10Levels ? 'bg-emerald-500' : 'bg-cyan-500'
                  }`}
                  style={{ width: `${(comp.passedLevelsCount / 10) * 100}%` }}
                />
              </div>
              <span className="font-mono tabular-nums text-xs font-semibold">
                {comp.passedLevelsCount}/10 ด่าน
              </span>
            </div>
            <span className={`text-[11px] ${mutedTextClass}`}>
              บทเรียน {comp.lessonRecords.length} ชุด · เหรียญ {student.totalMedalsCount}
            </span>
          </div>
        </td>

        <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
          {student.bestWpm > 0 ? (
            <div>
              <div className="flex items-center justify-end gap-1">
                <span className="font-bold">{student.bestWpm}</span>
                <span className={`text-[11px] ${mutedTextClass}`}>WPM</span>
                {student.chronologicalTyping.length >= 2 && (
                  <span
                    className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      student.wpmGrowth > 0
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : student.wpmGrowth < 0
                        ? 'bg-rose-500/15 text-rose-500'
                        : 'bg-slate-500/15 text-slate-400'
                    }`}
                  >
                    {student.wpmGrowth > 0 ? `+${student.wpmGrowth}` : student.wpmGrowth}
                  </span>
                )}
              </div>
              <div className={`text-[11px] ${mutedTextClass}`}>
                เฉลี่ย {student.avgWpm} · แม่นยำ {student.avgAccuracy}%
              </div>
            </div>
          ) : (
            <span className={mutedTextClass}>-</span>
          )}
        </td>

        <td className="py-3.5 px-3 text-right whitespace-nowrap">
          <div className="flex flex-col items-end">
            <span
              className={`font-mono tabular-nums font-bold ${
                comp.isGrandComplete
                  ? 'text-emerald-500'
                  : comp.completionPercent > 0
                  ? 'text-cyan-500'
                  : mutedTextClass
              }`}
            >
              {comp.completionPercent}%
            </span>
            <span className={`text-[10px] ${mutedTextClass}`}>
              {formatRelativeTime(student.lastActiveAt)}
            </span>
          </div>
        </td>

        <td className="py-3.5 px-4 text-right whitespace-nowrap">
          <div className="inline-flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedStudentUid(student.uid)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-300'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-cyan-700'
              }`}
              title="ดูพัฒนาการและรายละเอียดนักเรียน"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>พัฒนาการ</span>
            </button>
            <button
              type="button"
              onClick={() => openPasswordModal(student)}
              className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-500/30 text-amber-300'
                  : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700'
              }`}
              title="เปลี่ยนรหัสผ่านผู้ใช้"
              aria-label={`เปลี่ยนรหัสผ่านของ ${student.fullName}`}
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => openDeleteUserModal(student)}
              className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-rose-950/40 hover:bg-rose-900/50 border-rose-500/30 text-rose-400'
                  : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-600'
              }`}
              title="ลบบัญชีผู้ใช้นี้"
              aria-label={`ลบบัญชีผู้ใช้ ${student.fullName}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 1. Top Header + Realtime Sync Controls + Actions */}
      <div className={`border rounded-2xl p-5 sm:p-6 ${surfaceClass}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                แดชบอร์ดครูผู้สอน ·{' '}
                <span className="text-cyan-500">
                  {selectedClassroom === 'all' ? 'รวมนักเรียนทุกห้อง' : `ห้อง ${selectedClassroom}`}
                </span>
              </h1>
              {lastSyncedAt && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-mono tabular-nums border ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-400'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <Clock className="w-3 h-3 text-cyan-500" />
                  <span>
                    อัปเดต{' '}
                    {new Date(lastSyncedAt).toLocaleTimeString('th-TH', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </span>
                </span>
              )}
            </div>
            <p className={`text-xs sm:text-sm mt-1 ${mutedTextClass}`}>
              ติดตามพัฒนาการนักเรียนทุกคนแบบแยกตามห้องเรียน รวมสถิติภาพรวม และซิงค์ข้อมูลอัตโนมัติตลอดเวลา
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setAutoSyncEnabled(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap transition-colors ${
                autoSyncEnabled
                  ? isDark
                    ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/80'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                  : isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
              }`}
              title="เปิด/ปิดการดึงข้อมูลล่าสุดจาก Google Sheets อัตโนมัติทุก 15 วินาที"
            >
              <Activity className={`w-3.5 h-3.5 ${autoSyncEnabled ? 'animate-pulse' : ''}`} />
              <span>{autoSyncEnabled ? 'อัปเดตอัตโนมัติ: เปิด' : 'อัปเดตอัตโนมัติ: ปิด'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedClassroom !== 'all') setNewClassroom(selectedClassroom);
                setIsAddModalOpen(true);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap transition-colors ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-800'
              }`}
            >
              <UserPlus className="w-4 h-4 text-cyan-500" />
              <span>เพิ่มนักเรียน</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap transition-colors ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-emerald-400'
                  : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>ส่งออก CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSheetModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap transition-colors ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-300'
                  : 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200 text-cyan-700'
              }`}
              title="ดูและคัดลอกโค้ด Google Apps Script เวอร์ชันอัปเดตคอลัมน์ห้องเรียน"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>โค้ด Google Sheet</span>
            </button>

            <button
              type="button"
              onClick={() => syncTeacherData(true)}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white whitespace-nowrap shadow-sm transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'กำลังอัปเดต...' : 'อัปเดตทันที'}</span>
            </button>
          </div>
        </div>

        {/* 2. Prominent Classroom Selector Bar */}
        <div className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
            <span className={`text-xs font-semibold whitespace-nowrap shrink-0 mr-1 ${mutedTextClass}`}>
              แยกตามห้อง:
            </span>

            <button
              type="button"
              onClick={() => setSelectedClassroom('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                selectedClassroom === 'all'
                  ? 'bg-cyan-600 border-cyan-500 text-white shadow-xs'
                  : isDark
                  ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              ทุกห้องเรียน ({studentSummaries.length} คน)
            </button>

            {classroomCards.map(({ room, members }) => {
              const active = selectedClassroom === room;
              return (
                <button
                  key={room}
                  type="button"
                  onClick={() => setSelectedClassroom(room)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-cyan-600 border-cyan-500 text-white shadow-xs'
                      : isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {room} <span className="opacity-75 font-mono tabular-nums">({members.length})</span>
                </button>
              );
            })}
          </div>
        </div>

        {syncNotice && (
          <div
            className={`mt-3 px-4 py-2.5 rounded-xl border text-xs font-medium flex flex-wrap items-center justify-between gap-2 ${
              syncNoticeNeedsScript
                ? isDark
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
                : isDark
                ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300'
                : 'bg-cyan-50 border-cyan-200 text-cyan-800'
            }`}
          >
            <span>{syncNotice}</span>
            <div className="flex items-center gap-2 shrink-0">
              {syncNoticeNeedsScript && (
                <button
                  type="button"
                  onClick={() => setIsSheetModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>เปิดโค้ด Google Sheet เพื่ออัปเดต</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSyncNotice(null);
                  setSyncNoticeNeedsScript(false);
                }}
                className="p-1 rounded-md opacity-70 hover:opacity-100 transition-opacity"
                aria-label="ปิดการแจ้งเตือน"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Aggregated Statistics Strip (Combined All Students / Scoped Classroom) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className={`border rounded-2xl p-4 sm:p-5 ${surfaceClass}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs font-medium ${mutedTextClass}`}>
              นักเรียน{selectedClassroom === 'all' ? 'ทั้งหมด (รวมทุกห้อง)' : `ห้อง ${selectedClassroom}`}
            </span>
            <Users className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums">
            {scopedStats.total}{' '}
            <span className={`text-sm font-sans font-normal ${mutedTextClass}`}>คน</span>
          </div>
          <p className={`text-xs mt-1 font-mono tabular-nums ${mutedTextClass}`}>
            {selectedClassroom === 'all' ? `${activeRoomsCount} ห้อง · ` : ''}
            เริ่มฝึก {scopedStats.active} · ครบ 100% {scopedStats.done100} คน
          </p>
        </div>

        <div className={`border rounded-2xl p-4 sm:p-5 ${surfaceClass}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs font-medium ${mutedTextClass}`}>พัฒนาการสอบ Pre → Post เฉลี่ย</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums">
            <span className={mutedTextClass}>{scopedStats.avgPre ?? '-'}</span>
            <span className={`mx-1.5 text-base ${mutedTextClass}`}>→</span>
            <span className="text-amber-500">{scopedStats.avgPost ?? '-'}</span>
            <span className={`text-xs font-sans font-normal ml-1 ${mutedTextClass}`}>/10</span>
          </div>
          <p className={`text-xs mt-1 font-mono tabular-nums ${mutedTextClass}`}>
            {scopedStats.avgDelta !== null
              ? `พัฒนาการเฉลี่ย ${scopedStats.avgDelta >= 0 ? '+' : ''}${scopedStats.avgDelta} ข้อ (ดีขึ้น ${scopedStats.improvedExamCount} คน)`
              : 'รอผลสอบ Pre และ Post ครบคู่'}
          </p>
        </div>

        <div className={`border rounded-2xl p-4 sm:p-5 ${surfaceClass}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs font-medium ${mutedTextClass}`}>ความเร็ว &amp; ความแม่นยำรวม</span>
            <BookOpen className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-emerald-500">
            {scopedStats.avgWpm}{' '}
            <span className={`text-sm font-sans font-normal ${mutedTextClass}`}>WPM</span>
          </div>
          <p className={`text-xs mt-1 font-mono tabular-nums ${mutedTextClass}`}>
            สูงสุด {scopedStats.topWpm} WPM · แม่นยำเฉลี่ย {scopedStats.avgAccuracy}%
          </p>
        </div>

        <div className={`border rounded-2xl p-4 sm:p-5 ${surfaceClass}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs font-medium ${mutedTextClass}`}>ความคืบหน้า &amp; เหรียญตรารวม</span>
            <Award className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-indigo-400">
            {scopedStats.avgCompletion}%
          </div>
          <p className={`text-xs mt-1 font-mono tabular-nums ${mutedTextClass}`}>
            เหรียญรวม {scopedStats.totalMedals} เหรียญ · ฝึกแล้ว {scopedStats.totalSessions} ครั้ง
          </p>
        </div>
      </div>

      {/* 4. Classroom Overview Cards (Visual Split by Classroom) */}
      <div className={`border rounded-2xl p-4 sm:p-5 ${surfaceClass}`}>
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-500" />
            <h2 className="text-sm sm:text-base font-bold">ภาพรวมสถิติแยกตามห้องเรียน</h2>
          </div>
          {selectedClassroom !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedClassroom('all')}
              className="text-xs font-semibold text-cyan-500 hover:underline"
            >
              ดูรวมทุกห้อง
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {classroomCards.map(({ room, members, stats }) => {
            const isSelected = selectedClassroom === room;
            return (
              <button
                key={room}
                type="button"
                onClick={() => setSelectedClassroom(isSelected ? 'all' : room)}
                className={`text-left p-3.5 rounded-2xl border transition-all ${
                  isSelected
                    ? isDark
                      ? 'bg-cyan-950/40 border-cyan-500 ring-1 ring-cyan-500/40'
                      : 'bg-cyan-50/90 border-cyan-500 ring-1 ring-cyan-500/30'
                    : isDark
                    ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-50/80 border-slate-200 hover:border-cyan-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-bold text-sm text-cyan-500">{room}</span>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-mono tabular-nums font-bold ${
                      isDark ? 'bg-slate-800 text-slate-200' : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    {members.length} คน
                  </span>
                </div>

                {/* Room Progress Bar */}
                <div className="mb-2.5">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className={mutedTextClass}>ความคืบหน้าเฉลี่ย</span>
                    <span className="font-mono tabular-nums font-bold">{stats.avgCompletion}%</span>
                  </div>
                  <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all"
                      style={{ width: `${stats.avgCompletion}%` }}
                    />
                  </div>
                </div>

                <div className={`grid grid-cols-3 gap-1.5 text-[11px] font-mono tabular-nums ${mutedTextClass}`}>
                  <div>
                    <div className="text-[10px] font-sans opacity-80">WPM</div>
                    <div className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {stats.avgWpm || '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-sans opacity-80">แม่นยำ</div>
                    <div className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {stats.avgAccuracy ? `${stats.avgAccuracy}%` : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-sans opacity-80">Pre→Post</div>
                    <div className="font-bold text-amber-500">
                      {stats.avgPre ?? '-'}→{stats.avgPost ?? '-'}
                    </div>
                  </div>
                </div>

                {/* Mini Avatar Stack */}
                {members.length > 0 && (
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-500/15">
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {members.slice(0, 5).map(m => (
                        <UserAvatar
                          key={m.uid}
                          avatar={m.avatar}
                          name={m.displayName}
                          seed={m.uid || m.studentId}
                          gradient={m.avatarBg}
                          size="xs"
                          className="ring-2 ring-slate-900/40"
                        />
                      ))}
                      {members.length > 5 && (
                        <span
                          className={`w-6 h-6 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center ${
                            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          +{members.length - 5}
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] font-mono tabular-nums ${mutedTextClass}`}>
                      ครบ 100%: {stats.done100}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. View Switcher + Search/Status Filter */}
      <div className={`border rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${surfaceClass}`}>
        <div
          className={`inline-flex flex-wrap p-1 rounded-xl border self-start gap-1 ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => setViewMode('students')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              viewMode === 'students'
                ? isDark
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-900 shadow-xs'
                : mutedTextClass
            }`}
          >
            <ListChecks className="w-3.5 h-3.5 text-cyan-500" />
            <span>
              {selectedClassroom === 'all' ? 'รายชื่อแยกตามห้อง' : `รายชื่อห้อง ${selectedClassroom}`} ({filteredStudents.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('prepost')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              viewMode === 'prepost'
                ? isDark
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-900 shadow-xs'
                : mutedTextClass
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5 text-amber-500" />
            <span>
              เปรียบเทียบ Pre-Test / Post-Test ({scopedStats.pairedCount}/{scopedStats.total})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('development')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              viewMode === 'development'
                ? isDark
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-900 shadow-xs'
                : mutedTextClass
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>ติดตามพัฒนาการรายบุคคล</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('summary')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              viewMode === 'summary'
                ? isDark
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-900 shadow-xs'
                : mutedTextClass
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
            <span>เปรียบเทียบห้อง &amp; 10 ด่าน</span>
          </button>
        </div>

        {viewMode !== 'summary' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-56 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อ, รหัส หรือห้อง..."
                className={`w-full pl-8 pr-3 py-2 rounded-xl border text-xs focus:outline-none focus:border-cyan-500 ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            {viewMode !== 'prepost' && (
              <select
                value={completionFilter}
                onChange={e => setCompletionFilter(e.target.value as CompletionFilter)}
                className={`px-3 py-2 rounded-xl border text-xs focus:outline-none focus:border-cyan-500 ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-slate-200'
                    : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                <option value="all">สถานะทั้งหมด</option>
                <option value="complete_100">ผ่านครบ 100%</option>
                <option value="in_progress">กำลังเรียน</option>
                <option value="not_started">ยังไม่เริ่มเรียน</option>
              </select>
            )}
          </div>
        )}
      </div>

      {/* 6A. VIEW 1: GROUPED BY CLASSROOM (ALL) OR SINGLE CLASSROOM ROSTER */}
      {viewMode === 'students' && (
        selectedClassroom === 'all' ? (
          <div className="space-y-4">
            {groupedFilteredByClassroom.length === 0 ? (
              <div className={`border rounded-2xl p-12 text-center text-sm ${surfaceClass} ${mutedTextClass}`}>
                ไม่พบรายชื่อนักเรียนที่ตรงกับเงื่อนไขการค้นหา
              </div>
            ) : (
              groupedFilteredByClassroom.map(({ room, students, stats }) => (
                <div key={room} className={`border rounded-2xl overflow-hidden ${surfaceClass}`}>
                  <div
                    className={`px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-3 ${
                      isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-500 text-xs font-bold">
                        ห้อง {room}
                      </span>
                      <span className="text-xs font-semibold">
                        {students.length} คน
                      </span>
                      <span className={`text-xs font-mono tabular-nums ${mutedTextClass}`}>
                        · เฉลี่ย {stats.avgWpm} WPM · แม่นยำ {stats.avgAccuracy}% · ความคืบหน้า {stats.avgCompletion}%
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedClassroom(room)}
                      className="text-xs font-semibold text-cyan-500 hover:underline"
                    >
                      ดูเฉพาะห้อง {room} →
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-[13px]">
                      <thead
                        className={`border-b font-semibold text-xs ${
                          isDark
                            ? 'bg-slate-950/40 border-slate-800 text-slate-400'
                            : 'bg-slate-50/70 border-slate-200 text-slate-600'
                        }`}
                      >
                        <tr>
                          <th className="py-3 px-4">นักเรียน</th>
                          <th className="py-3 px-3 text-center">Pre → Post</th>
                          <th className="py-3 px-3 text-center">ด่านเกม &amp; เหรียญตรา</th>
                          <th className="py-3 px-3 text-right">ความเร็ว / พัฒนาการ</th>
                          <th className="py-3 px-3 text-right">ความคืบหน้า</th>
                          <th className="py-3 px-4 text-right">รายละเอียด</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-slate-800/70' : 'divide-slate-200'}`}>
                        {students.map(renderStudentRow)}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className={`border rounded-2xl overflow-hidden ${surfaceClass}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-[13px]">
                <thead
                  className={`border-b font-semibold text-xs ${
                    isDark
                      ? 'bg-slate-950/70 border-slate-800 text-slate-400'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <tr>
                    <th className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleSort('name')}
                        className="inline-flex items-center gap-1 hover:text-cyan-500"
                      >
                        <span>นักเรียน</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3.5 px-3 text-center">Pre → Post</th>
                    <th className="py-3.5 px-3 text-center">ด่านเกม &amp; เหรียญตรา</th>
                    <th className="py-3.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('wpm')}
                        className="inline-flex items-center gap-1 hover:text-cyan-500 ml-auto"
                      >
                        <span>ความเร็ว / พัฒนาการ</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('completion')}
                        className="inline-flex items-center gap-1 hover:text-cyan-500 ml-auto"
                      >
                        <span>ความคืบหน้า</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3.5 px-4 text-right">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800/70' : 'divide-slate-200'}`}>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={`py-12 text-center text-sm ${mutedTextClass}`}>
                        ยังไม่มีข้อมูลนักเรียนในห้อง {selectedClassroom}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(renderStudentRow)
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* 6A-2. VIEW: DEDICATED PRE-TEST VS POST-TEST COMPARISON */}
      {viewMode === 'prepost' && (
        <div className="space-y-5">
          {/* 4 Pre/Post Comparison KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className={`border rounded-2xl p-4 sm:p-5 ${surfaceClass}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-medium ${mutedTextClass}`}>ทำ Pre-Test แล้ว</span>
                <ClipboardCheck className="w-4 h-4 text-sky-500" />
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-sky-500">
                {scopedStats.preCount}{' '}
                <span className={`text-xs font-sans font-normal ${mutedTextClass}`}>/ {scopedStats.total} คน</span>
              </div>
              <p className={`text-xs mt-1 font-mono tabular-nums ${mutedTextClass}`}>
                เฉลี่ย Pre-Test: {scopedStats.avgPre !== null ? `${scopedStats.avgPre} / 10` : '-'}
              </p>
            </div>

            <div className={`border rounded-2xl p-4 sm:p-5 ${surfaceClass}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-medium ${mutedTextClass}`}>สอบครบคู่ Pre &amp; Post</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-500">
                {scopedStats.pairedCount}{' '}
                <span className={`text-xs font-sans font-normal ${mutedTextClass}`}>คน</span>
              </div>
              <p className={`text-xs mt-1 font-mono tabular-nums ${mutedTextClass}`}>
                ทำ Post-Test แล้ว {scopedStats.postCount} คน · ดีขึ้น {scopedStats.improvedExamCount} คน
              </p>
            </div>

            <div className={`border rounded-2xl p-4 sm:p-5 ${surfaceClass}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-medium ${mutedTextClass}`}>คะแนนข้อสอบเฉลี่ย Pre → Post</span>
                <TrendingUp className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums">
                <span className="text-sky-500">{scopedStats.avgPre ?? '-'}</span>
                <span className={`mx-1.5 text-base ${mutedTextClass}`}>→</span>
                <span className="text-amber-500">{scopedStats.avgPost ?? '-'}</span>
                <span className={`text-xs font-sans font-normal ml-1 ${mutedTextClass}`}>/10</span>
              </div>
              <p className={`text-xs mt-1 font-mono tabular-nums ${
                scopedStats.avgDelta !== null && scopedStats.avgDelta > 0
                  ? 'text-emerald-500 font-semibold'
                  : mutedTextClass
              }`}>
                {scopedStats.avgDelta !== null
                  ? `ผลต่างเฉลี่ย ${scopedStats.avgDelta > 0 ? '+' : ''}${scopedStats.avgDelta} คะแนน`
                  : 'รอคะแนนครบทั้ง Pre และ Post'}
              </p>
            </div>

            <div className={`border rounded-2xl p-4 sm:p-5 ${surfaceClass}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-medium ${mutedTextClass}`}>พิมพ์ปฏิบัติ Pre → Post (WPM)</span>
                <Keyboard className="w-4 h-4 text-cyan-500" />
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums">
                <span className="text-sky-500">{scopedStats.avgPreTypingWpm ?? '-'}</span>
                <span className={`mx-1.5 text-base ${mutedTextClass}`}>→</span>
                <span className="text-emerald-500">{scopedStats.avgPostTypingWpm ?? '-'}</span>
                <span className={`text-xs font-sans font-normal ml-1 ${mutedTextClass}`}>WPM</span>
              </div>
              <p className={`text-xs mt-1 font-mono tabular-nums ${
                scopedStats.avgTypingWpmDelta !== null && scopedStats.avgTypingWpmDelta > 0
                  ? 'text-emerald-500 font-semibold'
                  : mutedTextClass
              }`}>
                {scopedStats.avgTypingWpmDelta !== null
                  ? `ความเร็วเพิ่มเฉลี่ย ${scopedStats.avgTypingWpmDelta > 0 ? '+' : ''}${scopedStats.avgTypingWpmDelta} WPM`
                  : 'รอผลพิมพ์ปฏิบัติครบคู่'}
              </p>
            </div>
          </div>

          {/* Classroom Pre-Test vs Post-Test Visual Comparison */}
          {classroomCards.some(c => c.members.length > 0) && (
            <div className={`border rounded-2xl p-5 ${surfaceClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-cyan-500" />
                    <span>เปรียบเทียบคะแนนเฉลี่ย Pre-Test vs Post-Test แยกรายห้อง</span>
                  </h2>
                  <p className={`text-xs mt-0.5 ${mutedTextClass}`}>
                    เปรียบเทียบค่าเฉลี่ยข้อสอบความรู้ 10 ข้อของนักเรียนในแต่ละห้องเรียนแบบเรียลไทม์
                  </p>
                </div>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 inline-block" />
                    <span className={mutedTextClass}>Pre-Test (ก่อนเรียน)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                    <span className={mutedTextClass}>Post-Test (หลังเรียน)</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {classroomCards
                  .filter(c => c.members.length > 0)
                  .map(({ room, members, stats }) => {
                    const prePct = stats.avgPre !== null ? Math.round((stats.avgPre / 10) * 100) : 0;
                    const postPct = stats.avgPost !== null ? Math.round((stats.avgPost / 10) * 100) : 0;
                    return (
                      <div
                        key={room}
                        onClick={() => setSelectedClassroom(selectedClassroom === room ? 'all' : room)}
                        className={`cursor-pointer p-3.5 rounded-2xl border transition-all ${
                          selectedClassroom === room
                            ? isDark
                              ? 'bg-cyan-950/35 border-cyan-500'
                              : 'bg-cyan-50 border-cyan-500'
                            : isDark
                            ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                            : 'bg-slate-50 border-slate-200 hover:border-cyan-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span className="font-bold text-sm text-cyan-500">ห้อง {room}</span>
                          <span className={`text-[11px] font-mono tabular-nums ${mutedTextClass}`}>
                            สอบครบ {stats.pairedCount}/{members.length} คน
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <div className="flex justify-between text-[11px] font-mono tabular-nums mb-0.5">
                              <span className={mutedTextClass}>Pre-Test</span>
                              <span className="font-bold text-sky-500">
                                {stats.avgPre !== null ? `${stats.avgPre} / 10` : '-'}
                              </span>
                            </div>
                            <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                              <div className="h-full bg-sky-500 rounded-full" style={{ width: `${prePct}%` }} />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-[11px] font-mono tabular-nums mb-0.5">
                              <span className={mutedTextClass}>Post-Test</span>
                              <span className="font-bold text-amber-500">
                                {stats.avgPost !== null ? `${stats.avgPost} / 10` : '-'}
                                {stats.avgDelta !== null && (
                                  <span
                                    className={`ml-1.5 ${
                                      stats.avgDelta > 0
                                        ? 'text-emerald-500'
                                        : stats.avgDelta < 0
                                        ? 'text-rose-500'
                                        : mutedTextClass
                                    }`}
                                  >
                                    ({stats.avgDelta > 0 ? `+${stats.avgDelta}` : stats.avgDelta})
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${postPct}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Student Pre-Test vs Post-Test Comparison Table */}
          <div className={`border rounded-2xl overflow-hidden ${surfaceClass}`}>
            <div className={`p-4 sm:p-5 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div>
                <h2 className="text-base font-bold">
                  ตารางบันทึกและเปรียบเทียบคะแนน Pre-Test vs Post-Test รายบุคคล
                </h2>
                <p className={`text-xs mt-0.5 ${mutedTextClass}`}>
                  ดึงข้อมูลจาก Google Sheets ชีต Scores และ PrePostTests อัตโนมัติ (แสดงผล {filteredPrePostStudents.length} คน)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: 'all', label: 'ทั้งหมด' },
                    { id: 'paired', label: 'ครบทั้ง Pre & Post' },
                    { id: 'improved', label: 'คะแนนดีขึ้น (+)' },
                    { id: 'pre_only', label: 'ทำเฉพาะ Pre-Test' },
                    { id: 'not_tested', label: 'ยังไม่สอบ' }
                  ] as { id: PrePostFilter; label: string }[]
                ).map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPrePostFilter(tab.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      prePostFilter === tab.id
                        ? 'bg-cyan-600 border-cyan-500 text-white'
                        : isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleExportPrePostCsv}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    isDark
                      ? 'bg-emerald-950/60 hover:bg-emerald-900/60 border-emerald-500/40 text-emerald-300'
                      : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-700'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ส่งออกรายงาน Pre-Post CSV</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead
                  className={`border-b font-semibold ${
                    isDark
                      ? 'bg-slate-950/70 border-slate-800 text-slate-400'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <tr>
                    <th className="py-3 px-4">นักเรียน / ห้องเรียน</th>
                    <th className="py-3 px-3 text-center">Pre-Test (10 ข้อ)</th>
                    <th className="py-3 px-3 text-center">Post-Test (10 ข้อ)</th>
                    <th className="py-3 px-3 text-center">ผลต่างข้อสอบ</th>
                    <th className="py-3 px-3">กราฟเทียบ Pre / Post</th>
                    <th className="py-3 px-3 text-center">พิมพ์ปฏิบัติ (Pre → Post)</th>
                    <th className="py-3 px-4 text-right">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800/70' : 'divide-slate-200'}`}>
                  {filteredPrePostStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={`py-10 text-center text-sm ${mutedTextClass}`}>
                        ไม่พบข้อมูลนักเรียนที่ตรงกับตัวกรอง
                      </td>
                    </tr>
                  ) : (
                    filteredPrePostStudents.map(student => {
                      const preQ = student.pretestQuizScore;
                      const postQ = student.posttestQuizScore;
                      const diffQ = student.examDelta;
                      return (
                        <tr
                          key={student.uid}
                          onClick={() => setSelectedStudentUid(student.uid)}
                          className={`cursor-pointer transition-colors ${
                            isDark ? 'hover:bg-slate-800/50' : 'hover:bg-cyan-50/50'
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <UserAvatar
                                avatar={student.avatar}
                                name={student.displayName}
                                seed={student.uid || student.studentId}
                                gradient={student.avatarBg}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <div className="font-semibold truncate max-w-[190px]">{student.fullName}</div>
                                <div className={`text-[11px] font-mono tabular-nums ${mutedTextClass}`}>
                                  {student.studentId} ·{' '}
                                  <span className="text-cyan-500 font-sans font-semibold">{student.classroom}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 text-center font-mono tabular-nums whitespace-nowrap">
                            {preQ !== null ? (
                              <div>
                                <div className="text-sm font-bold text-sky-500">{preQ} / 10</div>
                                <div className={`text-[10px] ${mutedTextClass}`}>
                                  {Math.round((preQ / 10) * 100)}%
                                  {student.pretestQuizDate
                                    ? ` · ${new Date(student.pretestQuizDate).toLocaleDateString('th-TH', {
                                        day: 'numeric',
                                        month: 'short'
                                      })}`
                                    : ''}
                                </div>
                              </div>
                            ) : (
                              <span className={mutedTextClass}>ยังไม่สอบ</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-center font-mono tabular-nums whitespace-nowrap">
                            {postQ !== null ? (
                              <div>
                                <div className="text-sm font-bold text-amber-500">{postQ} / 10</div>
                                <div className={`text-[10px] ${mutedTextClass}`}>
                                  {Math.round((postQ / 10) * 100)}%
                                  {student.posttestQuizDate
                                    ? ` · ${new Date(student.posttestQuizDate).toLocaleDateString('th-TH', {
                                        day: 'numeric',
                                        month: 'short'
                                      })}`
                                    : ''}
                                </div>
                              </div>
                            ) : (
                              <span className={mutedTextClass}>รอสอบ</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-center font-mono tabular-nums whitespace-nowrap">
                            {diffQ !== null ? (
                              <span
                                className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg font-bold ${
                                  diffQ > 0
                                    ? 'bg-emerald-500/15 text-emerald-500'
                                    : diffQ < 0
                                    ? 'bg-rose-500/15 text-rose-500'
                                    : 'bg-slate-500/15 text-slate-400'
                                }`}
                              >
                                {diffQ > 0 ? (
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                ) : diffQ < 0 ? (
                                  <ArrowDownRight className="w-3.5 h-3.5" />
                                ) : (
                                  <Minus className="w-3 h-3" />
                                )}
                                <span>{diffQ > 0 ? `+${diffQ} ข้อ` : `${diffQ} ข้อ`}</span>
                              </span>
                            ) : (
                              <span className={`text-[11px] font-sans ${mutedTextClass}`}>
                                {preQ !== null ? 'รอ Post-Test' : '-'}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 min-w-[140px]">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] w-7 ${mutedTextClass}`}>Pre</span>
                                <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                  <div
                                    className="h-full bg-sky-500 rounded-full"
                                    style={{ width: `${preQ !== null ? Math.max(preQ * 10, 6) : 0}%` }}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] w-7 ${mutedTextClass}`}>Post</span>
                                <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                  <div
                                    className={`h-full rounded-full ${
                                      diffQ !== null && diffQ > 0 ? 'bg-emerald-500' : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${postQ !== null ? Math.max(postQ * 10, 6) : 0}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 text-center font-mono tabular-nums whitespace-nowrap">
                            {student.pretestTypingWpm !== null || student.posttestTypingWpm !== null ? (
                              <div>
                                <div>
                                  <span className="text-sky-500 font-bold">{student.pretestTypingWpm ?? '-'}</span>
                                  <span className={`mx-1 ${mutedTextClass}`}>→</span>
                                  <span className="text-emerald-500 font-bold">{student.posttestTypingWpm ?? '-'}</span>
                                  <span className={`text-[10px] ml-0.5 ${mutedTextClass}`}>WPM</span>
                                </div>
                                {student.typingTestWpmDelta !== null && (
                                  <div
                                    className={`text-[10px] font-bold ${
                                      student.typingTestWpmDelta > 0
                                        ? 'text-emerald-500'
                                        : student.typingTestWpmDelta < 0
                                        ? 'text-rose-500'
                                        : mutedTextClass
                                    }`}
                                  >
                                    {student.typingTestWpmDelta > 0
                                      ? `+${student.typingTestWpmDelta} WPM`
                                      : `${student.typingTestWpmDelta} WPM`}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className={mutedTextClass}>-</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setSelectedStudentUid(student.uid);
                              }}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                isDark
                                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-300'
                                  : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-cyan-700'
                              }`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>ดูผลเทียบ</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6B. VIEW 2: INDIVIDUAL DEVELOPMENT TRACKER */}
      {viewMode === 'development' && (
        <div className={`border rounded-2xl overflow-hidden ${surfaceClass}`}>
          <div className={`p-4 sm:p-5 border-b flex flex-wrap items-center justify-between gap-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div>
              <h2 className="text-base font-bold">ตารางเช็คพัฒนาการรายบุคคล (เทียบครั้งแรก → ล่าสุด)</h2>
              <p className={`text-xs mt-0.5 ${mutedTextClass}`}>
                เปรียบเทียบคะแนนสอบก่อน-หลังเรียน และพัฒนาการความเร็วการพิมพ์ (WPM) ของนักเรียนแต่ละคนแบบเรียลไทม์
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => handleSort('growth')}
                className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
                  sortField === 'growth'
                    ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10'
                    : isDark
                    ? 'border-slate-700 text-slate-300'
                    : 'border-slate-300 text-slate-700'
                }`}
              >
                เรียงตามพัฒนาการ WPM
              </button>
              <button
                type="button"
                onClick={() => handleSort('recent')}
                className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
                  sortField === 'recent'
                    ? 'border-cyan-500 text-cyan-500 bg-cyan-500/10'
                    : isDark
                    ? 'border-slate-700 text-slate-300'
                    : 'border-slate-300 text-slate-700'
                }`}
              >
                เรียงตามกิจกรรมล่าสุด
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead
                className={`border-b font-semibold ${
                  isDark
                    ? 'bg-slate-950/70 border-slate-800 text-slate-400'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <tr>
                  <th className="py-3 px-4">นักเรียน / ห้อง</th>
                  <th className="py-3 px-3 text-center">Pre → Post (ผลต่าง)</th>
                  <th className="py-3 px-3 text-center">WPM แรก → ล่าสุด</th>
                  <th className="py-3 px-3 text-center">พัฒนาการ WPM</th>
                  <th className="py-3 px-3 text-center">แม่นยำเฉลี่ย</th>
                  <th className="py-3 px-3 text-center">เหรียญตรา</th>
                  <th className="py-3 px-4 text-right">อัปเดตล่าสุด</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800/70' : 'divide-slate-200'}`}>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`py-10 text-center ${mutedTextClass}`}>
                      ไม่พบข้อมูลนักเรียน
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(student => (
                    <tr
                      key={student.uid}
                      onClick={() => setSelectedStudentUid(student.uid)}
                      className={`cursor-pointer transition-colors ${
                        isDark ? 'hover:bg-slate-800/50' : 'hover:bg-cyan-50/50'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            avatar={student.avatar}
                            name={student.displayName}
                            seed={student.uid || student.studentId}
                            gradient={student.avatarBg}
                            size="sm"
                          />
                          <div>
                            <div className="font-semibold">{student.fullName}</div>
                            <div className={`text-[11px] font-mono ${mutedTextClass}`}>
                              {student.studentId} · <span className="text-cyan-500 font-sans font-semibold">{student.classroom}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center font-mono tabular-nums">
                        {student.pretestQuizScore !== null || student.posttestQuizScore !== null ? (
                          <div className="inline-flex items-center gap-1.5">
                            <span>{student.pretestQuizScore ?? '-'} → {student.posttestQuizScore ?? '-'}</span>
                            {student.examDelta !== null && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  student.examDelta > 0
                                    ? 'bg-emerald-500/15 text-emerald-500'
                                    : student.examDelta < 0
                                    ? 'bg-rose-500/15 text-rose-500'
                                    : 'bg-slate-500/15 text-slate-400'
                                }`}
                              >
                                {student.examDelta > 0 ? `+${student.examDelta}` : student.examDelta}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className={mutedTextClass}>-</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center font-mono tabular-nums">
                        {student.chronologicalTyping.length > 0 ? (
                          <span>
                            {student.firstWpm} → <strong className="text-cyan-500">{student.latestWpm}</strong>
                            <span className={`ml-1 text-[10px] ${mutedTextClass}`}>(สูงสุด {student.bestWpm})</span>
                          </span>
                        ) : (
                          <span className={mutedTextClass}>-</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center font-mono tabular-nums">
                        {student.chronologicalTyping.length >= 2 ? (
                          <span
                            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg font-bold ${
                              student.wpmGrowth > 0
                                ? 'bg-emerald-500/15 text-emerald-500'
                                : student.wpmGrowth < 0
                                ? 'bg-rose-500/15 text-rose-500'
                                : 'bg-slate-500/15 text-slate-400'
                            }`}
                          >
                            {student.wpmGrowth > 0 ? (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            ) : student.wpmGrowth < 0 ? (
                              <ArrowDownRight className="w-3.5 h-3.5" />
                            ) : (
                              <Minus className="w-3 h-3" />
                            )}
                            {student.wpmGrowth > 0 ? `+${student.wpmGrowth}` : student.wpmGrowth} WPM
                          </span>
                        ) : (
                          <span className={`text-[11px] font-sans ${mutedTextClass}`}>รอฝึกเพิ่ม</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center font-mono tabular-nums font-semibold">
                        {student.avgAccuracy > 0 ? `${student.avgAccuracy}%` : '-'}
                      </td>

                      <td className="py-3 px-3 text-center font-mono tabular-nums">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-500 font-bold">
                          <Award className="w-3 h-3" />
                          {student.totalMedalsCount}
                        </span>
                      </td>

                      <td className={`py-3 px-4 text-right text-[11px] ${mutedTextClass}`}>
                        {formatRelativeTime(student.lastActiveAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6C. VIEW 3: CLASSROOM COMPARISON & 10-LEVEL BREAKDOWN */}
      {viewMode === 'summary' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Classroom Comparison */}
          <div className={`border rounded-2xl overflow-hidden ${surfaceClass}`}>
            <div className={`p-5 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h2 className="text-base font-bold">เปรียบเทียบผลสัมฤทธิ์รวมรายห้อง</h2>
              <p className={`text-xs mt-0.5 ${mutedTextClass}`}>
                คลิกที่ชื่อห้องเพื่อเจาะดูรายชื่อนักเรียนและพัฒนาการเฉพาะห้องนั้นทันที
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead
                  className={`border-b font-semibold ${
                    isDark
                      ? 'bg-slate-950/60 border-slate-800 text-slate-400'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <tr>
                    <th className="py-3 px-4">ห้องเรียน</th>
                    <th className="py-3 px-3 text-right">นักเรียน</th>
                    <th className="py-3 px-3 text-right">ครบ 100%</th>
                    <th className="py-3 px-3 text-right">WPM / แม่นยำ</th>
                    <th className="py-3 px-4 text-right">Pre → Post</th>
                  </tr>
                </thead>
                <tbody className={`divide-y font-mono tabular-nums ${isDark ? 'divide-slate-800/70' : 'divide-slate-200'}`}>
                  {classroomCards.filter(c => c.members.length > 0).length === 0 ? (
                    <tr>
                      <td colSpan={5} className={`py-8 text-center font-sans ${mutedTextClass}`}>
                        ยังไม่มีข้อมูลนักเรียนในห้องเรียน
                      </td>
                    </tr>
                  ) : (
                    classroomCards
                      .filter(c => c.members.length > 0)
                      .map(({ room, members, stats }) => (
                        <tr
                          key={room}
                          onClick={() => {
                            setSelectedClassroom(room);
                            setViewMode('students');
                          }}
                          className={`cursor-pointer transition-colors ${
                            isDark ? 'hover:bg-slate-800/50' : 'hover:bg-cyan-50/60'
                          }`}
                        >
                          <td className="py-3 px-4 font-sans font-bold text-cyan-500">
                            {room}
                          </td>
                          <td className="py-3 px-3 text-right">{members.length}</td>
                          <td className="py-3 px-3 text-right text-emerald-500 font-semibold">
                            {stats.done100} ({stats.avgCompletion}%)
                          </td>
                          <td className="py-3 px-3 text-right">
                            {stats.avgWpm || '-'} / {stats.avgAccuracy ? `${stats.avgAccuracy}%` : '-'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {stats.avgPre ?? '-'} → <span className="text-amber-500 font-semibold">{stats.avgPost ?? '-'}</span>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 10 Game Levels Pass Rate */}
          <div className={`border rounded-2xl overflow-hidden ${surfaceClass}`}>
            <div className={`p-5 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h2 className="text-base font-bold">
                สถิติเกม 10 ด่าน ({selectedClassroom === 'all' ? 'รวมทุกห้องเรียน' : `ห้อง ${selectedClassroom}`})
              </h2>
              <p className={`text-xs mt-0.5 ${mutedTextClass}`}>
                ช่วยวิเคราะห์ว่าด่านใดที่นักเรียนผ่านยากหรือต้องเสริมทักษะเพิ่มเติม
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead
                  className={`border-b font-semibold ${
                    isDark
                      ? 'bg-slate-950/60 border-slate-800 text-slate-400'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <tr>
                    <th className="py-3 px-4">ด่าน</th>
                    <th className="py-3 px-3 text-right">ครั้งที่เล่น</th>
                    <th className="py-3 px-3 text-right">ผ่าน</th>
                    <th className="py-3 px-4 text-right">อัตราผ่าน</th>
                  </tr>
                </thead>
                <tbody className={`divide-y font-mono tabular-nums ${isDark ? 'divide-slate-800/70' : 'divide-slate-200'}`}>
                  {levelSummary.map(lvl => (
                    <tr key={lvl.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                      <td className="py-2.5 px-4 font-sans font-medium truncate max-w-[240px]">
                        ด่าน {lvl.id} · {lvl.titleTh}
                      </td>
                      <td className="py-2.5 px-3 text-right">{lvl.attempts}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-500 font-semibold">{lvl.passes}</td>
                      <td className="py-2.5 px-4 text-right">
                        <span
                          className={`font-semibold ${
                            lvl.attempts === 0
                              ? mutedTextClass
                              : lvl.passRate >= 70
                              ? 'text-emerald-500'
                              : lvl.passRate >= 40
                              ? 'text-amber-500'
                              : 'text-rose-500'
                          }`}
                        >
                          {lvl.attempts > 0 ? `${lvl.passRate}%` : '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT DETAIL & DEVELOPMENT MODAL */}
      {selectedStudent && (
        <div
          onClick={() => {
            setSelectedStudentUid(null);
            setConfirmResetUid(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto border rounded-3xl p-6 sm:p-7 shadow-2xl ${surfaceClass}`}
          >
            <div className={`flex items-start justify-between gap-4 pb-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-3.5">
                <UserAvatar
                  avatar={selectedStudent.avatar}
                  name={selectedStudent.displayName}
                  seed={selectedStudent.uid || selectedStudent.studentId}
                  gradient={selectedStudent.avatarBg}
                  size="lg"
                />
                <div>
                  <h2 className="text-xl font-bold">{selectedStudent.fullName}</h2>
                  <div className={`flex flex-wrap items-center gap-2 text-xs mt-1 ${mutedTextClass}`}>
                    <span className="font-mono tabular-nums">รหัส: {selectedStudent.studentId}</span>
                    <span>·</span>
                    <label className="inline-flex items-center gap-1.5">
                      <span>ห้อง:</span>
                      <select
                        value={selectedStudent.classroom}
                        onChange={e => handleChangeStudentClassroom(selectedStudent, e.target.value)}
                        className={`px-2 py-0.5 rounded-lg border text-xs font-semibold focus:outline-none focus:border-cyan-500 ${
                          isDark
                            ? 'bg-slate-950 border-slate-700 text-cyan-400'
                            : 'bg-slate-50 border-slate-300 text-cyan-700'
                        }`}
                      >
                        {Array.from(new Set([...PRESET_CLASSROOMS, 'ทั่วไป', selectedStudent.classroom])).map(roomOpt => (
                          <option key={roomOpt} value={roomOpt}>
                            {roomOpt}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedStudentUid(null);
                  setConfirmResetUid(null);
                }}
                className={`p-2 rounded-xl transition-colors ${
                  isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Key Development KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-[11px] ${mutedTextClass}`}>สอบ Pre → Post</div>
                <div className="text-lg font-bold font-mono tabular-nums mt-0.5">
                  {selectedStudent.pretestQuizScore ?? '-'} →{' '}
                  <span className="text-amber-500">{selectedStudent.posttestQuizScore ?? '-'}</span>
                </div>
                {selectedStudent.examDelta !== null && (
                  <div
                    className={`text-[10px] font-bold mt-0.5 ${
                      selectedStudent.examDelta >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {selectedStudent.examDelta >= 0 ? `+${selectedStudent.examDelta}` : selectedStudent.examDelta} ข้อ
                  </div>
                )}
              </div>

              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-[11px] ${mutedTextClass}`}>พัฒนาการความเร็ว</div>
                <div className="text-lg font-bold font-mono tabular-nums mt-0.5 text-cyan-500">
                  {selectedStudent.bestWpm} WPM
                </div>
                <div className={`text-[10px] font-mono mt-0.5 ${mutedTextClass}`}>
                  {selectedStudent.chronologicalTyping.length >= 2
                    ? `แรก ${selectedStudent.firstWpm} → ล่าสุด ${selectedStudent.latestWpm}`
                    : `เฉลี่ย ${selectedStudent.avgWpm} WPM`}
                </div>
              </div>

              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-[11px] ${mutedTextClass}`}>ความแม่นยำเฉลี่ย</div>
                <div className="text-lg font-bold font-mono tabular-nums mt-0.5 text-emerald-500">
                  {selectedStudent.avgAccuracy}%
                </div>
                <div className={`text-[10px] mt-0.5 ${mutedTextClass}`}>
                  ผ่าน {selectedStudent.completion.passedLevelsCount}/10 ด่าน
                </div>
              </div>

              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-[11px] ${mutedTextClass}`}>ความคืบหน้า &amp; เหรียญ</div>
                <div className="text-lg font-bold font-mono tabular-nums mt-0.5 text-indigo-400">
                  {selectedStudent.completion.completionPercent}%
                </div>
                <div className="text-[10px] text-amber-500 font-semibold mt-0.5">
                  ได้รับแล้ว {selectedStudent.totalMedalsCount} เหรียญตรา
                </div>
              </div>
            </div>

            {/* Dedicated Pre-Test vs Post-Test Comparison Section in Student Modal */}
            <div className={`mb-5 p-4 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-500 flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4" />
                  <span>เปรียบเทียบคะแนน Pre-Test vs Post-Test</span>
                </h3>
                {selectedStudent.examDelta !== null && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono tabular-nums font-bold ${
                      selectedStudent.examDelta > 0
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : selectedStudent.examDelta < 0
                        ? 'bg-rose-500/15 text-rose-500'
                        : 'bg-slate-500/15 text-slate-400'
                    }`}
                  >
                    ข้อสอบ {selectedStudent.examDelta > 0 ? `+${selectedStudent.examDelta}` : selectedStudent.examDelta} ข้อ
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono tabular-nums">
                {/* Quiz Pre vs Post */}
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className="text-xs font-sans font-bold mb-2">ข้อสอบความรู้ 10 ข้อ</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className={`text-[10px] font-sans ${mutedTextClass}`}>Pre-Test</div>
                      <div className="text-base font-black text-sky-500 mt-0.5">
                        {selectedStudent.pretestQuizScore !== null ? `${selectedStudent.pretestQuizScore}/10` : '-'}
                      </div>
                      {selectedStudent.pretestQuizDate && (
                        <div className={`text-[9px] ${mutedTextClass}`}>
                          {new Date(selectedStudent.pretestQuizDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className={`text-[10px] font-sans ${mutedTextClass}`}>Post-Test</div>
                      <div className="text-base font-black text-amber-500 mt-0.5">
                        {selectedStudent.posttestQuizScore !== null ? `${selectedStudent.posttestQuizScore}/10` : '-'}
                      </div>
                      {selectedStudent.posttestQuizDate && (
                        <div className={`text-[9px] ${mutedTextClass}`}>
                          {new Date(selectedStudent.posttestQuizDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className={`text-[10px] font-sans ${mutedTextClass}`}>ผลต่าง</div>
                      <div
                        className={`text-base font-black mt-0.5 ${
                          selectedStudent.examDelta === null
                            ? mutedTextClass
                            : selectedStudent.examDelta > 0
                            ? 'text-emerald-500'
                            : selectedStudent.examDelta < 0
                            ? 'text-rose-500'
                            : 'text-cyan-500'
                        }`}
                      >
                        {selectedStudent.examDelta !== null
                          ? selectedStudent.examDelta > 0
                            ? `+${selectedStudent.examDelta}`
                            : `${selectedStudent.examDelta}`
                          : '-'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Practical Typing Pre vs Post */}
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className="text-xs font-sans font-bold mb-2">ทดสอบพิมพ์ปฏิบัติ (WPM)</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className={`text-[10px] font-sans ${mutedTextClass}`}>Pre พิมพ์</div>
                      <div className="text-base font-black text-sky-500 mt-0.5">
                        {selectedStudent.pretestTypingWpm !== null ? `${selectedStudent.pretestTypingWpm}` : '-'}
                      </div>
                      <div className={`text-[9px] ${mutedTextClass}`}>
                        {selectedStudent.pretestTypingAccuracy !== null ? `${selectedStudent.pretestTypingAccuracy}%` : 'ยังไม่ทดสอบ'}
                      </div>
                    </div>
                    <div>
                      <div className={`text-[10px] font-sans ${mutedTextClass}`}>Post พิมพ์</div>
                      <div className="text-base font-black text-emerald-500 mt-0.5">
                        {selectedStudent.posttestTypingWpm !== null ? `${selectedStudent.posttestTypingWpm}` : '-'}
                      </div>
                      <div className={`text-[9px] ${mutedTextClass}`}>
                        {selectedStudent.posttestTypingAccuracy !== null ? `${selectedStudent.posttestTypingAccuracy}%` : 'ยังไม่ทดสอบ'}
                      </div>
                    </div>
                    <div>
                      <div className={`text-[10px] font-sans ${mutedTextClass}`}>ผลต่าง WPM</div>
                      <div
                        className={`text-base font-black mt-0.5 ${
                          selectedStudent.typingTestWpmDelta === null
                            ? mutedTextClass
                            : selectedStudent.typingTestWpmDelta > 0
                            ? 'text-emerald-500'
                            : selectedStudent.typingTestWpmDelta < 0
                            ? 'text-rose-500'
                            : 'text-cyan-500'
                        }`}
                      >
                        {selectedStudent.typingTestWpmDelta !== null
                          ? selectedStudent.typingTestWpmDelta > 0
                            ? `+${selectedStudent.typingTestWpmDelta}`
                            : `${selectedStudent.typingTestWpmDelta}`
                          : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* WPM Development Bar Chart */}
            {selectedStudent.chronologicalTyping.length > 0 && (
              <div className={`mb-5 p-4 rounded-2xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-500">
                    กราฟพัฒนาการความเร็วการพิมพ์ (WPM ล่าสุด {Math.min(selectedStudent.chronologicalTyping.length, 12)} ครั้ง)
                  </h3>
                  <span className={`text-[11px] font-mono ${mutedTextClass}`}>
                    สูงสุด {selectedStudent.bestWpm} WPM
                  </span>
                </div>
                <div className="flex items-end gap-2 h-28 pt-4">
                  {(() => {
                    const recent = selectedStudent.chronologicalTyping.slice(-12);
                    const maxVal = Math.max(...recent.map(r => r.netWpm), 20);
                    return recent.map((rec, idx) => {
                      const pct = Math.max(12, Math.round((rec.netWpm / maxVal) * 100));
                      return (
                        <div
                          key={rec.scoreId || idx}
                          className="flex-1 flex flex-col items-center gap-1 h-full justify-end group"
                          title={`${rec.levelTitle} • ${rec.netWpm} WPM • แม่นยำ ${rec.accuracy}%`}
                        >
                          <span className="text-[10px] font-mono font-bold text-cyan-500">
                            {rec.netWpm}
                          </span>
                          <div
                            className="w-full max-w-[32px] rounded-t-lg bg-gradient-to-t from-cyan-600 to-emerald-400 transition-all"
                            style={{ height: `${pct}%` }}
                          />
                          <span className={`text-[9px] font-mono ${mutedTextClass}`}>
                            #{idx + 1}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* 10-Level Progress Grid */}
            <div className="mb-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2.5 text-cyan-500">
                ความคืบหน้าเกม 10 ด่าน (รายด่าน)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {LEVELS_CONFIG.map(lvl => {
                  const passedInfo = selectedStudent.completion.passedLevelMap.get(lvl.id);
                  return (
                    <div
                      key={lvl.id}
                      className={`p-2.5 rounded-xl border text-xs ${
                        passedInfo
                          ? isDark
                            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                            : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : isDark
                          ? 'bg-slate-950/60 border-slate-800 text-slate-400'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>ด่าน {lvl.id}</span>
                        {passedInfo ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <span className="text-[10px]">-</span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono tabular-nums mt-1">
                        {passedInfo ? `${passedInfo.bestWpm} WPM · ${passedInfo.bestAccuracy}%` : 'ยังไม่ผ่าน'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Activity History Table */}
            <div className="mb-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2.5 text-cyan-500">
                ประวัติการทำแบบทดสอบและการฝึก ({selectedStudent.scores.length} รายการ)
              </h3>
              {selectedStudent.scores.length === 0 ? (
                <p className={`text-xs py-4 text-center border rounded-xl ${isDark ? 'border-slate-800' : 'border-slate-200'} ${mutedTextClass}`}>
                  นักเรียนคนนี้ยังไม่มีประวัติการฝึกพิมพ์หรือสอบ
                </p>
              ) : (
                <div className={`border rounded-xl overflow-hidden max-h-56 overflow-y-auto ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <table className="w-full text-left text-xs">
                    <thead className={isDark ? 'bg-slate-950 text-slate-400' : 'bg-slate-50 text-slate-600'}>
                      <tr>
                        <th className="py-2 px-3">กิจกรรม</th>
                        <th className="py-2 px-2 text-right">WPM</th>
                        <th className="py-2 px-2 text-right">แม่นยำ</th>
                        <th className="py-2 px-3 text-right">วันที่</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                      {selectedStudent.scores.slice(0, 30).map(r => (
                        <tr key={r.scoreId}>
                          <td className="py-2 px-3 truncate max-w-[240px]">{r.levelTitle}</td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums">
                            {String(r.levelId || '').includes('quiz') ? '-' : r.netWpm}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums">{r.accuracy}%</td>
                          <td className={`py-2 px-3 text-right font-mono tabular-nums ${mutedTextClass}`}>
                            {new Date(r.createdAt).toLocaleDateString('th-TH', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className={`flex flex-wrap items-center justify-between gap-3 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openPasswordModal(selectedStudent)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                    isDark
                      ? 'border-amber-500/40 bg-amber-950/30 text-amber-300 hover:bg-amber-900/40'
                      : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>เปลี่ยนรหัสผ่าน</span>
                </button>

                {selectedStudent.scores.length > 0 &&
                  (confirmResetUid === selectedStudent.uid ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-rose-500 font-semibold">ยืนยันการล้างประวัติคะแนน?</span>
                      <button
                        type="button"
                        onClick={() => handleResetStudentProgress(selectedStudent)}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                      >
                        ยืนยันล้างข้อมูล
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmResetUid(null)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                          isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-700'
                        }`}
                      >
                        ยกเลิก
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmResetUid(selectedStudent.uid)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-500/30 text-orange-500 hover:bg-orange-500/10 text-xs font-medium transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>รีเซ็ตประวัติคะแนน</span>
                    </button>
                  ))}

                <button
                  type="button"
                  onClick={() => openDeleteUserModal(selectedStudent)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-xs font-semibold transition-colors"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>ลบบัญชีผู้ใช้</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedStudentUid(null);
                  setConfirmResetUid(null);
                }}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {isAddModalOpen && (
        <div
          onClick={() => {
            setIsAddModalOpen(false);
            setAddError(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-md border rounded-3xl p-6 shadow-2xl ${surfaceClass}`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">เพิ่มรายชื่อนักเรียนใหม่</h2>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setAddError(null);
                }}
                className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddStudentSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1">รหัสนักเรียน *</label>
                <input
                  type="text"
                  required
                  value={newStudentId}
                  onChange={e => setNewStudentId(e.target.value)}
                  placeholder="เช่น 66309010003"
                  className={`w-full px-3 py-2 rounded-xl border font-mono text-sm focus:outline-none focus:border-cyan-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">ชื่อ-นามสกุลจริง *</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={e => {
                    setNewFullName(e.target.value);
                    if (!newDisplayName) {
                      setNewDisplayName(e.target.value.split(' ')[0] || '');
                    }
                  }}
                  placeholder="เช่น นางสาวสุภาพร ตั้งใจเรียน"
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:border-cyan-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">ห้องเรียน</label>
                  <select
                    value={newClassroom}
                    onChange={e => setNewClassroom(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:border-cyan-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {PRESET_CLASSROOMS.map(room => (
                      <option key={room} value={room}>
                        {room}
                      </option>
                    ))}
                    <option value="ทั่วไป">ทั่วไป</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">รหัสผ่านเริ่มต้น</label>
                  <input
                    type="text"
                    required
                    minLength={4}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border font-mono text-sm focus:outline-none focus:border-cyan-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border ${
                    isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-700'
                  }`}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold"
                >
                  {isAdding ? 'กำลังบันทึก...' : 'บันทึกนักเรียน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE USER PASSWORD MODAL (TEACHER ADMIN) */}
      {passwordTargetStudent && (
        <div
          onClick={() => {
            if (!isUpdatingPassword) {
              setPasswordTargetStudent(null);
              setPasswordError(null);
            }
          }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-md border rounded-3xl p-6 shadow-2xl ${surfaceClass}`}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold">เปลี่ยนรหัสผ่านผู้ใช้</h2>
                  <p className={`text-xs ${mutedTextClass}`}>
                    สิทธิ์ครูผู้สอน · อัปเดตรหัสผ่านลง Google Sheet อัตโนมัติ
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isUpdatingPassword}
                onClick={() => {
                  setPasswordTargetStudent(null);
                  setPasswordError(null);
                }}
                className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Student Card */}
            <div className={`flex items-center gap-3 p-3 rounded-2xl border mb-4 ${isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <UserAvatar
                avatar={passwordTargetStudent.avatar}
                name={passwordTargetStudent.displayName}
                seed={passwordTargetStudent.uid || passwordTargetStudent.studentId}
                gradient={passwordTargetStudent.avatarBg}
                size="sm"
              />
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{passwordTargetStudent.fullName}</div>
                <div className={`text-xs font-mono flex items-center gap-1.5 ${mutedTextClass}`}>
                  <span>{passwordTargetStudent.studentId}</span>
                  <span>·</span>
                  <span className="font-sans text-cyan-500 font-semibold">{passwordTargetStudent.classroom}</span>
                </div>
              </div>
            </div>

            {passwordError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium">
                {passwordError}
              </div>
            )}

            <form onSubmit={handleUpdateUserPasswordSubmit} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold">รหัสผ่านใหม่ (อย่างน้อย 4 ตัวอักษร) *</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setNewPassInput('1234');
                        setConfirmPassInput('1234');
                        setShowNewPass(true);
                        setPasswordError(null);
                      }}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors ${
                        isDark
                          ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                          : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                      }`}
                    >
                      ตั้งเป็น 1234
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateRandomPassword}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors ${
                        isDark
                          ? 'bg-cyan-950/60 hover:bg-cyan-900/60 border-cyan-500/30 text-cyan-300'
                          : 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200 text-cyan-700'
                      }`}
                    >
                      สุ่มรหัส 6 หลัก
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    minLength={4}
                    autoFocus
                    value={newPassInput}
                    onChange={e => setNewPassInput(e.target.value)}
                    placeholder="กรอกรหัสผ่านใหม่..."
                    className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl border font-mono text-sm focus:outline-none focus:border-amber-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(prev => !prev)}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md ${mutedTextClass}`}
                    aria-label={showNewPass ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">ยืนยันรหัสผ่านใหม่ *</label>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={confirmPassInput}
                  onChange={e => setConfirmPassInput(e.target.value)}
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border font-mono text-sm focus:outline-none focus:border-amber-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className={`p-3 rounded-xl border text-[11px] flex items-start gap-2 ${isDark ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  เมื่อกดบันทึก ระบบจะอัปเดตรหัสผ่านใหม่ลงในชีต <strong>Users</strong> บน Google Sheets ทันที เพื่อให้นักเรียนใช้รหัสใหม่เข้าสู่ระบบได้จากทุกเครื่อง
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isUpdatingPassword}
                  onClick={() => {
                    setPasswordTargetStudent(null);
                    setPasswordError(null);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border ${
                    isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold shadow-sm transition-all disabled:opacity-60"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{isUpdatingPassword ? 'กำลังอัปเดตลง Google Sheet...' : 'บันทึกรหัสผ่านใหม่'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION MODAL (TEACHER ADMIN) */}
      {deleteTargetStudent && (
        <div
          onClick={() => {
            if (!isDeletingUser) {
              setDeleteTargetStudent(null);
              setDeleteError(null);
            }
          }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-md border rounded-3xl p-6 shadow-2xl ${surfaceClass}`}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/15 text-rose-500">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-rose-500">ยืนยันการลบบัญชีผู้ใช้</h2>
                  <p className={`text-xs ${mutedTextClass}`}>
                    การลบจะไม่สามารถกู้คืนข้อมูลได้
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={() => {
                  setDeleteTargetStudent(null);
                  setDeleteError(null);
                }}
                className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`flex items-center gap-3 p-3.5 rounded-2xl border mb-4 ${isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <UserAvatar
                avatar={deleteTargetStudent.avatar}
                name={deleteTargetStudent.displayName}
                seed={deleteTargetStudent.uid || deleteTargetStudent.studentId}
                gradient={deleteTargetStudent.avatarBg}
                size="sm"
              />
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{deleteTargetStudent.fullName}</div>
                <div className={`text-xs font-mono flex items-center gap-1.5 ${mutedTextClass}`}>
                  <span>{deleteTargetStudent.studentId}</span>
                  <span>·</span>
                  <span className="font-sans text-cyan-500 font-semibold">{deleteTargetStudent.classroom}</span>
                </div>
                <div className={`text-[11px] mt-0.5 ${mutedTextClass}`}>
                  ประวัติคะแนน {deleteTargetStudent.scores.length} รายการ · เหรียญตรา {deleteTargetStudent.totalMedalsCount} เหรียญ
                </div>
              </div>
            </div>

            <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 mb-4 ${isDark ? 'bg-rose-950/30 border-rose-500/30 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              <div className="font-bold">ข้อมูลที่จะถูกลบออกจากระบบและ Google Sheets:</div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                <li>บัญชีผู้ใช้งานและรหัสผ่าน (ชีต <strong>Users</strong>)</li>
                <li>ประวัติการฝึกพิมพ์และคะแนนทั้งหมด (ชีต <strong>Scores</strong>)</li>
                <li>เหรียญตราและผลสอบ Pre-Test / Post-Test (ชีต <strong>UserMedals</strong> &amp; <strong>PrePostTests</strong>)</li>
              </ul>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={() => {
                  setDeleteTargetStudent(null);
                  setDeleteError(null);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border ${
                  isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={handleConfirmDeleteUser}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-60"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>{isDeletingUser ? 'กำลังลบบัญชี...' : 'ยืนยันลบบัญชีผู้ใช้ถาวร'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GOOGLE SHEET APPS SCRIPT UPDATE MODAL */}
      {isSheetModalOpen && (
        <div
          onClick={() => setIsSheetModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-2xl max-h-[88vh] flex flex-col border rounded-3xl p-6 shadow-2xl ${surfaceClass}`}
          >
            <div className={`flex items-start justify-between gap-3 pb-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                  <span>อัปเดต Google Sheet (จัดการผู้ใช้, เปลี่ยนรหัสผ่าน &amp; PrePostTests)</span>
                </h2>
                <p className={`text-xs mt-1 ${mutedTextClass}`}>
                  Sheet ID: <span className="font-mono">{SHEET_ID}</span> · รองรับ <strong className="text-amber-500">เปลี่ยนรหัสผ่าน (updateUserPassword)</strong>, <strong className="text-rose-500">ลบบัญชีผู้ใช้ (deleteUser)</strong>, <strong className="text-cyan-500">Classroom</strong> และชีต <strong>PrePostTests</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSheetModalOpen(false)}
                className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`mt-4 p-3.5 rounded-2xl border text-xs space-y-1.5 ${isDark ? 'bg-slate-950/60 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
              <div className="font-bold text-cyan-500">วิธีอัปเดต Google Apps Script เพื่อเปิดใช้งานการเปลี่ยนรหัสผ่านและลบผู้ใช้บน Sheet:</div>
              <ol className="list-decimal list-inside space-y-1">
                <li>เปิด Google Sheet ของคุณ → เมนู <strong>ส่วนขยาย (Extensions)</strong> → <strong>Apps Script</strong></li>
                <li>กดปุ่ม <strong>คัดลอกโค้ด Apps Script</strong> ด้านล่าง แล้ววางแทนโค้ดเดิมในไฟล์ <span className="font-mono">Code.gs</span></li>
                <li>กด <strong>Deploy → Manage deployments → แก้ไข (ไอคอนดินสอ) → New version → Deploy</strong></li>
              </ol>
            </div>

            <div className="mt-3 flex-1 min-h-0 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${mutedTextClass}`}>โค้ด Google Apps Script (Code.gs)</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(APPS_SCRIPT_CODE_TEMPLATE);
                      setCopiedScript(true);
                      setTimeout(() => setCopiedScript(false), 2500);
                    } catch {
                      // fallback ignored
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold shadow-sm transition-all"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedScript ? 'คัดลอกโค้ดแล้ว ✓' : 'คัดลอกโค้ด Apps Script'}</span>
                </button>
              </div>
              <pre
                className={`flex-1 overflow-auto p-3.5 rounded-2xl border font-mono text-[11px] leading-relaxed select-all ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-slate-300'
                    : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                {APPS_SCRIPT_CODE_TEMPLATE}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
