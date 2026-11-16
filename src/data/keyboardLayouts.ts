import { FingerName, KeyInfo } from '../types';

export interface FingerDetail {
  name: FingerName;
  labelTh: string;
  labelEn: string;
  hand: 'left' | 'right';
  color: string;
  badgeColor: string;
}

export const FINGER_DETAILS: Record<FingerName, FingerDetail> = {
  'left-pinky': {
    name: 'left-pinky',
    labelTh: 'นิ้วก้อยซ้าย',
    labelEn: 'Left Pinky',
    hand: 'left',
    color: 'border-pink-500 bg-pink-500/15 text-pink-300',
    badgeColor: 'bg-pink-500 text-white'
  },
  'left-ring': {
    name: 'left-ring',
    labelTh: 'นิ้วนางซ้าย',
    labelEn: 'Left Ring',
    hand: 'left',
    color: 'border-orange-500 bg-orange-500/15 text-orange-300',
    badgeColor: 'bg-orange-500 text-white'
  },
  'left-middle': {
    name: 'left-middle',
    labelTh: 'นิ้วกลางซ้าย',
    labelEn: 'Left Middle',
    hand: 'left',
    color: 'border-amber-500 bg-amber-500/15 text-amber-300',
    badgeColor: 'bg-amber-500 text-white'
  },
  'left-index': {
    name: 'left-index',
    labelTh: 'นิ้วชี้ซ้าย',
    labelEn: 'Left Index',
    hand: 'left',
    color: 'border-emerald-500 bg-emerald-500/15 text-emerald-300',
    badgeColor: 'bg-emerald-500 text-white'
  },
  'thumb': {
    name: 'thumb',
    labelTh: 'นิ้วหัวแม่มือ',
    labelEn: 'Thumb (Space)',
    hand: 'left',
    color: 'border-cyan-500 bg-cyan-500/15 text-cyan-300',
    badgeColor: 'bg-cyan-500 text-white'
  },
  'right-index': {
    name: 'right-index',
    labelTh: 'นิ้วชี้ขวา',
    labelEn: 'Right Index',
    hand: 'right',
    color: 'border-blue-500 bg-blue-500/15 text-blue-300',
    badgeColor: 'bg-blue-500 text-white'
  },
  'right-middle': {
    name: 'right-middle',
    labelTh: 'นิ้วกลางขวา',
    labelEn: 'Right Middle',
    hand: 'right',
    color: 'border-indigo-500 bg-indigo-500/15 text-indigo-300',
    badgeColor: 'bg-indigo-500 text-white'
  },
  'right-ring': {
    name: 'right-ring',
    labelTh: 'นิ้วนางขวา',
    labelEn: 'Right Ring',
    hand: 'right',
    color: 'border-purple-500 bg-purple-500/15 text-purple-300',
    badgeColor: 'bg-purple-500 text-white'
  },
  'right-pinky': {
    name: 'right-pinky',
    labelTh: 'นิ้วก้อยขวา',
    labelEn: 'Right Pinky',
    hand: 'right',
    color: 'border-rose-500 bg-rose-500/15 text-rose-300',
    badgeColor: 'bg-rose-500 text-white'
  }
};

// 4 Rows of standard Keyboard layout
export const KEYBOARD_ROWS: KeyInfo[][] = [
  // Row 1: Numbers & symbols
  [
    { code: 'Backquote', labelEn: '`', shiftEn: '~', labelTh: '_', shiftTh: '%', finger: 'left-pinky' },
    { code: 'Digit1', labelEn: '1', shiftEn: '!', labelTh: 'ๅ', shiftTh: '+', finger: 'left-pinky' },
    { code: 'Digit2', labelEn: '2', shiftEn: '@', labelTh: '/', shiftTh: '๑', finger: 'left-ring' },
    { code: 'Digit3', labelEn: '3', shiftEn: '#', labelTh: '-', shiftTh: '๒', finger: 'left-middle' },
    { code: 'Digit4', labelEn: '4', shiftEn: '$', labelTh: 'ภ', shiftTh: '๓', finger: 'left-index' },
    { code: 'Digit5', labelEn: '5', shiftEn: '%', labelTh: 'ถ', shiftTh: '๔', finger: 'left-index' },
    { code: 'Digit6', labelEn: '6', shiftEn: '^', labelTh: 'ุ', shiftTh: 'ู', finger: 'right-index' },
    { code: 'Digit7', labelEn: '7', shiftEn: '&', labelTh: 'ึ', shiftTh: '฿', finger: 'right-index' },
    { code: 'Digit8', labelEn: '8', shiftEn: '*', labelTh: 'ค', shiftTh: '๕', finger: 'right-middle' },
    { code: 'Digit9', labelEn: '9', shiftEn: '(', labelTh: 'ต', shiftTh: '๖', finger: 'right-ring' },
    { code: 'Digit0', labelEn: '0', shiftEn: ')', labelTh: 'จ', shiftTh: '๗', finger: 'right-pinky' },
    { code: 'Minus', labelEn: '-', shiftEn: '_', labelTh: 'ข', shiftTh: '๘', finger: 'right-pinky' },
    { code: 'Equal', labelEn: '=', shiftEn: '+', labelTh: 'ช', shiftTh: '๙', finger: 'right-pinky' },
    { code: 'Backspace', labelEn: '⌫', shiftEn: '', labelTh: '⌫', shiftTh: '', finger: 'right-pinky', width: 1.6 }
  ],
  // Row 2: Upper Row
  [
    { code: 'Tab', labelEn: 'Tab', shiftEn: '', labelTh: 'Tab', shiftTh: '', finger: 'left-pinky', width: 1.4 },
    { code: 'KeyQ', labelEn: 'q', shiftEn: 'Q', labelTh: 'ๆ', shiftTh: '๐', finger: 'left-pinky' },
    { code: 'KeyW', labelEn: 'w', shiftEn: 'W', labelTh: 'ไ', shiftTh: '"', finger: 'left-ring' },
    { code: 'KeyE', labelEn: 'e', shiftEn: 'E', labelTh: 'ำ', shiftTh: 'ฎ', finger: 'left-middle' },
    { code: 'KeyR', labelEn: 'r', shiftEn: 'R', labelTh: 'พ', shiftTh: 'ฑ', finger: 'left-index' },
    { code: 'KeyT', labelEn: 't', shiftEn: 'T', labelTh: 'ะ', shiftTh: 'ธ', finger: 'left-index' },
    { code: 'KeyY', labelEn: 'y', shiftEn: 'Y', labelTh: 'ั', shiftTh: 'ํ', finger: 'right-index' },
    { code: 'KeyU', labelEn: 'u', shiftEn: 'U', labelTh: 'ี', shiftTh: '๊', finger: 'right-index' },
    { code: 'KeyI', labelEn: 'i', shiftEn: 'I', labelTh: 'ร', shiftTh: 'ณ', finger: 'right-middle' },
    { code: 'KeyO', labelEn: 'o', shiftEn: 'O', labelTh: 'น', shiftTh: 'ฯ', finger: 'right-ring' },
    { code: 'KeyP', labelEn: 'p', shiftEn: 'P', labelTh: 'ย', shiftTh: 'ญ', finger: 'right-pinky' },
    { code: 'BracketLeft', labelEn: '[', shiftEn: '{', labelTh: 'บ', shiftTh: 'ฐ', finger: 'right-pinky' },
    { code: 'BracketRight', labelEn: ']', shiftEn: '}', labelTh: 'ล', shiftTh: ',', finger: 'right-pinky' },
    { code: 'Backslash', labelEn: '\\', shiftEn: '|', labelTh: 'ฃ', shiftTh: 'ฅ', finger: 'right-pinky', width: 1.2 }
  ],
  // Row 3: Home Row (แป้นเหย้า!)
  [
    { code: 'CapsLock', labelEn: 'Caps', shiftEn: '', labelTh: 'Caps', shiftTh: '', finger: 'left-pinky', width: 1.7 },
    { code: 'KeyA', labelEn: 'a', shiftEn: 'A', labelTh: 'ฟ', shiftTh: 'ฤ', finger: 'left-pinky' },
    { code: 'KeyS', labelEn: 's', shiftEn: 'S', labelTh: 'ห', shiftTh: 'ฆ', finger: 'left-ring' },
    { code: 'KeyD', labelEn: 'd', shiftEn: 'D', labelTh: 'ก', shiftTh: 'ฏ', finger: 'left-middle' },
    { code: 'KeyF', labelEn: 'f', shiftEn: 'F', labelTh: 'ด', shiftTh: 'โ', finger: 'left-index' },
    { code: 'KeyG', labelEn: 'g', shiftEn: 'G', labelTh: 'เ', shiftTh: 'ฌ', finger: 'left-index' },
    { code: 'KeyH', labelEn: 'h', shiftEn: 'H', labelTh: '้', shiftTh: '็', finger: 'right-index' },
    { code: 'KeyJ', labelEn: 'j', shiftEn: 'J', labelTh: '่', shiftTh: '๋', finger: 'right-index' },
    { code: 'KeyK', labelEn: 'k', shiftEn: 'K', labelTh: 'า', shiftTh: 'ษ', finger: 'right-middle' },
    { code: 'KeyL', labelEn: 'l', shiftEn: 'L', labelTh: 'ส', shiftTh: 'ศ', finger: 'right-ring' },
    { code: 'Semicolon', labelEn: ';', shiftEn: ':', labelTh: 'ว', shiftTh: 'ซ', finger: 'right-pinky' },
    { code: 'Quote', labelEn: "'", shiftEn: '"', labelTh: 'ง', shiftTh: '.', finger: 'right-pinky' },
    { code: 'Enter', labelEn: 'Enter ↵', shiftEn: '', labelTh: 'Enter ↵', shiftTh: '', finger: 'right-pinky', width: 1.9 }
  ],
  // Row 4: Lower Row
  [
    { code: 'ShiftLeft', labelEn: 'Shift', shiftEn: '', labelTh: 'Shift', shiftTh: '', finger: 'left-pinky', width: 2.1 },
    { code: 'KeyZ', labelEn: 'z', shiftEn: 'Z', labelTh: 'ผ', shiftTh: '(', finger: 'left-pinky' },
    { code: 'KeyX', labelEn: 'x', shiftEn: 'X', labelTh: 'ป', shiftTh: ')', finger: 'left-ring' },
    { code: 'KeyC', labelEn: 'c', shiftEn: 'C', labelTh: 'แ', shiftTh: 'ฉ', finger: 'left-middle' },
    { code: 'KeyV', labelEn: 'v', shiftEn: 'V', labelTh: 'อ', shiftTh: 'ฮ', finger: 'left-index' },
    { code: 'KeyB', labelEn: 'b', shiftEn: 'B', labelTh: 'ิ', shiftTh: 'ฺ', finger: 'left-index' },
    { code: 'KeyN', labelEn: 'n', shiftEn: 'N', labelTh: 'ื', shiftTh: '์', finger: 'right-index' },
    { code: 'KeyM', labelEn: 'm', shiftEn: 'M', labelTh: 'ท', shiftTh: '?', finger: 'right-index' },
    { code: 'Comma', labelEn: ',', shiftEn: '<', labelTh: 'ม', shiftTh: 'ฒ', finger: 'right-middle' },
    { code: 'Period', labelEn: '.', shiftEn: '>', labelTh: 'ใ', shiftTh: 'ฬ', finger: 'right-ring' },
    { code: 'Slash', labelEn: '/', shiftEn: '?', labelTh: 'ฝ', shiftTh: 'ฦ', finger: 'right-pinky' },
    { code: 'ShiftRight', labelEn: 'Shift', shiftEn: '', labelTh: 'Shift', shiftTh: '', finger: 'right-pinky', width: 2.5 }
  ],
  // Row 5: Spacebar Row
  [
    { code: 'Space', labelEn: 'Spacebar', shiftEn: '', labelTh: 'เคาะวรรค', shiftTh: '', finger: 'thumb', width: 7.2 }
  ]
];

// Helper to look up key information for a target character
export function findKeyForChar(char: string, lang: 'th' | 'en'): { key: KeyInfo | null; needsShift: boolean } {
  if (char === ' ') {
    return { key: KEYBOARD_ROWS[4][0], needsShift: false };
  }

  for (const row of KEYBOARD_ROWS) {
    for (const key of row) {
      if (lang === 'en') {
        if (key.labelEn.toLowerCase() === char.toLowerCase()) {
          const isShift = char === char.toUpperCase() && char !== char.toLowerCase();
          return { key, needsShift: isShift };
        }
        if (key.shiftEn === char) {
          return { key, needsShift: true };
        }
      } else {
        // Thai
        if (key.labelTh === char) {
          return { key, needsShift: false };
        }
        if (key.shiftTh === char) {
          return { key, needsShift: true };
        }
      }
    }
  }

  return { key: null, needsShift: false };
}
