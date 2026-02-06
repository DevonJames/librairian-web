/**
 * Audio Generation Service
 * 
 * Provides functionality for generating investigative reports and podcasts
 * using AI text generation (Grok) and text-to-speech (ElevenLabs).
 */

export * from './types';
export * from './config';
export { generateInvestigativeReport, reportExists, getReportPath, getAudioDirectory } from './investigative-report';
export { generatePodcast, podcastExists, getPodcastPath } from './podcast';
export { generateText } from './text-generator';
export { synthesizeSpeech, getAvailableVoices } from './text-to-speech';
