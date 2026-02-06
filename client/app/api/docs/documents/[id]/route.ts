import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = params.id;
    console.log(`[DOCUMENTS API] Request for document: ${id}`);
    
    // Query the database for the document
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        pages: {
          orderBy: { pageNumber: 'asc' }
        },
        handwrittenNotes: true,
        documentStamps: true,
      }
    });
    
    if (!document) {
      console.log(`[DOCUMENTS API] Document not found: ${id}`);
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }
    
    // Extract correspondence fields from the raw document JSON
    const rawDocument = document.document as Record<string, unknown> | null;
    console.log(`[DOCUMENTS API] Raw document keys:`, rawDocument ? Object.keys(rawDocument) : 'null');
    console.log(`[DOCUMENTS API] isCorrespondence in raw:`, rawDocument?.isCorrespondence);
    console.log(`[DOCUMENTS API] from in raw:`, rawDocument?.from);
    console.log(`[DOCUMENTS API] to in raw:`, rawDocument?.to);
    
    const isCorrespondence = rawDocument?.isCorrespondence === true;
    const from = rawDocument?.from as { name?: string; organization?: string; address?: string } | undefined;
    const to = rawDocument?.to as { name?: string; organization?: string; address?: string } | undefined;
    const falseRedactions = rawDocument?.falseRedactions as { 
      found: boolean; 
      pageCount?: number; 
      totalHiddenWords?: number;
      pages?: Array<{
        pageNumber: number;
        hiddenWordCount?: number;
        hiddenWords?: string[];
        hiddenPhrases?: string[];
      }>;
    } | undefined;
    
    console.log(`[DOCUMENTS API] falseRedactions in raw:`, rawDocument?.falseRedactions);
    console.log(`[DOCUMENTS API] falseRedactions.found:`, falseRedactions?.found);
    
    // Transform to expected format
    const responseData = {
      id: document.id,
      title: document.title || `Document ${document.id}`,
      summary: document.summary,
      fullText: document.fullText,
      pageCount: document.pageCount || document.pages.length,
      documentType: document.documentType,
      documentGroup: document.documentGroup,
      allNames: document.allNames || [],
      allPlaces: document.allPlaces || [],
      allDates: document.allDates || [],
      allObjects: document.allObjects || [],
      stamps: document.stamps || [],
      hasHandwrittenNotes: document.hasHandwrittenNotes,
      hasStamps: document.hasStamps,
      hasFullText: document.hasFullText,
      earliestDate: document.earliestDate,
      latestDate: document.latestDate,
      // Correspondence fields
      isCorrespondence,
      from: isCorrespondence ? from : undefined,
      to: isCorrespondence ? to : undefined,
      // False redactions (hidden text under visual redactions)
      falseRedactions: falseRedactions?.found ? falseRedactions : undefined,
      pages: document.pages.map(page => ({
        pageNumber: page.pageNumber,
        imagePath: page.imagePath,
        summary: page.summary,
        fullText: page.fullText,
        hasImage: page.hasImage,
        hasText: page.hasText,
      })),
      handwrittenNotes: document.handwrittenNotes,
      documentStamps: document.documentStamps,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
    
    console.log(`[DOCUMENTS API] Returning document: ${id}, isCorrespondence: ${isCorrespondence}`);
    return NextResponse.json({
      document: responseData,
      status: 'success',
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
  } catch (error) {
    console.error(`[DOCUMENTS API] Error serving document:`, error);
    return NextResponse.json(
      { 
        error: "Failed to retrieve document",
        details: String(error)
      },
      { status: 500 }
    );
  }
} 