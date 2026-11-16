import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { GameMode } from './components/GameMode';
import { RankedMode } from './components/RankedMode';
import { LessonsMode } from './components/LessonsMode';
import { TestMode } from './components/TestMode';
import { LeaderboardView } from './components/LeaderboardView';
import { ProfileView } from './components/ProfileView';
import { StudentAuthView } from './components/StudentAuthView';
import { AuthModal } from './components/AuthModal';
import { AvatarSelectorModal } from './components/AvatarSelectorModal';
import { Language, User } from './types';
import { getCurrentUser, setCurrentUser } from './utils/googleSheets';
import { ThemeProvider, useTheme } from './context/ThemeContext';

function MainApp() {
  const [currentTab, setCurrentTab] = useState<string>('pretest');
  const [language, setLanguage] = useState<Language>('th');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const { isDark } = useTheme();

  useEffect(() => {
    const loggedUser = getCurrentUser();
    if (loggedUser) {
      setUser(loggedUser);
    }
  }, []);

  const handleLogout = () => {
    setCurrentUser(null);
    setUser(null);
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
        onTabChange={setCurrentTab}
        language={language}
        onLanguageChange={setLanguage}
        user={user}
        onOpenAuth={() => setCurrentTab('auth')}
        onLogout={handleLogout}
        onOpenAvatarModal={() => setIsAvatarModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* หน้าสมัครสมาชิกและเข้าสู่ระบบด้วยรหัสนักเรียน */}
        {currentTab === 'auth' && (
          <StudentAuthView
            currentUser={user}
            onAuthSuccess={(newUser) => {
              setUser(newUser);
              setCurrentTab('profile');
            }}
            onNavigateHome={() => setCurrentTab('pretest')}
          />
        )}

        {/* 1. Pretest (แบบทดสอบก่อนเรียน) */}
        {currentTab === 'pretest' && (
          <TestMode
            language={language}
            user={user}
            specificType="pretest"
            onViewLeaderboard={() => setCurrentTab('leaderboard')}
            onNavigateTab={setCurrentTab}
          />
        )}

        {/* 2. ศูนย์การเรียนรู้ (Lessons) */}
        {currentTab === 'lessons' && (
          <LessonsMode language={language} user={user} />
        )}

        {/* 3. โหมดเกม 10 ด่าน (10 Game Levels) */}
        {currentTab === 'game' && (
          <GameMode
            language={language}
            user={user}
            onViewLeaderboard={() => setCurrentTab('leaderboard')}
          />
        )}

        {/* 4. ประลองจัดอันดับ (Ranked Arena) */}
        {currentTab === 'ranked' && (
          <RankedMode
            language={language}
            user={user}
            onViewLeaderboard={() => setCurrentTab('leaderboard')}
            onOpenAvatarModal={() => setIsAvatarModalOpen(true)}
          />
        )}

        {/* 5. Posttest (แบบทดสอบหลังเรียน) */}
        {currentTab === 'posttest' && (
          <TestMode
            language={language}
            user={user}
            specificType="posttest"
            onViewLeaderboard={() => setCurrentTab('leaderboard')}
            onNavigateTab={setCurrentTab}
          />
        )}

        {/* 6. ตารางอันดับ (Leaderboard) */}
        {currentTab === 'leaderboard' && (
          <LeaderboardView
            currentLanguage={language}
            user={user}
            onGoToRanked={() => setCurrentTab('ranked')}
            onOpenAvatarModal={() => setIsAvatarModalOpen(true)}
          />
        )}

        {/* 7. โปรไฟล์ (Profile) */}
        {currentTab === 'profile' && (
          <ProfileView
            user={user}
            onOpenAuth={() => setCurrentTab('auth')}
            onOpenAvatarModal={() => setIsAvatarModalOpen(true)}
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
