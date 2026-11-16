import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Trophy,
  Flame,
  Zap,
  Target,
  ArrowRight,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  ChevronRight,
  Award,
  Heart,
  Clock,
  Shield,
  Volume2,
  VolumeX,
  AlertTriangle,
  Lock
} from 'lucide-react';
import { Language, ScoreRecord, User } from '../types';
import { VirtualKeyboard } from './VirtualKeyboard';
import { ChampionshipCertificateModal } from './ChampionshipCertificateModal';
import { UserAvatar } from './UserAvatar';
import { apiSaveScore } from '../utils/googleSheets';
import { useTheme } from '../context/ThemeContext';
import { soundManager } from '../utils/audio';
import { calculateTypingMetrics, parseGraphemes } from '../utils/thaiGrapheme';
import {
  THAI_SENTENCES,
  EN_SENTENCES,
  THAI_MEDIUM_WORDS,
  EN_MEDIUM_WORDS,
  THAI_HARD_WORDS,
  EN_HARD_WORDS,
  getRandomSlice
} from '../data/words';

export type ChampionshipModeType = 'speed_sprint' | 'championship_endurance' | 'sudden_death';

interface RankedModeProps {
  language: Language;
  user: User | null;
  onViewLeaderboard: () => void;
  onOpenAvatarModal: () => void;
}

export function calculateRankTier(score: number, accuracy: number, netWpm: number): {
  tier: string;
  code: string;
  icon: string;
  badgeClass: string;
} {
  if (score >= 2400 && netWpm >= 65 && accuracy >= 96) {
    return {
      tier: 'Grandmaster (GM)',
      code: 'GM',
      icon: '👑',
      badgeClass: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black shadow-lg shadow-amber-500/25 ring-2 ring-amber-300'
    };
  }
  if (score >= 1800 && netWpm >= 50 && accuracy >= 94) {
    return {
      tier: 'Master',
      code: 'Master',
      icon: '💎',
      badgeClass: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black shadow-lg shadow-purple-500/20 ring-1 ring-purple-300'
    };
  }
  if (score >= 1400 && netWpm >= 40 && accuracy >= 92) {
    return {
      tier: 'Diamond',
      code: 'Diamond',
      icon: '🔷',
      badgeClass: 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-bold'
    };
  }
  if (score >= 1000 && netWpm >= 30 && accuracy >= 90) {
    return {
      tier: 'Platinum',
      code: 'Platinum',
      icon: '💠',
      badgeClass: 'bg-gradient-to-r from-teal-400 to-emerald-500 text-white font-bold'
    };
  }
  if (score >= 650 && accuracy >= 85) {
    return {
      tier: 'Gold',
      code: 'Gold',
      icon: '🥇',
      badgeClass: 'bg-amber-500 text-slate-950 font-bold'
    };
  }
  if (score >= 350) {
    return {
      tier: 'Silver',
      code: 'Silver',
      icon: '🥈',
      badgeClass: 'bg-slate-300 text-slate-950 font-bold'
    };
  }
  return {
    tier: 'Bronze',
    code: 'Bronze',
    icon: '🥉',
    badgeClass: 'bg-amber-800 text-white font-semibold'
  };
}

export const RankedMode: React.FC<RankedModeProps> = ({
  language,
  user,
  onViewLeaderboard,
  onOpenAvatarModal
}) => {
  const { isDark } = useTheme();

  // Selected championship mode
  const [selectedMode, setSelectedMode] = useState<ChampionshipModeType>('speed_sprint');
  const [isPlaying, setIsPlaying] = useState(false);

  // Gameplay state
  const [targetText, setTargetText] = useState('');
  const [typedText, setTypedText] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [livesLeft, setLivesLeft] = useState(3); // For sudden death
  const [currentCombo, setCurrentCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [penaltyPoints, setPenaltyPoints] = useState(0);
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  // Result modal state
  const [completedRecord, setCompletedRecord] = useState<ScoreRecord | null>(null);
  const [isCertificateOpen, setIsCertificateOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for avoiding stale closures in timer and completion handlers
  const isPlayingRef = useRef(false);
  const typedTextRef = useRef('');
  const maxComboRef = useRef(0);
  const elapsedSecondsRef = useRef(0);
  const livesLeftRef = useRef(3);

  // Text generation for ranked modes
  const generateRankedText = (lang: Language, mode: ChampionshipModeType): string => {
    if (lang === 'th') {
      const sentenceCount = mode === 'championship_endurance' ? 6 : mode === 'sudden_death' ? 4 : 3;
      const wordCount = mode === 'championship_endurance' ? 14 : mode === 'sudden_death' ? 10 : 8;
      const sentences = getRandomSlice(THAI_SENTENCES, sentenceCount);
      const words = getRandomSlice(THAI_MEDIUM_WORDS.concat(THAI_HARD_WORDS), wordCount);
      return [...sentences, ...words].join(' ');
    } else {
      const sentenceCount = mode === 'championship_endurance' ? 6 : mode === 'sudden_death' ? 4 : 3;
      const wordCount = mode === 'championship_endurance' ? 16 : mode === 'sudden_death' ? 10 : 8;
      const sentences = getRandomSlice(EN_SENTENCES, sentenceCount);
      const words = getRandomSlice(EN_MEDIUM_WORDS.concat(EN_HARD_WORDS), wordCount);
      return [...sentences, ...words].join(' ');
    }
  };

  // Time limits
  const timeLimitSeconds =
    selectedMode === 'speed_sprint'
      ? 60
      : selectedMode === 'championship_endurance'
      ? 120
      : undefined; // Sudden death has no time limit; ends when text completes or lives reach 0

  const timeRemaining = timeLimitSeconds !== undefined ? Math.max(0, timeLimitSeconds - elapsedSeconds) : null;

  // Current target character
  const currentIndex = typedText.length;
  const currentTargetChar = currentIndex < targetText.length ? targetText[currentIndex] : null;

  // Combo multiplier calculation
  // 10+ -> 1.2x, 25+ -> 1.5x, 50+ -> 1.8x, 100+ -> 2.0x
  const getComboMultiplier = (combo: number): number => {
    if (combo >= 100) return 2.0;
    if (combo >= 50) return 1.8;
    if (combo >= 25) return 1.5;
    if (combo >= 10) return 1.2;
    return 1.0;
  };

  const activeComboMultiplier = getComboMultiplier(currentCombo);
  const isOnFire = currentCombo >= 25;

  // Live metrics calculation
  const liveMetrics = useMemo(() => {
    return calculateTypingMetrics(
      targetText,
      typedText,
      Math.max(elapsedSeconds, 1),
      language
    );
  }, [targetText, typedText, elapsedSeconds, language]);

  // Accuracy Shield multiplier
  const getAccuracyMultiplier = (acc: number): number => {
    if (acc >= 98) return 1.50;
    if (acc >= 95) return 1.25;
    if (acc >= 85) return 1.00;
    if (acc >= 80) return 0.70;
    if (acc >= 70) return 0.50;
    return 0.30;
  };

  const activeAccMultiplier = getAccuracyMultiplier(liveMetrics.accuracy);

  // Live Ranked Score Formula
  const calculateFinalScore = (
    metrics: { netWpm: number; correctCharacters: number; incorrectCharacters: number; accuracy: number },
    achievedMaxCombo: number
  ) => {
    const wpmWeight = Math.round(metrics.netWpm * 25);
    const correctWeight = metrics.correctCharacters * 2;
    const errorPenalty = metrics.incorrectCharacters * 15;
    const basePoints = Math.max(0, wpmWeight + correctWeight - errorPenalty);

    const comboBonus = getComboMultiplier(achievedMaxCombo);
    const accBonus = getAccuracyMultiplier(metrics.accuracy);

    // Final score combines net WPM, precision shield, and combo multiplier
    return Math.round(basePoints * accBonus * ((comboBonus - 1) * 0.5 + 1));
  };

  // Start championship game
  const handleStartMatch = (mode: ChampionshipModeType) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSelectedMode(mode);
    const text = generateRankedText(language, mode);
    setTargetText(text);
    setTypedText('');
    setStartTime(null);
    setElapsedSeconds(0);
    setLivesLeft(3);
    setCurrentCombo(0);
    setMaxCombo(0);
    setMistakeCount(0);
    setPenaltyPoints(0);
    setIsPlaying(true);
    setCompletedRecord(null);
    setIsCertificateOpen(false);

    // Sync refs
    isPlayingRef.current = true;
    typedTextRef.current = '';
    maxComboRef.current = 0;
    elapsedSecondsRef.current = 0;
    livesLeftRef.current = 3;

    setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 50);
  };

  // Timer loop
  useEffect(() => {
    if (isPlaying && startTime) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => {
          const next = prev + 1;
          elapsedSecondsRef.current = next;
          if (timeLimitSeconds && next >= timeLimitSeconds) {
            handleFinishGame(next, typedTextRef.current, maxComboRef.current);
            return timeLimitSeconds;
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, startTime, timeLimitSeconds]);

  // Finish match handler
  const handleFinishGame = async (
    finalSeconds?: number,
    overrideTypedText?: string,
    overrideMaxCombo?: number
  ) => {
    if (!isPlayingRef.current) return;
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);

    const finalTyped = overrideTypedText !== undefined ? overrideTypedText : typedTextRef.current;
    const finalMaxCombo = overrideMaxCombo !== undefined ? overrideMaxCombo : maxComboRef.current;
    const duration = finalSeconds !== undefined ? finalSeconds : Math.max(elapsedSecondsRef.current, 1);

    const metrics = calculateTypingMetrics(targetText, finalTyped, duration, language);
    const finalScore = calculateFinalScore(metrics, finalMaxCombo);
    const rankTierInfo = calculateRankTier(finalScore, metrics.accuracy, metrics.netWpm);

    const modeLabels = {
      speed_sprint: 'Speed Sprint (60s)',
      championship_endurance: 'Championship Endurance (120s)',
      sudden_death: 'Sudden Death Survival'
    };

    const record: ScoreRecord = {
      scoreId: 'ranked_' + Date.now().toString(36),
      uid: user ? user.uid : 'guest',
      displayName: user ? user.displayName : 'ผู้เล่นทั่วไป (Guest)',
      avatar: user?.avatar || '',
      avatarBg: user?.avatarBg || 'from-cyan-500 to-blue-600',
      gameMode: 'ranked',
      testType: 'RANKED',
      language: language,
      levelId: `ranked_${selectedMode}`,
      levelTitle: `ประลองจัดอันดับ (${modeLabels[selectedMode]})`,
      score: finalScore,
      totalCharacters: metrics.totalCharacters,
      correctCharacters: metrics.correctCharacters,
      incorrectCharacters: metrics.incorrectCharacters,
      accuracy: metrics.accuracy,
      grossWpm: metrics.grossWpm,
      netWpm: metrics.netWpm,
      timeTakenSeconds: duration,
      passed: metrics.accuracy >= 80,
      rankTier: rankTierInfo.tier,
      championshipMode: selectedMode,
      maxCombo: finalMaxCombo,
      accuracyMultiplier: getAccuracyMultiplier(metrics.accuracy),
      createdAt: new Date().toISOString()
    };

    setCompletedRecord(record);
    setIsCertificateOpen(true);
    soundManager.playVictoryFanfare();
    await apiSaveScore(record);
  };

  // Input change handler (No backspace / no mistake correction allowed in Ranked Arena)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isPlayingRef.current) return;

    const rawVal = e.target.value;
    const val = rawVal.normalize('NFC');

    // Strictly block any deletion, backspace, or replacement of already typed characters
    if (val.length <= typedTextRef.current.length) {
      return;
    }

    if (!startTime && val.length > 0) {
      setStartTime(Date.now());
    }

    const prevLen = typedTextRef.current.length;
    typedTextRef.current = val;
    setTypedText(val);

    let hasError = false;
    let errorCharCount = 0;
    for (let i = prevLen; i < val.length; i++) {
      const addedChar = val[i];
      const expectedChar = targetText[i];
      if (addedChar !== expectedChar) {
        hasError = true;
        errorCharCount++;
      }
    }

    if (!hasError) {
      soundManager.playKeyClick();
      const addedCount = val.length - prevLen;
      setCurrentCombo(prev => {
        const next = prev + addedCount;
        if (next > maxComboRef.current) {
          maxComboRef.current = next;
          setMaxCombo(next);
        }
        if (next === 25 || next === 50 || next === 100) {
          soundManager.playFireBonus();
        }
        return next;
      });
    } else {
      // Typing error! Cannot be undone or corrected
      soundManager.playError();
      setCurrentCombo(0);
      setMistakeCount(prev => prev + errorCharCount);
      setPenaltyPoints(prev => prev + 15 * errorCharCount);

      // Sudden death heart deduction
      if (selectedMode === 'sudden_death') {
        soundManager.playHeartLost();
        const remainingHearts = Math.max(0, livesLeftRef.current - errorCharCount);
        livesLeftRef.current = remainingHearts;
        setLivesLeft(remainingHearts);
        if (remainingHearts <= 0) {
          // Sudden death game over -> immediately open completion popup
          handleFinishGame(Math.max(elapsedSecondsRef.current, 1), val, maxComboRef.current);
          return;
        }
      }
    }

    // If reached end of text -> immediately open completion popup
    if (val.length >= targetText.length) {
      handleFinishGame(Math.max(elapsedSecondsRef.current, 1), val, maxComboRef.current);
    }
  };

  const keepCaretAtEnd = (el: HTMLInputElement) => {
    const len = el.value.length;
    if (el.selectionStart !== len || el.selectionEnd !== len) {
      try {
        el.setSelectionRange(len, len);
      } catch {
        // ignore if element does not support selection range
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setPressedKey(e.code);

    // Block deletion and cursor navigation keys so mistakes cannot be edited
    const blockedKeys = [
      'Backspace',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End'
    ];
    if (blockedKeys.includes(e.key)) {
      e.preventDefault();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && ['a', 'x', 'v', 'z', 'y'].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  };

  const handleKeyUp = () => {
    setPressedKey(null);
  };

  const cleanTargetText = targetText.normalize('NFC');
  const targetChars = Array.from(cleanTargetText);
  const isCustomAvatar = user?.avatar?.startsWith('data:image');

  return (
    <>
      {isPlaying ? (
        <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
          {/* Championship Top Live HUD Bar */}
          <div
            className={`border-2 rounded-3xl p-4 sm:p-5 shadow-2xl transition-all duration-300 relative overflow-hidden ${
              isOnFire
                ? 'border-amber-500 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 shadow-amber-500/20'
                : isDark
                ? 'bg-slate-900/90 border-slate-800 shadow-xl'
                : 'bg-white border-slate-200 shadow-slate-200/60'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Mode & Title */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg shrink-0 ${
                    selectedMode === 'speed_sprint'
                      ? 'bg-gradient-to-tr from-cyan-400 to-blue-600 text-white'
                      : selectedMode === 'championship_endurance'
                      ? 'bg-gradient-to-tr from-amber-400 to-orange-500 text-slate-950'
                      : 'bg-gradient-to-tr from-rose-500 to-pink-600 text-white'
                  }`}
                >
                  {selectedMode === 'speed_sprint' ? '⚡' : selectedMode === 'championship_endurance' ? '🏆' : '❤️'}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className={`text-base sm:text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {selectedMode === 'speed_sprint'
                        ? 'Speed Sprint (60 วินาที)'
                        : selectedMode === 'championship_endurance'
                        ? 'Championship Endurance (120 วินาที)'
                        : 'Sudden Death Survival'}
                    </h2>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-extrabold border border-amber-500/30">
                      Championship HUD
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 font-bold border border-rose-500/30">
                      <Lock className="w-3 h-3" />
                      <span>ห้ามลบแก้ไข</span>
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {language === 'th' ? '🇹🇭 ภาษาไทย' : '🇬🇧 English'} • เคาะแป้นพิมพ์เพื่อเริ่มจับเวลา (พิมพ์ผิดไม่สามารถลบแก้ได้)
                  </p>
                </div>
              </div>

              {/* Live Metrics Counters */}
              <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap font-mono">
                {/* Timer or Hearts Display */}
                {selectedMode === 'sudden_death' ? (
                  <div
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border ${
                      isDark ? 'bg-slate-950 border-rose-900/50' : 'bg-rose-50 border-rose-200'
                    }`}
                  >
                    <span className="text-xs font-sans font-bold text-rose-500 mr-1">หัวใจ:</span>
                    {[1, 2, 3].map(h => (
                      <span
                        key={h}
                        className={`text-lg transition-transform ${
                          h <= livesLeft ? 'scale-110' : 'grayscale opacity-30 scale-90'
                        }`}
                      >
                        ❤️
                      </span>
                    ))}
                  </div>
                ) : (
                  <div
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border ${
                      timeRemaining !== null && timeRemaining <= 10
                        ? 'bg-rose-500/20 border-rose-500 text-rose-500 animate-pulse font-black'
                        : isDark
                        ? 'bg-slate-950 border-slate-800 text-cyan-400'
                        : 'bg-slate-100 border-slate-300 text-cyan-700'
                    }`}
                  >
                    <Clock className="w-4 h-4 text-cyan-500" />
                    <span className="text-base font-black">
                      {timeRemaining !== null ? `${timeRemaining}s` : `${elapsedSeconds}s`}
                    </span>
                  </div>
                )}

                {/* Net WPM */}
                <div
                  className={`px-3.5 py-2 rounded-2xl border text-center ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'
                  }`}
                >
                  <span className="text-[10px] text-slate-400 font-sans block">Net WPM</span>
                  <span className={`text-base font-black ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    {liveMetrics.netWpm}
                  </span>
                </div>

                {/* Accuracy Shield */}
                <div
                  className={`px-3.5 py-2 rounded-2xl border text-center ${
                    liveMetrics.accuracy >= 98
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : liveMetrics.accuracy >= 95
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                      : liveMetrics.accuracy >= 85
                      ? isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-300'
                      : 'border-rose-500 bg-rose-500/10 text-rose-400 animate-pulse'
                  }`}
                >
                  <span className="text-[10px] font-sans flex items-center justify-center gap-1">
                    <Shield className="w-3 h-3" />
                    <span>เกราะแม่นยำ</span>
                  </span>
                  <span className="text-base font-black">
                    {liveMetrics.accuracy}%
                  </span>
                </div>

                {/* Combo Multiplier & On Fire Banner */}
                <div
                  className={`px-3.5 py-2 rounded-2xl border text-center transition-all ${
                    isOnFire
                      ? 'border-amber-400 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 shadow-md shadow-amber-500/20 animate-bounce'
                      : currentCombo >= 10
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                      : isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-300'
                  }`}
                >
                  <span className="text-[10px] font-sans flex items-center justify-center gap-1 font-bold">
                    {isOnFire ? <Flame className="w-3 h-3 text-amber-400 animate-spin" /> : null}
                    <span>{isOnFire ? 'ON FIRE!' : 'Combo'}</span>
                  </span>
                  <span className="text-base font-black">
                    {currentCombo}x <span className="text-xs font-normal">({activeComboMultiplier}x)</span>
                  </span>
                </div>

                {/* Exit Button */}
                <button
                  onClick={() => {
                    isPlayingRef.current = false;
                    setIsPlaying(false);
                    if (timerRef.current) clearInterval(timerRef.current);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  ออก
                </button>
              </div>
            </div>
          </div>

          {/* Typing Display Card */}
          <div
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.focus({ preventScroll: true });
                keepCaretAtEnd(inputRef.current);
              }
            }}
            className={`border-2 rounded-3xl p-6 sm:p-8 shadow-2xl relative cursor-text transition-all duration-300 min-h-[180px] ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-slate-300'
                : 'bg-white border-slate-200 text-slate-800 shadow-slate-200/50'
            }`}
          >
            {/* Hidden input taking keyboard events */}
            <input
              ref={inputRef}
              type="text"
              value={typedText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onPaste={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              onSelect={(e) => keepCaretAtEnd(e.currentTarget)}
              onFocus={(e) => keepCaretAtEnd(e.currentTarget)}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="opacity-0 absolute top-1/2 left-1/2 w-px h-px cursor-default pointer-events-none"
            />

            {/* Interactive target text with character-by-character color highlighting */}
            <div
              ref={textDisplayRef}
              className="text-lg sm:text-2xl leading-relaxed tracking-wide font-mono select-none break-words whitespace-pre-wrap"
            >
              {targetChars.map((char, index) => {
                const isTyped = index < typedText.length;
                const isCurrent = index === typedText.length;

                if (char === ' ') {
                  if (isCurrent) {
                    return (
                      <span
                        key={index}
                        className={`inline-block border-b-2 animate-pulse font-bold rounded-xs px-1 ${
                          isDark ? 'bg-cyan-500/40 border-cyan-400 text-cyan-300' : 'bg-cyan-200 border-cyan-600 text-cyan-800'
                        }`}
                      >
                        ␣
                      </span>
                    );
                  }
                  if (isTyped) {
                    const isCorrect = typedText[index] === ' ';
                    return (
                      <span
                        key={index}
                        className={
                          isCorrect
                            ? isDark ? 'text-cyan-400 font-medium' : 'text-cyan-600 font-semibold'
                            : isDark ? 'bg-rose-500/30 text-rose-300 underline font-bold rounded-xs px-1' : 'bg-rose-100 text-rose-700 underline font-bold rounded-xs px-1'
                        }
                      >
                        {isCorrect ? ' ' : '␣'}
                      </span>
                    );
                  }
                  return (
                    <span key={index} className={isDark ? 'text-slate-600' : 'text-slate-400'}>
                      {' '}
                    </span>
                  );
                }

                let charClass = isDark ? 'text-slate-500' : 'text-slate-400';

                if (isTyped) {
                  const isCorrect = typedText[index] === char;
                  charClass = isCorrect
                    ? isDark
                      ? 'text-cyan-400 font-bold'
                      : 'text-cyan-600 font-bold'
                    : isDark
                    ? 'text-rose-400 bg-rose-500/20 underline decoration-rose-500 rounded font-bold px-0.5'
                    : 'text-rose-600 bg-rose-100 underline decoration-rose-500 rounded font-bold px-0.5';
                } else if (isCurrent) {
                  charClass = isDark
                    ? 'text-white bg-cyan-500/40 border-b-2 border-cyan-400 animate-pulse px-0.5 font-bold rounded-xs'
                    : 'text-slate-900 bg-cyan-200 border-b-2 border-cyan-600 animate-pulse px-0.5 font-bold rounded-xs';
                }

                return (
                  <span key={index} className={`transition-colors ${charClass}`}>
                    {char}
                  </span>
                );
              })}
            </div>

            {/* Footer bar with No-Backspace rule & Live counts */}
            <div className={`mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-sans border-t pt-3 ${isDark ? 'border-slate-800/60 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>กติกาประลอง: พิมพ์ผิดไม่สามารถลบหรือแก้ไขย้อนหลังได้</span>
              </span>
              <span className="font-mono flex items-center gap-3">
                <span className="text-emerald-500 font-bold">ถูก: {liveMetrics.correctCharacters}</span>
                <span className="text-rose-500 font-bold">ผิด: {liveMetrics.incorrectCharacters}</span>
                <span>ความคืบหน้า: {typedText.length} / {targetText.length} ({Math.round((typedText.length / Math.max(targetText.length, 1)) * 100)}%)</span>
              </span>
            </div>
          </div>

          {/* Virtual Keyboard */}
          <VirtualKeyboard
            language={language}
            targetChar={currentTargetChar}
            pressedKey={pressedKey}
          />
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      {/* Hero Banner */}
      <div
        className={`relative overflow-hidden rounded-3xl p-6 sm:p-10 shadow-2xl transition-all duration-300 border ${
          isDark
            ? 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/30'
            : 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-white shadow-amber-200/50'
        }`}
      >
        <div className="relative z-10 max-w-3xl">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black mb-3 border ${
              isDark
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-white/20 border-white/40 text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>RANKED ARENA CHAMPIONSHIP 2026</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            สนามแข่งขันประลองจัดอันดับ (Ranked Arena)
          </h1>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-100">
            สัมผัสประสบการณ์การแข่งขันพิมพ์สัมผัสระดับแชมเปียนชิพ ด้วย 3 โหมดประลองสุดเร้าใจ 
            วัดผลด้วยสูตรคำนวณความเร็วคำสุทธิ (Net WPM) ผสานตัวคูณคอมโบต่อเนื่อง และเกราะป้องกันความแม่นยำสูง
          </p>
        </div>
      </div>

      {/* Player Standing Card */}
      <div
        className={`border rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-5 transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            onClick={onOpenAvatarModal}
            className="cursor-pointer hover:scale-105 transition-transform shrink-0"
            title="คลิกเพื่อเปลี่ยนรูปโปรไฟล์"
          >
            <UserAvatar
              avatar={user?.avatar}
              name={user?.displayName || ''}
              gradient={user?.avatarBg || 'from-cyan-500 to-blue-600'}
              size="lg"
              className="ring-2 ring-amber-400"
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {user?.displayName || 'ผู้เล่นทั่วไป (Guest Player)'}
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-500 font-bold">
                Ranked Ready
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              รูปโปรไฟล์นี้จะแสดงบน <strong>Leaderboard และ โพเดียม 3 อันดับแรก</strong>
            </p>
          </div>
        </div>

        <button
          onClick={onOpenAvatarModal}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
            isDark
              ? 'bg-slate-800 hover:bg-slate-750 text-cyan-300 border-slate-700'
              : 'bg-slate-100 hover:bg-slate-200 text-cyan-700 border-slate-300'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>เปลี่ยนรูปโปรไฟล์</span>
        </button>
      </div>

      {/* 3 Championship Game Modes Cards */}
      <div>
        <h3 className={`text-lg font-black mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <Zap className="w-5 h-5 text-amber-500" />
          <span>เลือกโหมดการแข่งขัน (3 Championship Modes):</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Mode 1: Speed Sprint (60s) */}
          <div
            className={`border-2 rounded-3xl p-6 flex flex-col justify-between shadow-xl transition-all duration-300 hover:scale-[1.02] ${
              selectedMode === 'speed_sprint'
                ? 'border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-400/50'
                : isDark
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-slate-200'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center text-2xl shadow-inner">
                  ⚡
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  60 SECONDS
                </span>
              </div>

              <h4 className={`text-xl font-black mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                1. Speed Sprint
              </h4>
              <p className={`text-xs leading-relaxed mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                แข่งขันเร่งความเร็วระยะสั้น ชิงคะแนนสูงสุดในเวลา 1 นาที เหมาะสำหรับผู้ที่ต้องการทดสอบสปีดการพิมพ์ความเร็วสูง
              </p>
            </div>

            <button
              onClick={() => handleStartMatch('speed_sprint')}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>เริ่มประลอง Speed Sprint (60s)</span>
            </button>
          </div>

          {/* Mode 2: Championship Endurance (120s) */}
          <div
            className={`border-2 rounded-3xl p-6 flex flex-col justify-between shadow-xl transition-all duration-300 hover:scale-[1.02] ${
              selectedMode === 'championship_endurance'
                ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-400/50'
                : isDark
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-slate-200'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-2xl shadow-inner">
                  🏆
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30">
                  120 SECONDS
                </span>
              </div>

              <h4 className={`text-xl font-black mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                2. Championship Endurance
              </h4>
              <p className={`text-xs leading-relaxed mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                ทดสอบความอึดและการรักษาระดับความเร็วต่อเนื่อง 2 นาทีเต็ม วัดสมาธิและความจำกล้ามเนื้อในระยะยาว
              </p>
            </div>

            <button
              onClick={() => handleStartMatch('championship_endurance')}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Trophy className="w-4 h-4" />
              <span>เริ่มประลอง Endurance (120s)</span>
            </button>
          </div>

          {/* Mode 3: Sudden Death Survival (3 Hearts) */}
          <div
            className={`border-2 rounded-3xl p-6 flex flex-col justify-between shadow-xl transition-all duration-300 hover:scale-[1.02] ${
              selectedMode === 'sudden_death'
                ? 'border-rose-500 bg-rose-500/10 ring-2 ring-rose-400/50'
                : isDark
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-slate-200'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-2xl shadow-inner">
                  ❤️
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  3 HEARTS SURVIVAL
                </span>
              </div>

              <h4 className={`text-xl font-black mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                3. Sudden Death Survival
              </h4>
              <p className={`text-xs leading-relaxed mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                เน้นความแม่นยำสูงสุด! พิมพ์ผิด 1 ตัวอักษรจะเสีย 1 หัวใจ หากหัวใจหมดครบ 3 ครั้งเกมจะจบลงทันที
              </p>
            </div>

            <button
              onClick={() => handleStartMatch('sudden_death')}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-black text-xs shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Heart className="w-4 h-4" />
              <span>เริ่มประลอง Sudden Death (3 หัวใจ)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Rules & Precision Formula Card */}
      <div
        className={`border rounded-3xl p-6 sm:p-8 shadow-xl transition-all duration-300 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        <h3 className={`text-lg font-black mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <Sparkles className="w-5 h-5 text-amber-500" />
          <span>สูตรคำนวณคะแนนและตัวคูณความแม่นยำ (Precision & Speed Formula):</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {/* Formula 1: Net WPM */}
          <div
            className={`p-4 rounded-2xl border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="font-bold text-sm text-blue-500 mb-1">⚡ Net WPM แกนหลัก</div>
            <p className={`leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              คะแนนพื้นฐานคิดจากความเร็วสุทธิ (Net WPM × 25 แต้ม) และจำนวนตัวอักษรที่พิมพ์ถูก
            </p>
          </div>

          {/* Formula 2: Combo Multipliers */}
          <div
            className={`p-4 rounded-2xl border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="font-bold text-sm text-orange-500 mb-1">🔥 Combo Multiplier</div>
            <p className={`leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              พิมพ์ถูกต่อเนื่อง 10+ (1.2x), 25+ (1.5x On Fire!), 50+ (1.8x) และสูงสุด 100+ (2.0x)
            </p>
          </div>

          {/* Formula 3: Accuracy Shield */}
          <div
            className={`p-4 rounded-2xl border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="font-bold text-sm text-emerald-500 mb-1">🛡️ เกราะแม่นยำ</div>
            <p className={`leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              แม่นยำ 98–100% รับโบนัส x1.50, 95–97% รับโบนัส x1.25, ต่ำกว่า 85% ถูกหักลดทอนหนัก (x0.30 - x0.70)
            </p>
          </div>

          {/* Formula 4: Error Penalty */}
          <div
            className={`p-4 rounded-2xl border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="font-bold text-sm text-rose-500 mb-1">⚠️ บทลงโทษพิมพ์ผิด</div>
            <p className={`leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              หักทันที 15 แต้มต่อคำผิด และรีเซ็ต Combo กลับเป็น 0 ทันทีเพื่อป้องกันการกดปุ่มมั่ว
            </p>
          </div>
        </div>
      </div>

      {/* Rank Tiers Guide */}
      <div
        className={`border rounded-3xl p-6 sm:p-8 shadow-xl transition-all duration-300 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        <h3 className={`text-lg font-black mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <Award className="w-5 h-5 text-amber-500" />
          <span>ระดับแรงก์การแข่งขัน (Rank Tiers):</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-center text-xs">
          <div className="p-3 rounded-2xl border bg-amber-500/10 border-amber-500/40">
            <span className="text-2xl block mb-1">👑</span>
            <span className="font-black text-amber-500 block">GM</span>
            <span className="text-[10px] text-slate-400 block mt-1 font-mono">2,400+ แต้ม</span>
            <span className="text-[9px] text-emerald-400 block font-mono">65+ WPM (96%+)</span>
          </div>

          <div className="p-3 rounded-2xl border bg-purple-500/10 border-purple-500/40">
            <span className="text-2xl block mb-1">💎</span>
            <span className="font-black text-purple-400 block">Master</span>
            <span className="text-[10px] text-slate-400 block mt-1 font-mono">1,800+ แต้ม</span>
            <span className="text-[9px] text-emerald-400 block font-mono">50+ WPM (94%+)</span>
          </div>

          <div className="p-3 rounded-2xl border bg-blue-500/10 border-blue-500/40">
            <span className="text-2xl block mb-1">🔷</span>
            <span className="font-bold text-blue-400 block">Diamond</span>
            <span className="text-[10px] text-slate-400 block mt-1 font-mono">1,400+ แต้ม</span>
            <span className="text-[9px] text-slate-400 block font-mono">40+ WPM (92%+)</span>
          </div>

          <div className="p-3 rounded-2xl border bg-teal-500/10 border-teal-500/40">
            <span className="text-2xl block mb-1">💠</span>
            <span className="font-bold text-teal-400 block">Platinum</span>
            <span className="text-[10px] text-slate-400 block mt-1 font-mono">1,000+ แต้ม</span>
            <span className="text-[9px] text-slate-400 block font-mono">30+ WPM (90%+)</span>
          </div>

          <div className="p-3 rounded-2xl border bg-amber-600/10 border-amber-600/30">
            <span className="text-2xl block mb-1">🥇</span>
            <span className="font-bold text-amber-500 block">Gold</span>
            <span className="text-[10px] text-slate-400 block mt-1 font-mono">650+ แต้ม</span>
            <span className="text-[9px] text-slate-400 block font-mono">Acc 85%+</span>
          </div>

          <div className="p-3 rounded-2xl border bg-slate-400/10 border-slate-400/30">
            <span className="text-2xl block mb-1">🥈</span>
            <span className="font-bold text-slate-400 block">Silver</span>
            <span className="text-[10px] text-slate-400 block mt-1 font-mono">350+ แต้ม</span>
          </div>

          <div className="p-3 rounded-2xl border bg-amber-900/10 border-amber-900/30">
            <span className="text-2xl block mb-1">🥉</span>
            <span className="font-bold text-amber-700 block">Bronze</span>
            <span className="text-[10px] text-slate-400 block mt-1 font-mono">ผู้เริ่มต้น</span>
          </div>
        </div>
      </div>
    </div>
      )}

      {/* Championship Certificate Modal on Completion (always mounted outside isPlaying branch) */}
      {completedRecord && (
        <ChampionshipCertificateModal
          isOpen={isCertificateOpen}
          onClose={() => setIsCertificateOpen(false)}
          record={completedRecord}
          onPlayAgain={() => handleStartMatch(selectedMode)}
          onViewLeaderboard={onViewLeaderboard}
        />
      )}
    </>
  );
};
