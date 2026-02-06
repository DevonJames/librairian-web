import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  size?: number;
  extension?: string;
}

// Supported document extensions
const DOCUMENT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.gif', '.webp', '.bmp', '.docx', '.doc', '.odt', '.rtf'];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dirPath = searchParams.get('path') || os.homedir();
  const showFilesParam = searchParams.get('showFiles');
  const showFiles = showFilesParam !== 'false'; // Default to true

  try {
    // Resolve and normalize the path
    const resolvedPath = path.resolve(dirPath);
    
    // Check if path exists
    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json(
        { error: 'Path does not exist', path: resolvedPath },
        { status: 404 }
      );
    }

    const stats = fs.statSync(resolvedPath);
    
    // If it's a file, return info about the file
    if (stats.isFile()) {
      return NextResponse.json({
        currentPath: resolvedPath,
        parentPath: path.dirname(resolvedPath),
        isFile: true,
        fileName: path.basename(resolvedPath),
        items: [],
      });
    }

    // Read directory contents
    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
    
    const items: FileInfo[] = [];
    
    for (const entry of entries) {
      // Skip hidden files/folders (starting with .)
      if (entry.name.startsWith('.')) continue;
      
      const fullPath = path.join(resolvedPath, entry.name);
      const isDir = entry.isDirectory();
      const isFile = entry.isFile();
      
      // For files, check if it's a supported document type
      if (isFile && showFiles) {
        const ext = path.extname(entry.name).toLowerCase();
        if (DOCUMENT_EXTENSIONS.includes(ext)) {
          try {
            const fileStats = fs.statSync(fullPath);
            items.push({
              name: entry.name,
              path: fullPath,
              isDirectory: false,
              isFile: true,
              size: fileStats.size,
              extension: ext,
            });
          } catch {
            // Skip files we can't access
          }
        }
      } else if (isDir) {
        items.push({
          name: entry.name,
          path: fullPath,
          isDirectory: true,
          isFile: false,
        });
      }
    }

    // Sort: directories first, then files, both alphabetically
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      currentPath: resolvedPath,
      parentPath: path.dirname(resolvedPath),
      isFile: false,
      items,
    });
  } catch (error) {
    console.error('[filesystem/browse] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to browse directory',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
