## Analysis Output Structure

When you process a document, the tool generates output in the `output/` directory with the following structure:

```
output/
├── images/
│   └── {document-hash}/
│       ├── page-01.png
│       ├── page-02.png
│       └── ...
├── analysis/
│   ├── document-manifest.json
│   ├── {document-hash}/
│   │   ├── page-1.json
│   │   ├── page-2.json
│   │   └── ...
│   ├── {document-hash}-metadata.json
│   └── {document-hash}-fulltext.txt
```

---

### 1. Image Files (`output/images/{hash}/`)

Converted page images from the source document:
- **Location:** `output/images/{document-hash}/`
- **Format:** PNG files named `page-01.png`, `page-02.png`, etc.
- **Purpose:** Used for OCR processing; retained for reference/debugging

---

### 2. Page-Level Analysis (`output/analysis/{hash}/page-N.json`)

Individual JSON file for each page containing:

| Field | Description |
|-------|-------------|
| `fullText` | Complete OCR text extracted from the page |
| `confidence` | OCR confidence score (0-1) |
| `wordCount` | Number of words on the page |
| `summary` | 2-3 sentence summary of page content |
| `documentType` | Type of document (letter, memo, report, etc.) |
| `isCorrespondence` | Boolean - true if it's a letter/email/memo |
| `from` | Sender info if correspondence (name, org, address) |
| `to` | Recipient info if correspondence |
| `names` | Array of person/organization names |
| `dates` | Array of dates mentioned |
| `places` | Array of locations mentioned |
| `objects` | Array of specific items/documents mentioned |
| `topics` | Array of main themes |
| `keyPoints` | 3-5 key points from the text |
| `handwrittenNotes` | Any handwritten annotations detected |
| `stamps` | Official stamps detected |
| `redactions` | Redacted content detected |
| `analyzedWithLLM` | Boolean - whether LLM analysis was used |
| `pageNumber` | Page number |
| `imagePath` | Path to the source image |

---

### 3. Document Metadata (`output/analysis/{hash}-metadata.json`)

Aggregated document-level analysis:

| Field | Description |
|-------|-------------|
| `documentId` | SHA256 content hash (first 16 chars) |
| `sourceFile` | Original file path |
| `fileName` | Original filename |
| `collection` | Collection name (if `--collection` flag used) |
| `processedAt` | ISO timestamp |
| `ocrBackend` | OCR engine used (doctr, trocr, grok) |
| `entityAnalyzer` | Analysis method (regex or LLM provider) |
| `pageCount` | Total pages |
| `successfulPages` | Pages processed successfully |
| `failedPages` | Pages that failed |
| `totalWordCount` | Total words across all pages |
| `documentType` | Overall document type |
| `isCorrespondence` | Whether it's correspondence |
| `from` / `to` | Sender/recipient (if correspondence) |
| `summary` | Combined summary from all pages |
| `entities` | Aggregated names, dates, places, objects |
| `handwrittenNotes` | All handwritten notes with IDs |
| `stamps` | All stamps detected |
| `redactions` | All redactions detected |
| `pages` | Array of page-level data |

---

### 4. Full Text (`output/analysis/{hash}-fulltext.txt`)

Plain text file with all extracted text, formatted as:
```
--- PAGE 1 ---
[text from page 1]

--- PAGE 2 ---
[text from page 2]
...
```

---

### 5. Document Manifest (`output/analysis/document-manifest.json`)

Central registry tracking all processed documents:

```json
{
  "version": 1,
  "createdAt": "2026-02-05T01:18:52.904Z",
  "updatedAt": "2026-02-05T15:42:53.876Z",
  "documents": [
    {
      "hash": "c51d789c046ac482",
      "originalPath": "/path/to/original.pdf",
      "fileName": "original.pdf",
      "fileSize": 891996,
      "processedAt": "2026-02-05T01:18:52.899Z",
      "sourceFiles": [
        {
          "path": "/first/location/original.pdf",
          "fileName": "original.pdf",
          "addedAt": "2026-02-05T01:18:52.904Z"
        },
        {
          "path": "/second/location/copy.pdf",
          "fileName": "copy.pdf", 
          "addedAt": "2026-02-05T15:42:53.875Z"
        }
      ],
      "lastProcessedAt": "2026-02-05T15:42:53.875Z"
    }
  ]
}
```

The manifest:
- Maps content hashes to original filenames/paths
- Tracks **all source files** that have the same content (duplicates)
- Prevents reprocessing identical files even with different names
- Records file size and processing timestamps

---

### Key Design Decisions

1. **Content-based IDs:** Documents are identified by SHA256 hash of file content, so identical files (even with different names) share the same analysis
2. **Checkpointing:** If processing is interrupted, image conversion and OCR results are preserved so you can resume without redoing work
3. **Separation of concerns:** Page-level detail vs document-level aggregation are stored separately for flexibility