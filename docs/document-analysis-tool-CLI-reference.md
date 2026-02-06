# Document Analysis Tool - CLI Reference

## Installation & Setup

```bash
# Install Node.js dependencies
npm install

# Set up Python virtual environment (for local OCR)
python3 -m venv .venv
source .venv/bin/activate
pip install "python-doctr[tf]" pillow transformers torch torchvision

# Configure API keys (create .env file)
echo "XAI_API_KEY=your-grok-api-key" > .env
```

---

## Commands

### `process` - Analyze Documents

Process one or more documents, extracting text and metadata.

```bash
node index.js process <input> [options]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `<input>` | Path to a file or directory to process |

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --output <dir>` | Output directory for results | `./output` |
| `-b, --backend <name>` | OCR backend to use | `doctr` |
| `-a, --analyze-with <provider>` | LLM provider for entity extraction | *(none - uses regex)* |
| `-c, --collection <name>` | Tag documents with a collection name | *(none)* |
| `-f, --force` | Force reprocessing even if already done | `false` |
| `-r, --recursive` | Recursively scan directories | `true` |
| `--no-recursive` | Do not scan subdirectories | — |
| `-v, --verbose` | Show detailed progress output | `false` |

**OCR Backends (`-b`):**

| Backend | Description | Requirements |
|---------|-------------|--------------|
| `doctr` | Local OCR, fast, good for printed text | Python + docTR |
| `trocr` | Local OCR, slower, better for handwriting | Python + TrOCR |
| `grok` | Cloud-based Grok Vision API | `XAI_API_KEY` |

**LLM Analyzers (`-a`):**

| Provider | Description | Environment Variable |
|----------|-------------|---------------------|
| `grok` | xAI Grok API | `XAI_API_KEY` |
| `openai` | OpenAI GPT API | `OPENAI_API_KEY` |
| `anthropic` | Anthropic Claude API | `ANTHROPIC_API_KEY` |

**Examples:**

```bash
# Basic processing with local OCR (doctr)
node index.js process ./documents/scan.pdf

# Process with LLM analysis for better entity extraction
node index.js process ./documents/letter.pdf --analyze-with grok

# Process entire folder with collection tag
node index.js process ./jfk-files --collection "JFK Files" -a grok

# Use TrOCR for handwritten documents
node index.js process ./handwritten-notes.jpg -b trocr -a grok

# Use Grok Vision for both OCR and analysis
node index.js process ./scan.pdf -b grok -a grok

# Force reprocess an already-processed document
node index.js process ./documents/scan.pdf --force

# Process directory non-recursively
node index.js process ./documents --no-recursive

# Custom output directory with verbose logging
node index.js process ./inbox -o ./processed -v
```

---

### `list` - List Processed Documents

Display all documents that have been processed.

```bash
node index.js list [options]
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --output <dir>` | Output directory to check | `./output` |

**Example:**

```bash
node index.js list
node index.js list -o ./my-output
```

---

### `check` - Check Backend Availability

Verify which OCR backends are available and properly configured.

```bash
node index.js check
```

**Example output:**

```
Checking OCR backend availability...

doctr:
  ✓ Available
  Python: /path/to/.venv/bin/python3

trocr:
  ✓ Available
  Python: /path/to/.venv/bin/python3

grok:
  ✓ Available (API key configured)
```

---

## Environment Variables

Create a `.env` file in the project root or set these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `XAI_API_KEY` | Grok API key (for grok backend/analyzer) | — |
| `OPENAI_API_KEY` | OpenAI API key (for openai analyzer) | — |
| `ANTHROPIC_API_KEY` | Anthropic API key (for anthropic analyzer) | — |
| `OUTPUT_DIR` | Default output directory | `./output` |
| `INPUT_DIR` | Default input directory | `./documents` |
| `DEFAULT_BACKEND` | Default OCR backend | `doctr` |
| `PYTHON_PATH` | Path to Python executable | `.venv/bin/python3` |
| `IMAGE_RESOLUTION` | PDF conversion DPI (72-600) | `300` |
| `PORT` | HTTP server port | `3000` |

**Example `.env` file:**

```bash
XAI_API_KEY=xai-xxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
OUTPUT_DIR=./output
DEFAULT_BACKEND=doctr
```

---

## Supported File Formats

| Category | Extensions |
|----------|------------|
| PDF | `.pdf` |
| Images | `.jpg`, `.jpeg`, `.png`, `.tiff`, `.tif`, `.gif`, `.webp`, `.bmp` |
| Office | `.docx`, `.doc`, `.odt`, `.rtf` |

---

## Typical Workflows

**Quick local processing (no API needed):**
```bash
node index.js process ./scan.pdf
```

**Best quality analysis (requires Grok API):**
```bash
node index.js process ./documents -a grok -c "My Collection"
```

**Batch processing a folder:**
```bash
node index.js process ./inbox --collection "January 2026" -a grok -v
```

**Processing handwritten documents:**
```bash
node index.js process ./handwritten.jpg -b trocr -a grok
```

**Resume interrupted processing:**
```bash
# Just run the same command again - already completed steps are skipped
node index.js process ./large-folder -a grok
```

---

## Output Structure

After processing, results are stored in the output directory:

```
output/
├── images/{hash}/          # Converted page images
├── analysis/{hash}/        # Per-page JSON analysis
├── analysis/{hash}-metadata.json    # Document metadata
├── analysis/{hash}-fulltext.txt     # Extracted text
└── analysis/document-manifest.json  # Document registry
```