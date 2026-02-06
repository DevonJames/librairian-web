"use client";

import { useState, useEffect } from 'react';

// Leaflet types
import type { LatLngExpression } from 'leaflet';

interface LeafletMapVisualizationProps {
  places: string[];
}

interface GeocodedPlace {
  name: string;
  lat: number;
  lng: number;
  displayName?: string;
}

// Cache for geocoded results to avoid repeated API calls
const geocodeCache: Record<string, { lat: number; lng: number; displayName: string } | null> = {};

// Geocode a place name using Nominatim (OpenStreetMap's free geocoding service)
async function geocodePlace(placeName: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  // Check cache first
  if (geocodeCache[placeName.toLowerCase()] !== undefined) {
    return geocodeCache[placeName.toLowerCase()];
  }

  try {
    // Use Nominatim API with a reasonable delay to respect rate limits
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'DocumentViewer/1.0' // Required by Nominatim ToS
        }
      }
    );

    if (!response.ok) {
      console.warn(`Geocoding failed for "${placeName}": ${response.statusText}`);
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

// The actual map component - will be loaded dynamically to avoid SSR issues
function MapComponent({ geocodedPlaces }: { geocodedPlaces: GeocodedPlace[] }) {
  const [components, setComponents] = useState<{
    MapContainer: any;
    TileLayer: any;
    Marker: any;
    Popup: any;
    useMap: any;
    L: any;
    icon: (num: number) => any;
  } | null>(null);

  useEffect(() => {
    // Dynamically import Leaflet components on the client side
    const loadLeaflet = async () => {
      const L = await import('leaflet');
      const RL = await import('react-leaflet');
      
      // Fix Leaflet's default icon issue with webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      // Create custom numbered icon
      const createNumberedIcon = (num: number) => {
        return L.divIcon({
          className: 'custom-numbered-marker',
          html: `<div style="
            background-color: #ef4444;
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 12px;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">${num}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -14]
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
        backgroundColor: '#f0f9ff'
      }}>
        Loading map...
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, useMap, L, icon } = components;

  // Component to automatically fit bounds
  function AutoFitBounds() {
    const map = useMap();
    
    useEffect(() => {
      if (geocodedPlaces.length > 0) {
        const bounds = L.latLngBounds(
          geocodedPlaces.map((p: GeocodedPlace) => [p.lat, p.lng])
        );
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 });
      }
    }, [map]);
    
    return null;
  }

  // Default center for empty map
  const defaultCenter: LatLngExpression = [20, 0];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={2}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <AutoFitBounds />
      {geocodedPlaces.map((place, index) => (
        <Marker
          key={`marker-${index}`}
          position={[place.lat, place.lng] as LatLngExpression}
          icon={icon(index + 1)}
        >
          <Popup>
            <div style={{ fontWeight: 'bold' }}>{place.name}</div>
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

const LeafletMapVisualization = ({ places = [] }: LeafletMapVisualizationProps) => {
  const [geocodedPlaces, setGeocodedPlaces] = useState<GeocodedPlace[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ current: 0, total: 0 });
  const [failedPlaces, setFailedPlaces] = useState<string[]>([]);

  useEffect(() => {
    const geocodePlaces = async () => {
      if (places.length === 0) return;

      setIsGeocoding(true);
      const uniquePlaces = [...new Set(places.filter(Boolean))].slice(0, 15); // Limit to 15 places
      setGeocodeProgress({ current: 0, total: uniquePlaces.length });
      
      const results: GeocodedPlace[] = [];
      const failed: string[] = [];

      for (let i = 0; i < uniquePlaces.length; i++) {
        const place = uniquePlaces[i];
        setGeocodeProgress({ current: i + 1, total: uniquePlaces.length });

        const coords = await geocodePlace(place);
        
        if (coords) {
          results.push({
            name: place,
            lat: coords.lat,
            lng: coords.lng,
            displayName: coords.displayName
          });
        } else {
          failed.push(place);
        }

        // Rate limiting: wait 1 second between requests (Nominatim requires max 1 req/sec)
        if (i < uniquePlaces.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setGeocodedPlaces(results);
      setFailedPlaces(failed);
      setIsGeocoding(false);
    };

    geocodePlaces();
  }, [places.join(',')]); // Re-run when places change

  return (
    <div style={{ 
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      border: '2px solid #dcfce7', 
      borderRadius: '0.5rem', 
      overflow: 'hidden',
      backgroundColor: 'white'
    }}>
      {/* Map container */}
      <div style={{ 
        position: 'relative', 
        width: '100%',
        flex: 1,
        minHeight: '100px',
        overflow: 'hidden', 
        backgroundColor: '#f0f9ff' 
      }}>
        {isGeocoding ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Geocoding locations... ({geocodeProgress.current}/{geocodeProgress.total})
            </div>
            <div style={{ 
              width: '200px', 
              height: '8px', 
              backgroundColor: '#e5e7eb', 
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
        ) : geocodedPlaces.length > 0 ? (
          <MapComponent geocodedPlaces={geocodedPlaces} />
        ) : (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            color: '#6b7280'
          }}>
            No locations could be geocoded
          </div>
        )}
      </div>
      
      {/* Show failed places if any - compact */}
      {failedPlaces.length > 0 && (
        <div style={{ marginTop: '0.25rem', fontSize: '0.625rem', color: '#9ca3af', flexShrink: 0 }}>
          Not mapped: {failedPlaces.slice(0, 3).join(', ')}{failedPlaces.length > 3 ? ` +${failedPlaces.length - 3} more` : ''}
        </div>
      )}

      {/* Import Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
        integrity="sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw=="
        crossOrigin="anonymous"
      />
    </div>
  );
};

export default LeafletMapVisualization;
