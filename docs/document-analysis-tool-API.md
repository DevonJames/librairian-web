# Document Analysis Tool - HTTP API Reference

## Starting the Server

```bash
# Start the server
node server.js

# Or with npm
npm run server

# Development mode with auto-reload
npm run dev
```

The server starts on `http://localhost:3001` by default. Configure with the `PORT` and `HOST` environment variables.

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/status` | Server status and configuration |
| `GET` | `/api/backends` | List available OCR backends |
| `POST` | `/api/process` | Process documents from a directory |
| `POST` | `/api/process/file` | Process a single file |
| `GET` | `/api/process/status/:jobId` | Get job status (polling) |
| `GET` | `/api/process/status/:jobId/stream` | Get job status (SSE stream) |
| `GET` | `/api/documents` | List all processed documents |
| `GET` | `/api/documents/:id` | Get document metadata |
| `GET` | `/api/documents/:id/text` | Get document full text |
| `GET` | `/api/documents/:id/images/:page` | Get page image |
| `GET` | `/api/search` | Search documents |

---

## Server Status

### `GET /api/status`

Returns server status and configuration.

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "config": {
    "outputDir": "/path/to/output",
    "defaultBackend": "doctr",
    "supportedFormats": {
      "pdf": [".pdf"],
      "image": [".jpg", ".jpeg", ".png", ".tiff", ".tif", ".gif", ".webp", ".bmp"],
      "office": [".docx", ".doc", ".odt", ".rtf"]
    }
  },
  "activeJobs": 0
}
```

---

## OCR Backends

### `GET /api/backends`

Check availability of OCR backends.

**Response:**
```json
{
  "doctr": {
    "available": true,
    "type": "local",
    "description": "DocTR - Local OCR engine"
  },
  "trocr": {
    "available": true,
    "type": "local",
    "description": "TrOCR - Handwriting recognition"
  },
  "grok": {
    "available": true,
    "type": "cloud",
    "description": "Grok Vision API"
  }
}
```

---

## Processing Documents

### `POST /api/process`

Process all documents in a directory. Returns immediately with a job ID for status tracking.

**Request Body:**
```json
{
  "inputDir": "/path/to/documents",
  "backend": "doctr",
  "analyzeWith": "grok",
  "collection": "JFK Files",
  "force": false,
  "recursive": true,
  "findFalseRedactions": true
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `inputDir` | string | Yes | — | Path to directory containing documents |
| `backend` | string | No | `"doctr"` | OCR backend: `doctr`, `trocr`, or `grok` |
| `analyzeWith` | string | No | `null` | LLM for entity analysis: `grok`, `openai`, or `anthropic` |
| `collection` | string | No | `null` | Collection name to tag documents with |
| `force` | boolean | No | `false` | Reprocess already-processed documents |
| `recursive` | boolean | No | `true` | Scan subdirectories |
| `convertToDocx` | boolean | No | `false` | Convert PDF to Word (.docx) format with extracted text |
| `findFalseRedactions` | boolean | No | `false` | Detect false redactions by comparing PDF text vs OCR (PDF only) |

**Response:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Processing started",
  "statusUrl": "/api/process/status/550e8400-e29b-41d4-a716-446655440000"
}
```

---

### `POST /api/process/file`

Process a single file.

**Request Body:**
```json
{
  "filePath": "/path/to/document.pdf",
  "backend": "doctr",
  "analyzeWith": "grok",
  "collection": "Tax Documents",
  "force": false,
  "findFalseRedactions": true
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `filePath` | string | Yes | — | Path to document file |
| `backend` | string | No | `"doctr"` | OCR backend: `doctr`, `trocr`, or `grok` |
| `analyzeWith` | string | No | `null` | LLM for entity analysis: `grok`, `openai`, or `anthropic` |
| `collection` | string | No | `null` | Collection name to tag document with |
| `force` | boolean | No | `false` | Reprocess even if already processed |
| `convertToDocx` | boolean | No | `false` | Convert PDF to Word (.docx) format with extracted text |
| `findFalseRedactions` | boolean | No | `false` | Detect false redactions by comparing PDF text vs OCR (PDF only) |

**Response:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Processing started",
  "statusUrl": "/api/process/status/550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Job Status

### `GET /api/process/status/:jobId`

Poll for job status.

**Response (in progress):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "startedAt": "2026-02-05T12:00:00.000Z",
  "currentFile": "document.pdf",
  "currentIndex": 3,
  "totalFiles": 10,
  "filesToProcess": 8,
  "progress": [
    { "status": "file_found", "file": "doc1.pdf" },
    { "status": "converting", "message": "Converting document to images" }
  ]
}
```

**Response (complete):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "complete",
  "startedAt": "2026-02-05T12:00:00.000Z",
  "completedAt": "2026-02-05T12:05:00.000Z",
  "results": [
    { "success": true, "file": "doc1.pdf", "documentId": "abc123..." },
    { "success": true, "file": "doc2.pdf", "documentId": "def456..." }
  ]
}
```

---

### `GET /api/process/status/:jobId/stream`

Real-time job status via Server-Sent Events (SSE).

**Usage:**
```javascript
const eventSource = new EventSource('/api/process/status/550e8400.../stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Progress:', data);
};

eventSource.addEventListener('complete', (event) => {
  console.log('Job complete:', JSON.parse(event.data));
  eventSource.close();
});

eventSource.addEventListener('error', (event) => {
  console.error('Job error:', JSON.parse(event.data));
  eventSource.close();
});
```

**Event Types:**
- `message` — Progress updates
- `complete` — Job finished successfully
- `error` — Job failed

---

## Document Retrieval

### `GET /api/documents`

List all processed documents.

**Response:**
```json
{
  "count": 2,
  "documents": [
    {
      "documentId": "c6ae72bf53e22e92",
      "fileName": "letter.pdf",
      "collection": "JFK Files",
      "processedAt": "2026-02-05T12:00:00.000Z",
      "pageCount": 14,
      "ocrBackend": "doctr",
      "documentType": "letter",
      "isCorrespondence": true,
      "from": { "name": "John Smith", "organization": "FBI" },
      "to": { "name": "Director", "organization": "CIA" },
      "summary": "A letter discussing...",
      "entityCounts": {
        "names": 45,
        "dates": 12,
        "places": 8,
        "objects": 15
      }
    }
  ]
}
```

---

### `GET /api/documents/:id`

Get full metadata for a specific document.

**Response:**
```json
{
  "documentId": "c6ae72bf53e22e92",
  "sourceFile": "/path/to/original.pdf",
  "fileName": "original.pdf",
  "collection": "JFK Files",
  "processedAt": "2026-02-05T12:00:00.000Z",
  "ocrBackend": "doctr",
  "entityAnalyzer": "grok",
  "pageCount": 14,
  "totalWordCount": 9117,
  "documentType": "letter",
  "isCorrespondence": true,
  "from": { "name": "John Smith" },
  "to": { "name": "Jane Doe" },
  "summary": "...",
  "entities": {
    "names": ["John Smith", "Jane Doe"],
    "dates": ["January 15, 1963"],
    "places": ["Washington DC"],
    "objects": ["memo", "report"]
  },
  "falseRedactions": {
    "found": true,
    "pageCount": 2,
    "totalHiddenWords": 15,
    "pages": [
      {
        "pageNumber": 1,
        "hiddenWordCount": 8,
        "hiddenWords": ["classified", "secret"],
        "hiddenPhrases": ["CLASSIFIED - TOP SECRET"]
      }
    ]
  },
  "pages": [...]
}
```

---

### `GET /api/documents/:id/text`

Get full extracted text for a document.

**Response:**
```json
{
  "documentId": "c6ae72bf53e22e92",
  "text": "--- PAGE 1 ---\nDear Director,\n\n..."
}
```

---

### `GET /api/documents/:id/images/:page`

Get page image file.

**Parameters:**
- `:id` — Document ID (hash)
- `:page` — Page number (1-indexed)

**Response:** PNG image file

**Example:**
```
GET /api/documents/c6ae72bf53e22e92/images/1
```

---

## Search

### `GET /api/search`

Search documents by various criteria.

**Query Parameters:**

| Parameter | Description |
|-----------|-------------|
| `name` | Search by person/organization name |
| `date` | Search by date |
| `place` | Search by location |
| `text` | Full-text search |
| `collection` | Filter by collection name |

**Examples:**
```
GET /api/search?name=Kennedy
GET /api/search?place=Dallas&date=1963
GET /api/search?collection=JFK%20Files
GET /api/search?text=assassination&collection=JFK%20Files
```

**Response:**
```json
{
  "query": {
    "name": "Kennedy",
    "collection": "JFK Files"
  },
  "count": 5,
  "results": [
    {
      "documentId": "abc123...",
      "fileName": "memo.pdf",
      "collection": "JFK Files",
      "summary": "..."
    }
  ]
}
```

---

## Example Workflows

### Process a folder with LLM analysis

```bash
curl -X POST http://localhost:3001/api/process \
  -H "Content-Type: application/json" \
  -d '{
    "inputDir": "/Users/me/documents/scans",
    "backend": "doctr",
    "analyzeWith": "grok",
    "collection": "2026 Tax Documents"
  }'
```

### Monitor job progress with SSE (JavaScript)

```javascript
async function processAndMonitor(inputDir, collection) {
  // Start processing
  const response = await fetch('http://localhost:3001/api/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      inputDir, 
      collection,
      analyzeWith: 'grok'
    })
  });
  
  const { jobId } = await response.json();
  
  // Monitor with SSE
  const events = new EventSource(`http://localhost:3001/api/process/status/${jobId}/stream`);
  
  events.onmessage = (e) => console.log('Progress:', JSON.parse(e.data));
  events.addEventListener('complete', (e) => {
    console.log('Done!', JSON.parse(e.data));
    events.close();
  });
}
```

### Search and retrieve documents

```bash
# Find all documents mentioning "Kennedy"
curl "http://localhost:3001/api/search?name=Kennedy"

# Get full metadata for a specific document
curl "http://localhost:3001/api/documents/c6ae72bf53e22e92"

# Get the extracted text
curl "http://localhost:3001/api/documents/c6ae72bf53e22e92/text"

# Download page 1 image
curl "http://localhost:3001/api/documents/c6ae72bf53e22e92/images/1" -o page1.png
```

---

## False Redaction Detection

When `findFalseRedactions: true` is set, the system detects "false redactions" in PDF documents. These occur when text appears visually redacted (black boxes, highlighting) but the underlying text data is still present in the PDF.

### How It Works

1. **PDF Text Extraction**: Extracts text directly from the PDF file (includes hidden text under visual redactions)
2. **OCR Comparison**: Compares against OCR results (only sees what's visually visible)
3. **Difference Detection**: Words present in PDF text but missing from OCR are flagged as potentially hidden

### Response Format

When false redactions are found, the metadata includes:

**Document Level:**
```json
{
  "falseRedactions": {
    "found": true,
    "pageCount": 2,
    "totalHiddenWords": 15,
    "pages": [
      {
        "pageNumber": 1,
        "hiddenWordCount": 8,
        "hiddenWords": ["confidential", "classified"],
        "hiddenPhrases": ["CONFIDENTIAL - DO NOT DISTRIBUTE"]
      }
    ]
  }
}
```

**Page Level** (in each page object):
```json
{
  "pageNumber": 1,
  "falseRedactions": {
    "found": true,
    "hiddenWordCount": 8,
    "hiddenWords": ["confidential", "classified"],
    "hiddenPhrases": ["CONFIDENTIAL - DO NOT DISTRIBUTE"],
    "pdfWordCount": 150,
    "ocrWordCount": 142
  }
}
```

### Example Usage

```bash
# Find false redactions in a single file
curl -X POST http://localhost:3001/api/process/file \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "/path/to/document.pdf",
    "findFalseRedactions": true
  }'

# Scan directory for false redactions with analysis
curl -X POST http://localhost:3001/api/process \
  -H "Content-Type: application/json" \
  -d '{
    "inputDir": "/path/to/documents",
    "findFalseRedactions": true,
    "analyzeWith": "grok"
  }'
```

> **Note:** False redaction detection only works with PDF files. For scanned PDFs (image-only), this feature will not find hidden text since there is no embedded text layer.

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Description of what went wrong"
}
```

| Status Code | Meaning |
|-------------|---------|
| `400` | Bad request (missing/invalid parameters) |
| `404` | Resource not found |
| `500` | Server error |