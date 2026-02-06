import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/db";

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DOCUMENT_ANALYZER_URL = process.env.DOCUMENT_ANALYZER_URL || 'http://localhost:3001';

// Date normalization utilities
function normalizeAllDates(dateStrings: string[]) {
  const validDates: Date[] = [];

  for (const dateString of dateStrings) {
    const date = parseDateString(dateString);
    if (date) {
      validDates.push(date);
    }
  }

  validDates.sort((a, b) => a.getTime() - b.getTime());

  return {
    normalizedDates: validDates,
    earliestDate: validDates.length > 0 ? validDates[0] : null,
    latestDate: validDates.length > 0 ? validDates[validDates.length - 1] : null,
  };
}

function parseDateString(dateString: string): Date | null {
  const formats = [
    {
      regex: /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i,
      parse: (m: RegExpMatchArray) => new Date(parseInt(m[3]), getMonthIndex(m[2]), parseInt(m[1])),
    },
    {
      regex: /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})$/i,
      parse: (m: RegExpMatchArray) => new Date(parseInt(m[3]), getMonthIndex(m[1]), parseInt(m[2])),
    },
    {
      regex: /^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/i,
      parse: (m: RegExpMatchArray) => new Date(parseInt(m[3]), getMonthIndex(m[2]), parseInt(m[1])),
    },
    {
      regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/i,
      parse: (m: RegExpMatchArray) => new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2])),
    },
    {
      regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/i,
      parse: (m: RegExpMatchArray) => new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])),
    },
    {
      regex: /^(\d{4})$/i,
      parse: (m: RegExpMatchArray) => new Date(parseInt(m[1]), 0, 1),
    },
  ];

  for (const format of formats) {
    const match = dateString.match(format.regex);
    if (match) {
      try {
        const date = format.parse(match);
        if (!isNaN(date.getTime())) {
          return date;
        }
      } catch {
        // Continue to next format
      }
    }
  }

  return null;
}

function getMonthIndex(month: string): number {
  const months: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  };
  return months[month.toLowerCase()] ?? 0;
}

function extractArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .flat()
    .filter(item => item !== null && item !== undefined)
    .map(item => typeof item === 'string' ? item : String(item))
    .reduce((acc: string[], item) => {
      const currentSize = acc.join(' ').length;
      if (currentSize < 5000) {
        acc.push(item);
      }
      return acc;
    }, []);
}

function generateSearchText(doc: {
  title?: string;
  summary?: string;
  allNames?: string[];
  allPlaces?: string[];
  allDates?: string[];
  allObjects?: string[];
  stamps?: string[];
  fullText?: string;
}): string {
  const textParts = [
    doc.title || '',
    doc.summary || '',
    (doc.allNames || []).join(' '),
    (doc.allPlaces || []).join(' '),
    (doc.allDates || []).join(' '),
    (doc.allObjects || []).join(' '),
    (doc.stamps || []).join(' ')
  ];

  if (doc.fullText && typeof doc.fullText === 'string') {
    textParts.push(doc.fullText.slice(0, 10000));
  }

  return textParts.filter(Boolean).join(' ');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    console.log(`[SYNC API] Syncing document: ${id}`);
    
    // Fetch fresh data from document analyzer
    const analyzerUrl = `${DOCUMENT_ANALYZER_URL}/api/documents/${id}`;
    console.log(`[SYNC API] Fetching from: ${analyzerUrl}`);
    
    const response = await fetch(analyzerUrl);
    
    if (!response.ok) {
      console.error(`[SYNC API] Analyzer returned ${response.status}`);
      return NextResponse.json(
        { error: `Document analyzer returned ${response.status}` },
        { status: response.status }
      );
    }
    
    const metadata = await response.json();
    console.log(`[SYNC API] Got metadata:`, Object.keys(metadata));
    console.log(`[SYNC API] isCorrespondence:`, metadata.isCorrespondence);
    console.log(`[SYNC API] from:`, metadata.from);
    console.log(`[SYNC API] to:`, metadata.to);
    console.log(`[SYNC API] collection:`, metadata.collection);
    console.log(`[SYNC API] falseRedactions:`, metadata.falseRedactions);
    
    // Check if document exists in our database
    const existing = await prisma.document.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return NextResponse.json(
        { error: "Document not found in database. Import it first." },
        { status: 404 }
      );
    }
    
    // Extract entities from metadata
    const allNames = extractArray(metadata.entities?.names || []);
    const allPlaces = extractArray(metadata.entities?.places || []);
    const allDates = extractArray(metadata.entities?.dates || []);
    const allObjects = extractArray(metadata.entities?.objects || []);
    const stampTexts = metadata.stamps?.map((s: { text?: string }) => s.text).filter(Boolean) || [];
    
    // Normalize dates
    const { normalizedDates, earliestDate, latestDate } = normalizeAllDates(allDates);
    
    // Check for handwritten notes and stamps
    const hasHandwrittenNotes = Array.isArray(metadata.handwrittenNotes) && metadata.handwrittenNotes.length > 0;
    const hasStamps = Array.isArray(metadata.stamps) && metadata.stamps.length > 0;
    
    // Build document data for full-text search
    const searchTextData = {
      title: metadata.fileName || existing.title,
      summary: metadata.summary,
      allNames,
      allPlaces,
      allDates,
      allObjects,
      stamps: stampTexts,
      fullText: metadata.fullText,
    };
    
    // Update document in database
    await prisma.$transaction(async (tx) => {
      // Update main document
      await tx.document.update({
        where: { id },
        data: {
          document: metadata,
          title: metadata.fileName || existing.title,
          summary: metadata.summary || null,
          fullText: metadata.fullText || null,
          documentType: metadata.documentType?.toLowerCase() || null,
          // Update documentGroup from collection field in metadata (lowercase for consistent filtering)
          documentGroup: metadata.collection?.toLowerCase() || existing.documentGroup,
          allNames,
          allPlaces,
          allDates,
          allObjects,
          stamps: stampTexts,
          normalizedDates,
          earliestDate,
          latestDate,
          hasHandwrittenNotes,
          hasStamps,
          hasFullText: Boolean(metadata.fullText),
          searchText: generateSearchText(searchTextData),
          pageCount: metadata.pageCount || existing.pageCount,
          lastProcessed: new Date(),
        }
      });
      
      // Update pages if we have page data
      if (metadata.pages && Array.isArray(metadata.pages)) {
        // Delete existing pages
        await tx.page.deleteMany({ where: { documentId: id } });
        
        // Create new pages
        for (const page of metadata.pages) {
          const pageNum = page.pageNumber || 1;
          await tx.page.create({
            data: {
              documentId: id,
              pageNumber: pageNum,
              imagePath: page.imagePath || null,
              summary: page.summary || null,
              fullText: page.fullText || null,
              hasImage: true,
              hasText: Boolean(page.fullText),
            }
          });
        }
      }
      
      // Update handwritten notes
      if (metadata.handwrittenNotes && Array.isArray(metadata.handwrittenNotes)) {
        await tx.handwrittenNote.deleteMany({ where: { documentId: id } });
        for (const note of metadata.handwrittenNotes) {
          await tx.handwrittenNote.create({
            data: {
              documentId: id,
              pageNumber: note.pageNumber,
              content: note.content,
              location: note.location || null,
            }
          });
        }
      }
      
      // Update stamps
      if (metadata.stamps && Array.isArray(metadata.stamps)) {
        await tx.documentStamp.deleteMany({ where: { documentId: id } });
        for (const stamp of metadata.stamps) {
          await tx.documentStamp.create({
            data: {
              documentId: id,
              pageNumber: stamp.pageNumber,
              type: stamp.type || null,
              date: stamp.date || null,
              text: stamp.text,
            }
          });
        }
      }
    });
    
    // Verify the data was saved correctly
    const savedDoc = await prisma.document.findUnique({
      where: { id },
      select: { document: true }
    });
    const savedJson = savedDoc?.document as Record<string, unknown> | null;
    console.log(`[SYNC API] Verified saved - isCorrespondence:`, savedJson?.isCorrespondence);
    console.log(`[SYNC API] Verified saved - from:`, savedJson?.from);
    console.log(`[SYNC API] Verified saved - to:`, savedJson?.to);
    console.log(`[SYNC API] Verified saved - falseRedactions:`, savedJson?.falseRedactions);
    
    console.log(`[SYNC API] Successfully synced document: ${id}`);
    
    return NextResponse.json({
      success: true,
      message: `Document ${id} synced successfully`,
      syncedAt: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error(`[SYNC API] Error syncing document:`, error);
    return NextResponse.json(
      { 
        error: "Failed to sync document",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
