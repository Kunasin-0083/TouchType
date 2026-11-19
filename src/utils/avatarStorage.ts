/**
 * Persistent Per-Account Profile Avatar Vault
 * Stores each account's latest chosen profile picture in BOTH:
 *   1. Dedicated localStorage vault (synchronous instant load on revisit/reload)
 *   2. IndexedDB backup (high-capacity persistent store resilient to localStorage quota)
 *
 * Keyed by normalized account identifiers (studentId, username, uid, displayName)
 * with ISO timestamps so the latest changed image always wins.
 */

export interface SavedAvatarEntry {
  accountKey: string;
  avatar: string;
  avatarBg: string;
  updatedAt: string;
}

const AVATAR_VAULT_STORAGE_KEY = 'touch_typing_user_avatars_v2';
const IDB_NAME = 'touch_typing_avatar_db_v1';
const IDB_STORE = 'avatars';

export function isValidAvatarData(avatar?: string | null): boolean {
  if (!avatar) return false;
  return (
    avatar.startsWith('data:image') ||
    avatar.startsWith('http://') ||
    avatar.startsWith('https://') ||
    avatar.startsWith('/')
  );
}

function normalizeKey(raw?: string | null): string {
  return String(raw || '').trim().toLowerCase();
}

export function buildUserAvatarKeys(user?: {
  uid?: string;
  username?: string;
  studentId?: string;
  displayName?: string;
} | null): string[] {
  if (!user) return [];
  const keys = new Set<string>();
  const sid = normalizeKey(user.studentId);
  const uname = normalizeKey(user.username);
  const uid = normalizeKey(user.uid);
  const dname = normalizeKey(user.displayName);

  if (sid && sid !== 'guest') {
    keys.add(sid);
    keys.add(`std_${sid}`);
  }
  if (uname && uname !== 'guest') {
    keys.add(uname);
    keys.add(`std_${uname}`);
  }
  if (uid && uid !== 'guest' && uid !== 'guest_default') {
    keys.add(uid);
    if (uid.startsWith('std_')) {
      keys.add(uid.slice(4));
    }
  }
  if (dname && dname !== 'guest') {
    keys.add(`name:${dname}`);
  }
  return Array.from(keys);
}

function readLocalVault(): Record<string, SavedAvatarEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(AVATAR_VAULT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalVault(vault: Record<string, SavedAvatarEntry>): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(AVATAR_VAULT_STORAGE_KEY, JSON.stringify(vault));
    return true;
  } catch {
    return false;
  }
}

function openAvatarDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'accountKey' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeToIndexedDB(keys: string[], entry: SavedAvatarEntry): Promise<void> {
  const db = await openAvatarDB();
  if (!db) return;
  try {
    await new Promise<void>(resolve => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      keys.forEach(k => {
        store.put({ ...entry, accountKey: k });
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore IDB errors
  } finally {
    db.close();
  }
}

async function readFromIndexedDB(keys: string[]): Promise<SavedAvatarEntry | null> {
  if (keys.length === 0) return null;
  const db = await openAvatarDB();
  if (!db) return null;
  try {
    const results = await Promise.all(
      keys.map(
        k =>
          new Promise<SavedAvatarEntry | null>(resolve => {
            try {
              const tx = db.transaction(IDB_STORE, 'readonly');
              const store = tx.objectStore(IDB_STORE);
              const req = store.get(k);
              req.onsuccess = () => resolve((req.result as SavedAvatarEntry) || null);
              req.onerror = () => resolve(null);
            } catch {
              resolve(null);
            }
          })
      )
    );
    const valid = results.filter((r): r is SavedAvatarEntry => Boolean(r && r.updatedAt));
    if (valid.length === 0) return null;
    valid.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return valid[0];
  } catch {
    return null;
  } finally {
    db.close();
  }
}

/**
 * Save a user's latest profile image to BOTH localStorage Vault and IndexedDB.
 * Note: empty `avatar` string is intentionally stored with a newer timestamp so
 * explicit "reset to default avatar" also persists cleanly across revisits.
 */
export function saveAvatarToVault(
  keys: string[],
  avatar: string,
  avatarBg: string,
  updatedAt?: string
): SavedAvatarEntry {
  const cleanKeys = keys.map(normalizeKey).filter(Boolean);
  const primaryKey = cleanKeys[0] || 'default';
  const entry: SavedAvatarEntry = {
    accountKey: primaryKey,
    avatar: isValidAvatarData(avatar) ? avatar : '',
    avatarBg: avatarBg || 'from-cyan-500 to-blue-600',
    updatedAt: updatedAt || new Date().toISOString()
  };

  if (cleanKeys.length > 0) {
    const vault = readLocalVault();
    const incomingTime = new Date(entry.updatedAt).getTime();

    cleanKeys.forEach(k => {
      const existing = vault[k];
      const existingTime = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      if (!existing || incomingTime >= existingTime) {
        vault[k] = { ...entry, accountKey: k };
      }
    });

    writeLocalVault(vault);
    writeToIndexedDB(cleanKeys, entry).catch(() => {});
  }

  return entry;
}

/**
 * Synchronously retrieve the latest saved avatar entry for a user from the localStorage vault.
 */
export function getSavedAvatarForUser(
  user?: {
    uid?: string;
    username?: string;
    studentId?: string;
    displayName?: string;
  } | null
): SavedAvatarEntry | null {
  const keys = buildUserAvatarKeys(user);
  if (keys.length === 0) return null;
  const vault = readLocalVault();

  let best: SavedAvatarEntry | null = null;
  let bestTime = -1;
  for (const k of keys) {
    const item = vault[k];
    if (!item) continue;
    const t = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
    if (!best || t > bestTime) {
      best = item;
      bestTime = t;
    }
  }
  return best;
}

/**
 * Synchronously retrieve the latest saved avatar entry matching a score record.
 */
export function getSavedAvatarForScore(score: {
  uid?: string;
  displayName?: string;
}): SavedAvatarEntry | null {
  return getSavedAvatarForUser({
    uid: score.uid,
    displayName: score.displayName
  });
}

/**
 * Asynchronously check IndexedDB for a newer or missing avatar and mirror back to localStorage vault.
 */
export async function hydrateAvatarFromIndexedDB(user: {
  uid?: string;
  username?: string;
  studentId?: string;
  displayName?: string;
}): Promise<SavedAvatarEntry | null> {
  const keys = buildUserAvatarKeys(user);
  if (keys.length === 0) return null;

  const localEntry = getSavedAvatarForUser(user);
  const idbEntry = await readFromIndexedDB(keys);
  if (!idbEntry) return localEntry;

  const localTime = localEntry?.updatedAt ? new Date(localEntry.updatedAt).getTime() : -1;
  const idbTime = idbEntry.updatedAt ? new Date(idbEntry.updatedAt).getTime() : 0;

  if (!localEntry || idbTime > localTime || (!localEntry.avatar && idbEntry.avatar && idbTime >= localTime)) {
    saveAvatarToVault(keys, idbEntry.avatar, idbEntry.avatarBg, idbEntry.updatedAt);
    return idbEntry;
  }
  return localEntry;
}
