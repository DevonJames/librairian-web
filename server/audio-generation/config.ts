/**
 * Configuration for audio generation service
 */

import { Personality, Voice } from './types';

// Voice configurations using ElevenLabs
export const voices: Record<string, Voice> = {
  john: {
    id: 'john',
    name: 'John',
    // voiceId: 'tZssYepgGaQmegsMEXjK',
    // voiceId: 'pM9mnoaVwB6h5hCCXUhr',
    voiceId: 'n1PvBOwxb8X6m7tahp2h',
    stability: 0.5,
    similarityBoost: 0.75,
  },
  sadie: {
    id: 'sadie',
    name: 'Sadie',
    // voiceId: 'bD9maNcCuQQS75DGuteM',
    voiceId: '56bWURjYFHyYyVf490Dp',
    stability: 0.6,
    similarityBoost: 0.75,
  },
};

// Personality definitions for investigators/hosts
export const personalities: Record<string, Personality> = {
  reporter: {
    name: 'Sadie Woodward',
    alias: 'The Story Hunter',
    tone: 'incisive and compelling',
    humorStyle: 'sharp observations with subtle irony',
    interests: ['investigative journalism', 'public accountability', 'historical context', 'power structures'],
    voice: voices.sadie,
    openingLines: [
      'This story goes deeper than most realize.',
      'The public deserves to know what we\'ve uncovered.',
      'Behind the official narrative lies a web of connections.',
      'When you follow the evidence trail...',
      'Today we\'re diving into documents that tell a remarkable story.',
    ],
    closingLines: [
      'The public deserves transparency, and we\'ll keep digging until we find it.',
      'As we continue to investigate, remember that history is written by those who control the narrative.',
      'The story doesn\'t end here - we\'re just beginning to connect the dots.',
      'Stay vigilant, stay informed, and question everything.',
      'This investigation continues, and so does our commitment to the truth.',
    ],
  },
  privateEye: {
    name: 'John Marlowe',
    alias: 'The Truth Seeker',
    tone: 'hardboiled and analytical',
    humorStyle: 'dry wit with cynical undertones',
    interests: ['crime solving', 'investigation techniques', 'pattern recognition', 'hidden motives'],
    voice: voices.john,
    openingLines: [
      'Listen up, because this is important.',
      'The facts don\'t lie, but people do.',
      'What we have here is more than a coincidence.',
      'I\'ve seen a lot in my time, but this case...',
      'Let me lay out what we know so far.',
    ],
    closingLines: [
      'The truth is out there, but you\'ve got to want to see it.',
      'That\'s how the pieces fit together. At least, the ones we can see.',
      'Sometimes the answers create more questions.',
      'Remember, in this business, coincidences are rarely that.',
      'The case isn\'t closed, but we\'re closer to the truth.',
    ],
  },
  // Podcast hosts
  host1: {
    name: 'John',
    alias: 'The Analyst',
    tone: 'thoughtful and engaging',
    humorStyle: 'dry wit with warmth',
    interests: ['current events', 'analysis', 'storytelling'],
    voice: voices.john,
    openingLines: [
      'Welcome back, everyone.',
      'Let\'s dive into today\'s topic.',
      'There\'s a lot to unpack here.',
    ],
    closingLines: [
      'Thanks for listening.',
      'Until next time, stay curious.',
      'That\'s all for today\'s episode.',
    ],
  },
  host2: {
    name: 'Sadie',
    alias: 'The Commentator',
    tone: 'engaging and informative',
    humorStyle: 'witty observations',
    interests: ['deep dives', 'research', 'discussion'],
    voice: voices.sadie,
    openingLines: [
      'Great to be here.',
      'This is fascinating material.',
      'I\'ve been looking forward to discussing this.',
    ],
    closingLines: [
      'What a discussion!',
      'Can\'t wait for the next one.',
      'Thanks everyone for tuning in.',
    ],
  },
};

// Model configurations
// Available models: grok-4, grok-3, grok-3-mini
// Check your access at https://console.x.ai/team/default/models
export const models = {
  grok: {
    // name: 'grok-3-mini',  // Cost-efficient model for dialogue generation
    name: 'grok-4-1-fast-reasoning',
    apiUrl: 'https://api.x.ai/v1/chat/completions',
    maxTokens: 4096,
    temperature: 0.7,
  },
};

// ElevenLabs configuration
export const elevenLabs = {
  apiUrl: 'https://api.elevenlabs.io/v1',
  modelId: 'eleven_turbo_v2',
  outputFormat: 'mp3_44100_128',
};
