"use client";
import { useSyncExternalStore } from 'react';
const subscribe=()=>()=>{};const snapshot=()=>Boolean(window.SpeechRecognition||window.webkitSpeechRecognition);const serverSnapshot=()=>false;
export function useSpeechAvailable(){return useSyncExternalStore(subscribe,snapshot,serverSnapshot);}
