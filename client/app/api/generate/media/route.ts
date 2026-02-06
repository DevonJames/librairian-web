/**
 * API Route: Serve Generated Media
 * 
 * GET /api/generate/media?id=<filename>
 * 
 * Serves generated audio files (podcasts and investigative reports).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAudioDirectory } from '@server/audio-generation';
import * as fs from 'fs';
import * as path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'Missing id parameter' },
      { status: 400 }
    );
  }

  // Sanitize the ID to prevent directory traversal
  const sanitizedId = path.basename(id);
  
  const audioDir = getAudioDirectory();
  const filePath = path.join(audioDir, sanitizedId);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    );
  }

  // Security check - ensure file is within the audio directory
  const resolvedPath = path.resolve(filePath);
  const resolvedAudioDir = path.resolve(audioDir);
  
  if (!resolvedPath.startsWith(resolvedAudioDir)) {
    return NextResponse.json(
      { error: 'Invalid path' },
      { status: 403 }
    );
  }

  // Get file stats for content-length
  const stats = fs.statSync(filePath);
  
  // Read the file
  const fileBuffer = fs.readFileSync(filePath);

  // Determine content type from extension
  const ext = path.extname(sanitizedId).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
  };
  const contentType = contentTypes[ext] || 'application/octet-stream';

  // Return the audio file
  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': stats.size.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes',
    },
  });
}
