import { ProcessedLogEntry } from '../types';

const DB_NAME = 'omnitrace';
const STORE = 'kv';
const KEY = 'session-logs';
const MAX_LOGS = 10000;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSession(logs: ProcessedLogEntry[]): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const payload = logs.slice(-MAX_LOGS);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(payload, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadSession(): Promise<ProcessedLogEntry[] | null> {
  try {
    const db = await openDb();
    if (!db) return null;
    const logs = await new Promise<ProcessedLogEntry[] | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as ProcessedLogEntry[]) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return Array.isArray(logs) && logs.length > 0 ? logs : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}
