// Utility functions for document handling
// These functions were extracted from app/documents/page.tsx

/**
 * Get the media source setting
 * Must be read dynamically for client-side to work properly
 */
const getMediaSource = (): string => {
  // Check if we're in browser or server
  if (typeof window !== 'undefined') {
    // Client-side: read from window or process.env
    return process.env.NEXT_PUBLIC_MEDIA_SOURCE || 'local';
  }
  // Server-side
  return process.env.NEXT_PUBLIC_MEDIA_SOURCE || 'local';
};

const getApiBaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_URL || 'https://api.oip.onl';
};

/**
 * Get the document analyzer URL (for local mode)
 */
const getDocumentAnalyzerUrl = (): string => {
  return process.env.NEXT_PUBLIC_DOCUMENT_ANALYZER_URL || 'http://localhost:3001';
};

/**
 * Check if we should use local media serving
 */
export const isLocalMediaSource = (): boolean => {
  const source = getMediaSource();
  console.log('[docUtils] Media source:', source);
  return source === 'local';
};

/**
 * Build media URL based on configuration
 * When local, uses the document analyzer API (localhost:3001)
 * When remote, uses the external API
 */
export const buildMediaUrl = (
  id: string, 
  type: 'image' | 'analysis' | 'pdf', 
  options?: { 
    filename?: string; 
    collection?: string;
    getLatestPageData?: boolean;
    pageNumber?: number;
  }
): string => {
  const cleanId = id.replace(/^\/+/, '');
  
  if (isLocalMediaSource()) {
    // Use the local proxy to avoid CORS issues
    // Proxy route: /api/analyzer-proxy/[...path] -> http://localhost:3001/api/[...path]
    
    if (type === 'image') {
      // Extract page number from filename (e.g., "page-01.png" -> 1)
      let pageNum = options?.pageNumber || 1;
      if (options?.filename) {
        const match = options.filename.match(/page-?(\d+)/i);
        if (match) {
          pageNum = parseInt(match[1], 10);
        }
      }
      return `/api/analyzer-proxy/documents/${cleanId}/images/${pageNum}`;
    }
    
    if (type === 'analysis') {
      // Document metadata endpoint
      return `/api/analyzer-proxy/documents/${cleanId}`;
    }
    
    if (type === 'pdf') {
      // For PDF, there's no direct endpoint in the analyzer
      // Return the metadata endpoint for now
      return `/api/analyzer-proxy/documents/${cleanId}`;
    }
    
    return `/api/analyzer-proxy/documents/${cleanId}`;
  }
  
  // Use remote API
  const params = new URLSearchParams({
    id: cleanId,
    type,
  });
  
  if (options?.filename) {
    params.set('filename', options.filename);
  }
  if (options?.collection) {
    params.set('collection', options.collection);
  }
  if (options?.getLatestPageData) {
    params.set('getLatestPageData', 'true');
  }
  
  return `${getApiBaseUrl()}/api/docs/media?${params.toString()}`;
};

// Get the URL for viewing a document in the app
export const getDocumentAppUrl = (documentId: string): string => {
  return `documents/${documentId}`;
};

// Get the URL for the document's JSON data
export const getDocumentJsonUrl = (frontendId: string, documentIdMap: Record<string, string>): string | null => {
  const backendId = documentIdMap[frontendId];
  if (!backendId) return null;
  return buildMediaUrl(backendId, 'analysis');
};

// Get the URL for a specific page image of a document
export const getDocumentPageUrl = (frontendId: string, pageNum: number, documentIdMap: Record<string, string>): string | null => {
  const backendId = documentIdMap[frontendId];
  if (!backendId) return null;
  return buildMediaUrl(backendId, 'image', { filename: `page-${pageNum}.png` });
};

// Get the URL for downloading the document's PDF
export const getDocumentPdfUrl = (frontendId: string, documentIdMap: Record<string, string>): string | null => {
  const backendId = documentIdMap[frontendId];
  if (!backendId) return null;
  return buildMediaUrl(backendId, 'pdf');
};

// Get the archives.gov source URL for a document
export const getArchivesGovUrl = (documentId: string, releaseDate?: string, documentType: string = 'jfk'): string => {
  // Check if this is an RFK document by either explicit type or ID
  const isRfk = documentType === 'rfk' || documentId.toLowerCase().includes('rfk');
  
  if (isRfk) {
    // RFK documents use a different URL pattern with 2025/0418 release path
    const rfkReleasePath = '2025/0418';
    return `https://www.archives.gov/files/research/rfk/releases/${rfkReleasePath}/${documentId}.pdf`;
  }
  
  // For JFK documents, use the existing logic
  // Default release path for March 18, 2025
  let releasePath = '0318';
  
  // If we have a release date, parse it
  if (releaseDate) {
    try {
      const date = new Date(releaseDate);
      // Format the month and day as MM/DD
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      releasePath = month + day;
    } catch (e) {
      console.error('Error parsing release date:', e);
      // Fall back to default
    }
  } else {
    // If no release date provided, try to determine from known release patterns
    // April 3 release IDs tend to be higher ranges (experimental)
    // This is a temporary solution - ideally we should store and look up the release date
    const isAprilRelease = documentId.startsWith('2023') || documentId.startsWith('2021');
    if (isAprilRelease) {
      releasePath = '0403';
    }
  }
  
  return `https://www.archives.gov/files/research/jfk/releases/2025/${releasePath}/${documentId}.pdf`;
};

// Format a date string for display
export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (e) {
    return dateString;
  }
};

// Calculate the progress percentage for a given status type
export const getProgressPercentage = (statusType: string, documents: any[]): number => {
  let count;
  
  if (statusType === 'ready' || statusType === 'waitingForAnalysis') {
    // For final states, use status
    count = documents.filter(d => d.status === statusType).length;
  } else {
    // For processing states, use processingStatus
    count = documents.filter(d => d.processingStatus === statusType).length;
  }
  
  return (count / (documents.length || 1)) * 100;
};

export const getAnalysisUrl = (id: string, options?: { collection?: string; getLatestPageData?: boolean }): string => {
  return buildMediaUrl(id, 'analysis', options);
};

export const getImageUrl = (id: string, pageNum: number, collection?: string): string => {
  return buildMediaUrl(id, 'image', { 
    filename: `page-${pageNum}.png`,
    pageNumber: pageNum,
    collection 
  });
};

export const getPdfUrl = (id: string, collection?: string): string => {
  return buildMediaUrl(id, 'pdf', { collection });
}; 