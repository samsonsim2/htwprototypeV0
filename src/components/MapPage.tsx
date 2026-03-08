import React, { useState, useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  Circle,
  CircleMarker,
  Polyline,
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

type RoutePathProps = {
  pins: LocationPin[];
};

function RoutePath({ pins }: RoutePathProps) {
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [fallbackPoints, setFallbackPoints] = useState<[number, number][]>([]);

  useEffect(() => {
    let isCancelled = false;

    async function buildRoute() {
      if (pins.length < 2) {
        setRoutePoints([]);
        setFallbackPoints([]);
        return;
      }

      const fallback = pins.map((pin) => [pin.lat, pin.lng] as [number, number]);
      setFallbackPoints(fallback);

      try {
        const allPoints: [number, number][] = [];

        for (let i = 0; i < pins.length - 1; i++) {
          const start = pins[i];
          const end = pins[i + 1];

          const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
          const url = `https://router.project-osrm.org/route/v1/foot/${coordinates}?overview=full&geometries=geojson`;

          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`OSRM request failed for leg ${i + 1}`);
          }

          const data = await res.json();
          const coords = data?.routes?.[0]?.geometry?.coordinates;

          if (!coords || !Array.isArray(coords) || coords.length === 0) {
            throw new Error(`No route geometry returned for leg ${i + 1}`);
          }

          const latLngs = coords.map(
            ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
          );

          if (i === 0) {
            allPoints.push(...latLngs);
          } else {
            allPoints.push(...latLngs.slice(1));
          }
        }

        if (!isCancelled) {
          setRoutePoints(allPoints);
        }
      } catch (err) {
        console.error('Failed to build routed walking path:', err);
        if (!isCancelled) {
          setRoutePoints([]);
        }
      }
    }

    buildRoute();

    return () => {
      isCancelled = true;
    };
  }, [pins]);

  if (routePoints.length > 1) {
    return (
      <>
        <Polyline
          positions={routePoints}
          pathOptions={{
            color: '#ffffff',
            weight: 8,
            opacity: 0.9,
          }}
        />
        <Polyline
          positions={routePoints}
          pathOptions={{
            color: '#ef4444',
            weight: 5,
            opacity: 1,
          }}
        />
      </>
    );
  }

  if (fallbackPoints.length > 1) {
    return (
      <Polyline
        positions={fallbackPoints}
        pathOptions={{
          color: '#ef4444',
          weight: 4,
          opacity: 0.7,
          dashArray: '8, 10',
        }}
      />
    );
  }

  return null;
}

function FitRouteBounds({ pins }: { pins: LocationPin[] }) {
  const map = useMap();

  useEffect(() => {
    if (!pins.length) return;

    const bounds = L.latLngBounds(pins.map((pin) => [pin.lat, pin.lng] as [number, number]));
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
            title="Recenter to my location"
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
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadingAudiosRef = useRef<HTMLAudioElement[]>([]);
  const fadeIntervalsRef = useRef<number[]>([]);

  const fadeOutAndStopAudio = (audioEl: HTMLAudioElement, duration = 10000) => {
    const startVolume = audioEl.volume;
    const steps = 20;
    const intervalMs = duration / steps;
    let step = 0;

    const intervalId = window.setInterval(() => {
      step += 1;
      const nextVolume = Math.max(0, startVolume * (1 - step / steps));
      audioEl.volume = nextVolume;

      if (step >= steps) {
        window.clearInterval(intervalId);
        audioEl.pause();
        audioEl.currentTime = 0;
        audioEl.src = '';
        audioEl.load();

        fadingAudiosRef.current = fadingAudiosRef.current.filter((a) => a !== audioEl);
        fadeIntervalsRef.current = fadeIntervalsRef.current.filter((id) => id !== intervalId);
      }
    }, intervalMs);

    fadeIntervalsRef.current.push(intervalId);
  };

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
      if (audioRef.current && !audioRef.current.paused && audioRef.current.src) {
        const oldAudio = new Audio(audioRef.current.src);
        oldAudio.currentTime = audioRef.current.currentTime;
        oldAudio.volume = audioRef.current.volume || 1;

        oldAudio
          .play()
          .then(() => {
            fadingAudiosRef.current.push(oldAudio);
            fadeOutAndStopAudio(oldAudio, 10000);
          })
          .catch((err) => {
            console.warn('Failed to create fading outgoing audio:', err);
          });

        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.volume = 1;
      }

      setProgress(0);
      setAudioError(null);
      setActivePin(closestPin);

      if (audioRef.current) {
        audioRef.current.src = closestPin.audioUrl;
        audioRef.current.volume = 1;
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn('Auto-play blocked or failed:', err);
            setIsPlaying(false);
          });
      }
    }
  }, [userPos, pins, activePin, hasStarted]);

  useEffect(() => {
    return () => {
      fadeIntervalsRef.current.forEach((id) => window.clearInterval(id));
      fadeIntervalsRef.current = [];

      fadingAudiosRef.current.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
      });
      fadingAudiosRef.current = [];
    };
  }, []);

  const handleStart = () => {
    setHasStarted(true);
    if (audioRef.current) {
      audioRef.current
        .play()
        .then(() => {
          audioRef.current?.pause();
        })
        .catch(() => {});
    }
  };

  const toggleAudio = () => {
    if (!audioRef.current || !activePin) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (
        audioRef.current.src !== window.location.origin + activePin.audioUrl &&
        !audioRef.current.src.endsWith(activePin.audioUrl)
      ) {
        audioRef.current.src = activePin.audioUrl;
      }

      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error('Play failed:', err));
    }
  };

  const restartAudio = () => {
    if (!audioRef.current || !activePin) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch((err) => console.error('Restart failed:', err));
    setIsPlaying(true);
  };

  return (
    <div className="relative w-full h-full bg-zinc-950">
      <div className="absolute top-0 left-0 right-0 z-[1000] p-4 bg-gradient-to-b from-black/90 to-transparent pointer-events-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
              <Navigation className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">GeoGuide</h1>
              <p className="text-emerald-400 text-[10px] font-medium uppercase tracking-wider">
                Audio Explorer
              </p>
            </div>
          </div>

          <Link
            to="/configurelocation"
            className="pointer-events-auto w-9 h-9 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </div>

      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[1.370050598938354, 103.84907773928799]}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          <FitRouteBounds pins={pins} />
          <LocationMarker setUserPos={setUserPos} />
          <RoutePath pins={pins} />

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

      <AnimatePresence>
        {activePin && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-6 left-4 right-4 z-[1000] pointer-events-none"
          >
            <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl pointer-events-auto">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="text-blue-400 w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 text-[9px] font-bold uppercase tracking-widest">
                      Nearby Discovery
                    </span>
                  </div>
                  <h2 className="text-white font-bold text-lg mt-0.5 truncate">{activePin.name}</h2>
                  {audioError && (
                    <p className="text-red-400 text-[10px] mt-1 font-medium">{audioError}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={toggleAudio}
                  className={`flex-1 flex items-center justify-center gap-3 py-3.5 rounded-2xl font-bold transition-all active:scale-95 ${
                    isPlaying
                      ? 'bg-zinc-800 text-white border border-white/10'
                      : 'bg-emerald-500 text-zinc-950 shadow-lg'
                  }`}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current" />
                  )}
                  <span>{isPlaying ? 'Pause Audio' : 'Play Audio'}</span>
                </button>

                <button
                  onClick={restartAudio}
                  className="w-14 flex items-center justify-center bg-zinc-800 text-white border border-white/10 rounded-2xl transition-all active:scale-95 hover:bg-zinc-700"
                  title="Restart Audio"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>

              {isPlaying && (
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${progress}%` }}
                      className="h-full bg-emerald-500 transition-[width] duration-300 ease-linear"
                    />
                  </div>
                  <Volume2 className="w-4 h-4 text-emerald-500 animate-pulse" />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={(e) => {
          const audio = e.currentTarget;
          if (audio.duration) {
            setProgress((audio.currentTime / audio.duration) * 100);
          }
        }}
        onError={(e) => {
          console.error('Audio playback error:', e);
          setIsPlaying(false);
          setProgress(0);
          setAudioError('Failed to load audio file. Please check if the file exists.');
        }}
        className="hidden"
      />

      {!hasStarted && (
        <div className="absolute inset-0 z-[2000] bg-zinc-950 flex flex-col items-center justify-center p-8 text-center">
          <div className="max-w-xs">
            {userPos ? (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
                  <Play className="text-emerald-500 w-10 h-10 fill-current ml-1" />
                </div>
                <h2 className="text-white text-2xl font-bold mb-3">Ready to Explore?</h2>
                <p className="text-zinc-400 text-sm mb-10">
                  We&apos;ve found your location. Tap below to start your audio-guided tour.
                </p>

                <button
                  onClick={handleStart}
                  className="w-full py-4 bg-emerald-500 text-zinc-950 rounded-2xl text-base font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  Start Tour
                </button>
              </motion.div>
            ) : (
              <>
                <Navigation className="text-blue-400 w-12 h-12 animate-bounce mx-auto mb-6" />
                <h2 className="text-white text-xl font-bold mb-2">Finding your location</h2>
                <p className="text-zinc-400 text-sm mb-8">
                  Please allow GPS access to start your tour.
                </p>

                <button
                  onClick={() => setUserPos([1.370050598938354, 103.84907773928799])}
                  className="px-6 py-3 bg-zinc-800 text-white rounded-xl text-sm font-medium border border-white/10"
                >
                  Skip &amp; Use Default Location
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}