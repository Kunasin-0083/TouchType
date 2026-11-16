import React, { useState } from 'react';
import {
  ArrowRight,
  Star,
  ChevronLeft,
  Sparkles
} from 'lucide-react';
import { Language, LevelConfig, ScoreRecord, User } from '../types';
import { LEVELS_CONFIG, generateLevelText } from '../data/levels';
import { TypingArea } from './TypingArea';
import { VirtualKeyboard } from './VirtualKeyboard';
import { ResultModal } from './ResultModal';
import { apiSaveScore } from '../utils/googleSheets';
import { useTheme } from '../context/ThemeContext';

interface GameModeProps {
  language: Language;
  user: User | null;
  onViewLeaderboard: () => void;
}

export const GameMode: React.FC<GameModeProps> = ({
  language,
  user,
  onViewLeaderboard
}) => {
  const [selectedLevel, setSelectedLevel] = useState<LevelConfig | null>(null);
  const [targetText, setTargetText] = useState('');
  const [currentTargetChar, setCurrentTargetChar] = useState<string | null>(null);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [completedRecord, setCompletedRecord] = useState<ScoreRecord | null>(null);
  const { isDark } = useTheme();

  const [unlockedLevel, setUnlockedLevel] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('touch_typing_unlocked_level');
      return saved ? parseInt(saved, 10) : 10;
    }
    return 10;
  });

  // Start Level
  const handleStartLevel = (level: LevelConfig) => {
    setSelectedLevel(level);
    const text = generateLevelText(level, language);
    setTargetText(text);
    setCompletedRecord(null);
  };

  // Level Finished
  const handleLevelComplete = async (metrics: {
    totalCharacters: number;
    correctCharacters: number;
    incorrectCharacters: number;
    accuracy: number;
    grossWpm: number;
    netWpm: number;
    timeTakenSeconds: number;
    cpm: number;
    finalScore: number;
  }) => {
    if (!selectedLevel) return;

    const isPassed =
      metrics.accuracy >= selectedLevel.targetAccuracy &&
      metrics.netWpm >= selectedLevel.minWpm;

    const record: ScoreRecord = {
      scoreId: 'sc_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      uid: user ? user.uid : 'guest',
      displayName: user ? user.displayName : 'ผู้เล่นทั่วไป (Guest)',
      gameMode: 'game',
      testType: 'NONE',
      language: language,
      levelId: selectedLevel.id,
      levelTitle: language === 'th' ? selectedLevel.titleTh : selectedLevel.titleEn,
      score: metrics.finalScore,
      totalCharacters: metrics.totalCharacters,
      correctCharacters: metrics.correctCharacters,
      incorrectCharacters: metrics.incorrectCharacters,
      accuracy: metrics.accuracy,
      grossWpm: metrics.grossWpm,
      netWpm: metrics.netWpm,
      timeTakenSeconds: metrics.timeTakenSeconds,
      passed: isPassed,
      createdAt: new Date().toISOString()
    };

    setCompletedRecord(record);

    // Save to Google Sheets
    await apiSaveScore(record);

    if (isPassed && selectedLevel.id >= unlockedLevel && selectedLevel.id < 10) {
      const nextUnlocked = selectedLevel.id + 1;
      setUnlockedLevel(nextUnlocked);
      localStorage.setItem('touch_typing_unlocked_level', String(nextUnlocked));
    }
  };

  const handleNextLevel = () => {
    if (!selectedLevel || selectedLevel.id >= 10) return;
    const nextConfig = LEVELS_CONFIG.find(l => l.id === selectedLevel.id + 1);
    if (nextConfig) {
      handleStartLevel(nextConfig);
    }
  };

  const handlePlayAgain = () => {
    if (selectedLevel) {
      const freshText = generateLevelText(selectedLevel, language);
      setTargetText(freshText);
      setCompletedRecord(null);
    }
  };

  // If a level is active, display game play view
  if (selectedLevel) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Top Level Bar */}
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border rounded-2xl p-4 transition-colors duration-300 ${
            isDark
              ? 'bg-slate-900/80 border-slate-800'
              : 'bg-white border-slate-200/90 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedLevel(null)}
              className={`p-2 rounded-xl transition-colors ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title="กลับหน้ารวมด่าน"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h2
                className={`text-lg font-bold flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                <span>{language === 'th' ? selectedLevel.titleTh : selectedLevel.titleEn}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    isDark
                      ? 'bg-cyan-950 border-cyan-800 text-cyan-300'
                      : 'bg-cyan-50 border-cyan-300 text-cyan-700'
                  }`}
                >
                  {language === 'th' ? '🇹🇭 ภาษาไทย' : '🇬🇧 ภาษาอังกฤษ'}
                </span>
              </h2>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {language === 'th' ? selectedLevel.descriptionTh : selectedLevel.descriptionEn}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span
              className={`px-3 py-1.5 rounded-xl border ${
                isDark
                  ? 'bg-slate-950 border-slate-800 text-slate-300'
                  : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              🎯 เกณฑ์ผ่าน: แม่นยำ <strong>{selectedLevel.targetAccuracy}%</strong> | ความเร็ว <strong>{selectedLevel.minWpm} WPM</strong>
            </span>
          </div>
        </div>

        {/* Typing Engine Screen */}
        <TypingArea
          key={targetText}
          targetText={targetText}
          language={language}
          timeLimitSeconds={selectedLevel.timeLimitSeconds}
          onTargetCharChange={setCurrentTargetChar}
          onKeyPressed={setPressedKey}
          onComplete={handleLevelComplete}
          onRestart={handlePlayAgain}
        />

        {/* Virtual Keyboard with Dynamic Target Highlight */}
        <VirtualKeyboard
          language={language}
          targetChar={currentTargetChar}
          pressedKey={pressedKey}
        />

        {/* Result Evaluation Modal */}
        {completedRecord && (
          <ResultModal
            scoreRecord={completedRecord}
            targetAccuracy={selectedLevel.targetAccuracy}
            minWpm={selectedLevel.minWpm}
            onPlayAgain={handlePlayAgain}
            onNextLevel={handleNextLevel}
            onViewLeaderboard={onViewLeaderboard}
            hasNextLevel={selectedLevel.id < 10}
          />
        )}
      </div>
    );
  }

  // Level Selection Grid View
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Banner */}
      <div
        className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 shadow-2xl transition-all duration-300 border ${
          isDark
            ? 'bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 border-cyan-500/20'
            : 'bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-700 border-blue-400/30 text-white'
        }`}
      >
        <div className="relative z-10 max-w-2xl">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-3 border ${
              isDark
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                : 'bg-white/15 border-white/30 text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>ระบบฝึกฝน 10 ระดับความยากแบบ Gamification</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            เกมฝึกพิมพ์สัมผัส 10 ด่าน (Level 1 - 10)
          </h1>
          <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-100">
            ไต่ระดับจากแป้นเหย้าพื้นฐาน สลับนิ้ว แป้นแถวบน-ล่าง สู่การพิมพ์คำศัพท์และประโยคจริง 
            ระบบจะสุ่มคำชุดใหม่ทุกครั้งที่เริ่มเล่นหรือกดเล่นซ้ำ
          </p>
        </div>
      </div>

      {/* Levels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {LEVELS_CONFIG.map(level => {
          const isUnlocked = level.id <= unlockedLevel;
          return (
            <div
              key={level.id}
              onClick={() => isUnlocked && handleStartLevel(level)}
              className={`relative rounded-2xl border p-5 transition-all duration-200 flex flex-col justify-between ${
                isUnlocked
                  ? isDark
                    ? 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/50 hover:bg-slate-850 cursor-pointer shadow-lg hover:shadow-cyan-500/10 group'
                    : 'bg-white border-slate-200 hover:border-cyan-400 hover:shadow-md cursor-pointer group shadow-xs'
                  : isDark
                  ? 'bg-slate-950/60 border-slate-900 opacity-60 cursor-not-allowed'
                  : 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
                      isDark
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                        : 'bg-cyan-50 text-cyan-700 border-cyan-200'
                    }`}
                  >
                    ด่าน {level.id} / 10
                  </span>
                  <div className={`flex items-center gap-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>เกณฑ์ {level.targetAccuracy}%</span>
                  </div>
                </div>

                <h3
                  className={`text-base font-bold transition-colors ${
                    isDark
                      ? 'text-white group-hover:text-cyan-300'
                      : 'text-slate-900 group-hover:text-cyan-600'
                  }`}
                >
                  {language === 'th' ? level.titleTh : level.titleEn}
                </h3>
                <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {language === 'th' ? level.descriptionTh : level.descriptionEn}
                </p>
              </div>

              <div
                className={`mt-5 pt-3 border-t flex items-center justify-between text-xs ${
                  isDark ? 'border-slate-800/80 text-slate-400' : 'border-slate-200 text-slate-600'
                }`}
              >
                <span>
                  ขั้นต่ำ: <strong className={isDark ? 'text-cyan-300' : 'text-cyan-600'}>{level.minWpm} WPM</strong>
                </span>

                <span
                  className={`flex items-center gap-1 font-semibold group-hover:translate-x-1 transition-transform ${
                    isDark ? 'text-cyan-400' : 'text-cyan-600'
                  }`}
                >
                  <span>เริ่มด่านนี้</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
