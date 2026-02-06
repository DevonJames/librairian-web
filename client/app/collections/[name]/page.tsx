"use client";

import React, { useState, useEffect, use, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Calendar, Users, MapPin, Search, X, EyeOff, Plus, ListPlus, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreateCollectionDialog } from '@/components/create-collection-dialog';
import { useDocumentDock, DocumentItem } from '@/lib/context/DocumentDockContext';

interface FalseRedactions {
  found: boolean;
  pageCount?: number;
  totalHiddenWords?: number;
}

interface Document {
  id: string;
  title: string;
  summary?: string;
  pageCount?: number;
  documentType?: string;
  documentGroup?: string;
  allNames?: string[];
  allPlaces?: string[];
  allDates?: string[];
  earliestDate?: string;
  latestDate?: string;
  falseRedactions?: FalseRedactions;
}

export default function CollectionPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const collectionName = decodeURIComponent(name);
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [addFilesDialogOpen, setAddFilesDialogOpen] = useState(false);
  
  // Document queue functionality
  const { queue, addToQueue } = useDocumentDock();
  
  // Check if a document is in the queue
  const isInQueue = useCallback((docId: string) => {
    return queue.some(item => item.id === docId);
  }, [queue]);
  
  // Add document to queue
  const handleAddToQueue = useCallback((doc: Document, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation when clicking the button
    e.stopPropagation();
    
    const docItem: DocumentItem = {
      id: doc.id,
      title: doc.title || doc.id,
      url: `/documents/${doc.id}`,
      type: 'document',
      excerpt: doc.summary,
    };
    
    addToQueue(docItem);
  }, [addToQueue]);

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/docs/document-status?groups=${encodeURIComponent(collectionName)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.status}`);
      }
      
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('Error fetching collection documents:', err);
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, [collectionName]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);
  
  // Convert collection name to title case for display
  const displayName = collectionName.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Check if a document matches the search query
  const matchesQuery = useCallback((doc: Document, query: string): boolean => {
    if (!query) return true;
    const q = query.toLowerCase();
    
    if (doc.title?.toLowerCase().includes(q)) return true;
    if (doc.summary?.toLowerCase().includes(q)) return true;
    if (doc.allNames?.some(name => name.toLowerCase().includes(q))) return true;
    if (doc.allPlaces?.some(place => place.toLowerCase().includes(q))) return true;
    if (doc.allDates?.some(date => date.toLowerCase().includes(q))) return true;
    if (doc.id?.toLowerCase().includes(q)) return true;
    
    return false;
  }, []);

  // Filter documents by search query
  const filteredDocuments = useMemo(() => {
    if (!debouncedQuery) return documents;
    return documents.filter(doc => matchesQuery(doc, debouncedQuery));
  }, [documents, debouncedQuery, matchesQuery]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return null;
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f9fafb',
      padding: '1.5rem'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link 
            href="/documents" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              color: '#6b7280',
              textDecoration: 'none'
            }}
          >
            <ArrowLeft style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.5rem' }} />
            Back
          </Link>
          <div>
            <h1 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              color: '#111827',
              margin: 0
            }}>
              {collectionName.toUpperCase()}
            </h1>
            <p style={{ 
              fontSize: '0.875rem', 
              color: '#6b7280',
              margin: '0.25rem 0 0 0'
            }}>
              {debouncedQuery 
                ? `${filteredDocuments.length} of ${documents.length} documents`
                : `${documents.length} document${documents.length !== 1 ? 's' : ''} in this collection`
              }
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Add Files Button */}
          <button
            onClick={() => setAddFilesDialogOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            <Plus style={{ width: '1rem', height: '1rem' }} />
            Add Files
          </button>
          
          {/* Search */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            padding: '0.5rem 0.75rem',
            width: '300px'
          }}>
            <Search style={{ width: '1rem', height: '1rem', color: '#9ca3af', marginRight: '0.5rem', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search people, places, dates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: '0.875rem'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9ca3af',
                  flexShrink: 0
                }}
                title="Clear search"
              >
                <X style={{ width: '1rem', height: '1rem' }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          height: '200px',
          color: '#6b7280'
        }}>
          Loading documents...
        </div>
      ) : error ? (
        <div style={{ 
          backgroundColor: '#fef2f2', 
          border: '1px solid #fecaca',
          borderRadius: '0.5rem',
          padding: '1rem',
          color: '#dc2626'
        }}>
          {error}
        </div>
      ) : filteredDocuments.length === 0 && debouncedQuery ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem',
          color: '#6b7280'
        }}>
          No documents match your search for &quot;{debouncedQuery}&quot;
        </div>
      ) : documents.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem',
          color: '#6b7280'
        }}>
          No documents in this collection.
        </div>
      ) : (
        <>
          {/* Search results info - always takes up space to prevent layout shift */}
          <div style={{
            marginBottom: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: debouncedQuery ? '#eff6ff' : 'transparent',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            color: '#1d4ed8',
            opacity: debouncedQuery ? 1 : 0,
            transition: 'opacity 0.2s, background-color 0.2s',
            minHeight: '2.25rem', // Reserve space even when hidden
          }}>
            {debouncedQuery 
              ? `Showing ${filteredDocuments.length} of ${documents.length} documents matching "${debouncedQuery}"`
              : '\u00A0' // Non-breaking space to maintain height
            }
          </div>
          
          {/* Document Grid with Framer Motion */}
          <motion.div
            layout
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '1rem',
            }}
          >
            <AnimatePresence mode="popLayout">
              {filteredDocuments.map((doc) => (
                <motion.div
                  key={doc.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    // Slow fade out for exiting items
                    opacity: { duration: 0.4, ease: "easeOut" },
                    scale: { duration: 0.4, ease: "easeOut" },
                    // Smooth spring for layout changes (slide into place)
                    layout: { 
                      type: "spring", 
                      stiffness: 300, 
                      damping: 30,
                      // Delay the slide until well after fade completes
                      delay: 0.5
                    }
                  }}
                >
                  <Link
                    href={`/documents/${doc.id}`}
                    style={{ textDecoration: 'none', display: 'block', height: '100%' }}
                  >
                    <motion.div
                      whileHover={{ 
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        borderColor: '#3b82f6'
                      }}
                      style={{
                        backgroundColor: 'white',
                        borderRadius: '0.5rem',
                        border: '1px solid #e5e7eb',
                        padding: '1rem',
                        cursor: 'pointer',
                        height: '100%'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{
                          backgroundColor: debouncedQuery ? '#dcfce7' : '#eff6ff',
                          borderRadius: '0.5rem',
                          padding: '0.5rem',
                          flexShrink: 0,
                          transition: 'background-color 0.2s'
                        }}>
                          <FileText style={{ 
                            width: '1.5rem', 
                            height: '1.5rem', 
                            color: debouncedQuery ? '#16a34a' : '#3b82f6',
                            transition: 'color 0.2s'
                          }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{ 
                            fontSize: '0.875rem', 
                            fontWeight: '600', 
                            color: '#111827',
                            margin: '0 0 0.25rem 0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {doc.title || `Document ${doc.id}`}
                          </h3>
                          <p style={{ 
                            fontSize: '0.75rem', 
                            color: '#9ca3af',
                            margin: '0 0 0.5rem 0'
                          }}>
                            {doc.id}
                          </p>
                          
                          {doc.summary && (
                            <p style={{ 
                              fontSize: '0.75rem', 
                              color: '#6b7280',
                              margin: '0 0 0.5rem 0',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>
                              {doc.summary}
                            </p>
                          )}

                          <div style={{ 
                            display: 'flex', 
                            flexWrap: 'wrap',
                            gap: '0.5rem',
                            fontSize: '0.7rem',
                            color: '#6b7280'
                          }}>
                            {doc.pageCount && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <FileText style={{ width: '0.75rem', height: '0.75rem' }} />
                                {doc.pageCount} pages
                              </span>
                            )}
                            {doc.allNames && doc.allNames.length > 0 && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Users style={{ width: '0.75rem', height: '0.75rem' }} />
                                {doc.allNames.length} people
                              </span>
                            )}
                            {doc.allPlaces && doc.allPlaces.length > 0 && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <MapPin style={{ width: '0.75rem', height: '0.75rem' }} />
                                {doc.allPlaces.length} places
                              </span>
                            )}
                            {doc.falseRedactions?.found && (
                              <span style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.25rem',
                                color: '#dc2626',
                                fontWeight: 500
                              }}>
                                <EyeOff style={{ width: '0.75rem', height: '0.75rem' }} />
                                {doc.falseRedactions.totalHiddenWords || doc.falseRedactions.pageCount} hidden
                              </span>
                            )}
                            {(doc.earliestDate || doc.latestDate) && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Calendar style={{ width: '0.75rem', height: '0.75rem' }} />
                                {formatDate(doc.earliestDate) || formatDate(doc.latestDate)}
                              </span>
                            )}
                          </div>
                          
                          {/* Add to Queue Button */}
                          <button
                            onClick={(e) => handleAddToQueue(doc, e)}
                            disabled={isInQueue(doc.id)}
                            style={{
                              marginTop: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              padding: '0.375rem 0.625rem',
                              fontSize: '0.7rem',
                              fontWeight: 500,
                              borderRadius: '0.375rem',
                              border: 'none',
                              cursor: isInQueue(doc.id) ? 'default' : 'pointer',
                              backgroundColor: isInQueue(doc.id) ? '#dcfce7' : '#f3f4f6',
                              color: isInQueue(doc.id) ? '#16a34a' : '#4b5563',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isInQueue(doc.id)) {
                                e.currentTarget.style.backgroundColor = '#e5e7eb';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isInQueue(doc.id)) {
                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                              }
                            }}
                          >
                            {isInQueue(doc.id) ? (
                              <>
                                <Check style={{ width: '0.75rem', height: '0.75rem' }} />
                                In Queue
                              </>
                            ) : (
                              <>
                                <ListPlus style={{ width: '0.75rem', height: '0.75rem' }} />
                                Add to Queue
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </>
      )}
      
      {/* Add Files Dialog */}
      <CreateCollectionDialog
        open={addFilesDialogOpen}
        onOpenChange={setAddFilesDialogOpen}
        onSuccess={fetchDocuments}
        existingCollectionName={displayName}
      />
    </div>
  );
}
