import React, { useEffect, useRef } from 'react';
import {
  Gamepad2,
  BookOpen,
  ClipboardCheck,
  Trophy,
  User as UserIcon,
  Volume2,
  VolumeX,
  LogIn,
  LogOut,
  Sun,
  Moon,
  Flame,
  Sparkles,
  Award,
  Lock,
  Keyboard,
  LayoutDashboard
} from 'lucide-react';
import { Language, User } from '../types';
import { soundManager } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';
import { UserAvatar } from './UserAvatar';
import { getPosttestUnlockStatus } from './MedalShowcase';
import { subscribeUserDataUpdates } from '../utils/googleSheets';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  user: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenAvatarModal?: () => void;
}

interface NavItemConfig {
  id: string;
  labelTh: string;
  compactTh: string;
  labelEn: string;
  tooltipTh: string;
  tooltipEn: string;
  icon: React.ComponentType<{ className?: string }>;
  isRanked?: boolean;
  isLocked?: boolean;
  group: 'learn' | 'social';
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  language,
  onLanguageChange,
  user,
  onOpenAuth,
  onLogout,
  onOpenAvatarModal
}) => {
  const [isMuted, setIsMuted] = React.useState(soundManager.getMuted());
  const { toggleTheme, isDark } = useTheme();
  const mobileTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleToggleSound = () => {
    const nextState = soundManager.toggleMute();
    setIsMuted(nextState);
  };

  // Auto-center active mobile tab in horizontal scroll strip
  useEffect(() => {
    const activeEl = mobileTabRefs.current[currentTab];
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  }, [currentTab]);

  const [realtimeTick, setRealtimeTick] = React.useState(0);

  useEffect(() => {
    return subscribeUserDataUpdates(() => {
      setRealtimeTick(prev => prev + 1);
    });
  }, []);

  const isTeacher = Boolean(user && (user.role === 'teacher' || user.role === 'admin'));
  const isAuthenticated = Boolean(user && (user.studentId || isTeacher) && user.username !== 'guest');

  const posttestStatus = React.useMemo(
    () => getPosttestUnlockStatus(user),
    [currentTab, user, realtimeTick]
  );
  const isPosttestLocked = !posttestStatus.isUnlocked;

  const navItems: NavItemConfig[] = isTeacher
    ? [
        {
          id: 'teacher',
          labelTh: 'แดชบอร์ดครู',
          compactTh: 'แดชบอร์ดครู',
          labelEn: 'Teacher Dashboard',
          tooltipTh: 'แดชบอร์ดติดตามผลและข้อมูลนักเรียน',
          tooltipEn: 'Teacher Analytics Dashboard',
          icon: LayoutDashboard,
          group: 'social'
        }
      ]
    : [
        {
          id: 'pretest',
          labelTh: 'Pre-test',
          compactTh: 'ก่อนเรียน',
          labelEn: 'Pre-test',
          tooltipTh: 'แบบทดสอบก่อนเรียน (Pre-test)',
          tooltipEn: 'Pre-test Assessment',
          icon: ClipboardCheck,
          group: 'learn'
        },
        {
          id: 'lessons',
          labelTh: 'ศูนย์การเรียนรู้',
          compactTh: 'บทเรียน',
          labelEn: 'Lessons',
          tooltipTh: 'ศูนย์การเรียนรู้ & ฝึกพิมพ์สัมผัส',
          tooltipEn: 'Touch Typing Learning Center',
          icon: BookOpen,
          group: 'learn'
        },
        {
          id: 'game',
          labelTh: 'เกม 10 ด่าน',
          compactTh: '10 ด่าน',
          labelEn: '10 Levels',
          tooltipTh: 'โหมดเกมฝึกพิมพ์ 10 ด่าน',
          tooltipEn: '10-Level Adventure Game',
          icon: Gamepad2,
          group: 'learn'
        },
        {
          id: 'ranked',
          labelTh: 'ประลองจัดอันดับ',
          compactTh: 'ประลอง',
          labelEn: 'Ranked',
          tooltipTh: 'โหมดประลองจัดอันดับ (Ranked Arena)',
          tooltipEn: 'Ranked Competitive Arena',
          icon: Flame,
          isRanked: true,
          group: 'learn'
        },
        {
          id: 'posttest',
          labelTh: 'Post-test',
          compactTh: 'หลังเรียน',
          labelEn: 'Post-test',
          tooltipTh: isPosttestLocked
            ? `แบบทดสอบหลังเรียน (ล็อค: ต้องทำ Pre-test, ศูนย์การเรียนรู้ และผ่านเกมครบทั้ง 10 ด่าน — ตอนนี้ ${posttestStatus.passedLevelsCount}/10 ด่าน)`
            : 'แบบทดสอบหลังเรียน (Post-test)',
          tooltipEn: isPosttestLocked
            ? `Post-test (Locked: Complete Pre-test, Lessons & all 10 Levels — ${posttestStatus.passedLevelsCount}/10)`
            : 'Post-test Assessment',
          icon: Award,
          isLocked: isPosttestLocked,
          group: 'learn'
        },
        {
          id: 'leaderboard',
          labelTh: 'ตารางอันดับ',
          compactTh: 'อันดับ',
          labelEn: 'Ranks',
          tooltipTh: 'สกอร์บอร์ดรวม (Leaderboard)',
          tooltipEn: 'Global Leaderboard',
          icon: Trophy,
          group: 'social'
        },
        {
          id: 'profile',
          labelTh: 'โปรไฟล์',
          compactTh: 'โปรไฟล์',
          labelEn: 'Profile',
          tooltipTh: 'โปรไฟล์ สถิติ และเหรียญตรา',
          tooltipEn: 'Profile, Stats & Badges',
          icon: UserIcon,
          group: 'social'
        }
      ];

  const learnItems = navItems.filter(i => i.group === 'learn');
  const socialItems = navItems.filter(i => i.group === 'social');

  const renderDesktopButton = (item: NavItemConfig) => {
    const Icon = item.icon;
    const isActive = currentTab === item.id;
    const isRanked = Boolean(item.isRanked);

    let buttonStyle = '';
    if (isActive) {
      if (isRanked) {
        buttonStyle = isDark
          ? 'bg-gradient-to-b from-amber-500/25 to-orange-500/15 text-amber-200 border border-amber-400/45 shadow-[0_2px_12px_-2px_rgba(245,158,11,0.35)] font-semibold'
          : 'bg-gradient-to-b from-amber-50 to-orange-50 text-amber-900 border border-amber-300/90 shadow-sm font-semibold';
      } else {
        buttonStyle = isDark
          ? 'bg-gradient-to-b from-cyan-500/22 to-blue-500/15 text-cyan-200 border border-cyan-400/40 shadow-[0_2px_12px_-2px_rgba(6,182,212,0.3)] font-semibold'
          : 'bg-white text-cyan-700 border border-cyan-300/80 shadow-sm font-semibold';
      }
    } else if (isRanked) {
      buttonStyle = isDark
        ? 'text-amber-300/90 hover:text-amber-200 hover:bg-amber-500/10 border border-transparent'
        : 'text-amber-700 hover:text-amber-900 hover:bg-amber-50/90 border border-transparent';
    } else {
      buttonStyle = isDark
        ? 'text-slate-300 hover:text-white hover:bg-slate-800/75 border border-transparent'
        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 border border-transparent';
    }

    const iconColor = isActive
      ? isRanked
        ? isDark
          ? 'text-amber-300'
          : 'text-amber-600'
        : isDark
        ? 'text-cyan-300'
        : 'text-cyan-600'
      : isRanked
      ? isDark
        ? 'text-amber-400/90'
        : 'text-amber-600'
      : isDark
      ? 'text-slate-400 group-hover/nav:text-slate-200'
      : 'text-slate-500 group-hover/nav:text-slate-800';

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onTabChange(item.id)}
        title={language === 'th' ? item.tooltipTh : item.tooltipEn}
        aria-current={isActive ? 'page' : undefined}
        className={`group/nav relative flex items-center gap-1.5 ${
          isTeacher ? 'px-2 xl:px-2.5' : 'px-2.5 xl:px-3'
        } h-9 rounded-xl text-[13px] whitespace-nowrap shrink-0 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${buttonStyle}`}
      >
        <Icon className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 group-hover/nav:scale-110 ${iconColor}`} />
        <span className="hidden xl:inline">
          {language === 'th' ? item.labelTh : item.labelEn}
        </span>
        <span className="xl:hidden">
          {language === 'th' ? item.compactTh : item.labelEn}
        </span>
        {item.isLocked && (
          <Lock
            className={`w-3 h-3 shrink-0 ${
              isDark ? 'text-amber-400/90' : 'text-amber-600'
            }`}
          />
        )}
        {isActive && (
          <span
            className={`absolute -bottom-0.5 left-3 right-3 h-[2px] rounded-full ${
              isRanked
                ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                : 'bg-gradient-to-r from-cyan-400 to-blue-500'
            }`}
          />
        )}
      </button>
    );
  };

  return (
    <header
      className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-colors duration-300 ${
        isDark
          ? 'bg-slate-950/85 border-slate-800/80 shadow-[0_8px_30px_-12px_rgba(2,6,23,0.85)]'
          : 'bg-white/85 border-slate-200/90 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]'
      }`}
    >
      {/* Subtle Top Gradient Accent Line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 opacity-90" />

      <div className="max-w-[1380px] mx-auto px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-3">
          {/* Brand Lockup — Tactile Keycap Emblem */}
          <button
            type="button"
            onClick={() => onTabChange(isAuthenticated ? (isTeacher ? 'teacher' : 'pretest') : 'auth')}
            className="flex items-center gap-2.5 text-left cursor-pointer group shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 rounded-xl pr-1"
          >
            <div
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200 group-hover:translate-y-[1px] ${
                isDark
                  ? 'bg-gradient-to-b from-cyan-500 via-sky-600 to-blue-700 border-cyan-300/35 shadow-[0_3px_0_0_#0e7490,0_8px_18px_-4px_rgba(6,182,212,0.45)] group-hover:shadow-[0_2px_0_0_#0e7490,0_6px_14px_-4px_rgba(6,182,212,0.45)]'
                  : 'bg-gradient-to-b from-cyan-400 via-sky-500 to-blue-600 border-white/60 shadow-[0_3px_0_0_#0369a1,0_8px_16px_-4px_rgba(14,165,233,0.35)] group-hover:shadow-[0_2px_0_0_#0369a1,0_6px_12px_-4px_rgba(14,165,233,0.35)]'
              }`}
            >
              {/* Inner Keycap Bevel Highlight */}
              <div className="absolute inset-0.5 rounded-[9px] border border-white/25 pointer-events-none" />
              <Keyboard className="w-5 h-5 text-white drop-shadow-xs" />
            </div>

            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-[17px] tracking-tight bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 bg-clip-text text-transparent whitespace-nowrap">
                  TouchTyping
                </span>
              </div>
              <p
                className={`text-[10px] font-medium tracking-wide whitespace-nowrap hidden sm:block lg:hidden 2xl:block ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {language === 'th' ? 'ฝึกพิมพ์สัมผัส ไทย · อังกฤษ' : 'Thai · English Tutor'}
              </p>
            </div>
          </button>

          {/* Desktop Navigation Dock */}
          {isAuthenticated && (
            <nav
              aria-label="Primary Navigation"
              className={`hidden lg:flex items-center gap-1 p-1 rounded-2xl border transition-colors ${
                isDark
                  ? 'bg-slate-900/75 border-slate-800/90 shadow-inner shadow-slate-950/60'
                  : 'bg-slate-100/85 border-slate-200/90 shadow-inner shadow-slate-200/50'
              }`}
            >
              {learnItems.map(renderDesktopButton)}

              {learnItems.length > 0 && socialItems.length > 0 && (
                <div
                  className={`w-px h-5 mx-0.5 shrink-0 ${
                    isDark ? 'bg-slate-700/80' : 'bg-slate-300/80'
                  }`}
                  aria-hidden="true"
                />
              )}

              {socialItems.map(renderDesktopButton)}
            </nav>
          )}

          {/* Right Utility Controls & Account Cluster */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              title={
                isDark
                  ? 'เปลี่ยนเป็นโหมดสว่าง (Switch to Light Mode)'
                  : 'เปลี่ยนเป็นโหมดมืด (Switch to Dark Mode)'
              }
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${
                isDark
                  ? 'bg-slate-900/90 border-slate-700/80 text-amber-300 hover:bg-slate-800 hover:border-amber-400/40'
                  : 'bg-slate-100/90 border-slate-200 text-indigo-600 hover:bg-white hover:border-indigo-300 hover:shadow-xs'
              }`}
            >
              {isDark ? (
                <Sun className="w-4 h-4 transition-transform duration-300 hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 transition-transform duration-300 hover:-rotate-12" />
              )}
            </button>

            {/* Segmented Language Switcher */}
            <div
              role="group"
              aria-label="Language switcher"
              className={`h-9 p-1 rounded-xl border flex items-center gap-0.5 text-xs transition-colors ${
                isDark
                  ? 'bg-slate-900/90 border-slate-700/80'
                  : 'bg-slate-100/90 border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => onLanguageChange('th')}
                className={`px-2.5 h-7 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 ${
                  language === 'th'
                    ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ไทย
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('en')}
                className={`px-2.5 h-7 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 ${
                  language === 'en'
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
            </div>

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={handleToggleSound}
              title={isMuted ? 'เปิดเสียงเอฟเฟกต์ (Unmute)' : 'ปิดเสียงเอฟเฟกต์ (Mute)'}
              aria-label={isMuted ? 'Unmute sound effects' : 'Mute sound effects'}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${
                isMuted
                  ? isDark
                    ? 'bg-slate-900/70 border-slate-700/80 text-slate-500 hover:text-slate-300'
                    : 'bg-slate-100/90 border-slate-200 text-slate-400 hover:text-slate-700'
                  : isDark
                  ? 'bg-cyan-950/60 border-cyan-500/35 text-cyan-300 hover:bg-cyan-900/60 shadow-[0_0_12px_-4px_rgba(6,182,212,0.5)]'
                  : 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Student / Teacher Profile Chip / Login CTA */}
            {user && (user.studentId || isTeacher) ? (
              <div
                className={`flex items-center gap-2 h-10 pl-1.5 pr-1.5 rounded-xl border transition-all ${
                  isDark
                    ? 'bg-slate-900/90 border-slate-700/80 text-slate-100 hover:border-cyan-500/40'
                    : 'bg-white border-slate-200/90 text-slate-800 shadow-xs hover:border-cyan-300'
                }`}
              >
                {/* Avatar Trigger */}
                <button
                  type="button"
                  onClick={onOpenAvatarModal}
                  title="คลิกเพื่อเปลี่ยนรูปโปรไฟล์"
                  className="hover:scale-105 transition-transform overflow-hidden relative group shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  <UserAvatar
                    avatar={user.avatar}
                    name={user.displayName || user.fullName || ''}
                    seed={user.uid || user.studentId || user.displayName || ''}
                    gradient={user.avatarBg || 'from-cyan-500 to-blue-600'}
                    size="sm"
                  />
                  <div className="absolute inset-0 bg-slate-950/60 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Sparkles className="w-3 h-3 text-cyan-300" />
                  </div>
                </button>

                {/* Student / Teacher Name & ID */}
                <button
                  type="button"
                  onClick={() => onTabChange(isTeacher ? 'teacher' : 'profile')}
                  title={isTeacher ? 'แดชบอร์ดครูผู้สอน' : 'ดูข้อมูลบัตรนักเรียนและสถิติ'}
                  className="cursor-pointer max-w-[116px] hidden sm:block text-left group/user focus-visible:outline-none"
                >
                  <div
                    className={`text-[11px] font-bold truncate leading-tight transition-colors ${
                      isDark ? 'group-hover/user:text-cyan-300' : 'group-hover/user:text-cyan-700'
                    }`}
                  >
                    {user.displayName}
                  </div>
                  <div
                    className={`text-[9.5px] font-mono font-semibold leading-tight ${
                      isDark ? 'text-cyan-400' : 'text-cyan-600'
                    }`}
                  >
                    {user.studentId || (isTeacher ? 'TEACHER' : '')}
                  </div>
                </button>

                {/* Divider + Logout */}
                <div
                  className={`w-px h-5 hidden sm:block ${
                    isDark ? 'bg-slate-800' : 'bg-slate-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={onLogout}
                  title={language === 'th' ? 'ออกจากระบบ' : 'Log out'}
                  aria-label="Log out"
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    isDark
                      ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/15'
                      : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:via-sky-400 hover:to-blue-500 text-white text-xs font-semibold whitespace-nowrap shadow-md shadow-cyan-500/25 border border-white/15 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span>{language === 'th' ? 'เข้าสู่ระบบ' : 'Sign In'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tablet & Mobile Horizontal Navigation Dock (students only; teachers stay on Teacher Dashboard) */}
        {isAuthenticated && !isTeacher && (
          <nav
            aria-label="Mobile Navigation"
            className={`lg:hidden flex items-center gap-1.5 overflow-x-auto py-2 border-t no-scrollbar ${
              isDark ? 'border-slate-800/70' : 'border-slate-200/80'
            }`}
          >
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              const isRanked = Boolean(item.isRanked);

              return (
                <button
                  key={item.id}
                  ref={el => {
                    mobileTabRefs.current[item.id] = el;
                  }}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`relative flex items-center gap-1.5 px-3 min-h-[34px] rounded-xl text-xs whitespace-nowrap shrink-0 font-medium transition-all duration-200 ${
                    isActive
                      ? isRanked
                        ? isDark
                          ? 'bg-amber-500/20 text-amber-200 border border-amber-400/45 shadow-sm shadow-amber-500/20 font-semibold'
                          : 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold shadow-xs'
                        : isDark
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 shadow-sm shadow-cyan-500/15 font-semibold'
                        : 'bg-cyan-50 text-cyan-800 border border-cyan-300 font-semibold shadow-xs'
                      : isRanked
                      ? isDark
                        ? 'text-amber-300 bg-amber-950/35 hover:bg-amber-900/40 border border-amber-800/50'
                        : 'text-amber-800 bg-amber-50/90 hover:bg-amber-100 border border-amber-200'
                      : isDark
                      ? 'text-slate-300 hover:text-white bg-slate-900/70 border border-slate-800/80'
                      : 'text-slate-600 hover:text-slate-900 bg-slate-100/90 border border-slate-200/80'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isRanked
                        ? isDark
                          ? 'text-amber-400'
                          : 'text-amber-600'
                        : isActive
                        ? isDark
                          ? 'text-cyan-300'
                          : 'text-cyan-600'
                        : ''
                    }`}
                  />
                  <span>{language === 'th' ? item.labelTh : item.labelEn}</span>
                  {item.isLocked && (
                    <Lock
                      className={`w-3 h-3 shrink-0 ${
                        isDark ? 'text-amber-400' : 'text-amber-600'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
};
