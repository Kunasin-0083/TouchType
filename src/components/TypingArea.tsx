import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, AlertCircle, Clock, Zap, Target } from 'lucide-react';
import { Language } from '../types';
import { calculateTypingMetrics, parseGraphemes } from '../utils/thaiGrapheme';
import { soundManager } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';

interface TypingAreaProps {
  targetText: string;
  language: Language;
  timeLimitSeconds?: number;
  onComplete: (metrics: {
    totalCharacters: number;
    correctCharacters: number;
    incorrectCharacters: number;
    accuracy: number;
    grossWpm: number;
    netWpm: number;
    timeTakenSeconds: number;
    cpm: number;
    finalScore: number;
  }) => void;
  onTargetCharChange?: (char: string | null) => void;
  onKeyPressed?: (code: string | null) => void;
  onRestart?: () => void;
  onInteract?: () => void;
  compact?: boolean;
  completionHint?: string;
  allowBackspace?: boolean;
}

export const TypingArea: React.FC<TypingAreaProps> = ({
  targetText,
  language,
  timeLimitSeconds,
  onComplete,
  onTargetCharChange,
  onKeyPressed,
  onRestart,
  onInteract,
  compact = false,
  completionHint,
  allowBackspace = true
}) => {
  const [typedText, setTypedText] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [combo, setCombo] = useState(0);
  const { isDark } = useTheme();

  const typedTextRef = useRef('');

  const inputRef = useRef<HTMLInputElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Target characters array (character-by-character for instant keystroke feedback)
  const cleanTargetText = React.useMemo(() => (targetText || '').normalize('NFC'), [targetText]);
  const targetChars = React.useMemo(() => Array.from(cleanTargetText), [cleanTargetText]);

  // Current target character index
  const currentIndex = typedText.length;
  const currentTargetChar = currentIndex < cleanTargetText.length ? cleanTargetText[currentIndex] : null;

  useEffect(() => {
    onTargetCharChange?.(currentTargetChar);
  }, [currentTargetChar, onTargetCharChange]);

  // Focus input automatically without jarring page scroll
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  // Timer loop
  useEffect(() => {
    if (isActive && !isFinished) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => {
          const next = prev + 1;
          if (timeLimitSeconds && next >= timeLimitSeconds) {
            handleFinish(next);
            return timeLimitSeconds;
          }
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, isFinished, timeLimitSeconds]);

  // Handle completion
  const handleFinish = (finalElapsed?: number, overrideTypedText?: string) => {
    if (isFinished) return;
    setIsFinished(true);
    setIsActive(false);

    const seconds = finalElapsed !== undefined ? finalElapsed : Math.max(elapsedSeconds, 1);
    const finalText = overrideTypedText !== undefined ? overrideTypedText : typedTextRef.current;
    const metrics = calculateTypingMetrics(targetText, finalText, seconds, language);
    onComplete({
      ...metrics,
      timeTakenSeconds: seconds
    });
  };

  // Reset drill
  const handleReset = () => {
    typedTextRef.current = '';
    setTypedText('');
    setStartTime(null);
    setElapsedSeconds(0);
    setIsActive(false);
    setIsFinished(false);
    setCombo(0);
    inputRef.current?.focus({ preventScroll: true });
    onInteract?.();
    onRestart?.();
  };

  const keepCaretAtEnd = (el: HTMLInputElement) => {
    if (allowBackspace) return;
    const len = el.value.length;
    if (el.selectionStart !== len || el.selectionEnd !== len) {
      try {
        el.setSelectionRange(len, len);
      } catch {
        // ignore if element does not support selection range
      }
    }
  };

  // Handle typing input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isFinished) return;

    const rawVal = e.target.value;
    const val = rawVal.normalize('NFC');

    // Enforce no-backspace / no-editing when allowBackspace is false
    if (!allowBackspace) {
      if (val.length <= typedTextRef.current.length || !val.startsWith(typedTextRef.current)) {
        keepCaretAtEnd(e.target);
        return;
      }
    }

    if (!startTime && val.length > 0) {
      setStartTime(Date.now());
      setIsActive(true);
      onInteract?.();
    }

    // Check last character typed
    if (val.length > typedText.length) {
      let hasError = false;
      for (let i = typedText.length; i < val.length; i++) {
        if (val[i] !== cleanTargetText[i]) {
          hasError = true;
          break;
        }
      }

      if (!hasError) {
        soundManager.playKeyClick();
        setCombo(prev => {
          const next = prev + 1;
          if (next > 0 && next % 20 === 0) {
            soundManager.playSuccessChime();
          }
          return next;
        });
      } else {
        soundManager.playError();
        setCombo(0);
      }
    } else {
      // Backspace
      setCombo(0);
    }

    typedTextRef.current = val;
    setTypedText(val);

    // If reached end of target text
    if (val.length >= cleanTargetText.length) {
      handleFinish(undefined, val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyPressed?.(e.code);

    if (!allowBackspace) {
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
      if ((e.ctrlKey || e.metaKey) && ['a', 'x', 'v', 'z', 'y', 'backspace', 'delete'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyPressed?.(null);
    keepCaretAtEnd(e.currentTarget);
  };

  // Live metrics calculations
  const liveMetrics = React.useMemo(() => {
    return calculateTypingMetrics(
      targetText,
      typedText,
      Math.max(elapsedSeconds, 1),
      language
    );
  }, [targetText, typedText, elapsedSeconds, language]);

  const timeRemaining = timeLimitSeconds ? Math.max(0, timeLimitSeconds - elapsedSeconds) : null;
  const progressPercent = Math.min(100, Math.round((typedText.length / Math.max(targetText.length, 1)) * 100));

  return (
    <div
      onClick={() => {
        inputRef.current?.focus({ preventScroll: true });
        onInteract?.();
      }}
      className={`w-full max-w-5xl mx-auto border rounded-3xl ${
        compact ? 'p-4 sm:p-5' : 'p-5 sm:p-7'
      } relative cursor-text select-none transition-all duration-300 ${
        isDark
          ? 'bg-slate-900 border-slate-800 shadow-2xl shadow-slate-950/50'
          : 'bg-white border-slate-200/90 shadow-xl shadow-slate-200/50'
      }`}
    >
      {/* Live HUD Header */}
      <div
        className={`grid grid-cols-2 sm:grid-cols-5 gap-3 ${
          compact ? 'mb-3 p-3' : 'mb-6 p-4'
        } rounded-2xl border transition-colors duration-300 ${
          isDark
            ? 'bg-slate-950/70 border-slate-800/80'
            : 'bg-slate-50/90 border-slate-200/80 shadow-xs'
        }`}
      >
        {/* Speed WPM */}
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
              isDark
                ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                : 'bg-cyan-50 border-cyan-200 text-cyan-600'
            }`}
          >
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div
              className={`text-xl sm:text-2xl font-black font-mono ${
                isDark ? 'text-cyan-300' : 'text-cyan-600'
              }`}
            >
              {liveMetrics.netWpm}
            </div>
            <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {language === 'th' ? 'คำ/นาที (WPM)' : 'Net WPM'}
            </div>
          </div>
        </div>

        {/* Accuracy */}
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
              isDark
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-emerald-50 border-emerald-200 text-emerald-600'
            }`}
          >
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div
              className={`text-xl sm:text-2xl font-black font-mono ${
                isDark ? 'text-emerald-400' : 'text-emerald-600'
              }`}
            >
              {liveMetrics.accuracy}%
            </div>
            <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ความแม่นยำ</div>
          </div>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
              isDark
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                : 'bg-blue-50 border-blue-200 text-blue-600'
            }`}
          >
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div
              className={`text-xl sm:text-2xl font-black font-mono ${
                isDark ? 'text-blue-300' : 'text-blue-600'
              }`}
            >
              {timeRemaining !== null ? `${timeRemaining}s` : `${elapsedSeconds}s`}
            </div>
            <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {timeRemaining !== null ? 'เวลาคงเหลือ' : 'เวลาที่ใช้'}
            </div>
          </div>
        </div>

        {/* Errors & Combo */}
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
              isDark
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                : 'bg-rose-50 border-rose-200 text-rose-600'
            }`}
          >
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <div
              className={`text-xl sm:text-2xl font-black font-mono ${
                isDark ? 'text-rose-400' : 'text-rose-600'
              }`}
            >
              {liveMetrics.incorrectCharacters}
            </div>
            <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ข้อผิดพลาด</div>
          </div>
        </div>

        {/* Controls / Combo badge */}
        <div className="col-span-2 sm:col-span-1 flex items-center justify-between sm:justify-end gap-2">
          {combo >= 5 && (
            <div className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-500 font-bold text-xs animate-bounce flex items-center gap-1">
              🔥 {combo} Combo!
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReset();
            }}
            title="เริ่มใหม่ (Restart)"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border-slate-300 shadow-xs'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>เริ่มใหม่</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        className={`w-full rounded-full h-2 ${compact ? 'mb-3.5' : 'mb-6'} overflow-hidden border ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-200 border-slate-300/60'
        }`}
      >
        <div
          className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-150 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Interactive Text Display */}
      <div
        ref={textDisplayRef}
        className={`${
          compact ? 'p-4 sm:p-5 min-h-[104px]' : 'p-6 min-h-[140px]'
        } rounded-2xl border font-mono text-lg sm:text-xl md:text-2xl leading-relaxed tracking-wider whitespace-pre-wrap relative overflow-hidden transition-colors duration-300 break-words ${
          isDark
            ? 'bg-slate-950/80 border-slate-800 text-slate-400'
            : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}
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
                      ? isDark ? 'text-emerald-400 font-medium' : 'text-emerald-600 font-semibold'
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

          let charStyle = isDark ? 'text-slate-500' : 'text-slate-400';

          if (isTyped) {
            const isCorrect = typedText[index] === char;
            if (isCorrect) {
              charStyle = isDark
                ? 'text-emerald-400 font-bold'
                : 'text-emerald-600 font-bold';
            } else {
              charStyle = isDark
                ? 'text-rose-400 bg-rose-950/60 underline decoration-rose-500 font-bold rounded-xs px-0.5'
                : 'text-rose-600 bg-rose-100 underline decoration-rose-500 font-bold rounded-xs px-0.5';
            }
          } else if (isCurrent) {
            charStyle = isDark
              ? 'text-white bg-cyan-500/40 border-b-2 border-cyan-400 rounded-xs animate-pulse font-bold px-0.5'
              : 'text-slate-900 bg-cyan-200 border-b-2 border-cyan-600 rounded-xs animate-pulse font-bold px-0.5';
          }

          return (
            <span
              key={index}
              className={`transition-colors ${charStyle}`}
            >
              {char}
            </span>
          );
        })}
      </div>

      {/* Hidden real input field for cross-device support */}
      <input
        ref={inputRef}
        type="text"
        value={typedText}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onSelect={(e) => keepCaretAtEnd(e.currentTarget)}
        onFocus={(e) => {
          keepCaretAtEnd(e.currentTarget);
          onInteract?.();
        }}
        disabled={isFinished}
        className="absolute opacity-0 top-1/2 left-1/2 w-px h-px pointer-events-none"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />

      {/* Status banner */}
      <div
        className={`${compact ? 'mt-3' : 'mt-4'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs ${
          isDark ? 'text-slate-400' : 'text-slate-500'
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {isFinished && completionHint ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className={`font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                {completionHint}
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
              <span>
                {allowBackspace
                  ? 'คลิกที่กล่องเพื่อเริ่มพิมพ์ได้ทันที หรือกดแป้นพิมพ์บนคีย์บอร์ด'
                  : 'พิมพ์ผิดไม่สามารถลบแก้ไขย้อนหลังได้ • คลิกที่กล่องเพื่อพิมพ์ต่อ'}
              </span>
            </>
          )}
        </div>
        <div>
          ความคืบหน้า: <strong className={isDark ? 'text-cyan-300' : 'text-cyan-600'}>{typedText.length}</strong> / {targetText.length} อักขระ ({progressPercent}%)
        </div>
      </div>
    </div>
  );
};
