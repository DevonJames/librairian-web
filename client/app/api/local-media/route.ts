/**
 * Local Media API Route
 * 
 * Serves images and analysis data from local document directories.
 * This is the local equivalent of the external API's /api/docs/media endpoint.
 * 
 * Query parameters:
 *   - id: Document hash/ID
 *   - type: 'image' | 'analysis' | 'pdf'
 *   - filename: For images, the filename (e.g., 'page-01.png')
 *   - getLatestPageData: For analysis, whether to include full page data
 * 
 * Environment variables:
 *   - LOCAL_DOCUMENTS_PATH: Path to the output directory
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Get the local documents path from environment
const LOCAL_DOCUMENTS_PATH = process.env.LOCAL_DOCUMENTS_PATH || '';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const type = searchParams.get('type');
  const filename = searchParams.get('filename');
  
  if (!id) {
    return NextResponse.json({ error: 'Missing document ID' }, { status: 400 });
  }
  
  if (!type) {
    return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 });
  }
  
  if (!LOCAL_DOCUMENTS_PATH) {
    return NextResponse.json(
      { error: 'LOCAL_DOCUMENTS_PATH not configured' }, 
      { status: 500 }
    );
  }
  
  const outputPath = path.resolve(LOCAL_DOCUMENTS_PATH);
  
  try {
    switch (type) {
      case 'image': {
        if (!filename) {
          return NextResponse.json({ error: 'Missing filename for image' }, { status: 400 });
        }
        
        // Construct image path
        const imagePath = path.join(outputPath, 'images', id, filename);
        
        // Security check - ensure path is within expected directory
        const resolvedPath = path.resolve(imagePath);
        if (!resolvedPath.startsWith(path.resolve(outputPath))) {
          return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
        }
        
        // Check if file exists
        try {
          await fs.access(imagePath);
        } catch {
          return NextResponse.json({ error: 'Image not found' }, { status: 404 });
        }
        
        // Read and return the image
        const imageBuffer = await fs.readFile(imagePath);
        
        // Determine content type from extension
        const ext = path.extname(filename).toLowerCase();
        const contentTypes: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
        };
        const contentType = contentTypes[ext] || 'application/octet-stream';
        
        return new NextResponse(imageBuffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
      
      case 'analysis': {
        // Read the metadata file
        const metadataPath = path.join(outputPath, 'analysis', `${id}-metadata.json`);
        
        // Security check
        const resolvedPath = path.resolve(metadataPath);
        if (!resolvedPath.startsWith(path.resolve(outputPath))) {
          return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
        }
        
        try {
          await fs.access(metadataPath);
        } catch {
          return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
        }
        
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);
        
        // Check if we need to load individual page data
        const getLatestPageData = searchParams.get('getLatestPageData') === 'true';
        
        if (getLatestPageData) {
          // Load individual page files if available
          const pagesDir = path.join(outputPath, 'analysis', id);
          try {
            const pageFiles = await fs.readdir(pagesDir);
            const pageJsonFiles = pageFiles
              .filter(f => f.match(/^page-\d+\.json$/))
              .sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)?.[0] || '0');
                const numB = parseInt(b.match(/\d+/)?.[0] || '0');
                return numA - numB;
              });
            
            const pages = [];
            for (const pageFile of pageJsonFiles) {
              const pagePath = path.join(pagesDir, pageFile);
              const pageContent = await fs.readFile(pagePath, 'utf-8');
              pages.push(JSON.parse(pageContent));
            }
            
            if (pages.length > 0) {
              metadata.pages = pages;
            }
          } catch {
            // Pages directory might not exist, use metadata.pages if available
          }
        }
        
        return NextResponse.json(metadata, {
          headers: {
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
      
      case 'pdf': {
        // PDFs might be stored in a pdfs directory or the original source
        // For now, return 404 as PDFs would need separate handling
        return NextResponse.json(
          { error: 'PDF serving not implemented for local documents' }, 
          { status: 501 }
        );
      }
      
      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error serving local media:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
