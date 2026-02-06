"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import TimelineChart from '../../../components/visualizations/TimelineChart';
import { Network, Clock, MapPin, Globe, Loader2 } from 'lucide-react';

interface CollectionOption {
  id: string;
  name: string;
  count: number;
}

export default function TimelineVisualizationPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth - 40 : 960,
    height: typeof window !== 'undefined' ? window.innerHeight - 200 : 600,
  });
  
  // Collection filter state
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);

  // Track window resize
  useEffect(() => {
    function handleResize() {
      setDimensions({
        width: window.innerWidth - 40,
        height: window.innerHeight - 200,
      });
    }
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch available collections
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const response = await fetch('/api/docs/document-groups');
        if (response.ok) {
          const data = await response.json();
          if (data.groups && Array.isArray(data.groups)) {
            setCollections(data.groups);
          }
        }
      } catch (error) {
        console.error('Error fetching collections:', error);
      } finally {
        setIsLoadingCollections(false);
      }
    };

    fetchCollections();
  }, []);

  const handleCollectionToggle = useCallback((collectionId: string) => {
    setSelectedCollections(prev => {
      if (prev.includes(collectionId)) {
        return prev.filter(c => c !== collectionId);
      } else {
        return [...prev, collectionId];
      }
    });
  }, []);

  const clearCollectionFilters = useCallback(() => {
    setSelectedCollections([]);
  }, []);

  const handleBarClick = useCallback((date: string, count: number) => {
    console.log(`Clicked on date: ${date} with ${count} documents`);
    // Could navigate to a filtered view or show a modal with documents from this date
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      padding: '0.5rem',
      backgroundColor: isDark ? '#1f2937' : 'white',
      overflow: 'hidden'
    }}>
      <h1 style={{
        fontFamily: 'Arial, sans-serif',
        fontSize: '2rem',
        fontWeight: 500,
        letterSpacing: '0.2em',
        color: isDark ? '#f9fafb' : '#111827',
        marginBottom: '0.25rem'
      }}>
        LIBRΛIRIΛN
      </h1>
      
      {/* Navigation tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '0.25rem',
        padding: '0.25rem',
        borderBottom: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`
      }}>
        <Link href="/documents/visualizations" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          color: isDark ? '#9ca3af' : '#6b7280',
          textDecoration: 'none',
          fontSize: '0.875rem'
        }}>
          <Globe size={16} />
          Chronosphere
        </Link>
        <Link href="/documents/visualizations/network" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          color: isDark ? '#9ca3af' : '#6b7280',
          textDecoration: 'none',
          fontSize: '0.875rem'
        }}>
          <Network size={16} />
          Network Connections
        </Link>
        <Link href="/documents/visualizations/timelinechart" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          color: '#3b82f6',
          textDecoration: 'none',
          fontSize: '0.875rem'
        }}>
          <Clock size={16} />
          Timeline
        </Link>
        <Link href="/documents/visualizations/geographicmap" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          color: isDark ? '#9ca3af' : '#6b7280',
          textDecoration: 'none',
          fontSize: '0.875rem'
        }}>
          <MapPin size={16} />
          Geographic Map
        </Link>
      </div>

      {/* Collection filter */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '0.25rem',
        padding: '0.5rem',
        backgroundColor: isDark ? '#374151' : '#f9fafb',
        borderRadius: '0.5rem',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <span style={{ 
          fontSize: '0.875rem', 
          fontWeight: 500,
          color: isDark ? '#e5e7eb' : '#374151'
        }}>
          Filter by Collection:
        </span>
        
        {isLoadingCollections ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontSize: '0.75rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
              Loading collections...
            </span>
          </div>
        ) : collections.length === 0 ? (
          <span style={{ fontSize: '0.75rem', color: isDark ? '#9ca3af' : '#6b7280' }}>
            No collections found
          </span>
        ) : (
          <>
            {collections.map(collection => (
              <button
                key={collection.id}
                onClick={() => handleCollectionToggle(collection.id)}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`,
                  backgroundColor: selectedCollections.includes(collection.id) 
                    ? '#3b82f6' 
                    : (isDark ? '#1f2937' : '#ffffff'),
                  color: selectedCollections.includes(collection.id) 
                    ? '#ffffff' 
                    : (isDark ? '#e5e7eb' : '#374151'),
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {collection.name} ({collection.count})
              </button>
            ))}
            {selectedCollections.length > 0 && (
              <button
                onClick={clearCollectionFilters}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  border: `1px solid ${isDark ? '#ef4444' : '#fca5a5'}`,
                  backgroundColor: 'transparent',
                  color: '#ef4444',
                  cursor: 'pointer'
                }}
              >
                Clear filters
              </button>
            )}
          </>
        )}
      </div>
      
      {/* Visualization container */}
      <div style={{ 
        flex: 1,
        position: 'relative',
        width: '100%', 
        height: 'calc(100vh - 180px)',
        backgroundColor: isDark ? '#111827' : '#ffffff', 
        borderRadius: '0.5rem', 
        border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, 
        overflow: 'hidden'
      }}>
        <TimelineChart
          width={dimensions.width}
          height={dimensions.height}
          onBarClick={handleBarClick}
          collections={selectedCollections}
        />
      </div>
    </div>
  );
}
