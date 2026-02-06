"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  Folder, 
  FileText, 
  ChevronUp, 
  Home, 
  Loader2,
  Check,
} from "lucide-react"

interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  isFile: boolean
  size?: number
  extension?: string
}

interface BrowseResponse {
  currentPath: string
  parentPath: string
  isFile: boolean
  items: FileInfo[]
  error?: string
}

interface FileBrowserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (path: string) => void
  mode: 'file' | 'folder'
  title?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileBrowser({ 
  open, 
  onOpenChange, 
  onSelect,
  mode,
  title,
}: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState('')
  const [pathInput, setPathInput] = useState('')
  const [items, setItems] = useState<FileInfo[]>([])
  const [parentPath, setParentPath] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const browse = useCallback(async (dirPath?: string) => {
    setIsLoading(true)
    setError(null)
    setSelectedPath(null)

    try {
      const params = new URLSearchParams()
      if (dirPath) params.set('path', dirPath)
      // For folder mode, don't show files
      if (mode === 'folder') params.set('showFiles', 'false')

      const response = await fetch(`/api/filesystem/browse?${params}`)
      const data: BrowseResponse = await response.json()

      if (data.error) {
        setError(data.error)
        return
      }

      setCurrentPath(data.currentPath)
      setPathInput(data.currentPath)
      setParentPath(data.parentPath)
      setItems(data.items)
    } catch (err) {
      console.error('Error browsing:', err)
      setError('Failed to browse directory')
    } finally {
      setIsLoading(false)
    }
  }, [mode])

  // Load initial directory when dialog opens
  useEffect(() => {
    if (open) {
      browse()
    }
  }, [open, browse])

  const handleItemClick = (item: FileInfo) => {
    if (item.isDirectory) {
      if (mode === 'folder') {
        // In folder mode, clicking a folder navigates into it
        // Double-click or select button confirms selection
        browse(item.path)
      } else {
        // In file mode, navigate into directories
        browse(item.path)
      }
    } else if (item.isFile && mode === 'file') {
      // In file mode, select the file
      setSelectedPath(item.path)
    }
  }

  const handleItemDoubleClick = (item: FileInfo) => {
    if (item.isDirectory) {
      browse(item.path)
    } else if (item.isFile && mode === 'file') {
      // Double-click on file confirms selection
      onSelect(item.path)
      onOpenChange(false)
    }
  }

  const handleGoUp = () => {
    if (parentPath && parentPath !== currentPath) {
      browse(parentPath)
    }
  }

  const handleGoHome = () => {
    browse()
  }

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pathInput.trim()) {
      browse(pathInput.trim())
    }
  }

  const handleSelect = () => {
    if (mode === 'folder') {
      // Select current directory
      onSelect(currentPath)
    } else if (selectedPath) {
      // Select the selected file
      onSelect(selectedPath)
    }
    onOpenChange(false)
  }

  const canSelect = mode === 'folder' || (mode === 'file' && selectedPath)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {title || (mode === 'folder' ? 'Select Folder' : 'Select File')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'folder' 
              ? 'Navigate to and select a folder containing documents.'
              : 'Navigate to and select a document file.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 flex-1 min-h-0">
          {/* Navigation bar */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleGoHome}
              disabled={isLoading}
              title="Go to home directory"
            >
              <Home className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleGoUp}
              disabled={isLoading || parentPath === currentPath}
              title="Go up one level"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <form onSubmit={handlePathSubmit} className="flex-1 flex gap-2">
              <Input
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                placeholder="/path/to/directory"
                className="flex-1 font-mono text-sm"
                disabled={isLoading}
              />
              <Button type="submit" variant="outline" disabled={isLoading}>
                Go
              </Button>
            </form>
          </div>

          {/* File list */}
          <div className="border rounded-md flex-1 min-h-[300px] bg-muted/30">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full text-red-500 text-sm p-4">
                {error}
              </div>
            ) : items.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {mode === 'folder' ? 'No subfolders in this directory' : 'No supported documents in this directory'}
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="p-1">
                  {items.map((item) => (
                    <button
                      key={item.path}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-md hover:bg-accent transition-colors ${
                        selectedPath === item.path ? 'bg-accent' : ''
                      }`}
                      onClick={() => handleItemClick(item)}
                      onDoubleClick={() => handleItemDoubleClick(item)}
                    >
                      {item.isDirectory ? (
                        <Folder className="h-5 w-5 text-blue-500 shrink-0" />
                      ) : (
                        <FileText className="h-5 w-5 text-gray-500 shrink-0" />
                      )}
                      <span className="flex-1 truncate text-sm">
                        {item.name}
                      </span>
                      {item.isFile && item.size !== undefined && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatFileSize(item.size)}
                        </span>
                      )}
                      {selectedPath === item.path && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Selection info */}
          <div className="text-sm text-muted-foreground">
            {mode === 'folder' ? (
              <span>
                Selected: <code className="bg-muted px-1 rounded">{currentPath}</code>
              </span>
            ) : selectedPath ? (
              <span>
                Selected: <code className="bg-muted px-1 rounded">{selectedPath}</code>
              </span>
            ) : (
              <span>Click a file to select it</span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={!canSelect}>
            {mode === 'folder' ? 'Select This Folder' : 'Select File'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
