# Document Viewer

A document analysis and viewing application that provides an intuitive interface for browsing, searching, and analyzing collections of documents. Integrates with the [Document Analysis Tool](https://github.com/your-repo/document-analysis-tool) for OCR, entity extraction, and document processing.

## Features

- **Collections Management**: Organize documents into collections, create new collections, and add files to existing ones
- **Document Viewer**: View document pages with high-quality images and extracted text
- **Entity Extraction**: Automatic extraction of people, places, dates, and objects mentioned in documents
- **Geographic Visualization**: Interactive map showing locations mentioned in documents (powered by Leaflet)
- **Timeline Visualization**: Visual timeline of dates referenced in documents
- **False Redaction Detection**: Detect hidden text under visual redactions in PDFs
- **Correspondence Support**: Special handling for letters with From/To information
- **Search**: Live search across document content, entities, and metadata within collections
- **Real-time Processing**: Monitor document processing progress with a minimizable status indicator

## Project Structure

```
document-viewer/
├── client/                 # Next.js frontend application
│   ├── app/               # App Router pages and API routes
│   ├── components/        # React components
│   └── lib/               # Utilities and database client
├── prisma/                # Database schema and migrations
├── scripts/               # Utility scripts
├── server/                # Backend services (news-scraper, text-analysis)
└── shared/                # Shared types and utilities
```

## Prerequisites

- Node.js 18+
- PostgreSQL 12+
- [Document Analysis Tool](https://github.com/your-repo/document-analysis-tool) running on `localhost:3001`

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-repo/document-viewer.git
   cd document-viewer
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   
   Copy the example environment file and update the values:
   ```bash
   cp .env.example .env
   ```

   Key environment variables:
   ```env
   # Database connection
   DATABASE_URL="postgresql://postgres:password@localhost:5432/jfk_documents?schema=public"

   # Media source: 'local' uses Document Analysis Tool, 'remote' uses external API
   NEXT_PUBLIC_MEDIA_SOURCE=local

   # Document Analysis Tool API URL (required when NEXT_PUBLIC_MEDIA_SOURCE=local)
   DOCUMENT_ANALYZER_URL=http://localhost:3001
   ```

4. **Set up the database:**
   ```bash
   # Start PostgreSQL (if using Docker)
   npm run db:local

   # Generate Prisma client and run migrations
   npm run post
   npx prisma migrate dev
   ```

## Running the Application

### Development

```bash
# Start the client application
npm run dev:client
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### With Docker

```bash
# Start all services with Docker Compose
docker compose -f docker-compose.dev.yml up -d --build
```

## Usage

### Creating a Collection

1. Click "Create New Collection" in the sidebar
2. Select a folder or file to process
3. Choose OCR settings (Grok, DocTR, or TrOCR)
4. Optionally enable entity analysis and false redaction detection
5. Click "Start Processing"

The progress can be minimized to a floating indicator while processing continues in the background.

### Adding Files to an Existing Collection

1. Click the `...` menu next to a collection in the sidebar
2. Select "Add Files"
3. Choose files/folders to add and processing options

### Viewing Documents

- Click on any document to open the document viewer
- Navigate pages using the page selector
- View extracted entities (people, places, dates, objects) in the sidebar panels
- Explore the geographic map and timeline visualizations
- Use the "Sync" button to refresh document data from the analyzer

### Searching

On a collection page, use the search bar to filter documents by:
- Document title
- Summary content
- People mentioned
- Places mentioned
- Dates referenced

## Database Scripts

```bash
# Import documents from local analysis output
npm run db:import-local

# Update existing documents from local analysis
npm run db:update-local

# Reset database
npm run db:reset
```

## Technology Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS
- **UI Components**: Radix UI, Lucide Icons, Framer Motion
- **Maps**: Leaflet, React-Leaflet
- **Charts**: Recharts, D3.js
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: Server-Sent Events (SSE) for processing updates

## API Routes

The application includes several API endpoints:

- `/api/docs/documents/[id]` - Get document details
- `/api/docs/documents/[id]/sync` - Sync document from analyzer
- `/api/docs/document-status` - List documents with filtering
- `/api/docs/document-groups` - Get available collections
- `/api/docs/sync-all` - Bulk sync all documents
- `/api/analyzer-proxy/[...path]` - Proxy requests to Document Analysis Tool
- `/api/filesystem/browse` - Browse local filesystem for file selection

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
