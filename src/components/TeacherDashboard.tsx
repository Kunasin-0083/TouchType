import React, { useState, useMemo } from 'react';
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
  ListChecks
} from 'lucide-react';
import { ScoreRecord, User } from '../types';
import {
  getLocalUsers,
  getLocalScores,
  apiFetchLeaderboard,
  apiRegisterStudent,
  clearStudentScores
} from '../utils/googleSheets';
import { LEVELS_CONFIG } from '../data/levels';
import { getCurriculumCompletion, CurriculumCompletionInfo } from './MedalShowcase';
import { UserAvatar } from './UserAvatar';
import { useTheme } from '../context/ThemeContext';

interface TeacherDashboardProps {
  currentUser: User | null;
}

type DashboardView = 'students' | 'summary';
type CompletionFilter = 'all' | 'complete_100' | 'in_progress' | 'not_started';
type SortField = 'name' | 'completion' | 'wpm' | 'accuracy';

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
  pretestQuizScore: number | null;
  posttestQuizScore: number | null;
  rankedBestScore: number;
  avgWpm: number;
  bestWpm: number;
  avgAccuracy: number;
}

const PRESET_CLASSROOMS = ['ปวช.3/1', 'ปวช.3/2', 'ปวช.3/3', 'ปวช.3/4'];

export const TeacherDashboard: React.FC<TeacherDashboardProps> = () => {
  const { isDark } = useTheme();
  const [viewMode, setViewMode] = useState<DashboardView>('students');
  const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [remoteScores, setRemoteScores] = useState<ScoreRecord[] | null>(null);

  // Student Detail Modal
  const [selectedStudentUid, setSelectedStudentUid] = useState<string | null>(null);
  const [confirmResetUid, setConfirmResetUid] = useState<string | null>(null);

  // Add Student Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newStudentId, setNewStudentId] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newClassroom, setNewClassroom] = useState('ปวช.3/1');
  const [newPassword, setNewPassword] = useState('1234');
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const allLocalUsers = useMemo(() => getLocalUsers(), [refreshTick]);

  // Combine local & synced scores, excluding demo seed_* records
  const allRealScores = useMemo(() => {
    const local = getLocalScores();
    const map = new Map<string, ScoreRecord>();
    const addRecord = (r: ScoreRecord) => {
      if (!r || !r.scoreId) return;
      if (String(r.uid || '').startsWith('seed_')) return;
      map.set(r.scoreId, r);
    };
    (remoteScores || []).forEach(addRecord);
    local.forEach(addRecord);
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [remoteScores, refreshTick]);

  // Build unified student roster
  const studentSummaries: StudentSummary[] = useMemo(() => {
    const registeredStudents = allLocalUsers.filter(
      u => u.role !== 'teacher' && u.role !== 'admin' && u.username !== 'teacher'
    );

    const rosterMap = new Map<string, User>();
    registeredStudents.forEach(u => {
      rosterMap.set(u.uid, u);
    });

    allRealScores.forEach(s => {
      if (!s.uid || s.uid === 'guest' || s.uid === 'guest_default') return;
      if (s.uid.startsWith('teacher_')) return;
      const alreadyExists =
        rosterMap.has(s.uid) ||
        Array.from(rosterMap.values()).some(
          u => u.studentId === s.uid || u.displayName === s.displayName
        );
      if (!alreadyExists) {
        rosterMap.set(s.uid, {
          uid: s.uid,
          username: s.uid,
          studentId: s.uid.replace(/^std_/, '').split('_')[0],
          fullName: s.displayName,
          classroom: 'ทั่วไป',
          displayName: s.displayName,
          role: 'student',
          avatar: s.avatar || '',
          avatarBg: s.avatarBg || 'from-cyan-500 to-blue-600',
          createdAt: s.createdAt
        });
      }
    });

    return Array.from(rosterMap.values()).map(student => {
      const scores = allRealScores.filter(
        s =>
          s.uid === student.uid ||
          (student.studentId && s.uid === student.studentId) ||
          (student.displayName && s.displayName === student.displayName)
      );

      const completion = getCurriculumCompletion(scores);

      const quizPre = completion.pretestRecords.find(r => String(r.levelId || '').includes('quiz'));
      const quizPost = completion.posttestRecords.find(r => String(r.levelId || '').includes('quiz'));
      const pretestQuizScore = quizPre ? Math.round(quizPre.score / 100) : null;
      const posttestQuizScore = quizPost ? Math.round(quizPost.score / 100) : null;

      const typingOnly = scores.filter(s => !String(s.levelId || '').includes('quiz'));
      const avgWpm = typingOnly.length
        ? Math.round(typingOnly.reduce((acc, s) => acc + s.netWpm, 0) / typingOnly.length)
        : 0;
      const bestWpm = typingOnly.length
        ? Math.max(...typingOnly.map(s => s.netWpm))
        : 0;
      const avgAccuracy = typingOnly.length
        ? Math.round(typingOnly.reduce((acc, s) => acc + s.accuracy, 0) / typingOnly.length)
        : 0;

      const rankedScores = scores.filter(s => s.gameMode === 'ranked' || s.testType === 'RANKED');
      const rankedBestScore = rankedScores.length
        ? Math.max(...rankedScores.map(s => s.score))
        : 0;

      return {
        uid: student.uid,
        studentId: student.studentId || student.username,
        fullName: student.fullName || student.displayName,
        displayName: student.displayName,
        classroom: student.classroom || 'ทั่วไป',
        avatar: student.avatar || '',
        avatarBg: student.avatarBg || 'from-cyan-500 to-blue-600',
        scores,
        completion,
        pretestQuizScore,
        posttestQuizScore,
        rankedBestScore,
        avgWpm,
        bestWpm,
        avgAccuracy
      };
    });
  }, [allLocalUsers, allRealScores]);

  // Classroom list with counts (presets + any custom classrooms that have students)
  const classroomTabs = useMemo(() => {
    const counts = new Map<string, number>();
    studentSummaries.forEach(s => {
      const room = s.classroom || 'ทั่วไป';
      counts.set(room, (counts.get(room) || 0) + 1);
    });

    const orderedRooms: string[] = [];
    PRESET_CLASSROOMS.forEach(r => {
      if (!orderedRooms.includes(r)) orderedRooms.push(r);
    });
    Array.from(counts.keys())
      .sort()
      .forEach(r => {
        if (!orderedRooms.includes(r)) orderedRooms.push(r);
      });

    return orderedRooms.map(room => ({
      room,
      count: counts.get(room) || 0
    }));
  }, [studentSummaries]);

  // Students inside currently selected classroom (used for KPIs & table)
  const roomStudents = useMemo(() => {
    if (selectedClassroom === 'all') return studentSummaries;
    return studentSummaries.filter(s => s.classroom === selectedClassroom);
  }, [studentSummaries, selectedClassroom]);

  // KPI summary scoped to the selected classroom!
  const kpis = useMemo(() => {
    const total = roomStudents.length;
    const active = roomStudents.filter(s => s.scores.length > 0).length;
    const done100 = roomStudents.filter(s => s.completion.isGrandComplete).length;

    const typingList = roomStudents.filter(s => s.avgWpm > 0);
    const avgWpm = typingList.length
      ? Math.round(typingList.reduce((sum, s) => sum + s.avgWpm, 0) / typingList.length)
      : 0;
    const avgAccuracy = typingList.length
      ? Math.round(typingList.reduce((sum, s) => sum + s.avgAccuracy, 0) / typingList.length)
      : 0;

    const preList = roomStudents.filter(s => s.pretestQuizScore !== null);
    const postList = roomStudents.filter(s => s.posttestQuizScore !== null);
    const avgPre = preList.length
      ? Number((preList.reduce((s, m) => s + (m.pretestQuizScore || 0), 0) / preList.length).toFixed(1))
      : null;
    const avgPost = postList.length
      ? Number((postList.reduce((s, m) => s + (m.posttestQuizScore || 0), 0) / postList.length).toFixed(1))
      : null;

    const paired = roomStudents.filter(s => s.pretestQuizScore !== null && s.posttestQuizScore !== null);
    const avgDelta = paired.length
      ? Number(
          (
            paired.reduce((s, m) => s + ((m.posttestQuizScore || 0) - (m.pretestQuizScore || 0)), 0) /
            paired.length
          ).toFixed(1)
        )
      : null;

    return { total, active, done100, avgWpm, avgAccuracy, avgPre, avgPost, avgDelta };
  }, [roomStudents]);

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
      }
      return sortAsc ? diff : -diff;
    });
  }, [roomStudents, completionFilter, searchQuery, sortField, sortAsc]);

  // Classroom breakdown for Summary tab
  const classroomSummary = useMemo(() => {
    return classroomTabs
      .filter(t => t.count > 0)
      .map(({ room }) => {
        const members = studentSummaries.filter(s => s.classroom === room);
        const count = members.length;
        const done100 = members.filter(s => s.completion.isGrandComplete).length;
        const avgComp = count
          ? Math.round(members.reduce((sum, s) => sum + s.completion.completionPercent, 0) / count)
          : 0;
        const typingMembers = members.filter(s => s.avgWpm > 0);
        const avgWpm = typingMembers.length
          ? Math.round(typingMembers.reduce((sum, s) => sum + s.avgWpm, 0) / typingMembers.length)
          : 0;
        const avgAcc = typingMembers.length
          ? Math.round(typingMembers.reduce((sum, s) => sum + s.avgAccuracy, 0) / typingMembers.length)
          : 0;
        const preMembers = members.filter(s => s.pretestQuizScore !== null);
        const postMembers = members.filter(s => s.posttestQuizScore !== null);
        const avgPre = preMembers.length
          ? (preMembers.reduce((s, m) => s + (m.pretestQuizScore || 0), 0) / preMembers.length).toFixed(1)
          : '-';
        const avgPost = postMembers.length
          ? (postMembers.reduce((s, m) => s + (m.posttestQuizScore || 0), 0) / postMembers.length).toFixed(1)
          : '-';

        return { room, count, done100, avgComp, avgWpm, avgAcc, avgPre, avgPost };
      });
  }, [classroomTabs, studentSummaries]);

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

  const handleSyncFromSheets = async () => {
    setIsSyncing(true);
    setSyncNotice(null);
    try {
      const fetched = await apiFetchLeaderboard();
      setRemoteScores(fetched);
      setRefreshTick(t => t + 1);
      setSyncNotice('อัปเดตข้อมูลล่าสุดเรียบร้อยแล้ว');
    } catch {
      setSyncNotice('ไม่สามารถเชื่อมต่อ Google Sheets ได้ในขณะนี้ (แสดงข้อมูลล่าสุดในเครื่อง)');
    } finally {
      setIsSyncing(false);
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
      'ศูนย์การเรียนรู้ (ชุด)',
      'ผ่านด่านเกม (/10)',
      'Post-test (/10)',
      'ความคืบหน้า (%)',
      'WPM สูงสุด',
      'แม่นยำเฉลี่ย (%)'
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
      s.completion.lessonRecords.length,
      `${s.completion.passedLevelsCount}/10`,
      s.posttestQuizScore !== null ? s.posttestQuizScore : s.completion.hasPosttest ? 'ทำแล้ว' : '-',
      s.completion.completionPercent,
      s.bestWpm,
      s.avgAccuracy
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const roomSuffix = selectedClassroom === 'all' ? 'ทุกห้อง' : selectedClassroom.replace('/', '-');
    link.download = `ผลคะแนน_${roomSuffix}_${new Date().toISOString().slice(0, 10)}.csv`;
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
    if (remoteScores) {
      setRemoteScores(prev =>
        prev
          ? prev.filter(r => r.uid !== student.uid && r.displayName !== student.displayName)
          : null
      );
    }
    setConfirmResetUid(null);
    setRefreshTick(t => t + 1);
  };

  const surfaceClass = isDark
    ? 'bg-slate-900 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  const mutedTextClass = isDark ? 'text-slate-400' : 'text-slate-600';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 1. Clean Top Header + Actions */}
      <div className={`border rounded-2xl p-5 sm:p-6 ${surfaceClass}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              แดชบอร์ดครู ·{' '}
              <span className="text-cyan-500">
                {selectedClassroom === 'all' ? 'ทุกห้องเรียน' : `ห้อง ${selectedClassroom}`}
              </span>
            </h1>
            <p className={`text-xs sm:text-sm mt-1 ${mutedTextClass}`}>
              เลือกห้องเรียนด้านล่างเพื่อดูคะแนน Pre-test / Post-test และความคืบหน้ารายบุคคล
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
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
              onClick={handleSyncFromSheets}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white whitespace-nowrap shadow-sm transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'กำลังอัปเดต...' : 'อัปเดตข้อมูล'}</span>
            </button>
          </div>
        </div>

        {/* 2. Prominent Classroom Selector Bar */}
        <div className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
            <span className={`text-xs font-semibold whitespace-nowrap shrink-0 mr-1 ${mutedTextClass}`}>
              เลือกห้อง:
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
              ทุกห้องเรียน ({studentSummaries.length})
            </button>

            {classroomTabs.map(({ room, count }) => {
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
                  {room} <span className="opacity-75 font-mono tabular-nums">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {syncNotice && (
          <div
            className={`mt-3 px-4 py-2 rounded-xl border text-xs font-medium ${
              isDark
                ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300'
                : 'bg-cyan-50 border-cyan-200 text-cyan-800'
            }`}
          >
            {syncNotice}
          </div>
        )}
      </div>

      {/* 3. Scoped 3-Card Summary Strip (Updates dynamically for selected classroom) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`border rounded-2xl p-4 sm:p-5 ${surfaceClass}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs font-medium ${mutedTextClass}`}>
              นักเรียน{selectedClassroom === 'all' ? 'ทั้งหมด' : `ห้อง ${selectedClassroom}`}
            </span>
            <Users className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums">
            {kpis.total} <span className={`text-sm font-sans font-normal ${mutedTextClass}`}>คน</span>
          </div>
          <p className={`text-xs mt-1 font-mono tabular-nums ${mutedTextClass}`}>
            เริ่มฝึกแล้ว {kpis.active} คน · จบหลักสูตรครบ 100% {kpis.done100} คน
          </p>
        </div>

        <div className={`border rounded-2xl p-4 sm:p-5 ${surfaceClass}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs font-medium ${mutedTextClass}`}>คะแนนสอบ Pre → Post เฉลี่ย</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums">
            <span className={mutedTextClass}>{kpis.avgPre ?? '-'}</span>
            <span className={`mx-1.5 text-base ${mutedTextClass}`}>→</span>
            <span className="text-amber-500">{kpis.avgPost ?? '-'}</span>
            <span className={`text-xs font-sans font-normal ml-1 ${mutedTextClass}`}>/10</span>
          </div>
          <p className={`text-xs mt-1 font-mono tabular-nums ${mutedTextClass}`}>
            {kpis.avgDelta !== null
              ? `พัฒนาการเฉลี่ย ${kpis.avgDelta >= 0 ? '+' : ''}${kpis.avgDelta} ข้อ`
              : 'ยังไม่มีผลสอบเปรียบเทียบครบคู่'}
          </p>
        </div>

        <div className={`border rounded-2xl p-4 sm:p-5 ${surfaceClass}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs font-medium ${mutedTextClass}`}>ความเร็วและความแม่นยำเฉลี่ย</span>
            <BookOpen className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-emerald-500">
            {kpis.avgWpm} <span className={`text-sm font-sans font-normal ${mutedTextClass}`}>WPM</span>
          </div>
          <p className={`text-xs mt-1 font-mono tabular-nums ${mutedTextClass}`}>
            ความแม่นยำเฉลี่ย {kpis.avgAccuracy}%
          </p>
        </div>
      </div>

      {/* 4. Simple View Switcher + Search/Status Filter */}
      <div className={`border rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${surfaceClass}`}>
        <div
          className={`inline-flex p-1 rounded-xl border self-start ${
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
            <span>รายชื่อนักเรียน ({filteredStudents.length})</span>
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
            <span>สรุปเปรียบเทียบห้อง &amp; 10 ด่าน</span>
          </button>
        </div>

        {viewMode === 'students' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-56 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อ หรือ รหัสนักเรียน..."
                className={`w-full pl-8 pr-3 py-2 rounded-xl border text-xs focus:outline-none focus:border-cyan-500 ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

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
          </div>
        )}
      </div>

      {/* 5A. VIEW 1: SIMPLE 6-COLUMN STUDENT TABLE */}
      {viewMode === 'students' && (
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
                  <th className="py-3.5 px-3 text-center">Pre-test</th>
                  <th className="py-3.5 px-3 text-center">เกม 10 ด่าน &amp; บทเรียน</th>
                  <th className="py-3.5 px-3 text-center">Post-test</th>
                  <th className="py-3.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('wpm')}
                      className="inline-flex items-center gap-1 hover:text-cyan-500 ml-auto"
                    >
                      <span>ความเร็ว / แม่นยำ</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('completion')}
                      className="inline-flex items-center gap-1 hover:text-cyan-500 ml-auto"
                    >
                      <span>ภาพรวม</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800/70' : 'divide-slate-200'}`}>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`py-12 text-center text-sm ${mutedTextClass}`}>
                      {selectedClassroom === 'all'
                        ? 'ไม่พบรายชื่อนักเรียนที่ตรงกับเงื่อนไข'
                        : `ยังไม่มีข้อมูลนักเรียนในห้อง ${selectedClassroom}`}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(student => {
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
                              gradient={student.avatarBg}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold truncate max-w-[200px]">
                                {student.fullName}
                              </div>
                              <div className={`text-[11px] font-mono tabular-nums ${mutedTextClass}`}>
                                {student.studentId} · {student.classroom}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-center font-mono tabular-nums whitespace-nowrap">
                          {student.pretestQuizScore !== null ? (
                            <span className="font-bold text-cyan-500">
                              {student.pretestQuizScore}/10
                            </span>
                          ) : comp.hasPretest ? (
                            <span className="text-emerald-500 font-medium">ทำแล้ว</span>
                          ) : (
                            <span className={mutedTextClass}>-</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-16 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                <div
                                  className={`h-full ${
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
                              บทเรียน {comp.lessonRecords.length} ชุด
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-center font-mono tabular-nums whitespace-nowrap">
                          {student.posttestQuizScore !== null ? (
                            <span className="font-bold text-amber-500">
                              {student.posttestQuizScore}/10
                            </span>
                          ) : comp.hasPosttest ? (
                            <span className="text-emerald-500 font-medium">ทำแล้ว</span>
                          ) : !postUnlocked ? (
                            <span className={`inline-flex items-center gap-1 text-xs ${mutedTextClass}`}>
                              <Lock className="w-3 h-3" />
                              <span>ล็อค</span>
                            </span>
                          ) : (
                            <span className="text-cyan-500 text-xs font-semibold">พร้อมสอบ</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          {student.bestWpm > 0 ? (
                            <div>
                              <span className="font-bold">{student.bestWpm}</span>{' '}
                              <span className={`text-[11px] ${mutedTextClass}`}>WPM</span>
                              <div className={`text-[11px] ${mutedTextClass}`}>
                                แม่นยำ {student.avgAccuracy}%
                              </div>
                            </div>
                          ) : (
                            <span className={mutedTextClass}>-</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2.5">
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
                            <button
                              type="button"
                              onClick={() => setSelectedStudentUid(student.uid)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                isDark
                                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-300'
                                  : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-cyan-700'
                              }`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>ดูข้อมูล</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5B. VIEW 2: CLASSROOM COMPARISON & 10-LEVEL BREAKDOWN */}
      {viewMode === 'summary' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Classroom Comparison (click a room row to filter that room!) */}
          <div className={`border rounded-2xl overflow-hidden ${surfaceClass}`}>
            <div className={`p-5 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h2 className="text-base font-bold">เปรียบเทียบผลสัมฤทธิ์รายห้อง</h2>
              <p className={`text-xs mt-0.5 ${mutedTextClass}`}>
                คลิกที่ชื่อห้องเพื่อดูรายชื่อนักเรียนเฉพาะห้องนั้นทันที
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
                    <th className="py-3 px-3 text-right">WPM เฉลี่ย</th>
                    <th className="py-3 px-4 text-right">Pre / Post</th>
                  </tr>
                </thead>
                <tbody className={`divide-y font-mono tabular-nums ${isDark ? 'divide-slate-800/70' : 'divide-slate-200'}`}>
                  {classroomSummary.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={`py-8 text-center font-sans ${mutedTextClass}`}>
                        ยังไม่มีข้อมูลห้องเรียน
                      </td>
                    </tr>
                  ) : (
                    classroomSummary.map(row => (
                      <tr
                        key={row.room}
                        onClick={() => {
                          setSelectedClassroom(row.room);
                          setViewMode('students');
                        }}
                        className={`cursor-pointer transition-colors ${
                          isDark ? 'hover:bg-slate-800/50' : 'hover:bg-cyan-50/60'
                        }`}
                      >
                        <td className="py-3 px-4 font-sans font-bold text-cyan-500">
                          {row.room}
                        </td>
                        <td className="py-3 px-3 text-right">{row.count}</td>
                        <td className="py-3 px-3 text-right text-emerald-500 font-semibold">
                          {row.done100} ({row.avgComp}%)
                        </td>
                        <td className="py-3 px-3 text-right">{row.avgWpm || '-'}</td>
                        <td className="py-3 px-4 text-right">
                          {row.avgPre} / <span className="text-amber-500 font-semibold">{row.avgPost}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 10 Game Levels Pass Rate (scoped to selected classroom) */}
          <div className={`border rounded-2xl overflow-hidden ${surfaceClass}`}>
            <div className={`p-5 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h2 className="text-base font-bold">
                สถิติเกม 10 ด่าน ({selectedClassroom === 'all' ? 'ทุกห้องเรียน' : `ห้อง ${selectedClassroom}`})
              </h2>
              <p className={`text-xs mt-0.5 ${mutedTextClass}`}>
                ช่วยดูว่าด่านใดที่นักเรียนผ่านยากหรือต้องฝึกเพิ่มเติม
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

      {/* STUDENT DETAIL MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div
            className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto border rounded-3xl p-6 sm:p-7 shadow-2xl ${surfaceClass}`}
          >
            <div className={`flex items-start justify-between gap-4 pb-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-3.5">
                <UserAvatar
                  avatar={selectedStudent.avatar}
                  name={selectedStudent.displayName}
                  gradient={selectedStudent.avatarBg}
                  size="lg"
                />
                <div>
                  <h2 className="text-xl font-bold">{selectedStudent.fullName}</h2>
                  <p className={`text-xs mt-0.5 font-mono tabular-nums ${mutedTextClass}`}>
                    รหัสนักเรียน: {selectedStudent.studentId} · ห้อง {selectedStudent.classroom} · {selectedStudent.displayName}
                  </p>
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-[11px] ${mutedTextClass}`}>Pre-test</div>
                <div className="text-lg font-bold font-mono tabular-nums mt-0.5">
                  {selectedStudent.pretestQuizScore !== null
                    ? `${selectedStudent.pretestQuizScore}/10`
                    : selectedStudent.completion.hasPretest
                    ? 'ทำแล้ว'
                    : 'ยังไม่ทำ'}
                </div>
              </div>

              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-[11px] ${mutedTextClass}`}>ศูนย์การเรียนรู้</div>
                <div className="text-lg font-bold font-mono tabular-nums mt-0.5">
                  {selectedStudent.completion.lessonRecords.length} ชุด
                </div>
              </div>

              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-[11px] ${mutedTextClass}`}>เกม 10 ด่าน</div>
                <div className="text-lg font-bold font-mono tabular-nums mt-0.5 text-cyan-500">
                  {selectedStudent.completion.passedLevelsCount}/10 ด่าน
                </div>
              </div>

              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-[11px] ${mutedTextClass}`}>Post-test / หลักสูตร</div>
                <div className="text-lg font-bold font-mono tabular-nums mt-0.5 text-emerald-500">
                  {selectedStudent.posttestQuizScore !== null
                    ? `${selectedStudent.posttestQuizScore}/10`
                    : `${selectedStudent.completion.completionPercent}%`}
                </div>
              </div>
            </div>

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
                      {selectedStudent.scores.slice(0, 25).map(r => (
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
              {selectedStudent.scores.length > 0 ? (
                confirmResetUid === selectedStudent.uid ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-rose-500 font-semibold">ยืนยันการล้างประวัติคะแนนของนักเรียนคนนี้?</span>
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-medium transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>รีเซ็ตประวัติคะแนนนักเรียน</span>
                  </button>
                )
              ) : (
                <div />
              )}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className={`w-full max-w-md border rounded-3xl p-6 shadow-2xl ${surfaceClass}`}>
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
                    <option value="ปวช.3/1">ปวช.3/1</option>
                    <option value="ปวช.3/2">ปวช.3/2</option>
                    <option value="ปวช.3/3">ปวช.3/3</option>
                    <option value="ปวช.3/4">ปวช.3/4</option>
                    <option value="ปวช.1">ปวช.1</option>
                    <option value="ปวช.2">ปวช.2</option>
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
    </div>
  );
};
