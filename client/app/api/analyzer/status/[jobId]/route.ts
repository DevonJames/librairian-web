import { NextRequest, NextResponse } from 'next/server';

const DOCUMENT_ANALYZER_URL = process.env.DOCUMENT_ANALYZER_URL || 'http://localhost:3001';

/**
 * GET /api/analyzer/status/[jobId] - Get job status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { jobId } = params;

  try {
    const response = await fetch(
      `${DOCUMENT_ANALYZER_URL}/api/process/status/${jobId}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Analyzer API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error getting job status:', error);
    return NextResponse.json(
      {
        error: 'Could not connect to document analyzer',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
