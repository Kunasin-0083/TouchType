import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Trophy,
  Search,
  RefreshCw,
  Flame,
  Camera,
  X,
  Gamepad2,
  Zap,
  ClipboardCheck,
  BookOpen,
  Award,
  Eye,
  Clock,
  CheckCircle2,
  TrendingUp,
  Crown,
  Building2,
  BarChart3
} from 'lucide-react';
import { ScoreRecord, Language, User } from '../types';
import {
  PublicPlayerProfile,
  apiFetchGlobalLeaderboardData,
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

type LeaderboardCategory = 'all' | 'ranked' | 'game' | 'speed' | 'prepost' | 'lesson' | 'medals';
type RankedSubMode = 'all' | 'speed_sprint' | 'championship_endurance' | 'sudden_death';
type PrePostSubMode = 'posttest' | 'pretest' | 'growth';

interface LeaderboardRowItem {
  rowKey: string;
  player: PublicPlayerProfile;
  sourceScore: ScoreRecord | null;
  primaryValue: number;
  primaryDisplay: string;
  primaryUnit: string;
  secondaryWpm: number;
  secondaryAccuracy: number;
  badgeText: string;
  badgeClass: string;
  languageLabel: string;
  extraText: string;
  dateIso: string | null;
  sortTuple: [number, number, number];
}

function getRankedRecordMode(item: ScoreRecord): 'speed_sprint' | 'championship_endurance' | 'sudden_death' {
  if (item.championshipMode) return item.championshipMode;
  const lvl = String(item.levelId || '').toLowerCase();
  if (lvl.includes('endurance') || item.timeTakenSeconds > 65) return 'championship_endurance';
  if (lvl.includes('sudden_death')) return 'sudden_death';
  return 'speed_sprint';
}

function getRankedModeLabel(mode?: string, timeTaken?: number) {
  if (mode === 'speed_sprint') {
    return { text: '⚡ Speed Sprint (60s)', class: 'bg-amber-500/15 text-amber-500 border-amber-500/30' };
  }
  if (mode === 'championship_endurance') {
    return { text: '🏆 Endurance (120s)', class: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
  }
  if (mode === 'sudden_death') {
    return { text: '❤️ Sudden Death', class: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
  }
  if (timeTaken && timeTaken > 65) {
    return { text: '🏆 Endurance', class: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
  }
  return { text: '⚡ Speed Sprint', class: 'bg-amber-500/15 text-amber-500 border-amber-500/30' };
}

function isQuizRecord(s: ScoreRecord): boolean {
  const lvl = String(s.levelId || '').toLowerCase();
  const title = String(s.levelTitle || '').toLowerCase();
  return lvl.includes('quiz') || title.includes('ข้อสอบ');
}

function getScoreCategoryLabel(s: ScoreRecord): { text: string; class: string } {
  if (s.gameMode === 'ranked' || s.testType === 'RANKED') {
    return { text: '⚔️ ประลองจัดอันดับ', class: 'bg-amber-500/15 text-amber-500 border-amber-500/30' };
  }
  if (s.gameMode === 'game') {
    return { text: `🎮 เกมด่านที่ ${s.levelId}`, class: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30' };
  }
  if (s.gameMode === 'posttest' || s.testType === 'POST_TEST') {
    return { text: '🎓 Post-Test', class: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' };
  }
  if (s.gameMode === 'pretest' || s.testType === 'PRE_TEST') {
    return { text: '📝 Pre-Test', class: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' };
  }
  return { text: '📚 ศูนย์การเรียนรู้', class: 'bg-teal-500/15 text-teal-500 border-teal-500/30' };
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  user,
  onGoToRanked,
  onOpenAvatarModal
}) => {
  const { isDark } = useTheme();

  // Remote + merged Google Sheets data
  const [players, setPlayers] = useState<PublicPlayerProfile[]>([]);
  const [totalScoresCount, setTotalScoresCount] = useState(0);
  const [syncedFromSheet, setSyncedFromSheet] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Category Tabs
  const [category, setCategory] = useState<LeaderboardCategory>('all');
  const [rankedSubMode, setRankedSubMode] = useState<RankedSubMode>('all');
  const [gameLevelFilter, setGameLevelFilter] = useState<'all' | number>('all');
  const [prePostSubMode, setPrePostSubMode] = useState<PrePostSubMode>('posttest');
  const [filterLang, setFilterLang] = useState<'all' | 'th' | 'en'>('all');
  const [filterClassroom, setFilterClassroom] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Player Public Profile Modal
  const [selectedProfile, setSelectedProfile] = useState<{
    player: PublicPlayerProfile;
    rank: number;
    categoryLabel: string;
  } | null>(null);

  const fetchGlobalData = useCallback(async () => {
    setIsLoading(true);
    try {
      const snapshot = await apiFetchGlobalLeaderboardData();
      setPlayers(snapshot.players);
      setTotalScoresCount(snapshot.scores.length);
      setSyncedFromSheet(snapshot.syncedFromSheet);
      setLastSyncedAt(snapshot.syncedAt);
    } catch {
      // keep previous snapshot on transient failure
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGlobalData();
    const unsubscribe = subscribeUserDataUpdates(() => {
      fetchGlobalData();
    });

    const handleFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        fetchGlobalData();
      }
    };
    window.addEventListener('focus', handleFocus);
    const intervalId = window.setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        fetchGlobalData();
      }
    }, 30000);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(intervalId);
    };
  }, [fetchGlobalData, user?.avatar, user?.avatarBg, user?.uid, user?.classroom]);

  const isPlayerCurrentUser = useCallback(
    (player: PublicPlayerProfile): boolean => {
      if (!user) return false;
      const uUid = String(user.uid || '').trim().toLowerCase();
      const uSid = String(user.studentId || user.username || '').trim().toLowerCase();
      const pUid = String(player.uid || '').trim().toLowerCase();
      const pSid = String(player.studentId || '').trim().toLowerCase();
      const pKey = String(player.playerKey || '').trim().toLowerCase();
      if (uUid && (pUid === uUid || pKey === uUid)) return true;
      if (uSid && (pSid === uSid || pKey === uSid || pUid === `std_${uSid}`)) return true;
      return player.allScores.some(s => isRecordOwnedByUser(s, user));
    },
    [user]
  );

  // Merge live avatar/classroom of currently logged-in user immediately for instant UX
  const hydratedPlayers = useMemo(() => {
    return players.map(p => {
      if (user && isPlayerCurrentUser(p)) {
        const hasLiveAvatar = Boolean(
          user.avatar && (user.avatar.startsWith('data:image') || user.avatar.startsWith('http') || user.avatar.startsWith('/'))
        );
        return {
          ...p,
          displayName: user.displayName || p.displayName,
          fullName: user.fullName || p.fullName,
          classroom: user.classroom || p.classroom,
          avatar: hasLiveAvatar ? user.avatar! : p.avatar,
          avatarBg: user.avatarBg || p.avatarBg
        };
      }
      return p;
    });
  }, [players, user, isPlayerCurrentUser]);

  // All available classrooms from Google Sheet players
  const availableClassrooms = useMemo(() => {
    const roomSet = new Set<string>();
    hydratedPlayers.forEach(p => {
      if (p.classroom && p.classroom.trim()) {
        roomSet.add(p.classroom.trim());
      }
    });
    return Array.from(roomSet).sort((a, b) => a.localeCompare(b, 'th'));
  }, [hydratedPlayers]);

  // Category counts for tab badges
  const categoryCounts = useMemo(() => {
    let allCount = 0;
    let rankedCount = 0;
    let gameCount = 0;
    let speedCount = 0;
    let prepostCount = 0;
    let lessonCount = 0;
    let medalsCount = 0;

    hydratedPlayers.forEach(p => {
      if (p.bestOverallScore > 0 || p.totalPlayed > 0) allCount++;
      if (p.bestRankedRecord) rankedCount++;
      if (p.allScores.some(s => s.gameMode === 'game')) gameCount++;
      if (p.bestWpm > 0) speedCount++;
      if (
        p.prePostComparison &&
        (p.prePostComparison.pretestQuizScore !== null ||
          p.prePostComparison.posttestQuizScore !== null ||
          p.prePostComparison.pretestTypingWpm !== null ||
          p.prePostComparison.posttestTypingWpm !== null)
      ) {
        prepostCount++;
      }
      if (p.bestLessonRecord) lessonCount++;
      if (p.totalMedalsCount > 0 || p.completionPercent > 0) medalsCount++;
    });

    return {
      all: allCount,
      ranked: rankedCount,
      game: gameCount,
      speed: speedCount,
      prepost: prepostCount,
      lesson: lessonCount,
      medals: medalsCount
    };
  }, [hydratedPlayers]);

  // Build ranked leaderboard rows based on selected category + filters
  const rankedRows = useMemo((): LeaderboardRowItem[] => {
    const langMatch = (s: ScoreRecord) => filterLang === 'all' || s.language === filterLang;
    const rows: LeaderboardRowItem[] = [];

    for (const player of hydratedPlayers) {
      if (filterClassroom !== 'all' && player.classroom !== filterClassroom) continue;

      if (category === 'all') {
        const eligible = player.allScores.filter(s => langMatch(s) && (Number(s.score) || 0) > 0);
        const best =
          eligible.length > 0
            ? [...eligible].sort(
                (a, b) => b.score - a.score || b.accuracy - a.accuracy || b.netWpm - a.netWpm
              )[0]
            : null;
        if (!best && filterLang === 'all' && player.bestOverallScore > 0) {
          rows.push({
            rowKey: `all_${player.playerKey}`,
            player,
            sourceScore: null,
            primaryValue: player.bestOverallScore,
            primaryDisplay: player.bestOverallScore.toLocaleString(),
            primaryUnit: 'pts',
            secondaryWpm: player.bestWpm,
            secondaryAccuracy: player.bestAccuracy,
            badgeText: player.bestOverallCategory !== '-' ? player.bestOverallCategory : 'คะแนนสะสม',
            badgeClass: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30',
            languageLabel: 'ทุกภาษา',
            extraText: `🏅 ${player.totalMedalsCount} เหรียญ · ${player.completionPercent}%`,
            dateIso: player.lastActiveAt,
            sortTuple: [player.bestOverallScore, player.bestAccuracy, player.bestWpm]
          });
        } else if (best) {
          const catMeta = getScoreCategoryLabel(best);
          rows.push({
            rowKey: `all_${player.playerKey}`,
            player,
            sourceScore: best,
            primaryValue: best.score,
            primaryDisplay: best.score.toLocaleString(),
            primaryUnit: 'pts',
            secondaryWpm: best.netWpm || player.bestWpm,
            secondaryAccuracy: best.accuracy || player.bestAccuracy,
            badgeText: catMeta.text,
            badgeClass: catMeta.class,
            languageLabel: best.language === 'th' ? '🇹🇭 ไทย' : '🇬🇧 EN',
            extraText: `🏅 ${player.totalMedalsCount} เหรียญ · เล่น ${player.totalPlayed} ครั้ง`,
            dateIso: best.createdAt,
            sortTuple: [best.score, best.accuracy, best.netWpm]
          });
        }
      } else if (category === 'ranked') {
        const rankedList = player.allScores.filter(s => {
          if (!(s.gameMode === 'ranked' || s.testType === 'RANKED')) return false;
          if (!langMatch(s)) return false;
          if (rankedSubMode !== 'all' && getRankedRecordMode(s) !== rankedSubMode) return false;
          return true;
        });
        if (rankedList.length === 0) continue;
        const best = [...rankedList].sort(
          (a, b) => b.score - a.score || b.accuracy - a.accuracy || b.netWpm - a.netWpm
        )[0];
        const tier = calculateRankTier(best.score, best.accuracy, best.netWpm);
        const modeInfo = getRankedModeLabel(best.championshipMode, best.timeTakenSeconds);
        rows.push({
          rowKey: `ranked_${player.playerKey}`,
          player,
          sourceScore: best,
          primaryValue: best.score,
          primaryDisplay: best.score.toLocaleString(),
          primaryUnit: 'pts',
          secondaryWpm: best.netWpm,
          secondaryAccuracy: best.accuracy,
          badgeText: `${tier.icon} ${tier.tier}`,
          badgeClass: tier.badgeClass,
          languageLabel: best.language === 'th' ? '🇹🇭 ไทย' : '🇬🇧 EN',
          extraText: modeInfo.text,
          dateIso: best.createdAt,
          sortTuple: [best.score, best.accuracy, best.netWpm]
        });
      } else if (category === 'game') {
        const gameScores = player.allScores.filter(s => {
          if (s.gameMode !== 'game') return false;
          if (!langMatch(s)) return false;
          if (gameLevelFilter !== 'all' && Number(s.levelId) !== gameLevelFilter) return false;
          return true;
        });
        if (gameScores.length === 0) continue;

        if (gameLevelFilter === 'all') {
          // Best score per level summed across levels 1..10
          const bestPerLevel = new Map<number, ScoreRecord>();
          gameScores.forEach(gs => {
            const lvl = Number(gs.levelId);
            if (!Number.isFinite(lvl) || lvl < 1 || lvl > 10) return;
            const ex = bestPerLevel.get(lvl);
            if (!ex || gs.score > ex.score || (gs.score === ex.score && gs.accuracy > ex.accuracy)) {
              bestPerLevel.set(lvl, gs);
            }
          });
          const bestRecords = Array.from(bestPerLevel.values());
          const totalScore = bestRecords.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
          const passedLvls = new Set(gameScores.filter(g => g.passed).map(g => Number(g.levelId))).size;
          const topRun = [...gameScores].sort((a, b) => b.score - a.score || b.netWpm - a.netWpm)[0];
          const avgGameWpm = Math.round(
            bestRecords.reduce((sum, r) => sum + (Number(r.netWpm) || 0), 0) / Math.max(1, bestRecords.length)
          );
          const avgGameAcc = Math.round(
            bestRecords.reduce((sum, r) => sum + (Number(r.accuracy) || 0), 0) / Math.max(1, bestRecords.length)
          );
          rows.push({
            rowKey: `game_all_${player.playerKey}`,
            player,
            sourceScore: topRun,
            primaryValue: totalScore,
            primaryDisplay: totalScore.toLocaleString(),
            primaryUnit: 'pts รวม',
            secondaryWpm: avgGameWpm,
            secondaryAccuracy: avgGameAcc,
            badgeText: `🎮 ผ่าน ${passedLvls}/10 ด่าน`,
            badgeClass:
              passedLvls >= 10
                ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                : 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30',
            languageLabel: topRun.language === 'th' ? '🇹🇭 ไทย' : '🇬🇧 EN',
            extraText: `สูงสุด/ด่าน ${topRun.score.toLocaleString()} pts`,
            dateIso: topRun.createdAt,
            sortTuple: [totalScore, passedLvls, avgGameWpm]
          });
        } else {
          const bestLvlRun = [...gameScores].sort(
            (a, b) => b.score - a.score || b.accuracy - a.accuracy || b.netWpm - a.netWpm
          )[0];
          rows.push({
            rowKey: `game_lvl_${gameLevelFilter}_${player.playerKey}`,
            player,
            sourceScore: bestLvlRun,
            primaryValue: bestLvlRun.score,
            primaryDisplay: bestLvlRun.score.toLocaleString(),
            primaryUnit: 'pts',
            secondaryWpm: bestLvlRun.netWpm,
            secondaryAccuracy: bestLvlRun.accuracy,
            badgeText: bestLvlRun.passed ? `✅ ผ่านด่านที่ ${gameLevelFilter}` : `🎮 ด่านที่ ${gameLevelFilter}`,
            badgeClass: bestLvlRun.passed
              ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-500 border-amber-500/30',
            languageLabel: bestLvlRun.language === 'th' ? '🇹🇭 ไทย' : '🇬🇧 EN',
            extraText: `${bestLvlRun.timeTakenSeconds} วินาที`,
            dateIso: bestLvlRun.createdAt,
            sortTuple: [bestLvlRun.score, bestLvlRun.accuracy, bestLvlRun.netWpm]
          });
        }
      } else if (category === 'speed') {
        const typingList = player.allScores.filter(
          s => !isQuizRecord(s) && langMatch(s) && (Number(s.netWpm) || 0) > 0
        );
        const bestWpmRun =
          typingList.length > 0
            ? [...typingList].sort(
                (a, b) => b.netWpm - a.netWpm || b.accuracy - a.accuracy || b.score - a.score
              )[0]
            : null;
        if (!bestWpmRun && filterLang === 'all' && player.bestWpm > 0) {
          rows.push({
            rowKey: `speed_${player.playerKey}`,
            player,
            sourceScore: null,
            primaryValue: player.bestWpm,
            primaryDisplay: `${player.bestWpm}`,
            primaryUnit: 'WPM',
            secondaryWpm: player.bestWpm,
            secondaryAccuracy: player.bestAccuracy,
            badgeText: '⚡ สถิติสูงสุด',
            badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
            languageLabel: 'ทุกภาษา',
            extraText: `เฉลี่ย ${player.avgWpm} WPM`,
            dateIso: player.lastActiveAt,
            sortTuple: [player.bestWpm, player.bestAccuracy, player.bestOverallScore]
          });
        } else if (bestWpmRun) {
          const catMeta = getScoreCategoryLabel(bestWpmRun);
          rows.push({
            rowKey: `speed_${player.playerKey}`,
            player,
            sourceScore: bestWpmRun,
            primaryValue: bestWpmRun.netWpm,
            primaryDisplay: `${bestWpmRun.netWpm}`,
            primaryUnit: 'WPM',
            secondaryWpm: bestWpmRun.netWpm,
            secondaryAccuracy: bestWpmRun.accuracy,
            badgeText: catMeta.text,
            badgeClass: catMeta.class,
            languageLabel: bestWpmRun.language === 'th' ? '🇹🇭 ไทย' : '🇬🇧 EN',
            extraText: `คะแนน ${bestWpmRun.score.toLocaleString()} · เฉลี่ย ${player.avgWpm} WPM`,
            dateIso: bestWpmRun.createdAt,
            sortTuple: [bestWpmRun.netWpm, bestWpmRun.accuracy, bestWpmRun.score]
          });
        }
      } else if (category === 'prepost') {
        const pp = player.prePostComparison;
        if (!pp) continue;

        if (prePostSubMode === 'posttest') {
          if (pp.posttestQuizScore === null && pp.posttestTypingWpm === null) continue;
          const qScore = pp.posttestQuizScore ?? 0;
          const pct = pp.posttestQuizPercent ?? Math.round((qScore / 10) * 100);
          const diff = pp.quizScoreDiff;
          rows.push({
            rowKey: `post_${player.playerKey}`,
            player,
            sourceScore: null,
            primaryValue: pp.posttestQuizScore !== null ? qScore : pp.posttestTypingWpm || 0,
            primaryDisplay: pp.posttestQuizScore !== null ? `${qScore}/10` : `${pp.posttestTypingWpm} WPM`,
            primaryUnit: pp.posttestQuizScore !== null ? `(${pct}%)` : 'พิมพ์ปฏิบัติ',
            secondaryWpm: pp.posttestTypingWpm ?? player.bestWpm,
            secondaryAccuracy: pp.posttestTypingAccuracy ?? pct,
            badgeText:
              diff !== null
                ? diff > 0
                  ? `📈 พัฒนา +${diff} ข้อ`
                  : diff < 0
                  ? `📉 ${diff} ข้อ`
                  : '➖ คงที่ (0)'
                : '🎓 Post-Test',
            badgeClass:
              diff !== null && diff > 0
                ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-500 border-amber-500/30',
            languageLabel: 'ข้อสอบ/ปฏิบัติ',
            extraText: `Pre-Test: ${pp.pretestQuizScore !== null ? `${pp.pretestQuizScore}/10` : '-'}`,
            dateIso: pp.posttestQuizDate || pp.posttestTypingDate || pp.updatedAt,
            sortTuple: [
              pp.posttestQuizScore !== null ? qScore * 100 : 0,
              pp.posttestTypingWpm || 0,
              pp.posttestTypingAccuracy || 0
            ]
          });
        } else if (prePostSubMode === 'pretest') {
          if (pp.pretestQuizScore === null && pp.pretestTypingWpm === null) continue;
          const qScore = pp.pretestQuizScore ?? 0;
          const pct = pp.pretestQuizPercent ?? Math.round((qScore / 10) * 100);
          rows.push({
            rowKey: `pre_${player.playerKey}`,
            player,
            sourceScore: null,
            primaryValue: pp.pretestQuizScore !== null ? qScore : pp.pretestTypingWpm || 0,
            primaryDisplay: pp.pretestQuizScore !== null ? `${qScore}/10` : `${pp.pretestTypingWpm} WPM`,
            primaryUnit: pp.pretestQuizScore !== null ? `(${pct}%)` : 'พิมพ์ปฏิบัติ',
            secondaryWpm: pp.pretestTypingWpm ?? player.bestWpm,
            secondaryAccuracy: pp.pretestTypingAccuracy ?? pct,
            badgeText: '📝 Pre-Test',
            badgeClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
            languageLabel: 'ข้อสอบ/ปฏิบัติ',
            extraText: `Post-Test: ${pp.posttestQuizScore !== null ? `${pp.posttestQuizScore}/10` : 'ยังไม่สอบ'}`,
            dateIso: pp.pretestQuizDate || pp.pretestTypingDate || pp.updatedAt,
            sortTuple: [
              pp.pretestQuizScore !== null ? qScore * 100 : 0,
              pp.pretestTypingWpm || 0,
              pp.pretestTypingAccuracy || 0
            ]
          });
        } else {
          // growth: requires both Pre & Post quiz or typing
          if (pp.quizScoreDiff === null && pp.typingWpmDiff === null) continue;
          const qDiff = pp.quizScoreDiff;
          const tDiff = pp.typingWpmDiff;
          rows.push({
            rowKey: `growth_${player.playerKey}`,
            player,
            sourceScore: null,
            primaryValue: qDiff !== null ? qDiff : tDiff || 0,
            primaryDisplay:
              qDiff !== null
                ? `${qDiff > 0 ? `+${qDiff}` : qDiff} ข้อ`
                : `${(tDiff || 0) > 0 ? `+${tDiff}` : tDiff} WPM`,
            primaryUnit: qDiff !== null ? `(${pp.pretestQuizScore}→${pp.posttestQuizScore})` : 'WPM',
            secondaryWpm: pp.posttestTypingWpm ?? player.bestWpm,
            secondaryAccuracy: pp.posttestTypingAccuracy ?? player.bestAccuracy,
            badgeText:
              (qDiff ?? 0) > 0 || (tDiff ?? 0) > 0 ? '🚀 พัฒนาการยอดเยี่ยม' : '📊 ครบคู่ Pre-Post',
            badgeClass:
              (qDiff ?? 0) > 0
                ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                : 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30',
            languageLabel: 'เปรียบเทียบ',
            extraText:
              tDiff !== null
                ? `พิมพ์ ${tDiff > 0 ? `+${tDiff}` : tDiff} WPM`
                : `Post ${pp.posttestQuizScore}/10`,
            dateIso: pp.posttestQuizDate || pp.updatedAt,
            sortTuple: [qDiff ?? -99, pp.posttestQuizScore ?? 0, tDiff ?? -99]
          });
        }
      } else if (category === 'lesson') {
        const lessonList = player.allScores.filter(
          s => (s.gameMode === 'lesson' || s.gameMode === 'practice') && langMatch(s)
        );
        if (lessonList.length === 0) continue;
        const best = [...lessonList].sort(
          (a, b) => b.netWpm - a.netWpm || b.accuracy - a.accuracy || b.score - a.score
        )[0];
        rows.push({
          rowKey: `lesson_${player.playerKey}`,
          player,
          sourceScore: best,
          primaryValue: best.netWpm,
          primaryDisplay: `${best.netWpm}`,
          primaryUnit: 'WPM',
          secondaryWpm: best.netWpm,
          secondaryAccuracy: best.accuracy,
          badgeText: `📚 ฝึก ${lessonList.length} ชุด`,
          badgeClass: 'bg-teal-500/15 text-teal-500 border-teal-500/30',
          languageLabel: best.language === 'th' ? '🇹🇭 ไทย' : '🇬🇧 EN',
          extraText: `คะแนน ${best.score.toLocaleString()} pts`,
          dateIso: best.createdAt,
          sortTuple: [best.netWpm, best.accuracy, lessonList.length]
        });
      } else if (category === 'medals') {
        if (player.totalMedalsCount <= 0 && player.completionPercent <= 0) continue;
        rows.push({
          rowKey: `medals_${player.playerKey}`,
          player,
          sourceScore: null,
          primaryValue: player.totalMedalsCount,
          primaryDisplay: `${player.totalMedalsCount}`,
          primaryUnit: 'เหรียญ',
          secondaryWpm: player.bestWpm,
          secondaryAccuracy: player.bestAccuracy,
          badgeText: player.isGrandComplete
            ? '👑 พิชิตหลักสูตร 100%'
            : `🎯 ความคืบหน้า ${player.completionPercent}%`,
          badgeClass: player.isGrandComplete
            ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
            : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
          languageLabel: 'ทุกกิจกรรม',
          extraText: `ผ่านเกม ${player.passedLevelsCount}/10 ด่าน`,
          dateIso: player.lastActiveAt,
          sortTuple: [player.totalMedalsCount, player.completionPercent, player.bestWpm]
        });
      }
    }

    rows.sort((a, b) => {
      if (b.sortTuple[0] !== a.sortTuple[0]) return b.sortTuple[0] - a.sortTuple[0];
      if (b.sortTuple[1] !== a.sortTuple[1]) return b.sortTuple[1] - a.sortTuple[1];
      if (b.sortTuple[2] !== a.sortTuple[2]) return b.sortTuple[2] - a.sortTuple[2];
      return a.player.displayName.localeCompare(b.player.displayName, 'th');
    });

    if (!searchQuery.trim()) return rows;
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(
      r =>
        r.player.displayName.toLowerCase().includes(q) ||
        r.player.fullName.toLowerCase().includes(q) ||
        r.player.classroom.toLowerCase().includes(q) ||
        r.player.studentId.toLowerCase().includes(q)
    );
  }, [
    hydratedPlayers,
    category,
    rankedSubMode,
    gameLevelFilter,
    prePostSubMode,
    filterLang,
    filterClassroom,
    searchQuery
  ]);

  // Logged-in user's standing in current leaderboard view
  const myStanding = useMemo(() => {
    if (!user) return null;
    const idx = rankedRows.findIndex(r => isPlayerCurrentUser(r.player));
    if (idx < 0) return null;
    return {
      rank: idx + 1,
      row: rankedRows[idx],
      leader: rankedRows[0] || null
    };
  }, [user, rankedRows, isPlayerCurrentUser]);

  const top1 = rankedRows[0] || null;
  const top2 = rankedRows[1] || null;
  const top3 = rankedRows[2] || null;

  const categoryMeta: Record<LeaderboardCategory, { label: string; shortLabel: string; primaryCol: string }> = {
    all: { label: 'คะแนนสูงสุดรวมทุกหมวด', shortLabel: 'รวมทุกหมวด', primaryCol: 'คะแนนสูงสุด' },
    ranked: { label: 'โหมดประลองจัดอันดับ (Ranked Arena)', shortLabel: 'ประลองจัดอันดับ', primaryCol: 'คะแนนแรงก์' },
    game: {
      label: gameLevelFilter === 'all' ? 'โหมดเกมฝึกพิมพ์ 10 ด่าน' : `โหมดเกม · ด่านที่ ${gameLevelFilter}`,
      shortLabel: 'เกม 10 ด่าน',
      primaryCol: gameLevelFilter === 'all' ? 'คะแนนรวมด่าน' : 'คะแนนด่าน'
    },
    speed: { label: 'เจ้าแห่งความเร็ว (Top WPM)', shortLabel: 'ความเร็ว WPM', primaryCol: 'ความเร็วสูงสุด' },
    prepost: { label: 'แบบทดสอบ Pre-Test & Post-Test', shortLabel: 'Pre / Post-Test', primaryCol: 'คะแนนสอบ' },
    lesson: { label: 'ศูนย์การเรียนรู้ & ฝึกพิมพ์', shortLabel: 'ฝึกพิมพ์บทเรียน', primaryCol: 'ความเร็วฝึกพิมพ์' },
    medals: { label: 'ทำเนียบเหรียญตรา & พิชิตหลักสูตร', shortLabel: 'เหรียญตรา', primaryCol: 'เหรียญที่ได้รับ' }
  };

  const openPublicProfile = (row: LeaderboardRowItem, rank: number) => {
    setSelectedProfile({
      player: row.player,
      rank,
      categoryLabel: categoryMeta[category].label
    });
  };

  const surfaceClass = isDark
    ? 'bg-slate-900 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200/90 text-slate-900 shadow-slate-200/50';
  const mutedTextClass = isDark ? 'text-slate-400' : 'text-slate-600';

  const categoryTabs: {
    id: LeaderboardCategory;
    label: string;
    icon: React.ReactNode;
    count: number;
  }[] = [
    { id: 'all', label: 'รวมทุกหมวด', icon: <Trophy className="w-3.5 h-3.5" />, count: categoryCounts.all },
    { id: 'ranked', label: 'ประลองจัดอันดับ', icon: <Flame className="w-3.5 h-3.5" />, count: categoryCounts.ranked },
    { id: 'game', label: 'เกม 10 ด่าน', icon: <Gamepad2 className="w-3.5 h-3.5" />, count: categoryCounts.game },
    { id: 'speed', label: 'ความเร็ว WPM', icon: <Zap className="w-3.5 h-3.5" />, count: categoryCounts.speed },
    { id: 'prepost', label: 'Pre / Post-Test', icon: <ClipboardCheck className="w-3.5 h-3.5" />, count: categoryCounts.prepost },
    { id: 'lesson', label: 'ฝึกพิมพ์บทเรียน', icon: <BookOpen className="w-3.5 h-3.5" />, count: categoryCounts.lesson },
    { id: 'medals', label: 'เหรียญตรา', icon: <Award className="w-3.5 h-3.5" />, count: categoryCounts.medals }
  ];

  const renderPodiumCard = (item: LeaderboardRowItem, place: 1 | 2 | 3) => {
    const isMine = isPlayerCurrentUser(item.player);
    const isFirst = place === 1;
    const isSecond = place === 2;
    const ringClass = isFirst
      ? 'ring-4 ring-amber-400 shadow-xl shadow-amber-400/30'
      : isSecond
      ? 'ring-2 ring-slate-300/80 shadow-lg'
      : 'ring-2 ring-amber-700/70 shadow-lg';

    const cardBorder = isFirst
      ? isDark
        ? 'border-2 bg-gradient-to-b from-amber-950/50 via-slate-900 to-slate-900 border-amber-400/80 shadow-2xl shadow-amber-500/15 md:-translate-y-2'
        : 'border-2 bg-gradient-to-b from-amber-50/90 via-white to-white border-amber-400 shadow-xl shadow-amber-200/60 md:-translate-y-2'
      : isDark
      ? 'border bg-slate-900/95 border-slate-800 shadow-xl'
      : 'border bg-white border-slate-200 shadow-lg shadow-slate-200/50';

    const orderClass = isFirst ? 'order-1 md:order-2' : isSecond ? 'order-2 md:order-1' : 'order-3';

    return (
      <div
        key={item.rowKey}
        onClick={() => openPublicProfile(item, place)}
        className={`${orderClass} ${cardBorder} rounded-3xl p-5 sm:p-6 text-center relative flex flex-col justify-between cursor-pointer group hover:border-cyan-400/70 transition-all duration-300`}
      >
        <div>
          <div className="relative inline-block mb-3">
            <div className={`p-1 rounded-3xl transition-transform group-hover:scale-105 ${ringClass}`}>
              <UserAvatar
                avatar={item.player.avatar}
                name={item.player.displayName}
                seed={item.player.uid || item.player.displayName}
                gradient={item.player.avatarBg}
                size="xl"
              />
            </div>
            {isFirst && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-2xl animate-bounce">
                👑
              </span>
            )}
            <span
              className={`absolute -bottom-2 -right-2 w-7 h-7 rounded-full font-black text-xs flex items-center justify-center border-2 border-slate-900 shadow-md ${
                isFirst
                  ? 'bg-amber-400 text-slate-950'
                  : isSecond
                  ? 'bg-slate-300 text-slate-950'
                  : 'bg-amber-700 text-white'
              }`}
            >
              {place}
            </span>
          </div>

          {isFirst && (
            <div className="mb-1">
              <span className="inline-block px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-[11px] font-black">
                🏆 อันดับ 1 · {categoryMeta[category].shortLabel}
              </span>
            </div>
          )}

          <h3
            className={`font-extrabold ${isFirst ? 'text-lg' : 'text-base'} truncate flex items-center justify-center gap-1.5 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            <span className="truncate">{item.player.displayName}</span>
            {isMine && (
              <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 text-[10px] font-bold shrink-0">
                คุณ
              </span>
            )}
          </h3>

          <div className={`text-[11px] mt-0.5 flex items-center justify-center gap-1.5 ${mutedTextClass}`}>
            <Building2 className="w-3 h-3 text-cyan-500 shrink-0" />
            <span>ห้อง {item.player.classroom}</span>
            {item.player.fullName && item.player.fullName !== item.player.displayName && (
              <>
                <span>·</span>
                <span className="truncate max-w-[130px]">{item.player.fullName}</span>
              </>
            )}
          </div>

          <div className="flex items-center justify-center gap-1.5 my-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${item.badgeClass}`}>
              {item.badgeText}
            </span>
          </div>

          <div
            className={`${isFirst ? 'text-3xl text-amber-500' : 'text-2xl'} font-black font-mono tabular-nums my-1.5 ${
              !isFirst && (isDark ? 'text-slate-100' : 'text-slate-800')
            }`}
          >
            {item.primaryDisplay}{' '}
            <span className={`text-xs font-sans font-semibold ${mutedTextClass}`}>{item.primaryUnit}</span>
          </div>
        </div>

        <div>
          <div
            className={`pt-3 mt-2 border-t flex justify-around text-xs font-mono tabular-nums ${
              isDark ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-600'
            }`}
          >
            <span>⚡ {item.secondaryWpm} WPM</span>
            <span>🎯 {item.secondaryAccuracy}%</span>
            <span>🏅 {item.player.totalMedalsCount}</span>
          </div>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              openPublicProfile(item, place);
            }}
            className={`mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              isDark
                ? 'bg-slate-800/80 group-hover:bg-cyan-950/60 border-slate-700 group-hover:border-cyan-500/40 text-cyan-300'
                : 'bg-slate-50 group-hover:bg-cyan-50 border-slate-200 group-hover:border-cyan-300 text-cyan-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>ดูโปรไฟล์และสถิติ</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Header Banner */}
      <div className={`border rounded-3xl p-5 sm:p-7 shadow-xl transition-all duration-300 ${surfaceClass}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  isDark
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>ทำเนียบอันดับคะแนนจาก Google Sheet</span>
              </div>
              {lastSyncedAt && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono tabular-nums border ${
                    syncedFromSheet
                      ? isDark
                        ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-400'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>
                    {syncedFromSheet ? 'ข้อมูลจริง Google Sheet' : 'ข้อมูลล่าสุดในเครื่อง'} ·{' '}
                    {hydratedPlayers.length} คน · {totalScoresCount} สถิติ ·{' '}
                    {new Date(lastSyncedAt).toLocaleTimeString('th-TH', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </span>
              )}
            </div>

            <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              ตารางจัดอันดับผู้เล่น (Leaderboard)
            </h1>
            <p className={`text-xs sm:text-sm mt-1 ${mutedTextClass}`}>
              ดูอันดับคะแนนสูงสุดแยกตามหมวดหมู่จาก Google Sheet และคลิกที่ผู้เล่นเพื่อเปิดดูโปรไฟล์และเหรียญตราของผู้อื่นได้ทันที
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                type="button"
                onClick={onGoToRanked}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02]"
              >
                <Flame className="w-4 h-4" />
                <span>ลงแข่งประลองจัดอันดับ</span>
              </button>
            )}

            <button
              type="button"
              onClick={fetchGlobalData}
              disabled={isLoading}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl font-semibold text-xs border transition-colors ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700'
                  : 'bg-slate-50 hover:bg-slate-100 text-cyan-700 border-slate-300 shadow-xs'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'กำลังดึงข้อมูล...' : 'อัปเดตล่าสุด'}</span>
            </button>
          </div>
        </div>

        {/* Category Selector Tabs */}
        <div className={`mt-5 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {categoryTabs.map(tab => {
              const active = category === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategory(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border whitespace-nowrap shrink-0 transition-all ${
                    active
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 border-cyan-400 text-white shadow-md shadow-cyan-500/20'
                      : isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] ${
                      active
                        ? 'bg-white/20 text-white'
                        : isDark
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Logged-in User's Current Standing Strip */}
      {myStanding && (
        <div
          className={`border rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
            myStanding.rank === 1
              ? isDark
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                : 'bg-amber-50 border-amber-300 text-amber-900'
              : isDark
              ? 'bg-cyan-950/30 border-cyan-500/30 text-cyan-200'
              : 'bg-cyan-50 border-cyan-200 text-cyan-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <UserAvatar
              avatar={myStanding.row.player.avatar}
              name={myStanding.row.player.displayName}
              seed={myStanding.row.player.uid}
              gradient={myStanding.row.player.avatarBg}
              size="sm"
            />
            <div className="text-xs sm:text-sm">
              <div className="font-bold flex flex-wrap items-center gap-2">
                <span>
                  อันดับของคุณในหมวด {categoryMeta[category].shortLabel}:{' '}
                  <strong className="font-mono text-base text-amber-500">#{myStanding.rank}</strong> จาก{' '}
                  {rankedRows.length} คน
                </span>
                {myStanding.rank === 1 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-[11px] font-black">
                    <Crown className="w-3 h-3" /> คุณอยู่อันดับสูงสุด!
                  </span>
                )}
              </div>
              <div className={`text-[11px] font-mono ${mutedTextClass}`}>
                สถิติของคุณ: <strong>{myStanding.row.primaryDisplay} {myStanding.row.primaryUnit}</strong>
                {myStanding.rank > 1 && myStanding.leader && (
                  <>
                    {' '}· อันดับ 1 ({myStanding.leader.player.displayName}):{' '}
                    <strong>
                      {myStanding.leader.primaryDisplay} {myStanding.leader.primaryUnit}
                    </strong>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openPublicProfile(myStanding.row, myStanding.rank)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              isDark
                ? 'bg-slate-900/80 hover:bg-slate-800 border-slate-700 text-cyan-300'
                : 'bg-white hover:bg-slate-50 border-slate-300 text-cyan-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>ดูโปรไฟล์ของฉัน</span>
          </button>
        </div>
      )}

      {/* 3. Top 3 Podium Cards (works cleanly for 1, 2, or 3+ players) */}
      {rankedRows.length > 0 && (
        <div
          className={`grid grid-cols-1 gap-4 pt-2 ${
            rankedRows.length >= 3
              ? 'md:grid-cols-3'
              : rankedRows.length === 2
              ? 'md:grid-cols-2 max-w-3xl mx-auto'
              : 'max-w-md mx-auto'
          }`}
        >
          {top2 && renderPodiumCard(top2, 2)}
          {top1 && renderPodiumCard(top1, 1)}
          {top3 && renderPodiumCard(top3, 3)}
        </div>
      )}

      {/* 4. Filters & Sub-category Toolbar */}
      <div className={`border rounded-2xl p-4 space-y-3 transition-all duration-300 ${surfaceClass}`}>
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search + Classroom */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อผู้เล่น, ชื่อ-สกุล หรือห้องเรียน..."
                className={`w-full pl-9 pr-4 py-2 border rounded-xl text-xs focus:outline-none focus:border-cyan-500 transition-colors ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            {availableClassrooms.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-cyan-500 shrink-0" />
                <select
                  value={filterClassroom}
                  onChange={e => setFilterClassroom(e.target.value)}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:border-cyan-500 ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-200'
                      : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                >
                  <option value="all">ทุกห้องเรียน ({hydratedPlayers.length} คน)</option>
                  {availableClassrooms.map(room => (
                    <option key={room} value={room}>
                      ห้อง {room}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Language Filter (for typing categories) */}
          {category !== 'prepost' && category !== 'medals' && (
            <div
              className={`border rounded-xl p-1 flex text-xs transition-colors shrink-0 self-start md:self-auto ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => setFilterLang('all')}
                className={`px-3 py-1 rounded-lg ${
                  filterLang === 'all'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ทุกภาษา
              </button>
              <button
                type="button"
                onClick={() => setFilterLang('th')}
                className={`px-3 py-1 rounded-lg ${
                  filterLang === 'th'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🇹🇭 ไทย
              </button>
              <button
                type="button"
                onClick={() => setFilterLang('en')}
                className={`px-3 py-1 rounded-lg ${
                  filterLang === 'en'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🇬🇧 EN
              </button>
            </div>
          )}
        </div>

        {/* Sub-filters for Ranked */}
        {category === 'ranked' && (
          <div className={`flex items-center gap-2 overflow-x-auto pb-0.5 pt-2 border-t text-xs ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <span className={`text-[11px] font-bold shrink-0 ${mutedTextClass}`}>โหมดประลอง:</span>
            {(
              [
                { id: 'all', label: '🏆 ทุกโหมดประลอง' },
                { id: 'speed_sprint', label: '⚡ Speed Sprint (60s)' },
                { id: 'championship_endurance', label: '🏆 Endurance (120s)' },
                { id: 'sudden_death', label: '❤️ Sudden Death (3 หัวใจ)' }
              ] as const
            ).map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setRankedSubMode(m.id)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                  rankedSubMode === m.id
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-sm'
                    : isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* Sub-filters for Game 10 Levels */}
        {category === 'game' && (
          <div className={`flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-2 border-t text-xs ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <span className={`text-[11px] font-bold shrink-0 mr-1 ${mutedTextClass}`}>เลือกด่าน:</span>
            <button
              type="button"
              onClick={() => setGameLevelFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                gameLevelFilter === 'all'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              รวมทุกด่าน (1–10)
            </button>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(lvl => (
              <button
                key={lvl}
                type="button"
                onClick={() => setGameLevelFilter(lvl)}
                className={`px-2.5 py-1.5 rounded-xl font-bold whitespace-nowrap font-mono transition-all ${
                  gameLevelFilter === lvl
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                ด่าน {lvl}
              </button>
            ))}
          </div>
        )}

        {/* Sub-filters for Pre/Post Test */}
        {category === 'prepost' && (
          <div className={`flex items-center gap-2 overflow-x-auto pb-0.5 pt-2 border-t text-xs ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <span className={`text-[11px] font-bold shrink-0 ${mutedTextClass}`}>จัดอันดับตาม:</span>
            {(
              [
                { id: 'posttest', label: '🎓 คะแนน Post-Test (หลังเรียน)' },
                { id: 'pretest', label: '📝 คะแนน Pre-Test (ก่อนเรียน)' },
                { id: 'growth', label: '📈 พัฒนาการสูงสุด (Post - Pre)' }
              ] as const
            ).map(sub => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setPrePostSubMode(sub.id)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                  prePostSubMode === sub.id
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-sm'
                    : isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 5. Main Scoreboard Table */}
      <div className={`border rounded-3xl overflow-hidden shadow-xl transition-all duration-300 ${surfaceClass}`}>
        <div
          className={`px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-2 ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/80 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-500" />
            <span className="text-xs sm:text-sm font-bold">{categoryMeta[category].label}</span>
          </div>
          <span className={`text-xs font-mono tabular-nums ${mutedTextClass}`}>
            แสดง {rankedRows.length} ผู้เล่น · คลิกที่แถวเพื่อดูโปรไฟล์
          </span>
        </div>

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
                <th className="py-3.5 px-4 w-16 text-center">อันดับ</th>
                <th className="py-3.5 px-4">รูปโปรไฟล์ &amp; ผู้เล่น</th>
                <th className="py-3.5 px-3 text-center">หมวด / สถานะ</th>
                <th className="py-3.5 px-3 text-right">{categoryMeta[category].primaryCol}</th>
                <th className="py-3.5 px-3 text-right">ความเร็ว WPM</th>
                <th className="py-3.5 px-3 text-right">ความแม่นยำ</th>
                <th className="py-3.5 px-3 text-center">รายละเอียดเพิ่มเติม</th>
                <th className="py-3.5 px-3 text-right">อัปเดตล่าสุด</th>
                <th className="py-3.5 px-4 text-right">โปรไฟล์</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-200/80'}`}>
              {isLoading && rankedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
                      <span>กำลังดึงข้อมูลอันดับและโปรไฟล์ผู้เล่นจาก Google Sheet...</span>
                    </div>
                  </td>
                </tr>
              ) : rankedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="font-semibold mb-1">ยังไม่มีข้อมูลคะแนนในหมวดหมู่นี้</div>
                    <div className="text-[11px]">
                      ลองเปลี่ยนตัวกรองหมวดหมู่ ห้องเรียน หรือเริ่มเล่นเพื่อบันทึกสถิติคนแรกบน Google Sheet
                    </div>
                  </td>
                </tr>
              ) : (
                rankedRows.map((row, index) => {
                  const rank = index + 1;
                  const isTop3 = rank <= 3;
                  const isMine = isPlayerCurrentUser(row.player);

                  return (
                    <tr
                      key={row.rowKey}
                      onClick={() => openPublicProfile(row, rank)}
                      className={`cursor-pointer transition-colors ${
                        isMine
                          ? isDark
                            ? 'bg-cyan-950/30 hover:bg-cyan-950/45'
                            : 'bg-cyan-50/75 hover:bg-cyan-100/70'
                          : isDark
                          ? isTop3
                            ? 'bg-amber-950/15 hover:bg-slate-800/60'
                            : 'hover:bg-slate-800/45'
                          : isTop3
                          ? 'bg-amber-50/55 hover:bg-slate-100/70'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center font-mono font-black whitespace-nowrap">
                        {rank === 1 ? '🥇 1' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : rank}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`relative shrink-0 rounded-2xl ${
                              rank === 1
                                ? 'ring-2 ring-amber-400'
                                : isMine
                                ? 'ring-2 ring-cyan-400'
                                : isDark
                                ? 'ring-1 ring-slate-700'
                                : 'ring-1 ring-slate-200'
                            }`}
                          >
                            <UserAvatar
                              avatar={row.player.avatar}
                              name={row.player.displayName}
                              seed={row.player.uid || row.player.displayName}
                              gradient={row.player.avatarBg}
                              size="md"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className={`font-bold flex items-center gap-1.5 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                              <span className="truncate max-w-[170px] sm:max-w-[220px]">{row.player.displayName}</span>
                              {isMine && (
                                <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 text-[10px] font-bold shrink-0">
                                  คุณ
                                </span>
                              )}
                              {row.player.isGrandComplete && (
                                <span title="พิชิตหลักสูตรครบ 100%">👑</span>
                              )}
                            </div>
                            <div className={`text-[11px] flex items-center gap-1.5 ${mutedTextClass}`}>
                              <span className="text-cyan-500 font-semibold">ห้อง {row.player.classroom}</span>
                              {row.player.fullName && row.player.fullName !== row.player.displayName && (
                                <>
                                  <span>·</span>
                                  <span className="truncate max-w-[140px]">{row.player.fullName}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${row.badgeClass}`}>
                          {row.badgeText}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <span className="font-black text-amber-500 text-sm">{row.primaryDisplay}</span>{' '}
                        <span className={`text-[10px] font-sans ${mutedTextClass}`}>{row.primaryUnit}</span>
                      </td>

                      <td className={`py-3.5 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                        {row.secondaryWpm > 0 ? `${row.secondaryWpm} WPM` : '-'}
                      </td>

                      <td className={`py-3.5 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        {row.secondaryAccuracy > 0 ? `${row.secondaryAccuracy}%` : '-'}
                      </td>

                      <td className={`py-3.5 px-3 text-center whitespace-nowrap text-[11px] ${mutedTextClass}`}>
                        <div>{row.extraText}</div>
                        <div className="text-[10px] opacity-80">{row.languageLabel}</div>
                      </td>

                      <td className={`py-3.5 px-3 text-right font-mono tabular-nums text-[11px] whitespace-nowrap ${mutedTextClass}`}>
                        {formatShortDate(row.dateIso)}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            openPublicProfile(row, rank);
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            isDark
                              ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-300'
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-cyan-700'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>ดูโปรไฟล์</span>
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

      {/* 6. Full Public Player Profile Modal (View Other Users' Profile, Scores & Medals) */}
      {selectedProfile && (() => {
        const { player, rank, categoryLabel } = selectedProfile;
        const isMine = isPlayerCurrentUser(player);
        const bestRanked = player.bestRankedRecord;
        const rankTier = bestRanked
          ? calculateRankTier(bestRanked.score, bestRanked.accuracy, bestRanked.netWpm)
          : null;
        const pp = player.prePostComparison;
        const earnedMedals = player.medalProfile?.earnedMedals || [];

        return (
          <div
            onClick={() => setSelectedProfile(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
          >
            <div
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto border rounded-3xl p-5 sm:p-6 shadow-2xl ${surfaceClass}`}
            >
              {/* Modal Header */}
              <div className={`flex items-start justify-between gap-4 pb-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className="flex items-center gap-4 min-w-0">
                  <div className="p-1 rounded-3xl ring-4 ring-cyan-500/30 shadow-lg shrink-0">
                    <UserAvatar
                      avatar={player.avatar}
                      name={player.displayName}
                      seed={player.uid || player.displayName}
                      gradient={player.avatarBg}
                      size="xl"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-black truncate">{player.displayName}</h2>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-xs font-black font-mono">
                        อันดับ #{rank}
                      </span>
                      {isMine && (
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[11px] font-bold">
                          โปรไฟล์ของคุณ
                        </span>
                      )}
                    </div>
                    {player.fullName && player.fullName !== player.displayName && (
                      <div className={`text-xs font-medium mt-0.5 ${mutedTextClass}`}>{player.fullName}</div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          isDark
                            ? 'bg-slate-950 border-slate-700 text-cyan-400'
                            : 'bg-cyan-50 border-cyan-200 text-cyan-700'
                        }`}
                      >
                        <Building2 className="w-3 h-3" />
                        <span>ห้อง {player.classroom}</span>
                      </span>
                      {rankTier && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${rankTier.badgeClass}`}>
                          <span>{rankTier.icon}</span>
                          <span>{rankTier.tier}</span>
                        </span>
                      )}
                      {player.isGrandComplete && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-500">
                          👑 พิชิตหลักสูตร 100%
                        </span>
                      )}
                    </div>
                    <div className={`text-[11px] mt-1.5 ${mutedTextClass}`}>
                      หมวดปัจจุบัน: {categoryLabel}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedProfile(null)}
                  className={`p-2 rounded-xl transition-colors shrink-0 ${
                    isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 4 Key KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`text-[11px] ${mutedTextClass}`}>คะแนนสูงสุดรวม</div>
                  <div className="text-xl font-black font-mono tabular-nums text-amber-500 mt-0.5">
                    {player.bestOverallScore.toLocaleString()}
                  </div>
                  <div className={`text-[10px] truncate mt-0.5 ${mutedTextClass}`}>{player.bestOverallCategory}</div>
                </div>

                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`text-[11px] ${mutedTextClass}`}>ความเร็วสูงสุด</div>
                  <div className="text-xl font-black font-mono tabular-nums text-cyan-500 mt-0.5">
                    {player.bestWpm} <span className="text-xs font-sans font-normal">WPM</span>
                  </div>
                  <div className={`text-[10px] font-mono mt-0.5 ${mutedTextClass}`}>เฉลี่ย {player.avgWpm} WPM</div>
                </div>

                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`text-[11px] ${mutedTextClass}`}>ความแม่นยำสูงสุด</div>
                  <div className="text-xl font-black font-mono tabular-nums text-emerald-500 mt-0.5">
                    {player.bestAccuracy}%
                  </div>
                  <div className={`text-[10px] font-mono mt-0.5 ${mutedTextClass}`}>เฉลี่ย {player.avgAccuracy}%</div>
                </div>

                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`text-[11px] ${mutedTextClass}`}>เหรียญตรา &amp; หลักสูตร</div>
                  <div className="text-xl font-black font-mono tabular-nums text-indigo-400 mt-0.5">
                    {player.totalMedalsCount} <span className="text-xs font-sans font-normal">เหรียญ</span>
                  </div>
                  <div className={`text-[10px] font-mono mt-0.5 ${mutedTextClass}`}>
                    คืบหน้า {player.completionPercent}%
                  </div>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="mb-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-500 mb-2.5 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  <span>คะแนนสูงสุดแยกตามหมวดหมู่ (จาก Google Sheet)</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="font-bold flex items-center justify-between mb-1">
                      <span>⚔️ โหมดประลองจัดอันดับ</span>
                      <span className="font-mono text-amber-500 font-black">
                        {player.bestRankedScore > 0 ? `${player.bestRankedScore.toLocaleString()} pts` : 'ยังไม่เคยแข่ง'}
                      </span>
                    </div>
                    <div className={`text-[11px] font-mono ${mutedTextClass}`}>
                      {bestRanked
                        ? `ความเร็ว ${bestRanked.netWpm} WPM · แม่นยำ ${bestRanked.accuracy}%`
                        : 'ยังไม่มีสถิติในโหมดประลอง'}
                    </div>
                  </div>

                  <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="font-bold flex items-center justify-between mb-1">
                      <span>🎮 โหมดเกม 10 ด่าน</span>
                      <span className="font-mono text-cyan-500 font-black">
                        ผ่าน {player.passedLevelsCount}/10 ด่าน
                      </span>
                    </div>
                    <div className={`text-[11px] font-mono ${mutedTextClass}`}>
                      คะแนนรวมด่าน {player.totalGameLevelsScore.toLocaleString()} pts · สูงสุดต่อด่าน{' '}
                      {player.bestGameScore.toLocaleString()} pts
                    </div>
                  </div>

                  <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="font-bold flex items-center justify-between mb-1">
                      <span>📝 แบบทดสอบ Pre → Post</span>
                      <span className="font-mono font-black text-emerald-500">
                        {pp?.pretestQuizScore ?? '-'} → {pp?.posttestQuizScore ?? '-'} / 10
                      </span>
                    </div>
                    <div className={`text-[11px] font-mono ${mutedTextClass}`}>
                      {pp?.quizScoreDiff !== null && pp?.quizScoreDiff !== undefined
                        ? `พัฒนาการข้อสอบ ${pp.quizScoreDiff > 0 ? `+${pp.quizScoreDiff}` : pp.quizScoreDiff} ข้อ`
                        : 'รอผลสอบครบทั้งก่อนและหลังเรียน'}
                    </div>
                  </div>

                  <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="font-bold flex items-center justify-between mb-1">
                      <span>📚 ศูนย์การเรียนรู้ &amp; ฝึกพิมพ์</span>
                      <span className="font-mono text-teal-500 font-black">
                        {player.bestLessonRecord ? `${player.bestLessonRecord.netWpm} WPM` : '-'}
                      </span>
                    </div>
                    <div className={`text-[11px] font-mono ${mutedTextClass}`}>
                      {player.bestLessonRecord
                        ? `แม่นยำ ${player.bestLessonRecord.accuracy}% · ฝึกทั้งหมด ${player.totalPlayed} รายการ`
                        : `รวมกิจกรรมทั้งหมด ${player.totalPlayed} รายการ`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Earned Medals Section */}
              <div className="mb-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-2.5 flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  <span>เหรียญตราที่ได้รับ ({earnedMedals.length} เหรียญ)</span>
                </h3>
                {earnedMedals.length === 0 ? (
                  <div className={`p-4 rounded-2xl border text-center text-xs ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'} ${mutedTextClass}`}>
                    ผู้เล่นคนนี้ยังไม่ได้รับเหรียญตราในระบบ
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {earnedMedals.map(m => (
                      <div
                        key={m.id}
                        className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${
                          m.category === 'grand'
                            ? isDark
                              ? 'bg-amber-950/35 border-amber-500/40'
                              : 'bg-amber-50 border-amber-300'
                            : isDark
                            ? 'bg-slate-950/60 border-slate-800'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-sm font-black shrink-0">
                          {m.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold truncate">{m.title}</div>
                          <div className={`text-[10px] truncate ${mutedTextClass}`}>{m.subtitle}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Google Sheet Scores */}
              <div className="mb-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-500 mb-2.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ประวัติคะแนนล่าสุดจาก Google Sheet ({player.allScores.length} รายการ)</span>
                </h3>
                {player.allScores.length === 0 ? (
                  <div className={`p-4 rounded-2xl border text-center text-xs ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'} ${mutedTextClass}`}>
                    ยังไม่มีรายการคะแนนที่บันทึกไว้
                  </div>
                ) : (
                  <div className={`border rounded-2xl overflow-hidden max-h-52 overflow-y-auto ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                    <table className="w-full text-left text-xs">
                      <thead className={isDark ? 'bg-slate-950 text-slate-400' : 'bg-slate-50 text-slate-600'}>
                        <tr>
                          <th className="py-2 px-3">หมวด / ด่าน</th>
                          <th className="py-2 px-2 text-right">คะแนน</th>
                          <th className="py-2 px-2 text-right">WPM</th>
                          <th className="py-2 px-2 text-right">แม่นยำ</th>
                          <th className="py-2 px-3 text-right">วันที่</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                        {player.allScores.slice(0, 15).map(sc => {
                          const cat = getScoreCategoryLabel(sc);
                          return (
                            <tr key={sc.scoreId}>
                              <td className="py-2 px-3">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${cat.class}`}>
                                  {cat.text}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-amber-500">
                                {sc.score.toLocaleString()}
                              </td>
                              <td className="py-2 px-2 text-right font-mono">
                                {isQuizRecord(sc) ? '-' : sc.netWpm}
                              </td>
                              <td className="py-2 px-2 text-right font-mono">{sc.accuracy}%</td>
                              <td className={`py-2 px-3 text-right font-mono text-[10px] ${mutedTextClass}`}>
                                {formatShortDate(sc.createdAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className={`flex flex-wrap items-center justify-between gap-2 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <div>
                  {isMine && onOpenAvatarModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProfile(null);
                        onOpenAvatarModal();
                      }}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                        isDark
                          ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-300'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-cyan-700'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>เปลี่ยนรูปโปรไฟล์ของฉัน</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedProfile(null)}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
