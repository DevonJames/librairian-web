"use client"

import { useState, useRef, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, FolderOpen, FileText, Search, Minimize2, Maximize2, X } from "lucide-react"
import { createPortal } from "react-dom"
import { FileBrowser } from "@/components/file-browser"

interface CreateCollectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  /** If provided, the collection name field is pre-filled and hidden (for adding to existing collection) */
  existingCollectionName?: string
}

type InputType = 'file' | 'folder'
type OcrBackend = 'grok' | 'doctr' | 'trocr'

export function CreateCollectionDialog({ 
  open, 
  onOpenChange,
  onSuccess,
  existingCollectionName
}: CreateCollectionDialogProps) {
  const [inputType, setInputType] = useState<InputType>('folder')
  const [path, setPath] = useState('')
  const [collectionName, setCollectionName] = useState(existingCollectionName || '')
  const [recursive, setRecursive] = useState(true)
  const [ocrBackend, setOcrBackend] = useState<OcrBackend>('doctr')
  const [useGrokForAnalysis, setUseGrokForAnalysis] = useState(true)
  const [forceReprocess, setForceReprocess] = useState(false)
  const [findFalseRedactions, setFindFalseRedactions] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<{
    jobId: string | null
    status: string
    progress?: string
    currentIndex?: number
    totalFiles?: number
    skippedFiles?: number
    currentFile?: string
  } | null>(null)
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  
  // Keep track of active polling timeout for cleanup
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
    }
  }, [])

  const resetForm = () => {
    // Clear any active polling
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current)
      pollingTimeoutRef.current = null
    }
    setPath('')
    // Keep existing collection name if provided, otherwise reset
    setCollectionName(existingCollectionName || '')
    setRecursive(true)
    setOcrBackend('doctr')
    setUseGrokForAnalysis(true)
    setConvertToDocx(false)
    setForceReprocess(false)
    setFindFalseRedactions(false)
    setError(null)
    setJobStatus(null)
    setIsMinimized(false)
  }
  
  // Determine if we're adding to an existing collection
  const isAddingToExisting = Boolean(existingCollectionName)
  
  // Handle minimize/restore
  const handleMinimize = () => {
    setIsMinimized(true)
    onOpenChange(false) // Close the dialog visually
  }
  
  const handleRestore = () => {
    setIsMinimized(false)
    onOpenChange(true) // Reopen the dialog
  }
  
  // Calculate progress percentage
  const progressPercent = jobStatus?.totalFiles 
    ? Math.round(((jobStatus.currentIndex || 0) / jobStatus.totalFiles) * 100)
    : 0

  const handleSubmit = async () => {
    if (!path.trim()) {
      setError('Please enter a file or folder path')
      return
    }
    // Collection name validation only needed for new collections
    const effectiveCollectionName = existingCollectionName || collectionName.trim()
    if (!effectiveCollectionName) {
      setError('Please enter a collection name')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setJobStatus(null)

    try {
      // Determine the endpoint and payload based on input type
      const endpoint = inputType === 'file' 
        ? '/api/process/file' 
        : '/api/process'
      
      const payload: Record<string, unknown> = {
        backend: ocrBackend,
        collection: effectiveCollectionName,
      }

      if (inputType === 'file') {
        payload.filePath = path.trim()
      } else {
        payload.inputDir = path.trim()
        payload.recursive = recursive
      }

      // Add analyzeWith if using grok for analysis (and OCR is not already grok)
      if (ocrBackend !== 'grok' && useGrokForAnalysis) {
        payload.analyzeWith = 'grok'
      } else if (ocrBackend === 'grok') {
        // When using grok for OCR, it also does analysis
        payload.analyzeWith = 'grok'
      }

      // Add optional flags
      if (forceReprocess) {
        payload.force = true
      }
      if (findFalseRedactions) {
        payload.findFalseRedactions = true
      }

      console.log('Submitting to analyzer:', { endpoint, payload })

      // Call the document analyzer directly (or through proxy if needed)
      const response = await fetch(`/api/analyzer-proxy/process${inputType === 'file' ? '/file' : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Request failed: ${response.status}`)
      }

      setJobStatus({
        jobId: result.jobId,
        status: 'started',
        progress: 'Processing started...'
      })

      // Start polling for job status
      if (result.jobId) {
        pollJobStatus(result.jobId)
      }

    } catch (err) {
      console.error('Error starting collection:', err)
      setError(err instanceof Error ? err.message : 'Failed to start processing')
      setIsSubmitting(false)
    }
  }

  // Poll for job status using HTTP
  const pollJobStatus = async (jobId: string) => {
    console.log('[CreateCollection] Polling job status:', jobId)
    
    try {
      const response = await fetch(`/api/analyzer-proxy/process/status/${jobId}`)
      const status = await response.json()
      
      console.log('[CreateCollection] Poll response:', status)

      if (status.status === 'complete') {
        const processed = status.results?.length || 0
        const skipped = status.skippedFiles || 0
        const skippedMsg = skipped > 0 ? `, ${skipped} skipped` : ''
        setJobStatus({
          jobId,
          status: 'complete',
          progress: `Completed! Processed ${processed} document${processed !== 1 ? 's' : ''}${skippedMsg}.`,
          currentIndex: processed,
          totalFiles: processed + skipped,
          skippedFiles: skipped
        })
        setIsSubmitting(false)
        setIsMinimized(false) // Auto-restore when complete
        
        // Trigger sync to import documents into our database
        await syncNewDocuments()
        
        if (onSuccess) {
          onSuccess()
        }
      } else if (status.status === 'error' || status.status === 'failed') {
        setError(status.error || 'Processing failed')
        setIsSubmitting(false)
        setIsMinimized(false) // Auto-restore on error
      } else {
        // Still processing - build progress string with counts
        let progressMsg = 'Processing...'
        if (status.currentFile) {
          const processed = status.currentIndex || 0
          const total = status.totalFiles || '?'
          const skipped = status.skippedFiles ? ` (${status.skippedFiles} skipped)` : ''
          progressMsg = `Processing: ${status.currentFile} (${processed}/${total}${skipped})`
        }
        
        setJobStatus({
          jobId,
          status: 'processing',
          progress: progressMsg,
          currentIndex: status.currentIndex,
          totalFiles: status.totalFiles,
          skippedFiles: status.skippedFiles,
          currentFile: status.currentFile
        })

        // Continue polling
        pollingTimeoutRef.current = setTimeout(() => pollJobStatus(jobId), 2000)
      }
    } catch (err) {
      console.error('[CreateCollection] Error polling:', err)
      // Continue polling even on error
      pollingTimeoutRef.current = setTimeout(() => pollJobStatus(jobId), 3000)
    }
  }

  const syncNewDocuments = async () => {
    try {
      setJobStatus(prev => prev ? { ...prev, progress: 'Syncing documents to library...' } : null)
      await fetch('/api/docs/sync-all', { method: 'POST' })
    } catch (err) {
      console.error('Error syncing documents:', err)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm()
      onOpenChange(false)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isAddingToExisting ? `Add Files to "${existingCollectionName}"` : 'Create New Collection'}
          </DialogTitle>
          <DialogDescription>
            {isAddingToExisting 
              ? 'Process additional documents and add them to this collection.'
              : 'Process documents and add them to a new collection.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Input Type Selection */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={inputType === 'folder' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputType('folder')}
              className="flex-1"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Folder
            </Button>
            <Button
              type="button"
              variant={inputType === 'file' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputType('file')}
              className="flex-1"
            >
              <FileText className="w-4 h-4 mr-2" />
              Single File
            </Button>
          </div>

          {/* Path Input */}
          <div className="grid gap-2">
            <Label htmlFor="path">
              {inputType === 'file' ? 'File Path' : 'Folder Path'}
            </Label>
            <div className="flex gap-2">
              <Input
                id="path"
                placeholder={inputType === 'file' 
                  ? '/path/to/document.pdf' 
                  : '/path/to/documents/folder'
                }
                value={path}
                onChange={(e) => setPath(e.target.value)}
                disabled={isSubmitting}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setFileBrowserOpen(true)}
                disabled={isSubmitting}
              >
                <Search className="w-4 h-4 mr-2" />
                Browse
              </Button>
            </div>
          </div>

          {/* Recursive Checkbox (only for folders) */}
          {inputType === 'folder' && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="recursive"
                checked={recursive}
                onCheckedChange={(checked) => setRecursive(checked === true)}
                disabled={isSubmitting}
              />
              <Label htmlFor="recursive" className="text-sm font-normal">
                Include subfolders (recursive)
              </Label>
            </div>
          )}

          {/* Collection Name - only show when creating new */}
          {!isAddingToExisting && (
            <div className="grid gap-2">
              <Label htmlFor="collection">Collection Name</Label>
              <Input
                id="collection"
                placeholder="e.g., Tax Documents 2026"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          )}

          {/* OCR Backend Selection */}
          <div className="grid gap-2">
            <Label htmlFor="ocr">OCR Tool</Label>
            <Select 
              value={ocrBackend} 
              onValueChange={(value: OcrBackend) => setOcrBackend(value)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grok">
                  <div className="flex flex-col">
                    <span>Grok</span>
                    <span className="text-xs text-muted-foreground">Fastest, requires API key</span>
                  </div>
                </SelectItem>
                <SelectItem value="doctr">
                  <div className="flex flex-col">
                    <span>DocTR</span>
                    <span className="text-xs text-muted-foreground">Local, fast, great for text-only docs</span>
                  </div>
                </SelectItem>
                <SelectItem value="trocr">
                  <div className="flex flex-col">
                    <span>TrOCR</span>
                    <span className="text-xs text-muted-foreground">Local, slower but handles handwriting</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Use Grok for Analysis (only when OCR is not grok) */}
          {ocrBackend !== 'grok' && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="grokAnalysis"
                checked={useGrokForAnalysis}
                onCheckedChange={(checked) => setUseGrokForAnalysis(checked === true)}
                disabled={isSubmitting}
              />
              <Label htmlFor="grokAnalysis" className="text-sm font-normal">
                Use Grok for entity analysis (recommended)
              </Label>
            </div>
          )}

          {/* Force New Analysis */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="forceReprocess"
              checked={forceReprocess}
              onCheckedChange={(checked) => setForceReprocess(checked === true)}
              disabled={isSubmitting}
            />
            <Label htmlFor="forceReprocess" className="text-sm font-normal">
              Force new analysis (reprocess even if already analyzed)
            </Label>
          </div>

          {/* Attempt Unredaction */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="findFalseRedactions"
              checked={findFalseRedactions}
              onCheckedChange={(checked) => setFindFalseRedactions(checked === true)}
              disabled={isSubmitting}
            />
            <Label htmlFor="findFalseRedactions" className="text-sm font-normal">
              Attempt unredaction (detect hidden text under redactions)
            </Label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Job Status */}
          {jobStatus && (
            <div className={`text-sm p-3 rounded-md ${
              jobStatus.status === 'complete' 
                ? 'text-green-700 bg-green-50' 
                : 'text-blue-700 bg-blue-50'
            }`}>
              {/* Progress bar for processing state */}
              {jobStatus.status === 'processing' && jobStatus.totalFiles && (
                <div className="mb-2">
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs">
                    <span>{jobStatus.currentIndex || 0} / {jobStatus.totalFiles} files</span>
                    <span>{progressPercent}%</span>
                  </div>
                </div>
              )}
              {jobStatus.progress}
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {isSubmitting && jobStatus?.status !== 'complete' && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleMinimize}
                title="Minimize to background"
              >
                <Minimize2 className="w-4 h-4 mr-2" />
                Minimize
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleClose}
              disabled={isSubmitting}
            >
              {jobStatus?.status === 'complete' ? 'Close' : 'Cancel'}
            </Button>
            {jobStatus?.status !== 'complete' && (
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting || !path.trim() || (!isAddingToExisting && !collectionName.trim())}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Start Processing'
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      {/* File Browser Dialog */}
      <FileBrowser
        open={fileBrowserOpen}
        onOpenChange={setFileBrowserOpen}
        mode={inputType}
        onSelect={(selectedPath) => {
          setPath(selectedPath)
          setFileBrowserOpen(false)
        }}
        title={inputType === 'file' ? 'Select Document File' : 'Select Documents Folder'}
      />
    </Dialog>
    
    {/* Floating Progress Bar (when minimized) */}
    {isMinimized && isSubmitting && typeof document !== 'undefined' && createPortal(
      <div 
        className="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-80 cursor-pointer hover:shadow-xl transition-shadow"
        onClick={handleRestore}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="text-sm font-medium text-gray-900">
              Processing Documents
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={(e) => {
                e.stopPropagation()
                handleRestore()
              }}
              className="p-1 hover:bg-gray-100 rounded"
              title="Expand"
            >
              <Maximize2 className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        {/* Progress details */}
        <div className="flex justify-between items-center text-xs text-gray-600">
          <span>
            {jobStatus?.currentIndex || 0} / {jobStatus?.totalFiles || '?'} files
            {jobStatus?.skippedFiles ? ` (${jobStatus.skippedFiles} skipped)` : ''}
          </span>
          <span>{progressPercent}%</span>
        </div>
        
        {/* Current file */}
        {jobStatus?.currentFile && (
          <div className="mt-2 text-xs text-gray-500 truncate" title={jobStatus.currentFile}>
            {jobStatus.currentFile}
          </div>
        )}
        
        <div className="mt-2 text-xs text-gray-400 text-center">
          Click to expand
        </div>
      </div>,
      document.body
    )}
    </>
  )
}
