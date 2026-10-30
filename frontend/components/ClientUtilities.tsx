"use client";

import dynamic from 'next/dynamic';

const FeedbackButton = dynamic(() => import('@/components/FeedbackButton').then(module => module.FeedbackButton), { ssr: false });
const VoiceAiButton = dynamic(() => import('@/components/VoiceAiButton').then(module => module.VoiceAiButton), { ssr: false });

export function ClientUtilities() {
  return <><FeedbackButton /><VoiceAiButton /></>;
}
