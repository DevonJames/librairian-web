/**
 * Text-to-Speech using ElevenLabs
 */

import { elevenLabs, voices } from './config';
import { Voice } from './types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Synthesize speech using ElevenLabs API
 */
export async function synthesizeSpeech(
  text: string,
  voice: Voice,
  outputPath: string
): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    console.error('[TTS] ELEVENLABS_API_KEY is not configured');
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    console.log('[TTS] Creating output directory:', outputDir);
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const url = `${elevenLabs.apiUrl}/text-to-speech/${voice.voiceId}`;
  console.log('[TTS] Synthesizing speech with voice:', voice.name, 'voiceId:', voice.voiceId);
  console.log('[TTS] Text length:', text.length, 'chars');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: elevenLabs.modelId,
        voice_settings: {
          stability: voice.stability ?? 0.5,
          similarity_boost: voice.similarityBoost ?? 0.75,
        },
        output_format: elevenLabs.outputFormat,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TTS] ElevenLabs API error:', response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    // Get the audio data as array buffer
    const audioBuffer = await response.arrayBuffer();
    console.log('[TTS] Received audio buffer, size:', audioBuffer.byteLength, 'bytes');
    
    if (audioBuffer.byteLength === 0) {
      throw new Error('ElevenLabs returned empty audio buffer');
    }
    
    // Write to file
    fs.writeFileSync(outputPath, Buffer.from(audioBuffer));
    console.log('[TTS] Audio saved to:', outputPath);
    
    return outputPath;
  } catch (error) {
    console.error('[TTS] Error synthesizing speech:', error);
    throw error;
  }
}

/**
 * Synthesize dialogue turn and save to file
 */
export async function synthesizeDialogueTurn(
  text: string,
  speakerId: string,
  outputDir: string,
  turnIndex: number
): Promise<string> {
  // Get voice for speaker
  const voice = speakerId === 'john' || speakerId === 'privateEye' || speakerId === 'host1'
    ? voices.john
    : voices.sadie;
  
  const outputFileName = `turn-${turnIndex.toString().padStart(3, '0')}-${speakerId}.mp3`;
  const outputPath = path.join(outputDir, outputFileName);
  
  // Split long text into chunks if needed (ElevenLabs has limits)
  const maxChunkLength = 5000;
  
  if (text.length <= maxChunkLength) {
    return await synthesizeSpeech(text, voice, outputPath);
  }
  
  // For long text, we need to synthesize in chunks and concatenate
  // For simplicity, we'll truncate to max length with a warning
  console.warn(`Text too long (${text.length} chars), truncating to ${maxChunkLength}`);
  const truncatedText = text.substring(0, maxChunkLength);
  
  return await synthesizeSpeech(truncatedText, voice, outputPath);
}

/**
 * Get available voices
 */
export function getAvailableVoices(): Voice[] {
  return Object.values(voices);
}

/**
 * Estimate audio duration from text (rough estimate)
 * Average speaking rate is about 150 words per minute
 */
export function estimateAudioDuration(text: string): number {
  const words = text.split(/\s+/).length;
  const wordsPerSecond = 2.5; // 150 words per minute
  return Math.ceil(words / wordsPerSecond);
}
