/**
 * Deterministic Illustrated SVG Portrait Avatar Generator
 * Guarantees every user and leaderboard player always has a distinct,
 * crisp visual profile picture (with zero external network dependencies).
 */

interface AvatarPalette {
  bgStart: string;
  bgEnd: string;
  skin: string;
  skinShadow: string;
  hair: string;
  shirt: string;
  shirtAccent: string;
  hairStyle: number; // 0..5
  hasGlasses: boolean;
  accessory: 'none' | 'headset' | 'star' | 'collar';
  smileType: number; // 0..2
}

const BACKGROUNDS: [string, string][] = [
  ['#0ea5e9', '#2563eb'],
  ['#f59e0b', '#ea580c'],
  ['#10b981', '#0d9488'],
  ['#8b5cf6', '#4f46e5'],
  ['#ec4899', '#e11d48'],
  ['#06b6d4', '#0284c7'],
  ['#f97316', '#dc2626'],
  ['#6366f1', '#7c3aed']
];

const SKINS: [string, string][] = [
  ['#fde2c4', '#f3c69f'],
  ['#f6cfa6', '#e3b283'],
  ['#e8b88a', '#d39c6b'],
  ['#d49b6a', '#bc8150'],
  ['#fbe4d2', '#ebc7ad']
];

const HAIRS: string[] = [
  '#1e293b',
  '#3b2314',
  '#0f172a',
  '#5c3a21',
  '#312e81',
  '#4c1d95',
  '#7c2d12',
  '#1f2937'
];

const SHIRTS: [string, string][] = [
  ['#1e40af', '#60a5fa'],
  ['#0f766e', '#5eead4'],
  ['#9333ea', '#d8b4fe'],
  ['#be123c', '#fda4af'],
  ['#b45309', '#fcd34d'],
  ['#0369a1', '#7dd3fc'],
  ['#3730a3', '#a5b4fc'],
  ['#047857', '#6ee7b7']
];

function hashString(input: string): number {
  let hash = 2166136261;
  const str = (input || 'player').trim().toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function buildPaletteFromSeed(seed: string): AvatarPalette {
  const h = hashString(seed);
  const bg = BACKGROUNDS[h % BACKGROUNDS.length];
  const skin = SKINS[(h >> 3) % SKINS.length];
  const hair = HAIRS[(h >> 6) % HAIRS.length];
  const shirt = SHIRTS[(h >> 9) % SHIRTS.length];
  const hairStyle = (h >> 12) % 6;
  const hasGlasses = ((h >> 15) % 4) === 0;
  const accList: AvatarPalette['accessory'][] = ['none', 'collar', 'headset', 'star'];
  const accessory = accList[(h >> 17) % accList.length];
  const smileType = (h >> 20) % 3;

  return {
    bgStart: bg[0],
    bgEnd: bg[1],
    skin: skin[0],
    skinShadow: skin[1],
    hair,
    shirt: shirt[0],
    shirtAccent: shirt[1],
    hairStyle,
    hasGlasses,
    accessory,
    smileType
  };
}

function renderHairBack(style: number, color: string): string {
  switch (style) {
    case 1: // Long straight
      return `<path d="M32 62 C30 88 32 108 36 120 L124 120 C128 108 130 88 128 62 C125 32 108 20 80 20 C52 20 35 32 32 62 Z" fill="${color}"/>`;
    case 2: // Bob cut
      return `<path d="M34 62 C32 82 36 96 44 102 L116 102 C124 96 128 82 126 62 C124 34 106 20 80 20 C54 20 36 34 34 62 Z" fill="${color}"/>`;
    case 3: // Ponytail / bun
      return `<circle cx="116" cy="36" r="14" fill="${color}"/><path d="M38 58 C38 32 56 20 80 20 C104 20 122 32 122 58 Z" fill="${color}"/>`;
    default:
      return '';
  }
}

function renderHairFront(style: number, color: string): string {
  switch (style) {
    case 0: // Neat swept short hair
      return `<path d="M40 60 C38 36 55 22 80 22 C105 22 122 36 120 60 C115 44 102 38 82 40 C64 42 50 46 40 60 Z" fill="${color}"/>`;
    case 1: // Long hair bangs
      return `<path d="M40 62 C42 36 58 24 80 24 C102 24 118 36 120 62 C110 46 98 40 80 42 C62 40 50 46 40 62 Z" fill="${color}"/>`;
    case 2: // Bob fringe
      return `<path d="M40 60 C42 34 58 24 80 24 C102 24 118 34 120 60 C108 48 96 46 80 46 C64 46 52 48 40 60 Z" fill="${color}"/>`;
    case 3: // Side-swept bun bangs
      return `<path d="M41 62 C40 35 58 23 80 23 C102 23 120 35 119 62 C108 44 92 40 72 44 C58 47 48 52 41 62 Z" fill="${color}"/>`;
    case 4: // Spiky energetic hair
      return `<path d="M40 60 C38 38 50 24 64 26 L72 17 L82 24 L94 18 L100 28 C114 30 122 42 120 60 C112 44 98 38 80 40 C62 42 50 46 40 60 Z" fill="${color}"/>`;
    default: // Curly / wavy top
      return `<path d="M40 60 C36 42 46 24 64 24 C70 18 90 18 96 24 C114 24 124 42 120 60 C110 46 98 42 80 43 C62 42 50 46 40 60 Z" fill="${color}"/>`;
  }
}

function renderSmile(smileType: number): string {
  switch (smileType) {
    case 0:
      return `<path d="M68 91 Q80 101 92 91" fill="none" stroke="#7c2d12" stroke-width="3.2" stroke-linecap="round"/>`;
    case 1:
      return `<path d="M69 90 Q80 102 91 90 Z" fill="#ffffff" stroke="#7c2d12" stroke-width="2.4" stroke-linejoin="round"/>`;
    default:
      return `<path d="M71 92 Q80 98 89 92" fill="none" stroke="#7c2d12" stroke-width="3" stroke-linecap="round"/>`;
  }
}

function buildAvatarSvg(p: AvatarPalette): string {
  const glassesSvg = p.hasGlasses
    ? `<g stroke="#1e293b" stroke-width="2.8" fill="rgba(255,255,255,0.22)">
         <rect x="52" y="65" width="22" height="15" rx="5"/>
         <rect x="86" y="65" width="22" height="15" rx="5"/>
         <line x1="74" y1="72" x2="86" y2="72"/>
       </g>`
    : '';

  const headsetSvg =
    p.accessory === 'headset'
      ? `<g>
           <path d="M36 68 C36 32 54 16 80 16 C106 16 124 32 124 68" fill="none" stroke="#0f172a" stroke-width="5" stroke-linecap="round"/>
           <rect x="30" y="60" width="10" height="22" rx="5" fill="#06b6d4" stroke="#0f172a" stroke-width="2"/>
           <rect x="120" y="60" width="10" height="22" rx="5" fill="#06b6d4" stroke="#0f172a" stroke-width="2"/>
         </g>`
      : '';

  const collarSvg =
    p.accessory === 'collar'
      ? `<path d="M62 114 L80 128 L98 114" fill="none" stroke="${p.shirtAccent}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
      : p.accessory === 'star'
      ? `<circle cx="102" cy="136" r="5" fill="${p.shirtAccent}" opacity="0.9"/>`
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.bgStart}"/>
      <stop offset="100%" stop-color="${p.bgEnd}"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" fill="url(#bg)"/>
  <circle cx="132" cy="28" r="24" fill="#ffffff" opacity="0.12"/>
  <circle cx="24" cy="132" r="28" fill="#ffffff" opacity="0.1"/>
  ${renderHairBack(p.hairStyle, p.hair)}
  <!-- Shoulders & Shirt -->
  <path d="M24 160 C26 126 48 112 80 112 C112 112 134 126 136 160 Z" fill="${p.shirt}"/>
  <path d="M56 116 Q80 132 104 116 L100 160 L60 160 Z" fill="${p.shirtAccent}" opacity="0.22"/>
  ${collarSvg}
  <!-- Neck -->
  <rect x="69" y="96" width="22" height="22" rx="10" fill="${p.skinShadow}"/>
  <!-- Ears -->
  <circle cx="42" cy="74" r="8" fill="${p.skinShadow}"/>
  <circle cx="118" cy="74" r="8" fill="${p.skinShadow}"/>
  <!-- Face -->
  <rect x="44" y="34" width="72" height="74" rx="34" fill="${p.skin}"/>
  <!-- Cheeks -->
  <ellipse cx="56" cy="83" rx="6.5" ry="3.8" fill="#fb7185" opacity="0.32"/>
  <ellipse cx="104" cy="83" rx="6.5" ry="3.8" fill="#fb7185" opacity="0.32"/>
  <!-- Eyes -->
  <circle cx="64" cy="72" r="4.3" fill="#0f172a"/>
  <circle cx="96" cy="72" r="4.3" fill="#0f172a"/>
  <circle cx="65.5" cy="70.5" r="1.5" fill="#ffffff"/>
  <circle cx="97.5" cy="70.5" r="1.5" fill="#ffffff"/>
  <!-- Eyebrows -->
  <path d="M56 62 Q64 58 72 62" fill="none" stroke="${p.hair}" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M88 62 Q96 58 104 62" fill="none" stroke="${p.hair}" stroke-width="2.6" stroke-linecap="round"/>
  <!-- Nose -->
  <path d="M80 74 Q82 80 78 82" fill="none" stroke="${p.skinShadow}" stroke-width="2.2" stroke-linecap="round"/>
  <!-- Smile -->
  ${renderSmile(p.smileType)}
  ${glassesSvg}
  ${renderHairFront(p.hairStyle, p.hair)}
  ${headsetSvg}
</svg>`;
}

const avatarCache = new Map<string, string>();

export function generateIllustratedAvatarDataUri(seed: string): string {
  const key = (seed || 'default_player').trim().toLowerCase();
  const cached = avatarCache.get(key);
  if (cached) return cached;

  const palette = buildPaletteFromSeed(key);
  const svg = buildAvatarSvg(palette);
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  avatarCache.set(key, uri);
  return uri;
}

export interface PresetAvatarItem {
  id: string;
  label: string;
  dataUri: string;
  gradient: string;
}

export const PRESET_AVATARS: PresetAvatarItem[] = [
  { id: 'cyber_pro', label: 'นักพิมพ์สายเทค', dataUri: generateIllustratedAvatarDataUri('preset_cyber_pro_01'), gradient: 'from-cyan-500 to-blue-600' },
  { id: 'speed_star', label: 'สปีดสตาร์', dataUri: generateIllustratedAvatarDataUri('preset_speed_star_02'), gradient: 'from-amber-400 to-orange-500' },
  { id: 'scholar_ace', label: 'เด็กเรียนหัวกะทิ', dataUri: generateIllustratedAvatarDataUri('preset_scholar_ace_03'), gradient: 'from-emerald-400 to-teal-600' },
  { id: 'gamer_elite', label: 'เกมเมอร์โปร', dataUri: generateIllustratedAvatarDataUri('preset_gamer_elite_04'), gradient: 'from-purple-500 to-indigo-600' },
  { id: 'pink_spark', label: 'นิ้วไวสายหวาน', dataUri: generateIllustratedAvatarDataUri('preset_pink_spark_05'), gradient: 'from-pink-500 to-rose-600' },
  { id: 'gold_champ', label: 'แชมป์เหรียญทอง', dataUri: generateIllustratedAvatarDataUri('preset_gold_champ_06'), gradient: 'from-yellow-400 to-amber-600' },
  { id: 'blue_ninja', label: 'นินจาคีย์บอร์ด', dataUri: generateIllustratedAvatarDataUri('preset_blue_ninja_07'), gradient: 'from-blue-600 to-violet-700' },
  { id: 'night_coder', label: 'โค้ดเดอร์ดึก', dataUri: generateIllustratedAvatarDataUri('preset_night_coder_08'), gradient: 'from-slate-700 to-slate-900' }
];
