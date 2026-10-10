import React, { useState, useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  Circle,
  Polyline,
} from 'react-leaflet';
import L from 'leaflet';
import { Navigation, Play, Pause, Settings, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { getStoredPins, LocationPin } from '../config';
import MagneticField from './MagneticField';
import usePlaybackField from './usePlaybackField';
import FieldDebugPanel, { DEFAULT_FIELD_SETTINGS } from './FieldDebugPanel';

const makeDotIcon = (colour: string, size = 10) => L.divIcon({
  className: 'soft-location-marker',
  html: `<span class="soft-location-dot" style="width:${size}px;height:${size}px;left:${(28 - size) / 2}px;top:${(28 - size) / 2}px;background:${colour};box-shadow:0 0 ${size * 0.4}px ${size * 0.2}px ${colour}99;filter:blur(${size * 0.08}px)"></span>`,
  iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -8],
});
const pinIcon = makeDotIcon('#FFE67D', 5);
const userIcon = makeDotIcon('#80C9FF');
const DEFAULT_ZOOM_BOOST = Math.log2(1.2);
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
  if (pins.length < 2) return null;

  const points = pins.map(pin => L.latLng(pin.lat, pin.lng));
  const positions: [number, number][] = [[points[0].lat, points[0].lng]];
  // Short quadratic bends soften corners without rounding away the route.
  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1], corner = points[i], next = points[i + 1];
    const incoming = corner.distanceTo(previous), outgoing = corner.distanceTo(next);
    if (incoming < 0.01 || outgoing < 0.01) {
      positions.push([corner.lat, corner.lng]);
      continue;
    }
    const trim = Math.min(80, incoming * 0.35, outgoing * 0.35);
    const ax = corner.lat + (previous.lat - corner.lat) * trim / incoming;
    const ay = corner.lng + (previous.lng - corner.lng) * trim / incoming;
    const bx = corner.lat + (next.lat - corner.lat) * trim / outgoing;
    const by = corner.lng + (next.lng - corner.lng) * trim / outgoing;
    for (let step = 0; step <= 20; step++) {
      const t = step / 20, u = 1 - t;
      positions.push([u * u * ax + 2 * u * t * corner.lat + t * t * bx,
        u * u * ay + 2 * u * t * corner.lng + t * t * by]);
    }
  }
  positions.push([points[points.length - 1].lat, points[points.length - 1].lng]);

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: '#000000',
        weight: 0.75,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }}
    />
  );
}

function FitRouteBounds({ pins }: { pins: LocationPin[] }) {
  const map = useMap();

  useEffect(() => {
    if (!pins.length) return;

    const bounds = L.latLngBounds(pins.map((pin) => [pin.lat, pin.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
    map.setZoom(map.getZoom() + DEFAULT_ZOOM_BOOST, { animate: false });
  }, [map, pins]);

  return null;
}

function LocationMarker({ setUserPos, visible }: { setUserPos: (pos: [number, number]) => void; visible: boolean }) {
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const map = useMap();

  const handleRecenter = () => {
    if (position) {
      map.setView(position, 17 + DEFAULT_ZOOM_BOOST);
    }
  };

  useEffect(() => {
    map.locate({ setView: true, maxZoom: 17 + DEFAULT_ZOOM_BOOST });

    const onLocationFound = (e: L.LocationEvent) => {
      setPosition(e.latlng);
      setUserPos([e.latlng.lat, e.latlng.lng]);
    };

    const onLocationError = (e: L.ErrorEvent) => {
      console.error('Location error:', e.message);
      const defaultPos = L.latLng(1.370050598938354, 103.84907773928799);
      setPosition(defaultPos);
      setUserPos([defaultPos.lat, defaultPos.lng]);
      map.setView(defaultPos, 15 + DEFAULT_ZOOM_BOOST);
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
      {visible && <Marker position={position} icon={userIcon} title="Your location">
        <Popup>You are here</Popup>
      </Marker>}
      <div
        className="leaflet-bottom leaflet-left recenter-control"
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
  const [mapOpacity, setMapOpacity] = useState(0);
  const [showRoute, setShowRoute] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showGeofences, setShowGeofences] = useState(false);
  const [showLayerDebug, setShowLayerDebug] = useState(false);
  const [fieldSettings, setFieldSettings] = useState({ ...DEFAULT_FIELD_SETTINGS });
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const formatTime = (seconds: number) => {
    const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    return Math.floor(safe / 60) + ':' + String(safe % 60).padStart(2, '0');
  };
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackField = usePlaybackField(audioRef);
  const fadingAudiosRef = useRef<HTMLAudioElement[]>([]);
  const fadeIntervalsRef = useRef<number[]>([]);
  const isSwitchingRef = useRef(false);
  const switchTimeoutRef = useRef<number | null>(null);

  const fadeOutAndStopAudio = (audioEl: HTMLAudioElement, duration = 10000) => {
    const startVolume = audioEl.volume || 1;
    const steps = 100;
    const intervalMs = duration / steps;
    let step = 0;

    const intervalId = window.setInterval(() => {
      step += 1;
      const progress = step / steps;
      audioEl.volume = Math.max(0, startVolume * (1 - progress));

      if (step >= steps) {
        window.clearInterval(intervalId);

        try {
          audioEl.pause();
          audioEl.currentTime = 0;
          audioEl.removeAttribute('src');
          audioEl.load();
        } catch (err) {
          console.warn('Error while stopping faded audio:', err);
        }

        fadingAudiosRef.current = fadingAudiosRef.current.filter((a) => a !== audioEl);
        fadeIntervalsRef.current = fadeIntervalsRef.current.filter((id) => id !== intervalId);
      }
    }, intervalMs);

    fadeIntervalsRef.current.push(intervalId);
  };

  const getClosestPinInRange = (pos: [number, number]) => {
    const nearbyPins = pins
      .map((pin) => ({
        pin,
        distance: getDistance(pos[0], pos[1], pin.lat, pin.lng),
      }))
      .filter((item) => item.distance <= item.pin.radius)
      .sort((a, b) => a.distance - b.distance);

    return nearbyPins.length > 0 ? nearbyPins[0].pin : null;
  };

  const playPinAudio = async (pin: LocationPin) => {
    if (!audioRef.current) return;

    setProgress(0);
    setAudioError(null);
    setActivePin(pin);

    audioRef.current.src = pin.audioUrl;
    audioRef.current.volume = 1;
    audioRef.current.currentTime = 0;

    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      console.warn('Audio play failed:', err);
      setIsPlaying(false);
      setAudioError('Tap play to start audio.');
    }
  };

  const switchToPinAudio = async (nextPin: LocationPin) => {
    if (!audioRef.current || isSwitchingRef.current) return;

    isSwitchingRef.current = true;
    setAudioError(null);
    setProgress(0);

    const mainAudio = audioRef.current;

    try {
      const hasCurrentAudio = !!mainAudio.src && !mainAudio.paused;

      if (hasCurrentAudio) {
        const currentSrc = mainAudio.currentSrc || mainAudio.src;
        const currentTime = mainAudio.currentTime || 0;
        const currentVolume = mainAudio.volume || 1;

        const outgoingAudio = new Audio();
        outgoingAudio.src = currentSrc;
        outgoingAudio.preload = 'auto';
        outgoingAudio.volume = currentVolume;

        const startFadeClone = async () => {
          try {
            const safeTime = Number.isFinite(currentTime) ? currentTime : 0;
            outgoingAudio.currentTime = safeTime;

            await outgoingAudio.play();

            fadingAudiosRef.current.push(outgoingAudio);
            fadeOutAndStopAudio(outgoingAudio, 4000);

            mainAudio.pause();
            mainAudio.currentTime = 0;
            mainAudio.volume = 1;
          } catch (err) {
            console.warn('Outgoing fade audio failed to play:', err);

            mainAudio.pause();
            mainAudio.currentTime = 0;
            mainAudio.volume = 1;
          }
        };

        if (outgoingAudio.readyState >= 1) {
          await startFadeClone();
        } else {
          await new Promise<void>((resolve) => {
            const cleanupListeners = () => {
              outgoingAudio.removeEventListener('loadedmetadata', onLoadedMetadata);
              outgoingAudio.removeEventListener('error', onError);
            };

            const onLoadedMetadata = async () => {
              cleanupListeners();
              await startFadeClone();
              resolve();
            };

            const onError = () => {
              cleanupListeners();
              console.warn('Outgoing audio metadata failed to load');

              mainAudio.pause();
              mainAudio.currentTime = 0;
              mainAudio.volume = 1;
              resolve();
            };

            outgoingAudio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
            outgoingAudio.addEventListener('error', onError, { once: true });
          });
        }
      }

      mainAudio.src = nextPin.audioUrl;
      mainAudio.currentTime = 0;
      mainAudio.volume = 1;

      setActivePin(nextPin);

      await mainAudio.play();
      setIsPlaying(true);
    } catch (err) {
      console.warn('Failed to switch to new pin audio:', err);
      setIsPlaying(false);
      setAudioError('Tap play to start audio.');
      setActivePin(nextPin);
    } finally {
      isSwitchingRef.current = false;
    }
  };

  useEffect(() => {
    if (!userPos || !hasStarted || !audioRef.current) return;
    if (isSwitchingRef.current) return;

    const closestPin = getClosestPinInRange(userPos);

    if (!closestPin) return;
    if (activePin?.id === closestPin.id) return;

    if (switchTimeoutRef.current) {
      window.clearTimeout(switchTimeoutRef.current);
    }

    switchTimeoutRef.current = window.setTimeout(() => {
      switchToPinAudio(closestPin);
    }, 500);

    return () => {
      if (switchTimeoutRef.current) {
        window.clearTimeout(switchTimeoutRef.current);
      }
    };
  }, [userPos, hasStarted, activePin]);

  useEffect(() => {
    return () => {
      if (switchTimeoutRef.current) {
        window.clearTimeout(switchTimeoutRef.current);
      }

      fadeIntervalsRef.current.forEach((id) => window.clearInterval(id));
      fadeIntervalsRef.current = [];

      fadingAudiosRef.current.forEach((audio) => {
        try {
          audio.pause();
          audio.currentTime = 0;
          audio.removeAttribute('src');
          audio.load();
        } catch (err) {
          console.warn('Cleanup error:', err);
        }
      });

      fadingAudiosRef.current = [];
    };
  }, []);

  const handleStart = async () => {
    playbackField.prepare();
    setHasStarted(true);

    if (!userPos) return;

    const closestPin = getClosestPinInRange(userPos);
    if (!closestPin) return;

    await playPinAudio(closestPin);
  };

  const toggleAudio = () => {
    playbackField.prepare();
    if (!audioRef.current || !activePin) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const currentSrc = audioRef.current.currentSrc || audioRef.current.src;
      const expectedAbsoluteUrl = new URL(activePin.audioUrl, window.location.origin).href;

      if (currentSrc !== expectedAbsoluteUrl && !currentSrc.endsWith(activePin.audioUrl)) {
        audioRef.current.src = activePin.audioUrl;
        audioRef.current.currentTime = 0;
      }

      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error('Play failed:', err);
          setAudioError('Tap again to start audio.');
        });
    }
  };

  return (
    <div className="relative w-full h-full bg-zinc-950">
      <div className="map-header absolute top-0 left-0 right-0 z-[1000] pointer-events-none">
        <div className="map-header-row">
          <div className="map-toolbar">      {hasStarted && (
        <aside className="map-tool text-white">
          <button type="button" title="Map overlays" aria-label="Map overlay debug settings"
            aria-expanded={showLayerDebug} aria-controls="map-overlay-debug"
            onClick={() => setShowLayerDebug(!showLayerDebug)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white/80 backdrop-blur-md hover:text-white">
            <Layers className="h-5 w-5" />
          </button>
          {showLayerDebug && (
            <div id="map-overlay-debug" className="map-debug-popover space-y-3 rounded-xl border border-white/10 bg-zinc-950/95 p-3 shadow-lg backdrop-blur-md">
              <p className="text-sm font-medium">Debug · Map overlays</p>
              <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 text-xs">
                Route line
                <input type="checkbox" checked={showRoute} onChange={e => setShowRoute(e.target.checked)} className="h-5 w-5 accent-emerald-500" />
              </label>
              <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 text-xs">
                Location markers
                <input type="checkbox" checked={showMarkers} onChange={e => setShowMarkers(e.target.checked)} className="h-5 w-5 accent-emerald-500" />              </label>
              <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 text-xs">
                Geofence radius
                <input type="checkbox" checked={showGeofences} onChange={e => setShowGeofences(e.target.checked)} className="h-5 w-5 accent-emerald-500" />
              </label>
            </div>
          )}
        </aside>
      )}
      {hasStarted && (
        <FieldDebugPanel settings={fieldSettings} onChange={setFieldSettings}
          mapOpacity={mapOpacity} onMapOpacity={setMapOpacity} />
      )}
          <Link
            to="/configurelocation"
            className="pointer-events-auto w-9 h-9 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <Settings className="w-5 h-5" />
          </Link></div>
        </div>
      </div>

      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[1.370050598938354, 103.84907773928799]}
          zoom={15 + DEFAULT_ZOOM_BOOST}
          zoomSnap={0}
          style={{ height: '100%', width: '100%', background: fieldSettings.background }}
          zoomControl={false}
        >
          <TileLayer
            opacity={mapOpacity}
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <FitRouteBounds pins={pins} />
          <MagneticField pins={pins} enabled={hasStarted} userPos={userPos} settings={fieldSettings}
            sampleAudio={playbackField.sample} />
          <LocationMarker setUserPos={setUserPos} visible={showMarkers} />
          {showRoute && <RoutePath pins={pins} />}

          {pins.map((pin) => (
            <React.Fragment key={pin.id}>
              {showMarkers && <Marker position={[pin.lat, pin.lng]} icon={pinIcon} title={pin.name}>
                <Popup>
                  <div className="p-1">
                    <h3 className="font-bold text-zinc-900">{pin.name}</h3>
                    <p className="text-xs text-zinc-600 mt-1">{pin.description}</p>
                  </div>
                </Popup>
              </Marker>}

              {showGeofences && <Circle
                center={[pin.lat, pin.lng]}
                radius={pin.radius}
                pathOptions={{
                  color: activePin?.id === pin.id ? '#10b981' : '#94a3b8',
                  fillColor: activePin?.id === pin.id ? '#10b981' : '#94a3b8',
                  fillOpacity: 0.1,
                }}
              />}
            </React.Fragment>
          ))}
        </MapContainer>
      </div>

      {activePin && <div className="audio-bottom-wash" aria-hidden="true" />}
      <AnimatePresence>
        {activePin && (
          <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
            className="audio-card absolute z-[1000] text-zinc-800">
            <h2 className="mb-4 truncate font-mono text-sm font-normal tracking-wide" title={activePin.name}>{activePin.name}</h2>
            <div className="flex items-start gap-2">
              <button type="button" onClick={toggleAudio} aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
                className="-mt-5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-zinc-800">
                {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
              </button>
              <div className="min-w-0 flex-1">
                <div role="progressbar" aria-label="Track progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}
                  className="h-px w-full bg-zinc-400/50">
                  <div className="h-full bg-zinc-800 transition-[width] duration-200 ease-linear" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-2 flex justify-between font-mono text-[11px] tabular-nums text-zinc-500">
                  <span aria-label="Elapsed time">{formatTime(elapsed)}</span>
                  <span aria-label="Remaining time">-{formatTime(duration - elapsed)}</span>
                </div>
              </div>
            </div>
            {audioError && <p role="status" className="mt-1 text-xs text-red-700">{audioError}</p>}
          </motion.div>
        )}
      </AnimatePresence>
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onLoadStart={() => { setElapsed(0); setDuration(0); setProgress(0); }}
        onLoadedMetadata={e => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onDurationChange={e => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onTimeUpdate={(e) => {
          const audio = e.currentTarget;
          setElapsed(audio.currentTime);
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
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
