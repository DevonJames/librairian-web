"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { Network, Clock, MapPin, Globe, Loader2 } from 'lucide-react';

// Leaflet types
import type { LatLngExpression } from 'leaflet';

interface CollectionOption {
  id: string;
  name: string;
  count: number;
}

interface PlaceData {
  place: string;
  document_count: number;
}

interface GeocodedPlace {
  name: string;
  lat: number;
  lng: number;
  displayName?: string;
  documentCount: number;
}

// Cache for geocoded results
const geocodeCache: Record<string, { lat: number; lng: number; displayName: string } | null> = {};

// Geocode a place using Nominatim
async function geocodePlace(placeName: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  if (geocodeCache[placeName.toLowerCase()] !== undefined) {
    return geocodeCache[placeName.toLowerCase()];
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'DocumentViewer/1.0'
        }
      }
    );

    if (!response.ok) {
      geocodeCache[placeName.toLowerCase()] = null;
      return null;
    }

    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
      geocodeCache[placeName.toLowerCase()] = result;
      return result;
    }

    geocodeCache[placeName.toLowerCase()] = null;
    return null;
  } catch (error) {
    console.error(`Error geocoding "${placeName}":`, error);
    geocodeCache[placeName.toLowerCase()] = null;
    return null;
  }
}

// Map component - dynamically loaded to avoid SSR issues
function MapComponent({ geocodedPlaces, isDark }: { geocodedPlaces: GeocodedPlace[]; isDark: boolean }) {
  const [components, setComponents] = useState<{
    MapContainer: any;
    TileLayer: any;
    Marker: any;
    Popup: any;
    useMap: any;
    L: any;
    icon: (num: number, count: number) => any;
  } | null>(null);

  useEffect(() => {
    const loadLeaflet = async () => {
      const L = await import('leaflet');
      const RL = await import('react-leaflet');
      
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const createNumberedIcon = (num: number, count: number) => {
        // Scale size based on document count
        const size = Math.min(40, Math.max(24, 20 + Math.log2(count + 1) * 4));
        return L.divIcon({
          className: 'custom-numbered-marker',
          html: `<div style="
            background-color: #ef4444;
            color: white;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: ${Math.max(10, size * 0.4)}px;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">${count}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [0, -size / 2]
        });
      };

      setComponents({
        MapContainer: RL.MapContainer,
        TileLayer: RL.TileLayer,
        Marker: RL.Marker,
        Popup: RL.Popup,
        useMap: RL.useMap,
        L: L,
        icon: createNumberedIcon
      });
    };

    loadLeaflet();
  }, []);

  if (!components) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: isDark ? '#1f2937' : '#f0f9ff'
      }}>
        <Loader2 className="animate-spin" size={24} />
        <span style={{ marginLeft: '0.5rem' }}>Loading map...</span>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, useMap, L, icon } = components;

  function AutoFitBounds() {
    const map = useMap();
    
    useEffect(() => {
      if (geocodedPlaces.length > 0) {
        const bounds = L.latLngBounds(
          geocodedPlaces.map((p: GeocodedPlace) => [p.lat, p.lng])
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
      }
    }, [map]);
    
    return null;
  }

  const defaultCenter: LatLngExpression = [20, 0];
  
  // Use dark or light tile layer based on theme
  const tileUrl = isDark 
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return (
    <MapContainer
      center={defaultCenter}
      zoom={2}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url={tileUrl}
      />
      <AutoFitBounds />
      {geocodedPlaces.map((place, index) => (
        <Marker
          key={`marker-${index}`}
          position={[place.lat, place.lng] as LatLngExpression}
          icon={icon(index + 1, place.documentCount)}
        >
          <Popup>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{place.name}</div>
            <div style={{ fontSize: '0.875rem', color: '#3b82f6' }}>
              {place.documentCount} document{place.documentCount !== 1 ? 's' : ''}
            </div>
            {place.displayName && (
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
                {place.displayName}
              </div>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default function GeographicMapVisualizationPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Collection filter state
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);
  
  // Map data state
  const [placesData, setPlacesData] = useState<PlaceData[]>([]);
  const [geocodedPlaces, setGeocodedPlaces] = useState<GeocodedPlace[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

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

  // Fetch places data
  useEffect(() => {
    const fetchPlaces = async () => {
      setIsLoadingPlaces(true);
      setError(null);
      
      try {
        // Build URL with collection filter
        let url = '/api/docs/connections?type=places';
        if (selectedCollections.length > 0) {
          url += `&collections=${selectedCollections.join(',')}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch places: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.results && Array.isArray(data.results)) {
          setPlacesData(data.results.slice(0, 25)); // Limit to 25 places
        } else {
          setPlacesData([]);
        }
      } catch (err) {
        console.error('Error fetching places:', err);
        setError(err instanceof Error ? err.message : 'Failed to load places');
      } finally {
        setIsLoadingPlaces(false);
      }
    };

    fetchPlaces();
  }, [selectedCollections]);

  // Geocode places when placesData changes
  useEffect(() => {
    const geocodePlaces = async () => {
      if (placesData.length === 0) {
        setGeocodedPlaces([]);
        return;
      }

      setIsGeocoding(true);
      setGeocodeProgress({ current: 0, total: placesData.length });
      
      const results: GeocodedPlace[] = [];

      for (let i = 0; i < placesData.length; i++) {
        const place = placesData[i];
        setGeocodeProgress({ current: i + 1, total: placesData.length });

        const coords = await geocodePlace(place.place);
        
        if (coords) {
          results.push({
            name: place.place,
            lat: coords.lat,
            lng: coords.lng,
            displayName: coords.displayName,
            documentCount: place.document_count
          });
        }

        // Rate limiting for Nominatim
        if (i < placesData.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setGeocodedPlaces(results);
      setIsGeocoding(false);
    };

    geocodePlaces();
  }, [placesData]);

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
          color: isDark ? '#9ca3af' : '#6b7280',
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
          color: '#3b82f6',
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
        {/* Leaflet CSS */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
          integrity="sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw=="
          crossOrigin="anonymous"
        />
        
        {isLoadingPlaces ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            gap: '1rem'
          }}>
            <Loader2 className="animate-spin" size={32} />
            <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Loading places data...</span>
          </div>
        ) : error ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            color: '#ef4444'
          }}>
            Error: {error}
          </div>
        ) : isGeocoding ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            gap: '1rem'
          }}>
            <Loader2 className="animate-spin" size={32} />
            <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
              Geocoding locations... ({geocodeProgress.current}/{geocodeProgress.total})
            </span>
            <div style={{ 
              width: '200px', 
              height: '8px', 
              backgroundColor: isDark ? '#374151' : '#e5e7eb', 
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: `${(geocodeProgress.current / geocodeProgress.total) * 100}%`, 
                height: '100%', 
                backgroundColor: '#22c55e',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        ) : geocodedPlaces.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            gap: '0.5rem',
            color: isDark ? '#9ca3af' : '#6b7280'
          }}>
            <MapPin size={48} />
            <span>No locations found{selectedCollections.length > 0 ? ' for selected collections' : ''}</span>
          </div>
        ) : (
          <MapComponent geocodedPlaces={geocodedPlaces} isDark={isDark} />
        )}
      </div>
      
      {/* Places list */}
      {geocodedPlaces.length > 0 && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.5rem',
          backgroundColor: isDark ? '#374151' : '#f9fafb',
          borderRadius: '0.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          maxHeight: '80px',
          overflow: 'auto'
        }}>
          {geocodedPlaces.map((place, idx) => (
            <span
              key={`place-tag-${idx}`}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`,
                borderRadius: '9999px',
                fontSize: '0.75rem',
                color: isDark ? '#e5e7eb' : '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <span style={{
                width: '1rem',
                height: '1rem',
                borderRadius: '9999px',
                backgroundColor: '#ef4444',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.5rem',
                fontWeight: 'bold'
              }}>
                {place.documentCount}
              </span>
              {place.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
