"use client";
import { useSyncExternalStore } from 'react';
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
/** Read browser-only state after hydration without a second effect-triggered render. */
export function useHydrated() { return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot); }
