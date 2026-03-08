import React, { useState, useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  Circle,
  CircleMarker
} from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Volume2, Play, Pause, Settings, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { getStoredPins, LocationPin } from '../config';

// Fix for default marker icons
if (typeof L !== 'undefined' && L.Icon && L.Icon.Default) {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

const pinIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function FitRouteBounds({ pins }: { pins: LocationPin[] }) {
  const map = useMap();

  useEffect(() => {
    if (!pins.length) return;

    const bounds = L.latLngBounds(
      pins.map((pin) => [pin.lat, pin.lng] as [number, number])
    );

    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, pins]);

  return null;
}

function LocationMarker({ setUserPos }: { setUserPos: (pos: [number, number]) => void }) {
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const map = useMap();

  const handleRecenter = () => {
    if (position) {
      map.setView(position, 17);
    }
  };

  useEffect(() => {
    map.locate({ setView: true, maxZoom: 17 });

    const onLocationFound = (e: L.LocationEvent) => {
      setPosition(e.latlng);
      setUserPos([e.latlng.lat, e.latlng.lng]);
    };

    const onLocationError = (e: L.ErrorEvent) => {
      console.error('Location error:', e.message);
      const defaultPos = L.latLng(1.370050598938354, 103.84907773928799);
      setPosition(defaultPos);
      setUserPos([defaultPos.lat, defaultPos.lng]);
      map.setView(defaultPos, 15);
    };

    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = L.latLng(pos.coords.latitude, pos.coords.longitude);
        setPosition(newPos);
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => {
      map.off('locationfound', onLocationFound);
      map.off('locationerror', onLocationError);
      navigator.geolocation.clearWatch(watchId);
    };
  }, [map, setUserPos]);

  return position === null ? null : (
    <>
      <CircleMarker
        center={position}
        radius={8}
        pathOptions={{
          color: 'white',
          fillColor: '#3b82f6',
          fillOpacity: 1,
          weight: 3,
        }}
      >
        <Popup>You are here</Popup>
      </CircleMarker>

      <div
        className="leaflet-bottom leaflet-right !mb-24 !mr-4"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="leaflet-control">
          <button
            onClick={handleRecenter}
            className="w-12 h-12 bg-white rounded-xl shadow-lg flex items-center justify-center text-zinc-900 hover:bg-zinc-50 active:scale-95 transition-all border border-zinc-200"
          >
            <Navigation className="w-6 h-6 fill-current text-blue-500" />
          </button>
        </div>
      </div>
    </>
  );
}

export default function MapPage() {
  const [pins] = useState<LocationPin[]>(getStoredPins());
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [activePin, setActivePin] = useState<LocationPin | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!userPos || !hasStarted) return;

    const nearbyPins = pins
      .map((pin) => ({
        pin,
        distance: getDistance(userPos[0], userPos[1], pin.lat, pin.lng),
      }))
      .filter((item) => item.distance <= item.pin.radius)
      .sort((a, b) => a.distance - b.distance);

    const closestPin = nearbyPins.length > 0 ? nearbyPins[0].pin : null;

    if (closestPin && activePin?.id !== closestPin.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      setActivePin(closestPin);

      if (audioRef.current) {
        audioRef.current.src = closestPin.audioUrl;
        audioRef.current.play().then(() => setIsPlaying(true));
      }
    }
  }, [userPos, pins, activePin, hasStarted]);

  const handleStart = () => {
    setHasStarted(true);
  };

  return (
    <div className="relative w-full h-full bg-zinc-950">

      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[1.370050598938354, 103.84907773928799]}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          <FitRouteBounds pins={pins} />
          <LocationMarker setUserPos={setUserPos} />

          {pins.map((pin) => (
            <React.Fragment key={pin.id}>
              <Marker position={[pin.lat, pin.lng]} icon={pinIcon}>
                <Popup>
                  <div className="p-1">
                    <h3 className="font-bold text-zinc-900">{pin.name}</h3>
                    <p className="text-xs text-zinc-600 mt-1">{pin.description}</p>
                  </div>
                </Popup>
              </Marker>

              <Circle
                center={[pin.lat, pin.lng]}
                radius={pin.radius}
                pathOptions={{
                  color: activePin?.id === pin.id ? '#10b981' : '#94a3b8',
                  fillColor: activePin?.id === pin.id ? '#10b981' : '#94a3b8',
                  fillOpacity: 0.1,
                }}
              />
            </React.Fragment>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}