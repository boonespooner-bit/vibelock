import { useEffect, useSyncExternalStore } from 'react';

// A persistent gallery of past generations.
//
// Images are ~1-2MB data URLs, which would blow localStorage's ~5MB cap after a
// couple of saves — so we use IndexedDB, which comfortably holds many. A tiny
// pub/sub store mirrors the DB in memory so the top-bar count and the gallery
// modal stay in sync, and useGallery() plugs it into React via
// useSyncExternalStore.

export interface Generation {
  id: string;
  subject: string;
  prompt: string;
  model: string;
  image: string; // data: URL
  createdAt: number;
}

const DB_NAME = 'vibe-lock';
const STORE = 'generations';
const MAX_ITEMS = 60;

let items: Generation[] = []; // newest first; reference is stable until a change
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function hasIDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(req.result as T);
    };
    t.onerror = () => {
      db.close();
      reject(t.error);
    };
  });
}

async function loadGallery(): Promise<void> {
  if (loaded) return;
  if (loading) return loading;
  loading = (async () => {
    if (hasIDB()) {
      try {
        const all = await tx<Generation[]>('readonly', (s) => s.getAll() as IDBRequest<Generation[]>);
        items = (all ?? []).sort((a, b) => b.createdAt - a.createdAt);
      } catch {
        items = [];
      }
    }
    loaded = true;
    emit();
  })();
  return loading;
}

export async function addGeneration(input: Omit<Generation, 'id' | 'createdAt'>): Promise<Generation> {
  const gen: Generation = {
    ...input,
    id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  items = [gen, ...items];

  // Evict oldest beyond the cap, from memory and disk.
  const evicted = items.slice(MAX_ITEMS);
  items = items.slice(0, MAX_ITEMS);
  emit();

  if (hasIDB()) {
    try {
      await tx('readwrite', (s) => s.put(gen));
      for (const e of evicted) await tx('readwrite', (s) => s.delete(e.id));
    } catch {
      /* persistence is best-effort; the in-memory copy still shows this session */
    }
  }
  return gen;
}

export async function removeGeneration(id: string): Promise<void> {
  items = items.filter((g) => g.id !== id);
  emit();
  if (hasIDB()) {
    try {
      await tx('readwrite', (s) => s.delete(id));
    } catch {
      /* ignore */
    }
  }
}

export async function clearGallery(): Promise<void> {
  items = [];
  emit();
  if (hasIDB()) {
    try {
      await tx('readwrite', (s) => s.clear());
    } catch {
      /* ignore */
    }
  }
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// React binding. Returns the current list (newest first); loads from IndexedDB
// on first use.
export function useGallery(): Generation[] {
  useEffect(() => {
    void loadGallery();
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  );
}
