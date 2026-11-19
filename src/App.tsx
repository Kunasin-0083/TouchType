import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { GameMode } from './components/GameMode';
import { RankedMode } from './components/RankedMode';
import { LessonsMode } from './components/LessonsMode';
import { TestMode } from './components/TestMode';
import { LeaderboardView } from './components/LeaderboardView';
import { ProfileView } from './components/ProfileView';
import { StudentAuthView } from './components/StudentAuthView';
import { TeacherDashboard } from './components/TeacherDashboard';
import { AuthModal } from './components/AuthModal';
import { AvatarSelectorModal } from './components/AvatarSelectorModal';
import { GrandCompletionModal } from './components/GrandCompletionModal';
import { Language, User } from './types';
import {
  getCurrentUser,
  setCurrentUser,
  apiSyncUserAccountData,
  hydrateCurrentUserAvatar,
  subscribeUserDataUpdates,
  getLocalScores,
  getUserMedalProfile,
  isRecordOwnedByUser,
  getAccountKey
} from './utils/googleSheets';
import { getPosttestUnlockStatus, getCurriculumCompletion } from './components/MedalShowcase';
import { ThemeProvider, useTheme } from './context/ThemeContext';

const GRAND_CELEBRATION_SEEN_KEY = 'touch_typing_grand_celebrated_v1';

function hasSeenGrandCelebration(accountKey: string): boolean {
  if (!accountKey) return false;
  try {
    const raw = localStorage.getItem(GRAND_CELEBRATION_SEEN_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, string>;
    return Boolean(map && map[accountKey]);
  } catch {
    return false;
  }
}

function markGrandCelebrationSeen(accountKey: string) {
  if (!accountKey) return;
  try {
    const raw = localStorage.getItem(GRAND_CELEBRATION_SEEN_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[accountKey] = new Date().toISOString();
    localStorage.setItem(GRAND_CELEBRATION_SEEN_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function MainApp() {
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const isTeacher = Boolean(user && (user.role === 'teacher' || user.role === 'admin'));
  const isAuthenticated = Boolean(user && (user.studentId || isTeacher) && user.username !== 'guest');
  const [currentTab, setCurrentTab] = useState<string>(() => {
    const u = getCurrentUser();
    if (!u) return 'auth';
    return u.role === 'teacher' || u.role === 'admin' ? 'teacher' : 'pretest';
  });
  const [language, setLanguage] = useState<Language>('th');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isGrandCelebrationOpen, setIsGrandCelebrationOpen] = useState(false);
  const [progressRevision, setProgressRevision] = useState(0);
  const { isDark } = useTheme();

  useEffect(() => {
    const loggedUser = getCurrentUser();
    const isTeacherSession = Boolean(loggedUser && (loggedUser.role === 'teacher' || loggedUser.role === 'admin'));
    if (loggedUser && (loggedUser.studentId || isTeacherSession)) {
      setUser(loggedUser);
      hydrateCurrentUserAvatar(loggedUser)
        .then(hydrated => {
          if (hydrated) setUser(hydrated);
        })
        .catch(() => {});
      if (!isTeacherSession) {
        apiSyncUserAccountData(loggedUser).catch(() => {});
      }
    } else {
      setUser(null);
      setCurrentTab('auth');
    }

    const unsubscribe = subscribeUserDataUpdates(() => {
      setProgressRevision(prev => prev + 1);
      const latest = getCurrentUser();
      if (latest) {
        setUser(prev => {
          if (
            prev &&
            prev.uid === latest.uid &&
            prev.avatar === latest.avatar &&
            prev.avatarBg === latest.avatarBg &&
            prev.displayName === latest.displayName &&
            prev.classroom === latest.classroom &&
            prev.classroomUpdatedAt === latest.classroomUpdatedAt
          ) {
            return prev;
          }
          return latest;
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const studentScores = useMemo(() => {
    if (!isAuthenticated || isTeacher || !user) return [];
    return getLocalScores().filter(s => isRecordOwnedByUser(s, user));
  }, [isAuthenticated, isTeacher, user, progressRevision]);

  const studentMedalProfile = useMemo(() => {
    if (!isAuthenticated || isTeacher || !user) return null;
    return getUserMedalProfile(user);
  }, [isAuthenticated, isTeacher, user, progressRevision]);

  const studentCompletion = useMemo(
    () => getCurriculumCompletion(studentScores, studentMedalProfile),
    [studentScores, studentMedalProfile]
  );

  // Auto-open celebratory popup the moment a student finishes all 4 curriculum pillars (100%)
  useEffect(() => {
    if (!isAuthenticated || isTeacher || !user || currentTab === 'auth') return;
    if (!studentCompletion.isGrandComplete) return;

    const accountKey = getAccountKey(user);
    if (!accountKey || hasSeenGrandCelebration(accountKey)) return;

    const timer = window.setTimeout(() => {
      markGrandCelebrationSeen(accountKey);
      setIsGrandCelebrationOpen(true);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [isAuthenticated, isTeacher, user, currentTab, studentCompletion.isGrandComplete]);

  const handleLogout = () => {
    setCurrentUser(null);
    setUser(null);
    setIsGrandCelebrationOpen(false);
    setCurrentTab('auth');
  };

  return (
    <div
      className={`min-h-screen flex flex-col font-['Kanit',sans-serif] selection:bg-cyan-500 selection:text-white transition-colors duration-300 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => {
          if (!isAuthenticated) {
            setCurrentTab('auth');
            return;
          }
          if (isTeacher) {
            setCurrentTab('teacher');
            return;
          }
          setCurrentTab(tab);
        }}
        language={language}
        onLanguageChange={setLanguage}
        user={user}
        onOpenAuth={() => setCurrentTab('auth')}
        onLogout={handleLogout}
        onOpenAvatarModal={() => setIsAvatarModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* บังคับเข้าสู่ระบบเป็นอันดับแรกเมื่อเข้าเว็บไซต์ หรือเมื่อเปิดหน้า auth */}
        {(!isAuthenticated || currentTab === 'auth') && (
          <StudentAuthView
            currentUser={user}
            onAuthSuccess={(newUser) => {
              setUser(newUser);
              hydrateCurrentUserAvatar(newUser)
                .then(hydrated => {
                  if (hydrated) setUser(hydrated);
                })
                .catch(() => {});
              if (newUser.role === 'teacher' || newUser.role === 'admin') {
                setCurrentTab('teacher');
                return;
              }
              apiSyncUserAccountData(newUser).catch(() => {});
              const status = getPosttestUnlockStatus(newUser);
              setCurrentTab(status.hasPretest ? 'profile' : 'pretest');
            }}
            onNavigateHome={() =>
              setCurrentTab(isAuthenticated ? (isTeacher ? 'teacher' : 'pretest') : 'auth')
            }
          />
        )}

        {/* แดชบอร์ดสำหรับครูผู้สอน (หน้าครูแสดงเฉพาะแดชบอร์ดครู) */}
        {isAuthenticated && isTeacher && currentTab !== 'auth' && (
          <TeacherDashboard currentUser={user} />
        )}

        {/* 1. Pretest (แบบทดสอบก่อนเรียน) */}
        {isAuthenticated && !isTeacher && currentTab === 'pretest' && (
          <TestMode
            language={language}
            user={user}
            specificType="pretest"
            onViewLeaderboard={() => setCurrentTab('leaderboard')}
            onNavigateTab={setCurrentTab}
          />
        )}

        {/* 2. ศูนย์การเรียนรู้ (Lessons) */}
        {isAuthenticated && !isTeacher && currentTab === 'lessons' && (
          <LessonsMode language={language} user={user} />
        )}

        {/* 3. โหมดเกม 10 ด่าน (10 Game Levels) */}
        {isAuthenticated && !isTeacher && currentTab === 'game' && (
          <GameMode
            language={language}
            user={user}
            onViewLeaderboard={() => setCurrentTab('leaderboard')}
          />
        )}

        {/* 4. ประลองจัดอันดับ (Ranked Arena) */}
        {isAuthenticated && !isTeacher && currentTab === 'ranked' && (
          <RankedMode
            language={language}
            user={user}
            onViewLeaderboard={() => setCurrentTab('leaderboard')}
            onOpenAvatarModal={() => setIsAvatarModalOpen(true)}
          />
        )}

        {/* 5. Posttest (แบบทดสอบหลังเรียน) */}
        {isAuthenticated && !isTeacher && currentTab === 'posttest' && (
          <TestMode
            language={language}
            user={user}
            specificType="posttest"
            onViewLeaderboard={() => setCurrentTab('leaderboard')}
            onNavigateTab={setCurrentTab}
          />
        )}

        {/* 6. ตารางอันดับ (Leaderboard) */}
        {isAuthenticated && !isTeacher && currentTab === 'leaderboard' && (
          <LeaderboardView
            currentLanguage={language}
            user={user}
            onGoToRanked={() => setCurrentTab('ranked')}
            onOpenAvatarModal={() => setIsAvatarModalOpen(true)}
          />
        )}

        {/* 7. โปรไฟล์ (Profile) */}
        {isAuthenticated && !isTeacher && currentTab === 'profile' && (
          <ProfileView
            user={user}
            onOpenAuth={() => setCurrentTab('auth')}
            onOpenAvatarModal={() => setIsAvatarModalOpen(true)}
            onUserUpdated={(updatedUser) => setUser(updatedUser)}
            onOpenGrandCelebration={() => setIsGrandCelebrationOpen(true)}
            onNavigateTab={setCurrentTab}
          />
        )}
      </main>

      {/* Footer */}
      <footer
        className={`mt-auto border-t py-6 text-xs text-center transition-colors duration-300 ${
          isDark
            ? 'border-slate-900 bg-slate-950/80 text-slate-500'
            : 'border-slate-200 bg-white/80 text-slate-600'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              เกมฝึกพิมพ์สัมผัส ไทย-อังกฤษ (Touch Typing Tutor)
            </span>
            <span className="hidden sm:inline"> • ฝึกทักษะการพิมพ์สัมผัสอย่างมีประสิทธิภาพ</span>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-[11px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
              Sheet: 1rpaY_...gh_yyhY
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-emerald-500 font-medium">Sheets Connected</span>
          </div>
        </div>
      </footer>

      {/* User Login / Register Dialog */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSwitchToFullPage={() => setCurrentTab('auth')}
        onSuccess={(newUser) => {
          setUser(newUser);
        }}
      />

      {/* Avatar Customization Modal */}
      <AvatarSelectorModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        currentUser={user}
        onAvatarUpdated={(updatedUser) => {
          setUser(updatedUser);
        }}
      />

      {/* 100% Curriculum Grand Completion Celebration Popup */}
      {isAuthenticated && !isTeacher && (
        <GrandCompletionModal
          isOpen={isGrandCelebrationOpen}
          onClose={() => setIsGrandCelebrationOpen(false)}
          user={user}
          completion={studentCompletion}
          userScores={studentScores}
          savedMedalProfile={studentMedalProfile}
          isOnProfileTab={currentTab === 'profile'}
          onGoToProfile={() => setCurrentTab('profile')}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}
