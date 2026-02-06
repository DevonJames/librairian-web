import { NextRequest, NextResponse } from 'next/server';

const DOCUMENT_ANALYZER_URL = process.env.DOCUMENT_ANALYZER_URL || 'http://localhost:3001';

/**
 * GET /api/analyzer - Get analyzer status and backends
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const endpoint = searchParams.get('endpoint') || 'status';

  try {
    const response = await fetch(`${DOCUMENT_ANALYZER_URL}/api/${endpoint}`);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Analyzer API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error connecting to document analyzer:', error);
    return NextResponse.json(
      { 
        error: 'Could not connect to document analyzer',
        details: error instanceof Error ? error.message : 'Unknown error',
        analyzerUrl: DOCUMENT_ANALYZER_URL
      },
      { status: 503 }
    );
  }
}

/**
 * POST /api/analyzer - Process documents
 * 
 * Body can contain:
 * - filePath: string - Path to a single file to process
 * - inputDir: string - Path to a directory to process
 * - backend: 'doctr' | 'trocr' | 'grok' - OCR backend (default: doctr)
 * - analyzeWith: 'grok' | 'openai' | 'anthropic' - LLM for entity extraction
 * - collection: string - Collection name to tag documents with
 * - force: boolean - Reprocess already-processed documents
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Determine which endpoint to call
    const endpoint = body.filePath ? 'process/file' : 'process';
    
    const response = await fetch(`${DOCUMENT_ANALYZER_URL}/api/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Analyzer API error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error processing with document analyzer:', error);
    return NextResponse.json(
      {
        error: 'Could not connect to document analyzer',
        details: error instanceof Error ? error.message : 'Unknown error',
        analyzerUrl: DOCUMENT_ANALYZER_URL
      },
      { status: 503 }
    );
  }
}
