/**
 * Investigative Report Generator
 * 
 * Generates audio investigative reports from documents using AI dialogue
 * between two investigators (reporter and private eye).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { personalities } from './config';
import { generateInvestigatorComment, generateTitle, generateTags } from './text-generator';
import { synthesizeDialogueTurn, estimateAudioDuration } from './text-to-speech';
import { DocumentInput, DialogueTurn, GenerationProgress, GenerationResult } from './types';

// Directory for generated audio files
const AUDIO_DIR = path.join(process.cwd(), 'generated-audio');

console.log('[IR] Audio directory configured at:', AUDIO_DIR);

// Ensure audio directory exists
if (!fs.existsSync(AUDIO_DIR)) {
  console.log('[IR] Creating audio directory');
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

/**
 * Generate a unique report ID based on content
 */
function generateReportId(documents: DocumentInput[], investigation: string): string {
  const content = documents.map(d => d.documentId || d.url || 'doc').join(',') + investigation;
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Group related documents by overlapping entities
 */
function groupRelatedDocuments(documents: DocumentInput[]): {
  relatedGroups: DocumentInput[][];
  unrelated: DocumentInput[];
} {
  // Get unique documents by ID
  const uniqueDocs = new Map<string, DocumentInput>();
  documents.forEach(doc => {
    if (doc.documentId && !uniqueDocs.has(doc.documentId)) {
      uniqueDocs.set(doc.documentId, doc);
    }
  });

  const docArray = Array.from(uniqueDocs.values());
  const used = new Set<string>();
  const relatedGroups: DocumentInput[][] = [];

  for (const doc of docArray) {
    if (used.has(doc.documentId!)) continue;

    const group: DocumentInput[] = [doc];
    used.add(doc.documentId!);

    // Find related documents (share names, places, or dates)
    for (const otherDoc of docArray) {
      if (used.has(otherDoc.documentId!)) continue;

      const hasOverlap =
        (doc.names?.some(n => otherDoc.names?.includes(n))) ||
        (doc.places?.some(p => otherDoc.places?.includes(p))) ||
        (doc.dates?.some(d => otherDoc.dates?.includes(d)));

      if (hasOverlap) {
        group.push(otherDoc);
        used.add(otherDoc.documentId!);
      }
    }

    if (group.length > 1) {
      relatedGroups.push(group);
    }
  }

  // Unrelated documents are those not in any group
  const unrelated = docArray.filter(d => !used.has(d.documentId!));

  return { relatedGroups, unrelated };
}

/**
 * Create document summary for dialogue
 */
function createDocumentSummary(documents: DocumentInput[]): string {
  const uniqueIds = [...new Set(documents.map(d => d.documentId))];
  
  const summaries: string[] = [];
  
  for (const docId of uniqueIds) {
    const doc = documents.find(d => d.documentId === docId);
    if (!doc) continue;

    let summary = `Document: ${docId}\n`;
    if (doc.summary) summary += `Summary: ${doc.summary}\n`;
    if (doc.names?.length) summary += `People: ${doc.names.join(', ')}\n`;
    if (doc.places?.length) summary += `Places: ${doc.places.join(', ')}\n`;
    if (doc.dates?.length) summary += `Dates: ${doc.dates.join(', ')}\n`;
    
    // Include false redactions data if present
    if (doc.falseRedactions?.found) {
      summary += `\nFalse Redactions (Hidden Text Found):\n`;
      if (doc.falseRedactions.totalHiddenWords) {
        summary += `Total hidden words recovered: ${doc.falseRedactions.totalHiddenWords}\n`;
      }
      if (doc.falseRedactions.hiddenWords?.length) {
        summary += `Hidden words: ${doc.falseRedactions.hiddenWords.join(', ')}\n`;
      }
      if (doc.falseRedactions.hiddenPhrases?.length) {
        summary += `Hidden phrases: ${doc.falseRedactions.hiddenPhrases.join(', ')}\n`;
      }
    }
    
    summaries.push(summary);
  }

  return summaries.join('\n---\n');
}

/**
 * Generate investigative report from documents
 */
export async function generateInvestigativeReport(
  documents: DocumentInput[],
  investigation: string = 'Document Investigation',
  selectedInvestigators: string[] = ['reporter', 'privateEye'],
  targetLengthSeconds: number = 300,
  onProgress?: (progress: GenerationProgress) => void
): Promise<GenerationResult> {
  const reportId = generateReportId(documents, investigation);
  const outputDir = path.join(AUDIO_DIR, reportId);
  
  // Check if already exists
  const finalOutputPath = path.join(AUDIO_DIR, `${reportId}.mp3`);
  if (fs.existsSync(finalOutputPath)) {
    return {
      success: true,
      audioFile: `${reportId}.mp3`,
      audioUrl: `/api/generate/media?id=${reportId}.mp3`,
    };
  }

  // Create temp directory for audio segments
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    console.log('[IR] Starting report generation for', documents.length, 'documents');
    console.log('[IR] Investigation:', investigation);
    console.log('[IR] Output directory:', outputDir);
    console.log('[IR] Final output path:', finalOutputPath);
    
    // Get personalities for investigators
    const [investigator1Key, investigator2Key] = selectedInvestigators;
    const speaker1 = personalities[investigator1Key] || personalities.reporter;
    const speaker2 = personalities[investigator2Key] || personalities.privateEye;
    
    console.log('[IR] Speakers:', speaker1.name, 'and', speaker2.name);

    onProgress?.({
      status: 'preparing',
      message: `${speaker1.name} and ${speaker2.name} are beginning the investigation`,
    });

    const dialogue: DialogueTurn[] = [];
    const audioFiles: string[] = [];
    let currentDuration = 0;
    const wordsPerSecond = 2.5;

    // Create document overview
    const documentOverview = createDocumentSummary(documents);
    
    // Group documents for analysis
    const { relatedGroups, unrelated } = groupRelatedDocuments(documents);

    // Step 1: Opening - Reporter introduces the investigation
    onProgress?.({
      status: 'generating',
      message: `${speaker1.name} is setting the stage`,
      currentStep: 1,
    });

    const openingLine = speaker1.openingLines[Math.floor(Math.random() * speaker1.openingLines.length)];
    const openingComment = await generateInvestigatorComment({
      speakerName: speaker1.name,
      speakerAlias: speaker1.alias,
      speakerTone: speaker1.tone,
      speakerHumorStyle: speaker1.humorStyle,
      documentContent: documentOverview,
      dialogue: [],
      investigation,
      isIntro: true,
      openingLine,
    });

    dialogue.push({ speaker: investigator1Key, text: openingComment });
    
    console.log('[IR] Generated opening comment:', openingComment.substring(0, 100) + '...');
    
    // Synthesize opening
    console.log('[IR] Synthesizing opening audio...');
    const openingAudio = await synthesizeDialogueTurn(
      openingComment,
      investigator1Key,
      outputDir,
      0
    );
    console.log('[IR] Opening audio saved:', openingAudio);
    audioFiles.push(openingAudio);
    currentDuration += estimateAudioDuration(openingComment);

    // Step 2: Private Eye's initial response
    onProgress?.({
      status: 'generating',
      message: `${speaker2.name} is analyzing the evidence`,
      currentStep: 2,
    });

    const initialResponse = await generateInvestigatorComment({
      speakerName: speaker2.name,
      speakerAlias: speaker2.alias,
      speakerTone: speaker2.tone,
      speakerHumorStyle: speaker2.humorStyle,
      documentContent: documentOverview,
      previousComment: openingComment,
      dialogue,
      investigation,
    });

    dialogue.push({ speaker: investigator2Key, text: initialResponse });
    
    const responseAudio = await synthesizeDialogueTurn(
      initialResponse,
      investigator2Key,
      outputDir,
      1
    );
    audioFiles.push(responseAudio);
    currentDuration += estimateAudioDuration(initialResponse);

    // Step 3: Analyze document groups
    let turnIndex = 2;
    let currentSpeakerIndex = 0;
    const speakers = [
      { key: investigator1Key, personality: speaker1 },
      { key: investigator2Key, personality: speaker2 },
    ];

    // Process related document groups
    for (let i = 0; i < relatedGroups.length && currentDuration < targetLengthSeconds * 0.8; i++) {
      const group = relatedGroups[i];
      const groupSummary = createDocumentSummary(group);

      onProgress?.({
        status: 'analyzing',
        message: `Analyzing document group ${i + 1} of ${relatedGroups.length}`,
        currentStep: turnIndex,
      });

      // Generate 2-3 turns per group
      for (let j = 0; j < 2 && currentDuration < targetLengthSeconds * 0.8; j++) {
        const speaker = speakers[currentSpeakerIndex % 2];
        const previousTurn = dialogue[dialogue.length - 1];

        const comment = await generateInvestigatorComment({
          speakerName: speaker.personality.name,
          speakerAlias: speaker.personality.alias,
          speakerTone: speaker.personality.tone,
          speakerHumorStyle: speaker.personality.humorStyle,
          documentContent: groupSummary,
          previousComment: previousTurn?.text,
          dialogue,
          investigation,
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
      }
    }

    // Step 4: Closing
    onProgress?.({
      status: 'concluding',
      message: `${speaker1.name} is wrapping up the investigation`,
    });

    const closingLine = speaker1.closingLines[Math.floor(Math.random() * speaker1.closingLines.length)];
    const closingComment = await generateInvestigatorComment({
      speakerName: speaker1.name,
      speakerAlias: speaker1.alias,
      speakerTone: speaker1.tone,
      speakerHumorStyle: speaker1.humorStyle,
      documentContent: documentOverview,
      previousComment: dialogue[dialogue.length - 1]?.text,
      dialogue,
      investigation,
      isOutro: true,
      closingLine,
    });

    dialogue.push({ speaker: investigator1Key, text: closingComment });
    
    const closingAudio = await synthesizeDialogueTurn(
      closingComment,
      investigator1Key,
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
      message: 'Investigation complete',
    });

    return {
      success: true,
      audioFile: `${reportId}.mp3`,
      audioUrl: `/api/generate/media?id=${reportId}.mp3`,
      title,
      tags,
    };

  } catch (error) {
    console.error('[IR] Error generating investigative report:', error);
    console.error('[IR] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
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
  console.log('[IR] Concatenating', inputFiles.length, 'audio files');
  console.log('[IR] Output path:', outputPath);
  
  // Filter to only existing files
  const existingFiles = inputFiles.filter(file => {
    const exists = fs.existsSync(file);
    if (!exists) {
      console.warn('[IR] File not found:', file);
    }
    return exists;
  });
  
  if (existingFiles.length === 0) {
    throw new Error('No audio files to concatenate');
  }
  
  // Try ffmpeg first for proper concatenation with correct duration
  const ffmpegAvailable = await checkFfmpegAvailable();
  
  if (ffmpegAvailable) {
    await concatenateWithFfmpeg(existingFiles, outputPath);
  } else {
    console.warn('[IR] ffmpeg not available, falling back to simple concatenation (duration may be incorrect)');
    await concatenateSimple(existingFiles, outputPath);
  }
}

/**
 * Check if ffmpeg is available
 */
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

/**
 * Concatenate using ffmpeg for proper duration metadata
 */
async function concatenateWithFfmpeg(inputFiles: string[], outputPath: string): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  console.log('[IR] Using ffmpeg for concatenation');
  
  // Create a temporary file list for ffmpeg concat demuxer
  const listPath = outputPath + '.txt';
  const listContent = inputFiles.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listPath, listContent);
  
  try {
    // Use ffmpeg concat demuxer - this properly handles duration
    const command = `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}"`;
    console.log('[IR] Running ffmpeg command:', command);
    
    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      console.log('[IR] ffmpeg stderr:', stderr);
    }
    
    // Verify the output file exists and has content
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log('[IR] Final audio saved:', outputPath, 'size:', stats.size, 'bytes');
    } else {
      throw new Error('ffmpeg did not create output file');
    }
  } finally {
    // Clean up the list file
    if (fs.existsSync(listPath)) {
      fs.unlinkSync(listPath);
    }
  }
}

/**
 * Simple buffer concatenation fallback (duration metadata may be incorrect)
 */
async function concatenateSimple(inputFiles: string[], outputPath: string): Promise<void> {
  const buffers: Buffer[] = [];
  
  for (const file of inputFiles) {
    const buffer = fs.readFileSync(file);
    console.log('[IR] Read file:', file, 'size:', buffer.length, 'bytes');
    buffers.push(buffer);
  }
  
  const combined = Buffer.concat(buffers);
  console.log('[IR] Combined audio size:', combined.length, 'bytes');
  fs.writeFileSync(outputPath, combined);
  console.log('[IR] Final audio saved to:', outputPath);
}

/**
 * Check if a report exists
 */
export function reportExists(reportId: string): boolean {
  const filePath = path.join(AUDIO_DIR, `${reportId}.mp3`);
  return fs.existsSync(filePath);
}

/**
 * Get report file path
 */
export function getReportPath(reportId: string): string | null {
  const filePath = path.join(AUDIO_DIR, reportId);
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  return null;
}

/**
 * Get audio directory path
 */
export function getAudioDirectory(): string {
  return AUDIO_DIR;
}
