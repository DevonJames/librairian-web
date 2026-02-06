/**
 * Podcast Generator
 * 
 * Generates audio podcasts from articles/content using AI dialogue
 * between two hosts.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { personalities } from './config';
import { generateHostComment, generateTitle, generateTags } from './text-generator';
import { synthesizeDialogueTurn, estimateAudioDuration } from './text-to-speech';
import { DialogueTurn, GenerationProgress, GenerationResult, PodcastRequest } from './types';

// Directory for generated audio files
const AUDIO_DIR = path.join(process.cwd(), 'generated-audio');

// Ensure audio directory exists
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

/**
 * Generate a unique podcast ID based on content
 */
function generatePodcastId(articles: PodcastRequest['articles'], hosts: string[]): string {
  const content = articles.map(a => a.url || a.title || a.id).join(',') + hosts.join(',');
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Create content summary for dialogue
 */
function createContentSummary(articles: PodcastRequest['articles']): string {
  return articles.map(article => {
    let summary = '';
    if (article.title) summary += `Title: ${article.title}\n`;
    if (article.summary) summary += `Summary: ${article.summary}\n`;
    if (article.content) {
      // Truncate long content
      const maxLength = 1500;
      const content = article.content.length > maxLength 
        ? article.content.substring(0, maxLength) + '...'
        : article.content;
      summary += `Content: ${content}\n`;
    }
    return summary;
  }).join('\n---\n');
}

/**
 * Generate podcast from articles
 */
export async function generatePodcast(
  request: PodcastRequest,
  onProgress?: (progress: GenerationProgress) => void
): Promise<GenerationResult> {
  const { articles, selectedHosts = ['host1', 'host2'], targetLengthSeconds = 300 } = request;
  
  const podcastId = generatePodcastId(articles, selectedHosts);
  const outputDir = path.join(AUDIO_DIR, podcastId);
  
  // Check if already exists
  const finalOutputPath = path.join(AUDIO_DIR, `${podcastId}.mp3`);
  if (fs.existsSync(finalOutputPath)) {
    return {
      success: true,
      audioFile: `${podcastId}.mp3`,
      audioUrl: `/api/generate/media?id=${podcastId}.mp3`,
    };
  }

  // Create temp directory for audio segments
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Get personalities for hosts
    const [host1Key, host2Key] = selectedHosts;
    const speaker1 = personalities[host1Key] || personalities.host1;
    const speaker2 = personalities[host2Key] || personalities.host2;

    onProgress?.({
      status: 'preparing',
      message: `${speaker1.name} and ${speaker2.name} are preparing the podcast`,
    });

    const dialogue: DialogueTurn[] = [];
    const audioFiles: string[] = [];
    let currentDuration = 0;

    // Create content overview
    const contentOverview = createContentSummary(articles);

    // Step 1: Opening - Host 1 introduces the episode
    onProgress?.({
      status: 'generating',
      message: `${speaker1.name} is opening the show`,
      currentStep: 1,
    });

    const openingLine = speaker1.openingLines[Math.floor(Math.random() * speaker1.openingLines.length)];
    const openingComment = await generateHostComment({
      speakerName: speaker1.name,
      speakerAlias: speaker1.alias,
      speakerTone: speaker1.tone,
      speakerHumorStyle: speaker1.humorStyle,
      articleContent: contentOverview,
      dialogue: [],
      isIntro: true,
      openingLine,
    });

    dialogue.push({ speaker: host1Key, text: openingComment });
    
    const openingAudio = await synthesizeDialogueTurn(
      openingComment,
      host1Key,
      outputDir,
      0
    );
    audioFiles.push(openingAudio);
    currentDuration += estimateAudioDuration(openingComment);

    // Step 2: Host 2's initial response
    onProgress?.({
      status: 'generating',
      message: `${speaker2.name} is joining the conversation`,
      currentStep: 2,
    });

    const initialResponse = await generateHostComment({
      speakerName: speaker2.name,
      speakerAlias: speaker2.alias,
      speakerTone: speaker2.tone,
      speakerHumorStyle: speaker2.humorStyle,
      articleContent: contentOverview,
      previousComment: openingComment,
      dialogue,
    });

    dialogue.push({ speaker: host2Key, text: initialResponse });
    
    const responseAudio = await synthesizeDialogueTurn(
      initialResponse,
      host2Key,
      outputDir,
      1
    );
    audioFiles.push(responseAudio);
    currentDuration += estimateAudioDuration(initialResponse);

    // Step 3: Continue conversation
    let turnIndex = 2;
    let currentSpeakerIndex = 0;
    const speakers = [
      { key: host1Key, personality: speaker1 },
      { key: host2Key, personality: speaker2 },
    ];

    // Generate turns until we reach target length (leave room for closing)
    while (currentDuration < targetLengthSeconds * 0.75) {
      const speaker = speakers[currentSpeakerIndex % 2];
      const previousTurn = dialogue[dialogue.length - 1];

      onProgress?.({
        status: 'generating',
        message: `${speaker.personality.name} is speaking...`,
        currentStep: turnIndex,
      });

      // Pick a random article to focus on for variety
      const articleIndex = Math.floor(Math.random() * articles.length);
      const focusedContent = createContentSummary([articles[articleIndex]]);

      const comment = await generateHostComment({
        speakerName: speaker.personality.name,
        speakerAlias: speaker.personality.alias,
        speakerTone: speaker.personality.tone,
        speakerHumorStyle: speaker.personality.humorStyle,
        articleContent: focusedContent,
        previousComment: previousTurn?.text,
        dialogue,
      });

      dialogue.push({ speaker: speaker.key, text: comment });
      
      const audio = await synthesizeDialogueTurn(
        comment,
        speaker.key,
        outputDir,
        turnIndex
      );
      audioFiles.push(audio);
      currentDuration += estimateAudioDuration(comment);
      
      turnIndex++;
      currentSpeakerIndex++;

      // Safety limit
      if (turnIndex > 20) break;
    }

    // Step 4: Closing
    onProgress?.({
      status: 'concluding',
      message: `${speaker1.name} is wrapping up`,
    });

    const closingLine = speaker1.closingLines[Math.floor(Math.random() * speaker1.closingLines.length)];
    const closingComment = await generateHostComment({
      speakerName: speaker1.name,
      speakerAlias: speaker1.alias,
      speakerTone: speaker1.tone,
      speakerHumorStyle: speaker1.humorStyle,
      articleContent: contentOverview,
      previousComment: dialogue[dialogue.length - 1]?.text,
      dialogue,
      isOutro: true,
      closingLine,
    });

    dialogue.push({ speaker: host1Key, text: closingComment });
    
    const closingAudio = await synthesizeDialogueTurn(
      closingComment,
      host1Key,
      outputDir,
      turnIndex
    );
    audioFiles.push(closingAudio);

    // Step 5: Concatenate audio files
    onProgress?.({
      status: 'finalizing',
      message: 'Combining audio segments',
    });

    await concatenateAudioFiles(audioFiles, finalOutputPath);

    // Generate title and tags
    const title = await generateTitle(dialogue, [speaker1.name, speaker2.name]);
    const tags = await generateTags(dialogue);

    // Clean up temp files
    try {
      fs.rmSync(outputDir, { recursive: true });
    } catch (e) {
      console.warn('Could not clean up temp directory:', e);
    }

    onProgress?.({
      status: 'complete',
      message: 'Podcast complete',
    });

    return {
      success: true,
      audioFile: `${podcastId}.mp3`,
      audioUrl: `/api/generate/media?id=${podcastId}.mp3`,
      title,
      tags,
    };

  } catch (error) {
    console.error('Error generating podcast:', error);
    
    // Clean up on error
    try {
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true });
      }
    } catch (e) {
      // Ignore cleanup errors
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Concatenate multiple audio files into one using ffmpeg
 * This properly handles duration metadata
 */
async function concatenateAudioFiles(inputFiles: string[], outputPath: string): Promise<void> {
  console.log('[Podcast] Concatenating', inputFiles.length, 'audio files');
  
  // Filter to only existing files
  const existingFiles = inputFiles.filter(file => fs.existsSync(file));
  
  if (existingFiles.length === 0) {
    throw new Error('No audio files to concatenate');
  }
  
  // Try ffmpeg first for proper concatenation with correct duration
  const ffmpegAvailable = await checkFfmpegAvailable();
  
  if (ffmpegAvailable) {
    await concatenateWithFfmpeg(existingFiles, outputPath);
  } else {
    console.warn('[Podcast] ffmpeg not available, falling back to simple concatenation');
    const buffers: Buffer[] = existingFiles.map(file => fs.readFileSync(file));
    fs.writeFileSync(outputPath, Buffer.concat(buffers));
  }
}

async function checkFfmpegAvailable(): Promise<boolean> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch {
    return false;
  }
}

async function concatenateWithFfmpeg(inputFiles: string[], outputPath: string): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  const listPath = outputPath + '.txt';
  const listContent = inputFiles.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listPath, listContent);
  
  try {
    const command = `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}"`;
    await execAsync(command);
    console.log('[Podcast] Audio concatenated with ffmpeg');
  } finally {
    if (fs.existsSync(listPath)) {
      fs.unlinkSync(listPath);
    }
  }
}

/**
 * Check if a podcast exists
 */
export function podcastExists(podcastId: string): boolean {
  const filePath = path.join(AUDIO_DIR, `${podcastId}.mp3`);
  return fs.existsSync(filePath);
}

/**
 * Get podcast file path
 */
export function getPodcastPath(podcastId: string): string | null {
  const filePath = path.join(AUDIO_DIR, podcastId);
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  return null;
}
