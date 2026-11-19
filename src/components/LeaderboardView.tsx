import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Search,
  RefreshCw,
  Flame,
  Camera,
  X
} from 'lucide-react';
import { ScoreRecord, Language, User } from '../types';
import {
  apiFetchLeaderboard,
  getLocalUsers,
  isRecordOwnedByUser,
  subscribeUserDataUpdates
} from '../utils/googleSheets';
import { useTheme } from '../context/ThemeContext';
import { calculateRankTier } from './RankedMode';
import { UserAvatar } from './UserAvatar';

interface LeaderboardViewProps {
  currentLanguage: Language;
  user?: User | null;
  onGoToRanked?: () => void;
  onOpenAvatarModal?: () => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  user,
  onGoToRanked,
  onOpenAvatarModal
}) => {
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLang, setFilterLang] = useState<'all' | 'th' | 'en'>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'speed_sprint' | 'championship_endurance' | 'sudden_death'>('all');
  const [previewPlayer, setPreviewPlayer] = useState<{
    displayName: string;
    uid: string;
    avatar: string;
    avatarBg: string;
    rankTier: string;
    score: number;
    netWpm: number;
    accuracy: number;
  } | null>(null);
  const { isDark } = useTheme();

  const fetchScores = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetchLeaderboard();
      // Specifically filter to the Ranked Arena game as requested: "Ranking วัดจากเกมนี้อย่างเดียว"
      const rankedOnly = data.filter(s => s.gameMode === 'ranked' || s.testType === 'RANKED');
      setScores(rankedOnly.length > 0 ? rankedOnly : data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
    const unsubscribe = subscribeUserDataUpdates(() => {
      fetchScores();
    });
    return () => unsubscribe();
  }, [fetchScores, user?.avatar, user?.avatarBg, user?.uid]);

  const getRecordMode = (item: ScoreRecord): 'speed_sprint' | 'championship_endurance' | 'sudden_death' => {
    if (item.championshipMode) return item.championshipMode;
    if (item.levelId === 'ranked_championship_endurance' || item.timeTakenSeconds > 65) {
      return 'championship_endurance';
    }
    if (item.levelId === 'ranked_sudden_death') {
      return 'sudden_death';
    }
    return 'speed_sprint';
  };

  const getUserIdentityKey = (item: ScoreRecord): string => {
    if (item.uid && item.uid !== 'guest' && item.uid !== 'guest_default') {
      return item.uid.toLowerCase();
    }
    return (item.displayName || 'guest').trim().toLowerCase();
  };

  const isRowOwnedByCurrentUser = useCallback(
    (item: ScoreRecord): boolean => {
      if (!user) return false;
      return isRecordOwnedByUser(item, user);
    },
    [user]
  );

  // Resolve most up-to-date profile picture & gradient for ANY player across users + all score rows
  const resolvePlayerAvatar = React.useMemo(() => {
    const localUsers = getLocalUsers();
    const isValidImg = (av?: string) =>
      Boolean(av && (av.startsWith('data:image') || av.startsWith('http') || av.startsWith('/')));

    // Build latest non-empty avatar per player across ALL score rows (newest first)
    const latestFromScores = new Map<string, { avatar: string; avatarBg: string }>();
    const newestScores = [...scores].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    for (const s of newestScores) {
      if (!isValidImg(s.avatar)) continue;
      const entry = {
        avatar: s.avatar!,
        avatarBg: s.avatarBg || 'from-cyan-500 to-blue-600'
      };
      const uidKey = String(s.uid || '').trim().toLowerCase();
      const nameKey = s.displayName ? `name:${s.displayName.trim().toLowerCase()}` : '';
      if (uidKey && uidKey !== 'guest' && uidKey !== 'guest_default' && !latestFromScores.has(uidKey)) {
        latestFromScores.set(uidKey, entry);
      }
      if (nameKey && !latestFromScores.has(nameKey)) {
        latestFromScores.set(nameKey, entry);
      }
    }

    return (item: ScoreRecord) => {
      const uidKey = String(item.uid || '').trim().toLowerCase();
      const nameKey = item.displayName ? `name:${item.displayName.trim().toLowerCase()}` : '';
      const fromScoreMap =
        (uidKey && uidKey !== 'guest' && uidKey !== 'guest_default' ? latestFromScores.get(uidKey) : undefined) ||
        (nameKey ? latestFromScores.get(nameKey) : undefined);

      if (isRowOwnedByCurrentUser(item) && user) {
        const bestAvatar = isValidImg(user.avatar)
          ? user.avatar!
          : fromScoreMap?.avatar || (isValidImg(item.avatar) ? item.avatar! : '');
        return {
          avatar: bestAvatar,
          avatarBg: user.avatarBg || fromScoreMap?.avatarBg || item.avatarBg || 'from-cyan-500 to-blue-600'
        };
      }

      const matched = localUsers.find(u => isRecordOwnedByUser(item, u));
      const bestAvatar =
        (matched && isValidImg(matched.avatar) ? matched.avatar! : '') ||
        fromScoreMap?.avatar ||
        (isValidImg(item.avatar) ? item.avatar! : '');

      return {
        avatar: bestAvatar,
        avatarBg: matched?.avatarBg || fromScoreMap?.avatarBg || item.avatarBg || 'from-cyan-500 to-blue-600'
      };
    };
  }, [user, scores, isRowOwnedByCurrentUser]);

  // Filter, keep ONLY each user's BEST score per mode, sort, then apply search
  const filteredScores = React.useMemo(() => {
    const modeFiltered = scores.filter(item => {
      if (filterLang !== 'all' && item.language !== filterLang) return false;
      const mode = getRecordMode(item);
      if (filterMode !== 'all' && mode !== filterMode) return false;
      return true;
    });

    // Keep only the single highest score per (user, mode)
    const bestMap = new Map<string, ScoreRecord>();
    for (const item of modeFiltered) {
      const userKey = getUserIdentityKey(item);
      const modeKey = getRecordMode(item);
      const compositeKey = `${userKey}__${modeKey}`;
      const existing = bestMap.get(compositeKey);
      if (
        !existing ||
        item.score > existing.score ||
        (item.score === existing.score && item.accuracy > existing.accuracy) ||
        (item.score === existing.score && item.accuracy === existing.accuracy && item.netWpm > existing.netWpm)
      ) {
        bestMap.set(compositeKey, item);
      }
    }

    const deduplicated = Array.from(bestMap.values()).sort(
      (a, b) => (b.score - a.score) || (b.accuracy - a.accuracy) || (b.netWpm - a.netWpm)
    );

    if (!searchQuery.trim()) return deduplicated;
    const query = searchQuery.toLowerCase();
    return deduplicated.filter(item => item.displayName.toLowerCase().includes(query));
  }, [scores, filterLang, filterMode, searchQuery]);

  // Top 3 Podium
  const top1 = filteredScores[0] || null;
  const top2 = filteredScores[1] || null;
  const top3 = filteredScores[2] || null;

  const renderAvatar = (
    avatar?: string,
    avatarBg?: string,
    size: 'sm' | 'md' | 'lg' = 'md',
    name: string = '',
    seed: string = '',
    className: string = ''
  ) => {
    return (
      <UserAvatar
        avatar={avatar}
        name={name}
        seed={seed || name}
        gradient={avatarBg || 'from-cyan-500 to-blue-600'}
        size={size === 'lg' ? 'xl' : size}
        className={className}
      />
    );
  };

  const handleAvatarClick = (
    row: ScoreRecord,
    avatar: string,
    avatarBg: string,
    rankTierName: string,
    isMine: boolean
  ) => {
    if (isMine && onOpenAvatarModal) {
      onOpenAvatarModal();
      return;
    }
    setPreviewPlayer({
      displayName: row.displayName,
      uid: row.uid,
      avatar,
      avatarBg,
      rankTier: rankTierName,
      score: row.score,
      netWpm: row.netWpm,
      accuracy: row.accuracy
    });
  };

  const getModeLabel = (mode?: string, timeTaken?: number) => {
    if (mode === 'speed_sprint') return { text: '⚡ Speed Sprint (60s)', class: 'bg-amber-500/15 text-amber-500 border-amber-500/30' };
    if (mode === 'championship_endurance') return { text: '🏆 Endurance (120s)', class: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
    if (mode === 'sudden_death') return { text: '❤️ Sudden Death', class: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
    if (timeTaken && timeTaken > 65) return { text: '🏆 Endurance', class: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
    return { text: '⚡ Speed Sprint', class: 'bg-amber-500/15 text-amber-500 border-amber-500/30' };
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div
        className={`border rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        <div>
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-2 border ${
              isDark
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>ทำเนียบยอดฝีมือ (Official Ranking Scoreboard)</span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            ตารางจัดอันดับการประลอง (Ranked Leaderboard)
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            แสดงเฉพาะ<strong>คะแนนที่ดีที่สุดของผู้เล่นแต่ละคนในแต่ละโหมด</strong>ของ Ranked Arena
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onOpenAvatarModal && user && (
            <button
              type="button"
              onClick={onOpenAvatarModal}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl font-semibold text-xs border transition-colors ${
                isDark
                  ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-cyan-500/50'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300 shadow-xs'
              }`}
              title="อัปโหลดหรือเปลี่ยนรูปโปรไฟล์เพื่อแสดงบนตารางอันดับ"
            >
              <UserAvatar
                avatar={user.avatar}
                name={user.displayName || user.fullName || ''}
                seed={user.uid || user.studentId || user.displayName || ''}
                gradient={user.avatarBg || 'from-cyan-500 to-blue-600'}
                size="xs"
              />
              <Camera className="w-3.5 h-3.5 text-cyan-500" />
              <span>เปลี่ยนรูปโปรไฟล์</span>
            </button>
          )}

          {onGoToRanked && (
            <button
              onClick={onGoToRanked}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all hover:scale-105"
            >
              <Flame className="w-4 h-4" />
              <span>ลงแข่งประลองจัดอันดับ</span>
            </button>
          )}

          <button
            onClick={fetchScores}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-xs border transition-colors w-fit ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700'
                : 'bg-slate-50 hover:bg-slate-100 text-cyan-700 border-slate-300 shadow-xs'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
          </button>
        </div>
      </div>

      {/* Top 3 Podium Cards with Player Avatars */}
      {filteredScores.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          {/* Rank 2 (Silver) */}
          {(() => {
            const tier = calculateRankTier(top2.score, top2.accuracy, top2.netWpm);
            const mode = getModeLabel(top2.championshipMode, top2.timeTakenSeconds);
            const { avatar, avatarBg } = resolvePlayerAvatar(top2);
            const isMine = isRowOwnedByCurrentUser(top2);
            return (
              <div
                className={`order-2 md:order-1 border rounded-3xl p-6 text-center relative flex flex-col justify-between shadow-xl transition-all duration-300 ${
                  isDark
                    ? 'bg-slate-900/90 border-slate-700/60'
                    : 'bg-white border-slate-200 shadow-slate-200/50'
                }`}
              >
                <div>
                  <div className="relative inline-block mb-3">
                    <div
                      onClick={() => handleAvatarClick(top2, avatar, avatarBg, tier.tier, isMine)}
                      title={isMine ? 'คลิกเพื่อเปลี่ยนรูปโปรไฟล์' : `ดูรูปโปรไฟล์ของ ${top2.displayName}`}
                      className="p-0.5 rounded-3xl ring-2 ring-slate-300/70 shadow-lg cursor-pointer hover:scale-105 transition-transform"
                    >
                      {renderAvatar(avatar, avatarBg, 'lg', top2.displayName, top2.uid)}
                    </div>
                    <span className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-slate-300 text-slate-950 font-black text-xs flex items-center justify-center border-2 border-slate-900 shadow-md">
                      2
                    </span>
                  </div>
                  <h3 className={`font-bold text-base truncate flex items-center justify-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <span className="truncate">{top2.displayName}</span>
                    {isMine && (
                      <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 text-[10px] font-bold shrink-0">
                        คุณ
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center justify-center gap-1.5 my-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${tier.badgeClass}`}>
                      <span>{tier.icon}</span>
                      <span>{tier.tier}</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] border ${mode.class}`}>
                      {mode.text}
                    </span>
                  </div>
                  <div className={`text-2xl font-black font-mono my-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {top2.score} <span className="text-xs font-normal text-slate-500">pts</span>
                  </div>
                </div>
                <div className={`pt-3 border-t flex justify-around text-xs ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'}`}>
                  <span>⚡ {top2.netWpm} WPM</span>
                  <span>🎯 {top2.accuracy}% Acc</span>
                  {top2.maxCombo ? <span className="text-amber-500 font-bold">🔥 {top2.maxCombo}x</span> : null}
                </div>
              </div>
            );
          })()}

          {/* Rank 1 (Gold / Grandmaster) */}
          {(() => {
            const tier = calculateRankTier(top1.score, top1.accuracy, top1.netWpm);
            const mode = getModeLabel(top1.championshipMode, top1.timeTakenSeconds);
            const isGM = tier.code === 'GM';
            const { avatar, avatarBg } = resolvePlayerAvatar(top1);
            const isMine = isRowOwnedByCurrentUser(top1);
            return (
              <div
                className={`order-1 md:order-2 border-2 rounded-3xl p-7 text-center relative flex flex-col justify-between shadow-2xl md:-translate-y-3 transition-all duration-300 ${
                  isGM
                    ? 'bg-gradient-to-b from-amber-950/60 via-slate-900 to-slate-900 border-amber-400 ring-4 ring-amber-400/20 shadow-amber-500/20'
                    : isDark
                    ? 'bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/50 shadow-amber-500/10'
                    : 'bg-gradient-to-b from-amber-50/70 via-white to-white border-amber-400 shadow-amber-200/60'
                }`}
              >
                <div>
                  <div className="relative inline-block mb-3">
                    <div
                      onClick={() => handleAvatarClick(top1, avatar, avatarBg, tier.tier, isMine)}
                      title={isMine ? 'คลิกเพื่อเปลี่ยนรูปโปรไฟล์' : `ดูรูปโปรไฟล์ของ ${top1.displayName}`}
                      className="p-1 rounded-3xl ring-4 ring-amber-400 shadow-xl shadow-amber-400/30 cursor-pointer hover:scale-105 transition-transform"
                    >
                      {renderAvatar(avatar, avatarBg, 'lg', top1.displayName, top1.uid)}
                    </div>
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl animate-bounce">
                      👑
                    </span>
                    <span className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center border-2 border-slate-900 shadow-md">
                      1
                    </span>
                  </div>
                  <div className="inline-block px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-xs font-black mb-1">
                    🏆 อันดับ 1 แชมเปียนการประลอง
                  </div>
                  <h3 className={`font-black text-lg truncate flex items-center justify-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <span className="truncate">{top1.displayName}</span>
                    {isMine && (
                      <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 text-[10px] font-bold shrink-0">
                        คุณ
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center justify-center gap-1.5 my-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-black ${tier.badgeClass}`}>
                      <span>{tier.icon}</span>
                      <span>{tier.tier}</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] border ${mode.class}`}>
                      {mode.text}
                    </span>
                  </div>
                  <div className="text-3xl font-black text-amber-500 font-mono my-2">
                    {top1.score} <span className="text-xs font-normal text-amber-600">pts</span>
                  </div>
                </div>
                <div className={`pt-3 border-t flex justify-around text-xs font-bold ${isDark ? 'border-slate-800 text-amber-300' : 'border-amber-200 text-amber-700'}`}>
                  <span>⚡ {top1.netWpm} WPM</span>
                  <span>🎯 {top1.accuracy}% Acc</span>
                  {top1.maxCombo ? <span className="text-orange-500 font-black">🔥 {top1.maxCombo}x Combo</span> : null}
                </div>
              </div>
            );
          })()}

          {/* Rank 3 (Bronze) */}
          {(() => {
            const tier = calculateRankTier(top3.score, top3.accuracy, top3.netWpm);
            const mode = getModeLabel(top3.championshipMode, top3.timeTakenSeconds);
            const { avatar, avatarBg } = resolvePlayerAvatar(top3);
            const isMine = isRowOwnedByCurrentUser(top3);
            return (
              <div
                className={`order-3 border rounded-3xl p-6 text-center relative flex flex-col justify-between shadow-xl transition-all duration-300 ${
                  isDark
                    ? 'bg-slate-900/90 border-amber-900/40'
                    : 'bg-white border-slate-200 shadow-slate-200/50'
                }`}
              >
                <div>
                  <div className="relative inline-block mb-3">
                    <div
                      onClick={() => handleAvatarClick(top3, avatar, avatarBg, tier.tier, isMine)}
                      title={isMine ? 'คลิกเพื่อเปลี่ยนรูปโปรไฟล์' : `ดูรูปโปรไฟล์ของ ${top3.displayName}`}
                      className="p-0.5 rounded-3xl ring-2 ring-amber-700/70 shadow-lg cursor-pointer hover:scale-105 transition-transform"
                    >
                      {renderAvatar(avatar, avatarBg, 'lg', top3.displayName, top3.uid)}
                    </div>
                    <span className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-amber-700 text-white font-black text-xs flex items-center justify-center border-2 border-slate-900 shadow-md">
                      3
                    </span>
                  </div>
                  <h3 className={`font-bold text-base truncate flex items-center justify-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <span className="truncate">{top3.displayName}</span>
                    {isMine && (
                      <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 text-[10px] font-bold shrink-0">
                        คุณ
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center justify-center gap-1.5 my-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${tier.badgeClass}`}>
                      <span>{tier.icon}</span>
                      <span>{tier.tier}</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] border ${mode.class}`}>
                      {mode.text}
                    </span>
                  </div>
                  <div className={`text-2xl font-black font-mono my-2 ${isDark ? 'text-amber-300/80' : 'text-amber-700'}`}>
                    {top3.score} <span className="text-xs font-normal text-slate-500">pts</span>
                  </div>
                </div>
                <div className={`pt-3 border-t flex justify-around text-xs ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'}`}>
                  <span>⚡ {top3.netWpm} WPM</span>
                  <span>🎯 {top3.accuracy}% Acc</span>
                  {top3.maxCombo ? <span className="text-amber-500 font-bold">🔥 {top3.maxCombo}x</span> : null}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Filters Toolbar */}
      <div
        className={`border rounded-2xl p-4 space-y-3 transition-all duration-300 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-sm'
        }`}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อผู้เล่น..."
              className={`w-full pl-9 pr-4 py-2 border rounded-xl text-xs focus:outline-none focus:border-cyan-500 transition-colors ${
                isDark
                  ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>

          {/* Language Tabs */}
          <div
            className={`border rounded-xl p-1 flex text-xs transition-colors shrink-0 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'
            }`}
          >
            <button
              onClick={() => setFilterLang('all')}
              className={`px-3 py-1 rounded-lg ${filterLang === 'all' ? 'bg-amber-500 text-slate-950 font-black' : isDark ? 'text-slate-400' : 'text-slate-600'}`}
            >
              ทุกภาษา
            </button>
            <button
              onClick={() => setFilterLang('th')}
              className={`px-3 py-1 rounded-lg ${filterLang === 'th' ? 'bg-amber-500 text-slate-950 font-black' : isDark ? 'text-slate-400' : 'text-slate-600'}`}
            >
              🇹🇭 ภาษาไทย
            </button>
            <button
              onClick={() => setFilterLang('en')}
              className={`px-3 py-1 rounded-lg ${filterLang === 'en' ? 'bg-amber-500 text-slate-950 font-black' : isDark ? 'text-slate-400' : 'text-slate-600'}`}
            >
              🇬🇧 English
            </button>
          </div>
        </div>

        {/* Championship Mode Filter Sub-tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-t border-slate-800/40 text-xs">
          <span className="text-[11px] font-bold text-slate-400 shrink-0">โหมดการแข่งขัน:</span>
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
              filterMode === 'all'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-amber-500/20'
                : isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            🏆 แข่งจัดอันดับทั้งหมด
          </button>
          <button
            onClick={() => setFilterMode('speed_sprint')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
              filterMode === 'speed_sprint'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md shadow-amber-500/20'
                : isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            ⚡ Speed Sprint (60 วินาที)
          </button>
          <button
            onClick={() => setFilterMode('championship_endurance')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
              filterMode === 'championship_endurance'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/20'
                : isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            🏆 Championship Endurance (120 วินาที)
          </button>
          <button
            onClick={() => setFilterMode('sudden_death')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
              filterMode === 'sudden_death'
                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/20'
                : isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            ❤️ Sudden Death Survival (3 หัวใจ)
          </button>
        </div>
      </div>

      {/* Scoreboard Table with Player Profile Pictures */}
      <div
        className={`border rounded-3xl overflow-hidden shadow-xl transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead
              className={`uppercase tracking-wider border-b font-semibold ${
                isDark
                  ? 'bg-slate-950/80 text-slate-400 border-slate-800'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <tr>
                <th className="py-3.5 px-4 w-14 text-center">อันดับ</th>
                <th className="py-3.5 px-4">รูป & ผู้เล่น</th>
                <th className="py-3.5 px-4 text-center">ระดับยศ</th>
                <th className="py-3.5 px-4 text-center">โหมดการแข่งขัน</th>
                <th className="py-3.5 px-4 text-center">ภาษา</th>
                <th className="py-3.5 px-4 text-right">คะแนนแรงก์</th>
                <th className="py-3.5 px-4 text-right">ความเร็ว WPM</th>
                <th className="py-3.5 px-4 text-right">ความแม่นยำ / เกราะ</th>
                <th className="py-3.5 px-4 text-center">คอมโบสูงสุด</th>
                <th className="py-3.5 px-4 text-right">เวลา</th>
                <th className="py-3.5 px-4 text-right">วันที่แข่ง</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y font-mono ${
                isDark ? 'divide-slate-800/60' : 'divide-slate-200/80'
              }`}
            >
              {filteredScores.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-500 font-sans">
                    ยังไม่มีคะแนนในโหมดประลองจัดอันดับ เป็นคนแรกที่เริ่มแข่งขันตอนนี้!
                  </td>
                </tr>
              ) : (
                filteredScores.map((row, index) => {
                  const rank = index + 1;
                  const isTop3 = rank <= 3;
                  const tier = calculateRankTier(row.score, row.accuracy, row.netWpm);
                  const mode = getModeLabel(row.championshipMode, row.timeTakenSeconds);
                  const isGM = tier.code === 'GM';
                  const isMaster = tier.code === 'Master';
                  const { avatar, avatarBg } = resolvePlayerAvatar(row);
                  const isMine = isRowOwnedByCurrentUser(row);
                  const dateStr = new Date(row.createdAt).toLocaleDateString('th-TH', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <tr
                      key={row.scoreId || index}
                      className={`transition-colors ${
                        isMine
                          ? isDark
                            ? 'bg-cyan-950/30 hover:bg-cyan-950/45'
                            : 'bg-cyan-50/70 hover:bg-cyan-100/60'
                          : isDark
                          ? isTop3
                            ? 'bg-amber-950/15 hover:bg-slate-800/60'
                            : 'hover:bg-slate-800/40'
                          : isTop3
                          ? 'bg-amber-50/60 hover:bg-slate-50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center font-bold">
                        {rank === 1 ? '🥇 1' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : rank}
                      </td>

                      {/* Profile Picture & Display Name */}
                      <td className="py-3 px-4 font-sans font-semibold">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => handleAvatarClick(row, avatar, avatarBg, tier.tier, isMine)}
                            title={isMine ? 'คลิกเพื่อเปลี่ยนรูปโปรไฟล์' : `คลิกเพื่อดูรูปโปรไฟล์ของ ${row.displayName}`}
                            className={`relative group/av shrink-0 cursor-pointer hover:scale-105 transition-transform rounded-2xl ${
                              isGM
                                ? 'ring-2 ring-amber-400'
                                : isMaster
                                ? 'ring-2 ring-purple-400'
                                : isMine
                                ? 'ring-2 ring-cyan-400'
                                : isDark
                                ? 'ring-1 ring-slate-700'
                                : 'ring-1 ring-slate-200'
                            }`}
                          >
                            {renderAvatar(avatar, avatarBg, 'md', row.displayName, row.uid)}
                            {isMine && onOpenAvatarModal && (
                              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center shadow-sm">
                                <Camera className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                          <div>
                            <div className={`flex items-center gap-1.5 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                              <span>{row.displayName}</span>
                              {isMine && (
                                <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 text-[10px] font-bold">
                                  คุณ
                                </span>
                              )}
                              {isGM && <span title="Grandmaster">👑</span>}
                              {isMaster && <span title="Master">💎</span>}
                            </div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              {row.uid.slice(0, 14)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Rank Tier */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${tier.badgeClass}`}
                        >
                          <span>{tier.icon}</span>
                          <span>{tier.tier}</span>
                        </span>
                      </td>

                      {/* Championship Mode */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${mode.class}`}>
                          {mode.text}
                        </span>
                      </td>

                      {/* Language */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] border ${
                            isDark
                              ? 'bg-slate-950 border-slate-800 text-slate-300'
                              : 'bg-slate-100 border-slate-200 text-slate-700'
                          }`}
                        >
                          {row.language === 'th' ? '🇹🇭 ไทย' : '🇬🇧 EN'}
                        </span>
                      </td>

                      {/* Rank Score */}
                      <td className="py-3.5 px-4 text-right font-black text-amber-500 text-sm">
                        {row.score}
                      </td>

                      {/* Net WPM */}
                      <td className={`py-3.5 px-4 text-right font-bold ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                        {row.netWpm} WPM
                      </td>

                      {/* Accuracy & Shield Bonus */}
                      <td className={`py-3.5 px-4 text-right font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        <span>{row.accuracy}%</span>
                        {row.accuracy >= 98 ? (
                          <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400">
                            x1.50🛡️
                          </span>
                        ) : row.accuracy >= 95 ? (
                          <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400">
                            x1.25🛡️
                          </span>
                        ) : null}
                      </td>

                      {/* Max Combo */}
                      <td className="py-3.5 px-4 text-center">
                        {row.maxCombo && row.maxCombo > 0 ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-500 font-bold text-[11px]">
                            🔥 {row.maxCombo}x
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Time taken */}
                      <td className={`py-3.5 px-4 text-right ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {row.timeTakenSeconds}s
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-right text-slate-500 font-sans text-[11px]">
                        {dateStr}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Player Avatar Zoom Preview Modal */}
      {previewPlayer && (
        <div
          onClick={() => setPreviewPlayer(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-xs border rounded-3xl p-6 text-center shadow-2xl relative ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => setPreviewPlayer(null)}
              className={`absolute top-4 right-4 p-1.5 rounded-xl transition-colors ${
                isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex justify-center mb-4 mt-1">
              <div className="p-1 rounded-3xl ring-4 ring-cyan-400/40 shadow-xl">
                <UserAvatar
                  avatar={previewPlayer.avatar}
                  name={previewPlayer.displayName}
                  seed={previewPlayer.uid || previewPlayer.displayName}
                  gradient={previewPlayer.avatarBg}
                  size="xl"
                  className="w-32 h-32 rounded-3xl"
                />
              </div>
            </div>

            <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {previewPlayer.displayName}
            </h3>
            <p className="text-xs font-bold text-amber-500 mt-0.5">{previewPlayer.rankTier}</p>

            <div
              className={`mt-4 pt-3 border-t grid grid-cols-3 gap-2 text-xs font-mono ${
                isDark ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-700'
              }`}
            >
              <div>
                <div className="text-[10px] text-slate-500 font-sans">คะแนน</div>
                <div className="font-black text-amber-500">{previewPlayer.score}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 font-sans">ความเร็ว</div>
                <div className="font-bold text-cyan-500">{previewPlayer.netWpm} WPM</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 font-sans">แม่นยำ</div>
                <div className="font-bold text-emerald-500">{previewPlayer.accuracy}%</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
