import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";

const DOCUMENT_ANALYZER_URL = process.env.DOCUMENT_ANALYZER_URL || 'http://localhost:3001';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper to extract array fields from metadata
function extractArray(data: unknown): string[] {
  if (Array.isArray(data)) {
    return data.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

// Generate search text for full-text search
function generateSearchText(data: {
  fileName?: string;
  summary?: string;
  fullText?: string;
  allNames?: string[];
  allPlaces?: string[];
  allObjects?: string[];
}): string {
  const parts: string[] = [];
  if (data.fileName) parts.push(data.fileName);
  if (data.summary) parts.push(data.summary);
  if (data.fullText) parts.push(data.fullText);
  if (data.allNames?.length) parts.push(data.allNames.join(' '));
  if (data.allPlaces?.length) parts.push(data.allPlaces.join(' '));
  if (data.allObjects?.length) parts.push(data.allObjects.join(' '));
  return parts.join(' ').substring(0, 50000); // Limit length
}

// Sync all documents from the document analyzer
export async function POST() {
  try {
    console.log(`[SYNC-ALL API] Starting bulk sync...`);
    
    // First, fetch ALL documents from the analyzer
    const analyzerListUrl = `${DOCUMENT_ANALYZER_URL}/api/documents`;
    console.log(`[SYNC-ALL API] Fetching document list from: ${analyzerListUrl}`);
    
    const listResponse = await fetch(analyzerListUrl);
    if (!listResponse.ok) {
      throw new Error(`Failed to fetch document list: ${listResponse.status}`);
    }
    
    const analyzerData = await listResponse.json();
    const analyzerDocs = analyzerData.documents || [];
    
    console.log(`[SYNC-ALL API] Found ${analyzerDocs.length} documents in analyzer`);
    
    // Get existing document IDs from our database
    const existingDocs = await prisma.document.findMany({
      select: { id: true }
    });
    const existingIds = new Set(existingDocs.map(d => d.id));
    
    const results = {
      total: analyzerDocs.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    // Process each document from analyzer
    for (const doc of analyzerDocs) {
      const docId = doc.documentId;
      
      try {
        // Fetch full document details
        const detailUrl = `${DOCUMENT_ANALYZER_URL}/api/documents/${docId}`;
        const detailResponse = await fetch(detailUrl);
        
        if (!detailResponse.ok) {
          console.log(`[SYNC-ALL API] Could not fetch details for ${docId}`);
          continue;
        }
        
        const metadata = await detailResponse.json();
        
        // Extract entities from pages
        const allNames: string[] = [];
        const allPlaces: string[] = [];
        const allDates: string[] = [];
        const allObjects: string[] = [];
        const stampTexts: string[] = [];
        
        if (metadata.entities) {
          if (metadata.entities.names) allNames.push(...extractArray(metadata.entities.names));
          if (metadata.entities.places) allPlaces.push(...extractArray(metadata.entities.places));
          if (metadata.entities.dates) allDates.push(...extractArray(metadata.entities.dates));
          if (metadata.entities.objects) allObjects.push(...extractArray(metadata.entities.objects));
        }
        
        // Also extract from pages
        if (Array.isArray(metadata.pages)) {
          for (const page of metadata.pages) {
            if (page.entities) {
              if (page.entities.names) allNames.push(...extractArray(page.entities.names));
              if (page.entities.places) allPlaces.push(...extractArray(page.entities.places));
              if (page.entities.dates) allDates.push(...extractArray(page.entities.dates));
              if (page.entities.objects) allObjects.push(...extractArray(page.entities.objects));
            }
            if (page.stamps) {
              for (const stamp of page.stamps) {
                if (stamp.text) stampTexts.push(stamp.text);
              }
            }
          }
        }
        
        // Deduplicate
        const uniqueNames = [...new Set(allNames)];
        const uniquePlaces = [...new Set(allPlaces)];
        const uniqueDates = [...new Set(allDates)];
        const uniqueObjects = [...new Set(allObjects)];
        const uniqueStamps = [...new Set(stampTexts)];
        
        const hasHandwrittenNotes = Array.isArray(metadata.pages) && 
          metadata.pages.some((p: { handwrittenNotes?: unknown[] }) => p.handwrittenNotes?.length > 0);
        const hasStamps = uniqueStamps.length > 0;
        
        const documentData = {
          document: metadata,
          title: metadata.fileName || `Document ${docId}`,
          summary: metadata.summary || null,
          fullText: metadata.fullText || null,
          documentType: metadata.documentType?.toLowerCase() || null,
          // Store collection name in lowercase for consistent filtering
          documentGroup: metadata.collection?.toLowerCase() || null,
          allNames: uniqueNames,
          allPlaces: uniquePlaces,
          allDates: uniqueDates,
          allObjects: uniqueObjects,
          stamps: uniqueStamps,
          hasHandwrittenNotes,
          hasStamps,
          hasFullText: Boolean(metadata.fullText),
          searchText: generateSearchText({
            fileName: metadata.fileName,
            summary: metadata.summary,
            fullText: metadata.fullText,
            allNames: uniqueNames,
            allPlaces: uniquePlaces,
            allObjects: uniqueObjects,
          }),
          pageCount: metadata.pageCount || 0,
          lastProcessed: new Date(),
        };
        
        const collectionLower = metadata.collection?.toLowerCase() || null;
        
        if (existingIds.has(docId)) {
          // Update existing document
          await prisma.document.update({
            where: { id: docId },
            data: documentData
          });
          results.updated++;
          console.log(`[SYNC-ALL API] Updated ${docId} (collection: ${collectionLower || 'none'})`);
        } else {
          // Create new document
          await prisma.document.create({
            data: {
              id: docId,
              ...documentData,
              createdAt: new Date(),
            }
          });
          results.created++;
          console.log(`[SYNC-ALL API] Created ${docId} (collection: ${collectionLower || 'none'})`);
        }
        
      } catch (err) {
        results.failed++;
        const errorMsg = `Failed to sync ${docId}: ${err instanceof Error ? err.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        console.error(`[SYNC-ALL API] ${errorMsg}`);
      }
    }
    
    console.log(`[SYNC-ALL API] Bulk sync complete. Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`);
    
    return NextResponse.json({
      success: true,
      ...results
    });
    
  } catch (error) {
    console.error(`[SYNC-ALL API] Error:`, error);
    return NextResponse.json(
      { 
        error: "Failed to sync documents",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
