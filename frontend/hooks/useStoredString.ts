'use client';

import { useSyncExternalStore } from 'react';
const changeEvent = 'capital-local-storage-changed';

function subscribe(notify: () => void) {
  window.addEventListener('storage', notify);
  window.addEventListener(changeEvent, notify);
  return () => { window.removeEventListener('storage', notify); window.removeEventListener(changeEvent, notify); };
}

export function useStoredString(key: string | null) {
  return useSyncExternalStore(subscribe, () => {
    try { return key ? localStorage.getItem(key) : null; } catch { return null; }
  }, () => null);
}

export function writeStoredString(key: string, value: string | null) {
  if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  window.dispatchEvent(new Event(changeEvent));
}
