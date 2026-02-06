/**
 * Import Local Documents Script
 * 
 * This script imports documents from a local analysis output directory into the database.
 * It reads from the document-manifest.json and individual document analysis files.
 * 
 * Usage:
 *   npm run db:import-local -- --path /your/output/path --collection "my-collection"
 * 
 * Or directly:
 *   node scripts/importLocalDocuments.js --path /your/output/path --collection "my-collection"
 * 
 * Options:
 *   --path <path>       Path to the output directory (default: from LOCAL_DOCUMENTS_PATH env)
 *   --collection <name> Collection/group name for the documents (e.g., "jfk", "rfk")
 *   --test              Test mode - only import first 5 documents
 *   --force             Force re-import even if document exists (deletes and recreates)
 *   --update            Update existing documents with new data (preserves, updates fields)
 *   --dry-run           Show what would be imported without actually importing
 * 
 * Expected directory structure:
 *   output/
 *   ├── images/{document-hash}/page-01.png, page-02.png, ...
 *   └── analysis/
 *       ├── document-manifest.json
 *       ├── {document-hash}/page-1.json, page-2.json, ...
 *       ├── {document-hash}-metadata.json
 *       └── {document-hash}-fulltext.txt
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Initialize Prisma client
const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const testMode = args.includes('--test');
const forceMode = args.includes('--force');
const updateMode = args.includes('--update');
const dryRun = args.includes('--dry-run');

// Get path from args or environment
const pathArgIndex = args.indexOf('--path');
const localPath = pathArgIndex !== -1 ? args[pathArgIndex + 1] : process.env.LOCAL_DOCUMENTS_PATH;

// Get collection name from args
const collectionArgIndex = args.indexOf('--collection');
const collectionName = collectionArgIndex !== -1 ? args[collectionArgIndex + 1] : undefined;

if (!localPath) {
  console.error('Error: No path specified. Use --path <path> or set LOCAL_DOCUMENTS_PATH environment variable.');
  process.exit(1);
}

// Resolve paths
const outputPath = path.resolve(localPath);
const analysisPath = path.join(outputPath, 'analysis');
const imagesPath = path.join(outputPath, 'images');
const manifestPath = path.join(analysisPath, 'document-manifest.json');

console.log('='.repeat(60));
console.log('Local Document Import Script');
console.log('='.repeat(60));
console.log(`Output path: ${outputPath}`);
console.log(`Analysis path: ${analysisPath}`);
console.log(`Images path: ${imagesPath}`);
console.log(`Collection: ${collectionName || '(not specified)'}`);
console.log(`Mode: ${testMode ? 'TEST' : 'FULL'}${forceMode ? ' + FORCE' : ''}${updateMode ? ' + UPDATE' : ''}${dryRun ? ' + DRY-RUN' : ''}`);
console.log('='.repeat(60));

// Type definitions are inferred from the JSON structure
// See the script header for expected directory structure

// Date normalization utilities (copied from dateUtils.ts)
function normalizeAllDates(dateStrings) {
  const validDates = [];

  for (const dateString of dateStrings) {
    const date = parseDateString(dateString);
    if (date) {
      validDates.push(date);
    }
  }

  // Sort dates chronologically
  validDates.sort((a, b) => a.getTime() - b.getTime());

  return {
    normalizedDates: validDates,
    earliestDate: validDates.length > 0 ? validDates[0] : null,
    latestDate: validDates.length > 0 ? validDates[validDates.length - 1] : null,
  };
}

function parseDateString(dateString) {
  const formats = [
    {
      regex: /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i,
      parse: (m) => new Date(parseInt(m[3]), getMonthIndex(m[2]), parseInt(m[1])),
    },
    {
      regex: /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})$/i,
      parse: (m) => new Date(parseInt(m[3]), getMonthIndex(m[1]), parseInt(m[2])),
    },
    {
      regex: /^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/i,
      parse: (m) => new Date(parseInt(m[3]), getMonthIndex(m[2]), parseInt(m[1])),
    },
    {
      regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/i,
      parse: (m) => new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2])),
    },
    {
      regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/i,
      parse: (m) => new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])),
    },
    {
      regex: /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/i,
      parse: (m) => new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])),
    },
    {
      regex: /^(\d{4})$/i,
      parse: (m) => new Date(parseInt(m[1]), 0, 1),
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
      } catch (e) {
        // Continue to next format
      }
    }
  }

  return null;
}

function getMonthIndex(month) {
  const months = {
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

// Helper function to extract array elements with size limit
function extractArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .flat()
    .filter(item => item !== null && item !== undefined)
    .map(item => typeof item === 'string' ? item : String(item))
    .reduce((acc, item) => {
      const currentSize = acc.join(' ').length;
      if (currentSize < 5000) {
        acc.push(item);
      }
      return acc;
    }, []);
}

// Generate search text for full-text search
function generateSearchText(doc) {
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

// Read and parse JSON file
function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return null;
  }
}

// Read full text file
function readFullText(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return null;
  }
}

// Main import function
async function importDocuments() {
  const stats = {
    total: 0,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  // Check if paths exist
  if (!fs.existsSync(outputPath)) {
    console.error(`Error: Output path does not exist: ${outputPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(analysisPath)) {
    console.error(`Error: Analysis path does not exist: ${analysisPath}`);
    process.exit(1);
  }

  // Read manifest
  let documents = [];
  
  if (fs.existsSync(manifestPath)) {
    console.log('Reading document manifest...');
    const manifest = readJsonFile(manifestPath);
    if (manifest && manifest.documents) {
      documents = manifest.documents;
      console.log(`Found ${documents.length} documents in manifest`);
    }
  } else {
    // Fallback: scan for metadata files
    console.log('No manifest found, scanning for metadata files...');
    const files = fs.readdirSync(analysisPath);
    const metadataFiles = files.filter(f => f.endsWith('-metadata.json'));
    
    for (const file of metadataFiles) {
      const hash = file.replace('-metadata.json', '');
      documents.push({
        hash,
        originalPath: '',
        fileName: '',
        fileSize: 0,
        processedAt: new Date().toISOString(),
      });
    }
    console.log(`Found ${documents.length} metadata files`);
  }

  if (documents.length === 0) {
    console.log('No documents found to import.');
    return;
  }

  // Limit documents in test mode
  const limit = testMode ? 5 : Infinity;
  const documentsToProcess = documents.slice(0, limit);
  stats.total = documentsToProcess.length;

  console.log(`\nProcessing ${documentsToProcess.length} documents...\n`);

  for (let i = 0; i < documentsToProcess.length; i++) {
    const entry = documentsToProcess[i];
    const hash = entry.hash;
    
    console.log(`[${i + 1}/${documentsToProcess.length}] Processing document: ${hash}`);

    try {
      // Check if document already exists
      const existing = await prisma.document.findUnique({
        where: { id: hash }
      });

      if (existing && !forceMode && !updateMode) {
        console.log(`  ⏭ Skipping (already exists - use --update or --force to re-import)`);
        stats.skipped++;
        continue;
      }

      // Read metadata file
      const metadataPath = path.join(analysisPath, `${hash}-metadata.json`);
      const metadata = readJsonFile(metadataPath);

      if (!metadata) {
        console.log(`  ⚠ No metadata file found at ${metadataPath}`);
        stats.errors++;
        continue;
      }

      // Read full text file
      const fullTextPath = path.join(analysisPath, `${hash}-fulltext.txt`);
      const fullText = readFullText(fullTextPath);

      // Read individual page analysis files
      const pagesDir = path.join(analysisPath, hash);
      const pages = [];
      
      if (fs.existsSync(pagesDir)) {
        const pageFiles = fs.readdirSync(pagesDir)
          .filter(f => f.match(/^page-\d+\.json$/))
          .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)?.[0] || '0');
            const numB = parseInt(b.match(/\d+/)?.[0] || '0');
            return numA - numB;
          });

        for (const pageFile of pageFiles) {
          const pagePath = path.join(pagesDir, pageFile);
          const pageData = readJsonFile(pagePath);
          if (pageData) {
            pages.push(pageData);
          }
        }
      }

      // Use pages from metadata if no individual files found
      if (pages.length === 0 && metadata.pages) {
        pages.push(...metadata.pages);
      }

      // Extract entities from metadata or aggregate from pages
      const allNames = extractArray(metadata.entities?.names || []);
      const allPlaces = extractArray(metadata.entities?.places || []);
      const allDates = extractArray(metadata.entities?.dates || []);
      const allObjects = extractArray(metadata.entities?.objects || []);
      
      // Process stamps
      const stampTexts = metadata.stamps?.map(s => s.text).filter(Boolean) || [];

      // Normalize dates
      const { normalizedDates, earliestDate, latestDate } = normalizeAllDates(allDates);

      // Check for handwritten notes and stamps
      const hasHandwrittenNotes = Array.isArray(metadata.handwrittenNotes) && metadata.handwrittenNotes.length > 0;
      const hasStamps = Array.isArray(metadata.stamps) && metadata.stamps.length > 0;
      const hasFullText = Boolean(fullText && fullText.trim().length > 0);

      // Determine title
      const title = metadata.fileName || entry.fileName || `Document ${hash}`;

      // Build the document record
      const documentData = {
        id: hash,
        document: metadata, // Store full metadata as JSON
        documentUrl: entry.originalPath || metadata.sourceFile || null,
        processingDate: metadata.processedAt ? new Date(metadata.processedAt) : null,
        pageCount: metadata.pageCount || pages.length,
        title,
        summary: metadata.summary || null,
        fullText: fullText || null,
        documentType: metadata.documentType || null,
        documentGroup: collectionName || metadata.collection || null,
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
        hasFullText,
        searchText: '',
        processingStage: 'completed',
        processingSteps: ['download', 'conversion', 'analysis', 'complete'],
        lastProcessed: new Date(),
      };

      // Generate search text
      documentData.searchText = generateSearchText(documentData);

      if (dryRun) {
        console.log(`  📋 Would import: ${title}`);
        console.log(`     - ${pages.length} pages`);
        console.log(`     - ${allNames.length} names, ${allPlaces.length} places, ${allDates.length} dates`);
        console.log(`     - Handwritten notes: ${hasHandwrittenNotes}, Stamps: ${hasStamps}`);
        stats.imported++;
        continue;
      }

      // Use transaction to create or update records
      await prisma.$transaction(async (tx) => {
        if (existing && updateMode) {
          // UPDATE MODE: Update the existing document
          await tx.document.update({
            where: { id: hash },
            data: {
              document: documentData.document,
              title: documentData.title,
              summary: documentData.summary,
              fullText: documentData.fullText,
              documentType: documentData.documentType,
              documentGroup: documentData.documentGroup,
              allNames: documentData.allNames,
              allPlaces: documentData.allPlaces,
              allDates: documentData.allDates,
              allObjects: documentData.allObjects,
              stamps: documentData.stamps,
              normalizedDates: documentData.normalizedDates,
              earliestDate: documentData.earliestDate,
              latestDate: documentData.latestDate,
              hasHandwrittenNotes: documentData.hasHandwrittenNotes,
              hasStamps: documentData.hasStamps,
              hasFullText: documentData.hasFullText,
              searchText: documentData.searchText,
              pageCount: documentData.pageCount,
              lastProcessed: new Date(),
            }
          });

          // Delete and recreate pages (to handle page count changes)
          await tx.page.deleteMany({ where: { documentId: hash } });
          await tx.handwrittenNote.deleteMany({ where: { documentId: hash } });
          await tx.documentStamp.deleteMany({ where: { documentId: hash } });

        } else if (forceMode && existing) {
          // FORCE MODE: Delete and recreate
          await tx.page.deleteMany({ where: { documentId: hash } });
          await tx.handwrittenNote.deleteMany({ where: { documentId: hash } });
          await tx.documentStamp.deleteMany({ where: { documentId: hash } });
          await tx.document.deleteMany({ where: { id: hash } });
          await tx.document.create({ data: documentData });
        } else {
          // CREATE MODE: New document
          await tx.document.create({ data: documentData });
        }

        // Create page records (for all modes)
        for (const page of pages) {
          const pageNum = page.pageNumber || 1;
          const imagePath = path.join(imagesPath, hash, `page-${String(pageNum).padStart(2, '0')}.png`);
          
          await tx.page.create({
            data: {
              documentId: hash,
              pageNumber: pageNum,
              imagePath: imagePath,
              summary: page.summary || null,
              fullText: page.fullText || null,
              hasImage: fs.existsSync(imagePath),
              hasText: Boolean(page.fullText),
            }
          });
        }

        // Create handwritten note records
        if (metadata.handwrittenNotes) {
          for (const note of metadata.handwrittenNotes) {
            await tx.handwrittenNote.create({
              data: {
                documentId: hash,
                pageNumber: note.pageNumber,
                content: note.content,
                location: note.location || null,
              }
            });
          }
        }

        // Create stamp records
        if (metadata.stamps) {
          for (const stamp of metadata.stamps) {
            await tx.documentStamp.create({
              data: {
                documentId: hash,
                pageNumber: stamp.pageNumber,
                type: stamp.type || null,
                date: stamp.date || null,
                text: stamp.text,
              }
            });
          }
        }
      });

      if (existing && updateMode) {
        console.log(`  ✓ Updated: ${title} (${pages.length} pages)`);
        stats.updated++;
      } else {
        console.log(`  ✓ Imported: ${title} (${pages.length} pages)`);
        stats.imported++;
      }

    } catch (error) {
      console.error(`  ✗ Error processing ${hash}:`, error);
      stats.errors++;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Import Complete');
  console.log('='.repeat(60));
  console.log(`Total documents:  ${stats.total}`);
  console.log(`Imported:         ${stats.imported}`);
  console.log(`Updated:          ${stats.updated}`);
  console.log(`Skipped:          ${stats.skipped}`);
  console.log(`Errors:           ${stats.errors}`);
  console.log('='.repeat(60));
}

// Run the import
importDocuments()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    prisma.$disconnect();
    process.exit(1);
  });
