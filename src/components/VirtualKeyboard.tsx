import React from 'react';
import {
  KEYBOARD_ROWS,
  FINGER_DETAILS,
  findKeyForChar
} from '../data/keyboardLayouts';
import { Language } from '../types';
import { useTheme } from '../context/ThemeContext';

interface VirtualKeyboardProps {
  language: Language;
  targetChar: string | null;
  pressedKey?: string | null;
}

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  language,
  targetChar,
  pressedKey
}) => {
  const { isDark } = useTheme();
  const targetLookup = targetChar ? findKeyForChar(targetChar, language) : { key: null, needsShift: false };
  const targetKey = targetLookup.key;
  const needsShift = targetLookup.needsShift;

  const currentFinger = targetKey ? FINGER_DETAILS[targetKey.finger] : null;

  return (
    <div
      className={`w-full max-w-5xl mx-auto rounded-3xl border p-4 sm:p-5 shadow-xl transition-all duration-300 ${
        isDark
          ? 'bg-slate-950/80 border-slate-800 shadow-slate-950/60'
          : 'bg-white/95 border-slate-200/90 shadow-slate-200/50'
      }`}
    >
      {/* Top Helper / Finger Guidance Banner */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 mb-3.5 pb-3 border-b text-xs transition-colors duration-300 ${
          isDark ? 'border-slate-800/80' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>เป้าหมายถัดไป:</span>
          {targetChar ? (
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center justify-center min-w-8 h-8 px-2 rounded-xl font-mono text-base font-bold shadow-md animate-pulse ${
                  isDark
                    ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-200 shadow-cyan-500/20'
                    : 'bg-cyan-100 border border-cyan-400 text-cyan-800 shadow-cyan-200/50'
                }`}
              >
                {targetChar === ' ' ? 'Spacebar ␣' : targetChar}
              </span>
              {needsShift && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-500 font-semibold text-[11px]">
                  + กด Shift ค้างไว้
                </span>
              )}
            </div>
          ) : (
            <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>รอเริ่มพิมพ์</span>
          )}
        </div>

        {/* Active Finger Indicator */}
        {currentFinger && (
          <div className="flex items-center gap-2">
            <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>ใช้นิ้ว:</span>
            <span
              className={`px-2.5 py-1 rounded-lg font-medium text-xs border ${currentFinger.color} flex items-center gap-1.5`}
            >
              <span className="w-2 h-2 rounded-full bg-current animate-ping"></span>
              <span>{language === 'th' ? currentFinger.labelTh : currentFinger.labelEn}</span>
            </span>
          </div>
        )}

        {/* Legend */}
        <div
          className={`hidden md:flex items-center gap-1.5 text-[10px] ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-pink-500/40 border border-pink-500"></span> ก้อย</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-orange-500/40 border border-orange-500"></span> นาง</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-amber-500/40 border border-amber-500"></span> กลาง</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-emerald-500/40 border border-emerald-500"></span> ชี้</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-cyan-500/40 border border-cyan-500"></span> โป้ง</span>
        </div>
      </div>

      {/* Keyboard Grid */}
      <div className="space-y-1.5 select-none font-mono">
        {KEYBOARD_ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className="flex justify-center gap-1 sm:gap-1.5">
            {row.map(key => {
              const isTarget = targetKey?.code === key.code;
              const isShiftHighlight =
                needsShift && (key.code === 'ShiftLeft' || key.code === 'ShiftRight');
              const isPressed = pressedKey === key.code;
              const fingerInfo = FINGER_DETAILS[key.finger];

              // Visual styling based on theme and state
              let keyBg = isDark
                ? 'bg-slate-900/90 text-slate-300 border-slate-700/80 hover:border-slate-500'
                : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100 hover:border-slate-300 shadow-2xs';

              if (isTarget) {
                keyBg = isDark
                  ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 ring-2 ring-cyan-400/60 shadow-lg shadow-cyan-500/30 scale-105 z-10'
                  : 'bg-cyan-100 border-cyan-500 text-cyan-900 ring-2 ring-cyan-500/60 shadow-md shadow-cyan-300 scale-105 z-10 font-bold';
              } else if (isShiftHighlight) {
                keyBg = isDark
                  ? 'bg-amber-500/30 border-amber-400 text-amber-200 ring-2 ring-amber-400/60 animate-bounce z-10'
                  : 'bg-amber-100 border-amber-500 text-amber-900 ring-2 ring-amber-500/60 animate-bounce z-10 font-bold';
              } else if (isPressed) {
                keyBg = isDark
                  ? 'bg-emerald-500/40 border-emerald-400 text-white scale-95'
                  : 'bg-emerald-100 border-emerald-500 text-emerald-900 scale-95';
              }

              // Determine labels
              const primaryLabel = language === 'th' ? key.labelTh : key.labelEn;
              const shiftLabel = language === 'th' ? key.shiftTh : key.shiftEn;

              return (
                <div
                  key={key.code}
                  style={{ flexGrow: key.width || 1, flexBasis: 0 }}
                  className={`relative min-w-0 h-10 sm:h-12 rounded-xl border flex flex-col items-center justify-center p-1 text-xs transition-all duration-150 ${keyBg}`}
                >
                  {/* Shift character (top right/center) */}
                  {shiftLabel && (
                    <span
                      className={`text-[9px] sm:text-[10px] leading-none mb-0.5 ${
                        needsShift && isTarget
                          ? 'text-amber-500 font-bold'
                          : isDark
                          ? 'text-slate-500'
                          : 'text-slate-400'
                      }`}
                    >
                      {shiftLabel}
                    </span>
                  )}

                  {/* Primary character */}
                  <span
                    className={`font-semibold text-xs sm:text-sm leading-none ${
                      !needsShift && isTarget
                        ? isDark
                          ? 'text-cyan-300 font-extrabold text-sm sm:text-base'
                          : 'text-cyan-700 font-extrabold text-sm sm:text-base'
                        : ''
                    }`}
                  >
                    {primaryLabel}
                  </span>

                  {/* Subtle bottom finger dot indicator */}
                  <span
                    className={`absolute bottom-0.5 w-1.5 h-1.5 rounded-full opacity-70 ${fingerInfo.badgeColor}`}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Two Hands Finger Diagram representation */}
      <div
        className={`mt-4 pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs transition-colors duration-300 ${
          isDark ? 'border-slate-800/80 text-slate-400' : 'border-slate-200 text-slate-600'
        }`}
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>👋 มือซ้าย:</span>
          <span className={`px-2 py-0.5 rounded-md text-[11px] border ${currentFinger?.name === 'left-pinky' ? 'bg-pink-500 text-white font-bold' : isDark ? 'bg-slate-900 border-pink-500/40 text-pink-300' : 'bg-slate-100 border-pink-300 text-pink-700'}`}>ก้อย</span>
          <span className={`px-2 py-0.5 rounded-md text-[11px] border ${currentFinger?.name === 'left-ring' ? 'bg-orange-500 text-white font-bold' : isDark ? 'bg-slate-900 border-orange-500/40 text-orange-300' : 'bg-slate-100 border-orange-300 text-orange-700'}`}>นาง</span>
          <span className={`px-2 py-0.5 rounded-md text-[11px] border ${currentFinger?.name === 'left-middle' ? 'bg-amber-500 text-white font-bold' : isDark ? 'bg-slate-900 border-amber-500/40 text-amber-300' : 'bg-slate-100 border-amber-300 text-amber-700'}`}>กลาง</span>
          <span className={`px-2 py-0.5 rounded-md text-[11px] border ${currentFinger?.name === 'left-index' ? 'bg-emerald-500 text-white font-bold' : isDark ? 'bg-slate-900 border-emerald-500/40 text-emerald-300' : 'bg-slate-100 border-emerald-300 text-emerald-700'}`}>ชี้</span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-0.5 rounded-md text-[11px] border ${currentFinger?.name === 'thumb' ? 'bg-cyan-500 text-white font-bold animate-pulse' : isDark ? 'bg-slate-900 border-cyan-500/40 text-cyan-300' : 'bg-slate-100 border-cyan-300 text-cyan-700'}`}>
            👍 นิ้วหัวแม่มือ (Space)
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>มือขวา 👋:</span>
          <span className={`px-2 py-0.5 rounded-md text-[11px] border ${currentFinger?.name === 'right-index' ? 'bg-blue-500 text-white font-bold' : isDark ? 'bg-slate-900 border-blue-500/40 text-blue-300' : 'bg-slate-100 border-blue-300 text-blue-700'}`}>ชี้</span>
          <span className={`px-2 py-0.5 rounded-md text-[11px] border ${currentFinger?.name === 'right-middle' ? 'bg-indigo-500 text-white font-bold' : isDark ? 'bg-slate-900 border-indigo-500/40 text-indigo-300' : 'bg-slate-100 border-indigo-300 text-indigo-700'}`}>กลาง</span>
          <span className={`px-2 py-0.5 rounded-md text-[11px] border ${currentFinger?.name === 'right-ring' ? 'bg-purple-500 text-white font-bold' : isDark ? 'bg-slate-900 border-purple-500/40 text-purple-300' : 'bg-slate-100 border-purple-300 text-purple-700'}`}>นาง</span>
          <span className={`px-2 py-0.5 rounded-md text-[11px] border ${currentFinger?.name === 'right-pinky' ? 'bg-rose-500 text-white font-bold' : isDark ? 'bg-slate-900 border-rose-500/40 text-rose-300' : 'bg-slate-100 border-rose-300 text-rose-700'}`}>ก้อย</span>
        </div>
      </div>
    </div>
  );
};
