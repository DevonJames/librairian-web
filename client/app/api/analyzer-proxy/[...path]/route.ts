import { NextRequest, NextResponse } from 'next/server';

const DOCUMENT_ANALYZER_URL = process.env.DOCUMENT_ANALYZER_URL || 'http://localhost:3001';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const path = pathSegments.join('/');
  const targetUrl = `${DOCUMENT_ANALYZER_URL}/api/${path}`;

  try {
    console.log(`[analyzer-proxy] Proxying GET request to: ${targetUrl}`);
    
    const response = await fetch(targetUrl, {
      headers: {
        'Accept': request.headers.get('accept') || '*/*',
      },
    });

    if (!response.ok) {
      console.error(`[analyzer-proxy] Error from analyzer: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Analyzer returned ${response.status}: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Get the content type to determine how to handle the response
    const contentType = response.headers.get('content-type') || '';

    // For images, stream the binary data
    if (contentType.startsWith('image/')) {
      const imageBuffer = await response.arrayBuffer();
      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // For JSON responses
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return NextResponse.json(data);
    }

    // For other content types, pass through as-is
    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('[analyzer-proxy] Error proxying request:', error);
    return NextResponse.json(
      {
        error: 'Could not connect to document analyzer',
        details: error instanceof Error ? error.message : 'Unknown error',
        targetUrl,
      },
      { status: 503 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const path = pathSegments.join('/');
  const targetUrl = `${DOCUMENT_ANALYZER_URL}/api/${path}`;

  try {
    const body = await request.json();
    console.log(`[analyzer-proxy] Proxying POST request to: ${targetUrl}`, body);
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      console.error(`[analyzer-proxy] Error from analyzer: ${response.status} ${response.statusText}`);
      
      // Try to get error details from response
      let errorDetails = { error: `Analyzer returned ${response.status}: ${response.statusText}` };
      if (contentType.includes('application/json')) {
        try {
          errorDetails = await response.json();
        } catch {
          // Use default error
        }
      }
      
      return NextResponse.json(errorDetails, { status: response.status });
    }

    // For JSON responses
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return NextResponse.json(data);
    }

    // For other content types, pass through as-is
    const text = await response.text();
    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('[analyzer-proxy] Error proxying POST request:', error);
    return NextResponse.json(
      {
        error: 'Could not connect to document analyzer',
        details: error instanceof Error ? error.message : 'Unknown error',
        targetUrl,
      },
      { status: 503 }
    );
  }
}
