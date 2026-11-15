import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { Navigation, Play, Pause, Settings, Layers, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { BOARDING_AUDIO_URL, getStoredPins, LocationPin } from '../config';
import { journeyPins, walkingPath, isWalkingStop, WALKING_STOP_IDS, nearWalkingPath, backOnBusPath } from '../journeyRoutes';
import MagneticField from './MagneticField';
import MapDebugOverlays from './MapDebugOverlays';
import DebugAudioPanel from './DebugAudioPanel';
import { fadeGain, loadFade, type FadeSettings } from './audioFade';
import MapSubtitles from './MapSubtitles';
import BusArrival from './BusArrival';
import DirectionGuides from './DirectionGuides';
import JourneyOpening from './JourneyOpening';
import usePlaybackField from './usePlaybackField';
import FieldDebugPanel, { DEFAULT_FIELD_SETTINGS } from './FieldDebugPanel';
import type { EncounterKind } from './ar/characters';
import { launchGroundAR, type GroundARLaunch } from './ar/session';
import { launchHandCamera, type HandCameraLaunch } from './ar/handCamera';

const ARExperience = React.lazy(() => import('./ARExperience'));
const HandARExperience = React.lazy(() => import('./HandARExperience'));
const HAND_FILTER_STOP_ID = 'pin-11';
const groundEncounters: Record<string, EncounterKind> = {
  'pin-9': 'mynas',
  'pin-9b': 'mynas',
  'pin-10': 'bun',
  'pin-11b': 'rubber-tree',
};
// Keep AR encounters configured while their placement is being decided.
const SHOW_AR_FILTER_BUTTONS = false;
const encounterLabels: Record<string, string> = {
  'pin-9': 'Meet the mynas in AR',
  'pin-9b': 'Meet the mynas in AR',
  'pin-10': 'Find the pink bun in AR',
  [HAND_FILTER_STOP_ID]: 'Try the hand filter in AR',
  'pin-11b': 'Tap a rubber tree in AR',
};

class ARLoadBoundary extends React.Component<{ onClose: () => void; launch: { dispose: () => Promise<void> }; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { void this.props.launch.dispose().catch(() => {}); }
  render() {
    return this.state.failed ? createPortal(<div className="ar-loading" role="dialog" aria-modal="true" aria-label="AR unavailable">
      <p>AR could not load. Refresh the app to try again.</p>
      <button type="button" className="ar-capsule" onClick={this.props.onClose}>Back to map</button>
    </div>, document.body) : this.props.children;
  }
}

const makeDotIcon = (colour: string, size = 10, pulseIndex = -1) => L.divIcon({
  className: 'soft-location-marker',
  html: `<span class="soft-location-dot${pulseIndex >= 0 ? ' walking-pin-pulse' : ''}" style="animation-delay:${pulseIndex * 0.45}s;width:${size}px;height:${size}px;left:${(28 - size) / 2}px;top:${(28 - size) / 2}px;background:${colour};box-shadow:0 0 ${size * 0.4}px ${size * 0.2}px ${colour.slice(0, 7)}99;filter:blur(${size * 0.08}px)"></span>`,
  iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -8],
});
const pinIcon = makeDotIcon('#FF8A3D', 5);
const inactivePinIcon = makeDotIcon('#2D4A36F5', 5);
const walkingPinIcons = WALKING_STOP_IDS.map((_, i) => makeDotIcon('#FF8A3D', 5, i));
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
  animated?: boolean;
};

function RoutePath({ pins, animated = true }: RoutePathProps) {
  const map = useMap();
  useEffect(() => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.style.position = 'absolute';
    svg.style.pointerEvents = 'none';
    svg.style.overflow = 'hidden';
    svg.setAttribute('aria-hidden', 'true');
    path.setAttribute('fill', 'none');
    path.setAttribute('class', `route-path${animated ? '' : ' route-path-inactive'}`);
    path.setAttribute('stroke', '#888888');
    path.setAttribute('stroke-width', '0.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(path);
    map.getPanes().overlayPane.appendChild(svg);

    const update = () => {
      const size = map.getSize();
      svg.setAttribute('width', String(size.x));
      svg.setAttribute('height', String(size.y));
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      svg.style.transform = `translate(${topLeft.x}px, ${topLeft.y}px)`;

      // Project without Leaflet's integer rounding to retain subpixel precision.
      const origin = map.getPixelOrigin();
      const offset = map.containerPointToLayerPoint([0, 0]);
      const precise = pins.map(pin => map.project([pin.lat, pin.lng], map.getZoom()).subtract(origin).subtract(offset))
        .filter((point, i, all) => i === 0 || point.distanceTo(all[i - 1]) > 0.001);
      if (precise.length < 2) { path.setAttribute('d', ''); return; }
      const handles = precise.map((point, i) => {
        const before = precise[Math.max(0, i - 1)];
        const after = precise[Math.min(precise.length - 1, i + 1)];
        const direction = after.subtract(before);
        const incoming = i ? point.distanceTo(before) : point.distanceTo(after);
        const outgoing = i < precise.length - 1 ? point.distanceTo(after) : incoming;
        return direction.multiplyBy(Math.min(incoming, outgoing) * 0.33 / (Math.hypot(direction.x, direction.y) || 1));
      });
      let d = `M ${precise[0].x} ${precise[0].y}`;
      for (let i = 0; i < precise.length - 1; i++) {
        let a = precise[i].add(handles[i]);
        const end = precise[i + 1];
        const b = end.subtract(handles[i + 1]);
        if (pins[i]?.id === 'pin-9' && pins[i + 1]?.id === 'pin-10') {
          // These stops are almost collinear with the pavilion. Give the
          // departure a gentle bow while keeping the arrival tangent shared
          // with the next segment, so the curve flows smoothly through Walk 1.
          const direction = end.subtract(precise[i]);
          a = a.add(L.point(-direction.y, direction.x).multiplyBy(0.3));
        }
        d += ` C ${a.x} ${a.y}, ${b.x} ${b.y}, ${end.x} ${end.y}`;
      }
      path.setAttribute('d', d);
    };
    const hide = () => { svg.style.visibility = 'hidden'; };
    const show = () => { update(); svg.style.visibility = ''; };
    update();
    map.on('move resize viewreset', update);
    map.on('zoomstart', hide);
    map.on('zoomend', show);
    return () => {
      map.off('move resize viewreset', update);
      map.off('zoomstart', hide);
      map.off('zoomend', show);
      svg.remove();
    };
  }, [map, pins, animated]);
  return null;
}
function DebugMapFocus({ pin }: { pin: LocationPin | null }) {
  const map = useMap();
  useEffect(() => {
    if (pin) map.setView([pin.lat, pin.lng], 17 + DEFAULT_ZOOM_BOOST, { animate: false });
  }, [map, pin]);
  return null;
}
function WalkingRouteFocus({ walking, pins }: { walking: boolean; pins: LocationPin[] }) {
  const map = useMap();
  useEffect(() => {
    if (!walking) return;
    const stops = pins.filter(pin => isWalkingStop(pin.id));
    if (!stops.length) return;
    const size = map.getSize();
    const options = {
      paddingTopLeft: L.point(40, Math.min(160, size.y * 0.22)),
      paddingBottomRight: L.point(40, Math.min(180, size.y * 0.25)),
      maxZoom: 17 + DEFAULT_ZOOM_BOOST,
      duration: 1.2,
    };
    // Include more of the surrounding path, beyond simply fitting the pins.
    const bounds = L.latLngBounds(stops.map(pin => L.latLng(pin.lat, pin.lng))).pad(0.4);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) map.fitBounds(bounds, options);
    else map.flyToBounds(bounds, options);
  }, [map, walking, pins]);
  return null;
}

function LocationMarker({ setUserPos, visible, followUser }: { setUserPos: (pos: [number, number]) => void; visible: boolean; followUser: boolean }) {
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const map = useMap();
  const followUserRef = useRef(followUser);
  const latestPositionRef = useRef<L.LatLng | null>(null);
  useEffect(() => {
    const resumingBus = followUser && !followUserRef.current;
    followUserRef.current = followUser;
    if (resumingBus && latestPositionRef.current) {
      map.setView(latestPositionRef.current, 17 + DEFAULT_ZOOM_BOOST, { animate: true });
    }
  }, [followUser, map]);

  const handleRecenter = () => {
    if (position) {
      map.setView(position, 17 + DEFAULT_ZOOM_BOOST);
    }
  };

  useEffect(() => {
    let disposed = false;
    let hasLocated = false;
    const watchId = navigator.geolocation.watchPosition(
      (result) => {
        if (disposed) return;
        const next = L.latLng(result.coords.latitude, result.coords.longitude);
        latestPositionRef.current = next;
        setPosition(next);
        setUserPos([next.lat, next.lng]);
        // Keep GPS and audio triggers live without moving the walking overview.
        if (!followUserRef.current) { hasLocated = true; return; }
        // Use a fixed close-up zoom, independent of GPS accuracy bounds.
        // Subsequent fixes keep the user centered while preserving their zoom.
        if (!hasLocated) {
          hasLocated = true;
          map.setView(next, 17 + DEFAULT_ZOOM_BOOST, { animate: false });
        } else {
          map.panTo(next, { animate: true, duration: 0.5 });
        }
      },
      (error) => {
        if (disposed) return;
        console.error('Location error:', error.message);
        if (hasLocated) return;
        const fallback = L.latLng(1.370050598938354, 103.84907773928799);
        setPosition(fallback);
        setUserPos([fallback.lat, fallback.lng]);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
    return () => {
      disposed = true;
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
  // Deliberately session-only: refresh always returns to the bus journey.
  const [walking, setWalking] = useState(false);
  const [leavingBus, setLeavingBus] = useState(false);
  const walkingRef = useRef(false);
  const navigationPins = useMemo(() => journeyPins(pins, walking), [pins, walking]);
  const busRoutePins = useMemo(() => journeyPins(pins, false), [pins]);
  const walkingRoutePins = useMemo(() => walkingPath(pins), [pins]);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [activePin, setActivePin] = useState<LocationPin | null>(null);
  const boardedBusRef = useRef(false);
  const [showBoardingInstructions, setShowBoardingInstructions] = useState(true);
  const [subtitlesStarted, setSubtitlesStarted] = useState(false);
  const [showDirectionGuides, setShowDirectionGuides] = useState(false);
  const [pavilionContinued, setPavilionContinued] = useState(false);
  const pavilionContinuedRef = useRef<string | null>(null);
  const pavilionFadeRef = useRef<number | null>(null);
  const [showPavilionGuide, setShowPavilionGuide] = useState(false);
  const [showLandmarks, setShowLandmarks] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showOpening, setShowOpening] = useState(true);
  useEffect(() => {
    if (!hasStarted) return;
    const timer = window.setTimeout(() => setShowOpening(false), 850);
    return () => window.clearTimeout(timer);
  }, [hasStarted]);
  const [mapOpacity, setMapOpacity] = useState(0);
  const [showRoute, setShowRoute] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showLocationNames, setShowLocationNames] = useState(false);
  const [showGeofences, setShowGeofences] = useState(true);
  const [debugPlayback, setDebugPlayback] = useState(false);
  const [fadeSettings, setFadeSettings] = useState(loadFade);
  const [fadeProgress, setFadeProgress] = useState<number | null>(null);
  const audioCardRef = useRef<HTMLDivElement | null>(null);
  const [audioClearance, setAudioClearance] = useState(260);
  useEffect(() => {
    const card = audioCardRef.current;
    if (!card) return;
    const measure = () => setAudioClearance(card.getBoundingClientRect().height + (parseFloat(getComputedStyle(card).bottom) || 18) + 16);
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [hasStarted, activePin, showOpening]);
  const changeFadeSettings = (value: FadeSettings) => {
    setFadeSettings(value);
    try { localStorage.setItem('htw-audio-fade', JSON.stringify(value)); } catch { /* Session settings still apply. */ }
  };
  const [arScene, setArScene] = useState<{ kind: EncounterKind; trackId: string; audioUrl: string; launch: GroundARLaunch } | null>(null);
  const [handScene, setHandScene] = useState<{ trackId: string; audioUrl: string; launch: HandCameraLaunch } | null>(null);
  const handLaunchRef = useRef<HandCameraLaunch | null>(null);
  const arLaunchRef = useRef<GroundARLaunch | null>(null);
  useEffect(() => () => { void arLaunchRef.current?.dispose().catch(() => {}); void handLaunchRef.current?.dispose(); }, []);
  const arOpenRef = useRef(false);
  const debugPlaybackRef = useRef(false);
  const playbackRequestRef = useRef(0);
  const [debugPinId, setDebugPinId] = useState(pins[0]?.id ?? '');
  const [showLayerDebug, setShowLayerDebug] = useState(false);
  const [fieldSettings, setFieldSettings] = useState({ ...DEFAULT_FIELD_SETTINGS });
  const [darkMap, setDarkMap] = useState(false);
  const lightPaletteRef = useRef({ color: DEFAULT_FIELD_SETTINGS.color, background: DEFAULT_FIELD_SETTINGS.background });
  const toggleMapTheme = () => {
    if (!darkMap) lightPaletteRef.current = { color: fieldSettings.color, background: fieldSettings.background };
    const palette = darkMap ? lightPaletteRef.current : { color: '#e8e6df', background: '#000000' };
    setFieldSettings(current => ({ ...current, ...palette }));
    setDarkMap(!darkMap);
  };
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
  const fadeCompletionsRef = useRef(new Map<number, () => void>());
  const isSwitchingRef = useRef(false);
  const switchTimeoutRef = useRef<number | null>(null);

  const fadeOutAndStopAudio = (audioEl: HTMLAudioElement, settings = fadeSettings): Promise<void> => new Promise(resolve => {
    const startVolume = audioEl.volume;
    const startedAt = performance.now();

    const intervalId = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / (settings.seconds * 1000));
      audioEl.volume = startVolume * (1 - fadeGain(progress, settings));

      if (progress >= 1) {
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
        fadeCompletionsRef.current.delete(intervalId);
        resolve();
      }
    }, 50);

    fadeIntervalsRef.current.push(intervalId);
    fadeCompletionsRef.current.set(intervalId, resolve);
  });

  const getClosestPinInRange = (pos: [number, number]) => {
    const nearbyPins = navigationPins
      .map((pin) => ({
        pin,
        distance: getDistance(pos[0], pos[1], pin.lat, pin.lng),
      }))
      .filter((item) => item.distance <= item.pin.radius &&
        item.pin.id !== pavilionContinuedRef.current &&
        !(boardedBusRef.current && item.pin.id === 'pin-1'))
      .sort((a, b) => a.distance - b.distance);

    return nearbyPins.length > 0 ? nearbyPins[0].pin : null;
  };

  const leaveBus = async () => {
    const getOffPin = pins.find(pin => pin.id === 'pin-9b');
    if (walkingRef.current || !getOffPin || !audioRef.current) return;
    const request = ++playbackRequestRef.current;
    if (switchTimeoutRef.current) window.clearTimeout(switchTimeoutRef.current);
    switchTimeoutRef.current = null;
    fadeIntervalsRef.current.forEach(id => window.clearInterval(id));
    fadeIntervalsRef.current = [];
    fadeCompletionsRef.current.forEach(resolve => resolve());
    fadeCompletionsRef.current.clear();
    fadingAudiosRef.current.forEach(audio => { audio.pause(); audio.removeAttribute('src'); audio.load(); });
    fadingAudiosRef.current = [];
    const audio = audioRef.current;
    // Lock GPS and controls until the exclusive transition has finished.
    walkingRef.current = true;
    setWalking(true);
    setDebugPinId(getOffPin.id);
    setLeavingBus(true);
    isSwitchingRef.current = true;
    try {
      // Start within the tap gesture, without waiting for the GPS fade.
      // Mobile browsers can reject playback after an asynchronous fade.
      audio.pause();
      if (request === playbackRequestRef.current) await playPinAudio(getOffPin);
    } finally {
      if (request + 1 === playbackRequestRef.current) {
        isSwitchingRef.current = false;
        setLeavingBus(false);
      }
    }
  };

  const playPinAudio = async (pin: LocationPin) => {
    if (!audioRef.current) return;
    if (pavilionFadeRef.current !== null) window.clearInterval(pavilionFadeRef.current);
    pavilionFadeRef.current = null;
    setPavilionContinued(false);
    setShowPavilionGuide(false);
    setShowLandmarks(false);
    if (pin.id === pavilionContinuedRef.current) pavilionContinuedRef.current = null;

    const request = ++playbackRequestRef.current;
    setElapsed(0);
    setDuration(0);
    setAudioError(null);
    setActivePin(pin);

    audioRef.current.src = pin.audioUrl;
    audioRef.current.volume = 1;
    audioRef.current.currentTime = 0;

    try {
      await audioRef.current.play();
      if (request === playbackRequestRef.current) setIsPlaying(true);
    } catch (err) {
      if (request !== playbackRequestRef.current) return;
      console.warn('Audio play failed:', err);
      setIsPlaying(false);
      setAudioError('Tap play to start audio.');
    }
  };

  const switchToPinAudio = async (nextPin: LocationPin) => {
    if (!audioRef.current || isSwitchingRef.current) return;

    const request = ++playbackRequestRef.current;
    isSwitchingRef.current = true;
    setAudioError(null);

    const mainAudio = audioRef.current;
    const settings = { ...fadeSettings };
    let fadingOut: HTMLAudioElement | null = null;
    let rampStarted = false;

    try {
      const hasCurrentAudio = !!mainAudio.src && !mainAudio.paused;

      if (hasCurrentAudio) {
        const currentSrc = mainAudio.currentSrc || mainAudio.src;
        const currentTime = mainAudio.currentTime || 0;
        const currentVolume = mainAudio.volume;

        const outgoingAudio = new Audio();
        outgoingAudio.src = currentSrc;
        outgoingAudio.preload = 'auto';
        outgoingAudio.volume = currentVolume;

        const startFadeClone = async () => {
          if (request !== playbackRequestRef.current) return;
          try {
            const safeTime = Number.isFinite(currentTime) ? currentTime : 0;
            outgoingAudio.currentTime = safeTime;

            await outgoingAudio.play();
            if (request !== playbackRequestRef.current) {
              outgoingAudio.pause();
              return;
            }

            fadingAudiosRef.current.push(outgoingAudio);
            fadingOut = outgoingAudio;

            mainAudio.pause();
            mainAudio.currentTime = 0;
            mainAudio.volume = 1;
          } catch (err) {
            if (request !== playbackRequestRef.current) return;
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
              if (request !== playbackRequestRef.current) { resolve(); return; }
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

      if (request !== playbackRequestRef.current) return;
      mainAudio.src = nextPin.audioUrl;
      mainAudio.currentTime = 0;
      mainAudio.volume = fadingOut ? 0 : 1;

      setActivePin(nextPin);

      await mainAudio.play();
      if (request === playbackRequestRef.current && fadingOut) {
        rampStarted = true;
        void fadeOutAndStopAudio(fadingOut, settings);
        const startedAt = performance.now();
        setFadeProgress(0);
        const intervalId = window.setInterval(() => {
          const progress = Math.min(1, (performance.now() - startedAt) / (settings.seconds * 1000));
          if (request === playbackRequestRef.current) {
            mainAudio.volume = fadeGain(progress, settings);
            setFadeProgress(progress);
          }
          if (progress >= 1 || request !== playbackRequestRef.current) {
            window.clearInterval(intervalId);
            fadeIntervalsRef.current = fadeIntervalsRef.current.filter(id => id !== intervalId);
            setFadeProgress(null);
            if (request === playbackRequestRef.current) isSwitchingRef.current = false;
          }
        }, 30);
        fadeIntervalsRef.current.push(intervalId);
      }
      if (request === playbackRequestRef.current) setIsPlaying(true);
    } catch (err) {
      if (request !== playbackRequestRef.current) return;
      console.warn('Failed to switch to new pin audio:', err);
      if (fadingOut) void fadeOutAndStopAudio(fadingOut, settings);
      mainAudio.volume = 1;
      setIsPlaying(false);
      setAudioError('Tap play to start audio.');
      setActivePin(nextPin);
    } finally {
      if (request === playbackRequestRef.current && !rampStarted) isSwitchingRef.current = false;
    }
  };

  useEffect(() => {
    if (debugPlaybackRef.current || arOpenRef.current || !userPos || !hasStarted || !audioRef.current) return;
    if (isSwitchingRef.current) return;

    const closestPin = getClosestPinInRange(userPos);

    if (!closestPin) return;
    if (activePin?.id === closestPin.id) return;
    // Keep a manually selected recording at a shared geofence (9 / 9b).
    if (activePin && activePin.lat === closestPin.lat && activePin.lng === closestPin.lng) return;

    if (switchTimeoutRef.current) {
      window.clearTimeout(switchTimeoutRef.current);
    }

    switchTimeoutRef.current = window.setTimeout(() => {
      if (!debugPlaybackRef.current && !arOpenRef.current) void switchToPinAudio(closestPin);
    }, 500);

    return () => {
      if (switchTimeoutRef.current) {
        window.clearTimeout(switchTimeoutRef.current);
      }
    };
  }, [userPos, hasStarted, activePin, debugPlayback, arScene, handScene, walking, leavingBus]);

  useEffect(() => {
    return () => {
      ++playbackRequestRef.current;
      if (pavilionFadeRef.current !== null) window.clearInterval(pavilionFadeRef.current);
      if (switchTimeoutRef.current) {
        window.clearTimeout(switchTimeoutRef.current);
      }

      fadeIntervalsRef.current.forEach((id) => window.clearInterval(id));
      fadeIntervalsRef.current = [];
      fadeCompletionsRef.current.forEach(resolve => resolve());
      fadeCompletionsRef.current.clear();

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

  const stopPreviewAudio = () => {
    setFadeProgress(null);
    if (pavilionFadeRef.current !== null) window.clearInterval(pavilionFadeRef.current);
    pavilionFadeRef.current = null;
    ++playbackRequestRef.current;
    isSwitchingRef.current = false;
    setLeavingBus(false);
    if (switchTimeoutRef.current) window.clearTimeout(switchTimeoutRef.current);
    switchTimeoutRef.current = null;
    fadeIntervalsRef.current.forEach(id => window.clearInterval(id));
    fadeIntervalsRef.current = [];
    fadeCompletionsRef.current.forEach(resolve => resolve());
    fadeCompletionsRef.current.clear();
    fadingAudiosRef.current.forEach(audio => { audio.pause(); audio.removeAttribute('src'); audio.load(); });
    fadingAudiosRef.current = [];
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    setActivePin(null);
    setIsPlaying(false);
    setElapsed(0);
    setDuration(0);
    setAudioError(null);
  };

  const enterDebugPlayback = () => {
    debugPlaybackRef.current = true;
    setDebugPlayback(true);
    setDebugPinId(activePin?.id ?? pins[0]?.id ?? '');
    stopPreviewAudio();
  };

  const continuePavilionWalk = () => {
    if (!activePin || !['pin-11', 'pin-11b', 'pin-12'].includes(activePin.id) || pavilionContinuedRef.current === activePin.id) return;
    pavilionContinuedRef.current = activePin.id;
    setPavilionContinued(true);
    const audio = audioRef.current;
    if (!audio || audio.paused) { setIsPlaying(false); return; }
    const startVolume = audio.volume;
    const startedAt = performance.now();
    pavilionFadeRef.current = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / 1200);
      audio.volume = startVolume * (1 - progress);
      if (progress === 1) {
        window.clearInterval(pavilionFadeRef.current!);
        pavilionFadeRef.current = null;
        audio.pause();
        audio.volume = 1;
        setIsPlaying(false);
      }
    }, 30);
  };

  const goBackToPavilion = () => {
    const pin = pins.find(candidate => candidate.id === activePin?.id);
    if (!pin || !['pin-11', 'pin-11b', 'pin-12'].includes(pin.id)) return;
    playbackField.prepare();
    void playPinAudio(pin);
  };

  const previewDebugPin = (id: string) => {
    const pin = pins.find(candidate => candidate.id === id);
    if (!pin) return;
    debugPlaybackRef.current = true;
    setDebugPlayback(true);
    setDebugPinId(pin.id);
    stopPreviewAudio();
    playbackField.prepare();
    void playPinAudio(pin);
  };

  const exitDebugPlayback = () => {
    stopPreviewAudio();
    debugPlaybackRef.current = false;
    setDebugPlayback(false);
  };

  const previewCrossfade = (id: string) => {
    const pin = pins.find(candidate => candidate.id === id);
    if (!pin || isSwitchingRef.current || fadeProgress !== null) return;
    debugPlaybackRef.current = true;
    setDebugPlayback(true);
    setDebugPinId(pin.id);
    playbackField.prepare();
    void switchToPinAudio(pin);
  };

  const openAR = () => {
    if (!activePin || !encounterLabels[activePin.id] || isSwitchingRef.current || arOpenRef.current) return;
    if (activePin.id === HAND_FILTER_STOP_ID) {
      const launch = launchHandCamera();
      handLaunchRef.current = launch; arOpenRef.current = true;
      if (switchTimeoutRef.current) window.clearTimeout(switchTimeoutRef.current);
      switchTimeoutRef.current = null;
      setHandScene({ trackId: activePin.id, audioUrl: activePin.audioUrl, launch });
      return;
    }
    const launch = launchGroundAR();
    arLaunchRef.current = launch;
    arOpenRef.current = true;
    if (switchTimeoutRef.current) window.clearTimeout(switchTimeoutRef.current);
    switchTimeoutRef.current = null;
    setArScene({ kind: groundEncounters[activePin.id], trackId: activePin.id, audioUrl: activePin.audioUrl, launch });
  };

  const closeHandAR = () => {
    void handLaunchRef.current?.dispose(); handLaunchRef.current = null;
    arOpenRef.current = false; setHandScene(null);
  };
  const retryHandAR = () => {
    if (!handScene) return;
    void handLaunchRef.current?.dispose();
    const launch = launchHandCamera(); handLaunchRef.current = launch;
    setHandScene({ ...handScene, launch });
  };

  const closeAR = async () => {
    const launch = arLaunchRef.current;
    if (!launch) return;
    await launch.dispose();
    if (arLaunchRef.current !== launch) return;
    arLaunchRef.current = null;
    arOpenRef.current = false;
    setArScene(null);
  };

  const retryAR = () => {
    if (!arScene) return;
    const launch = launchGroundAR();
    void arLaunchRef.current?.dispose().catch(() => {});
    arLaunchRef.current = launch;
    setArScene({ ...arScene, launch });
  };

  const seekAudio = (seconds: number) => {
    const audio = audioRef.current;
    if (leavingBus || isSwitchingRef.current || !audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration));
    setElapsed(audio.currentTime);
  };

  const handleStart = async () => {
    playbackField.prepare();
    setHasStarted(true);

    if (!userPos) return;

    const closestPin = getClosestPinInRange(userPos);
    if (!closestPin) return;

    await playPinAudio(closestPin);
  };

  const toggleAudio = () => {
    if (isSwitchingRef.current || pavilionContinued) return;
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

  const canBoardBus = activePin?.id === 'pin-1' && activePin.audioUrl !== BOARDING_AUDIO_URL;
  const boardBus = () => {
    if (!canBoardBus || !activePin || isSwitchingRef.current) return;
    setShowBoardingInstructions(false);
    if (switchTimeoutRef.current !== null) window.clearTimeout(switchTimeoutRef.current);
    switchTimeoutRef.current = null;
    if (!debugPlaybackRef.current) boardedBusRef.current = true;
    playbackField.prepare();
    void playPinAudio({ ...activePin, audioUrl: BOARDING_AUDIO_URL });
  };

  const canLeaveBus = hasStarted && !walking &&
    (activePin?.id === 'pin-9' || (!debugPlayback && !!(userPos && nearWalkingPath(userPos, pins))));

  useEffect(() => {
    if (!walking || leavingBus || arScene || handScene) return;
    const position: [number, number] | null = debugPlayback
      ? (activePin ? [activePin.lat, activePin.lng] : null)
      : userPos;
    if (!position || !backOnBusPath(position, pins)) return;
    walkingRef.current = false;
    setWalking(false);
  }, [walking, userPos, pins, debugPlayback, activePin, leavingBus, arScene, handScene]);

  const pavilionPrompt = !showOpening && ['pin-11', 'pin-11b', 'pin-12'].includes(activePin?.id ?? '') ? (<motion.section className="pavilion-instructions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .65 }}>
          <h1>{pavilionContinued ? 'Ready for the next stretch?' : 'Stay here for this story.'}</h1>
          <p>{pavilionContinued ? (activePin?.id === 'pin-12' ? 'Follow the directions to the Amenities Centre. Begin when you are ready to move.' : 'Follow the path along the reservoir to find the next pavilion. Begin when you are ready to move.') : 'Find a comfortable place at the pavilion. This is a listening stop.'}</p>
          {activePin?.id === 'pin-12' && !pavilionContinued && <button type="button" className="direction-guide-link" onClick={() => setShowLandmarks(true)}><span className="phone-info-icon" aria-hidden="true">i</span><span>View landmarks</span></button>}
          {pavilionContinued ? <button type="button" className="direction-guide-link" onClick={() => setShowPavilionGuide(true)}><span className="phone-info-icon" aria-hidden="true">i</span><span>View direction guides</span></button> : null}
        </motion.section>) : null;
  return (
    <div inert={!!arScene || !!handScene} className={`relative w-full h-full bg-zinc-950${darkMap ? " dark-map" : ""}${showOpening ? " opening-active" : ""}`}>
      <div hidden={showOpening} className="map-header absolute top-0 left-0 right-0 z-[1000] pointer-events-none">
        <div className="map-header-row">
          <div className="map-toolbar">
            <div className="map-tool">
              <button type="button" onClick={toggleMapTheme} aria-pressed={darkMap}
                aria-label="Dark map" title={darkMap ? 'Switch to light map' : 'Switch to dark map'}
                className="flex items-center justify-center rounded-xl border backdrop-blur-md">
                {darkMap ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            </div>      {hasStarted && (
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
                Stop names & radius labels
                <input type="checkbox" checked={showLocationNames} onChange={e => setShowLocationNames(e.target.checked)} className="h-5 w-5 accent-emerald-500" />
              </label>
              <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 text-xs">
                Geofence circles
                <input type="checkbox" checked={showGeofences} onChange={e => setShowGeofences(e.target.checked)} className="h-5 w-5 accent-emerald-500" />
              </label>
            </div>
          )}
        </aside>
      )}
      {hasStarted && <DebugAudioPanel pins={pins} enabled={debugPlayback} selectedId={debugPinId}
        activeId={activePin?.id} playing={isPlaying} elapsed={elapsed} duration={duration}
        onEnter={enterDebugPlayback} onExit={exitDebugPlayback} onPreview={previewDebugPin}
        onTogglePlayback={toggleAudio} onSeek={seekAudio}
        fadeSettings={fadeSettings} onFadeSettings={changeFadeSettings} fadeProgress={fadeProgress}
        audioClearance={audioClearance}
        onCrossfade={previewCrossfade} />}
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

      <div className="map-scene absolute inset-0 z-0" inert={showOpening}>
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


          <MagneticField pins={pins} enabled={true} userPos={debugPlayback && activePin ? [activePin.lat, activePin.lng] : userPos} settings={fieldSettings}
            sampleAudio={playbackField.sample} />
          <DebugMapFocus pin={debugPlayback && !(walking && activePin && (isWalkingStop(activePin.id) || activePin.id === 'pin-9b')) ? activePin : null} />
          <MapDebugOverlays pins={pins} circles={showGeofences} labels={showLocationNames && showMarkers} activeId={activePin?.id} />
          <WalkingRouteFocus walking={walking} pins={walkingRoutePins} />
          {hasStarted && !debugPlayback && <LocationMarker setUserPos={setUserPos} visible={showMarkers} followUser={!walking} />}
          {showRoute && <>
            <RoutePath pins={busRoutePins} />
            <RoutePath pins={walkingRoutePins} animated={walking} />
          </>}

          {pins.map((pin) => (
            <React.Fragment key={pin.id}>
              {showMarkers && pin.id !== 'pin-9b' && <Marker key={`${pin.id}-${isWalkingStop(pin.id) && walking}`} position={[pin.lat, pin.lng]}
                icon={isWalkingStop(pin.id) ? (walking ? walkingPinIcons[WALKING_STOP_IDS.indexOf(pin.id)] : inactivePinIcon) : pinIcon}
                title={`${pin.name}${isWalkingStop(pin.id) && !walking ? ' (walking route inactive)' : ''}`}>
                <Popup>
                  <div className="p-1">
                    <h3 className="font-bold text-zinc-900">{pin.name}</h3>
                    <p className="text-xs text-zinc-600 mt-1">{pin.description}</p>
                    {pins.filter(candidate => candidate.lat === pin.lat && candidate.lng === pin.lng).map(candidate => (
                      <button key={candidate.id} type="button" className="mt-2 block text-xs underline" onClick={() => previewDebugPin(candidate.id)}>
                        Debug: play {candidate.name}
                      </button>
                    ))}
                  </div>
                </Popup>
              </Marker>}

            </React.Fragment>
          ))}

        </MapContainer>
      </div>

      <AnimatePresence>
        {!showOpening && activePin?.id === 'pin-13' && <motion.section className="map-boarding-instructions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} aria-label="Mt Alvernia boarding instructions">
          <h1>Wait for bus 166 at<br />Mt Alvernia Hospital station<BusArrival stop="51069" /></h1>
        </motion.section>}
        {!showOpening && showBoardingInstructions && (!activePin || activePin.id === 'pin-1') && <motion.section className="map-boarding-instructions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} aria-label="Boarding instructions">
          <h1>Wait for bus 166 at<br />Ang Mo Kio Interchange<BusArrival stop="54009" /></h1>
          <motion.div className="map-boarding-copy" animate={{ opacity: subtitlesStarted ? 0 : 1 }} transition={{ duration: 0.65 }} aria-hidden={subtitlesStarted}>
            <p>Board the bus and settle<br />in.</p>
            <p>Remember to head<br />upstairs and sit near the<br />front when a seat is<br />available.</p>
            <p>Start once you are<br />seated.</p>
          </motion.div>
        </motion.section>}
      </AnimatePresence>
      <AnimatePresence>
        {!showOpening && !walking && !leavingBus && (activePin?.id === 'pin-8' || activePin?.id === 'pin-9') && <motion.section className="map-boarding-instructions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.65 }} aria-label="Decide to step outside or stay on board">
          <h1 className={activePin?.id === 'pin-9' ? 'decision-pulse' : undefined}>{activePin?.id === 'pin-8' ? <>At the next stop, step outside<br />or stay on board.<span style={{ display: 'block', marginTop: 12 }}>The choice is yours.</span></> : <>Decide to step outside<br />or stay on board...</>}</h1>
        </motion.section>}
      </AnimatePresence>
      <AnimatePresence>
        {!showOpening && ((walking && leavingBus) || activePin?.id === 'pin-9b') && <motion.section className="map-boarding-instructions fig-tree-instructions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.65 }} aria-label="Find the fig tree">
          <h1>Find the fig tree</h1>
          <div className="fig-tree-copy">
            <p>Go down the stairs</p>
            <p>Through the tunnel</p>
            <p>Towards the park</p>
            <button type="button" className="phone-help-link" disabled title="Route photos coming soon"><span aria-hidden="true" className="phone-info-icon">i</span><span>Show me photos</span></button>
          </div>
        </motion.section>}
      </AnimatePresence>

      {hasStarted && !leavingBus && activePin?.id !== 'pin-9b' && <MapSubtitles key={activePin?.audioUrl ?? 'no-track'} audioRef={audioRef}
        leadingContent={pavilionPrompt}
        hideCue={pavilionContinued}
        onSubtitlesStarted={setSubtitlesStarted}
        onOpenDirections={activePin?.id === 'pin-12b' ? () => setShowDirectionGuides(true) : undefined}
        belowBoardingHeading={activePin?.id === 'pin-13' || activePin?.id === 'pin-8' || activePin?.id === 'pin-9' || (showBoardingInstructions && activePin?.id === 'pin-1' && activePin.audioUrl !== BOARDING_AUDIO_URL)}
        trackId={activePin?.audioUrl === BOARDING_AUDIO_URL ? 'boarding' : activePin?.id}
        audioUrl={activePin?.audioUrl} />}
      <AnimatePresence>{showDirectionGuides && <DirectionGuides onClose={() => setShowDirectionGuides(false)} />}</AnimatePresence>
      <AnimatePresence>{showPavilionGuide && <DirectionGuides singlePavilion={activePin?.id !== 'pin-12'} variant={activePin?.id === 'pin-12' ? 'amenities' : 'bus'} pavilionNumber={activePin?.id === 'pin-11b' ? 3 : 2} onClose={() => setShowPavilionGuide(false)} />}</AnimatePresence>
      <AnimatePresence>{showLandmarks && <DirectionGuides variant="landmarks" onClose={() => setShowLandmarks(false)} />}</AnimatePresence>
      {(activePin || canLeaveBus) && <div className="audio-bottom-wash" aria-hidden="true" />}
      <AnimatePresence>
        {(activePin || canLeaveBus) && (
          <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
            ref={audioCardRef} className="audio-card absolute z-[1000] text-zinc-800">
            {(canLeaveBus || (SHOW_AR_FILTER_BUTTONS && activePin && encounterLabels[activePin.id])) &&
              <div className="journey-actions">
                {SHOW_AR_FILTER_BUTTONS && activePin && encounterLabels[activePin.id] &&
                  <button type="button" className="journey-ar-launch" onClick={openAR}>{encounterLabels[activePin.id]}</button>}
                {canLeaveBus &&
                  <button type="button" className="journey-ar-launch" onClick={() => void leaveBus()}>I Left the Bus</button>}
              </div>}
            {canBoardBus &&
              <button type="button" className="journey-ar-launch" onClick={boardBus}>I'm on the bus</button>}
            <AnimatePresence mode="wait">{(activePin?.id === 'pin-11' || activePin?.id === 'pin-11b' || activePin?.id === 'pin-12') && <motion.button key={pavilionContinued ? 'pavilion-back' : 'pavilion-continue'} type="button" className="journey-ar-launch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .4 }} onClick={pavilionContinued ? goBackToPavilion : continuePavilionWalk}>{pavilionContinued ? 'Go back' : activePin?.id === 'pin-12' ? 'Continue walking – end of walk' : `Continue walking – start part ${activePin?.id === 'pin-11b' ? 3 : 2}`}</motion.button>}</AnimatePresence>
            {leavingBus && <p role="status" className="mb-2 text-xs">Switching to the walking route…</p>}
            {debugPlayback && <p className="debug-audio-status mb-2 text-xs font-bold">DEBUG AUDIO PREVIEW - GPS triggers paused</p>}
            <h2 className="mb-4 truncate font-mono text-sm font-normal tracking-wide" title={activePin?.name}>{activePin?.name ?? 'Optional MacRitchie walk'}</h2>
            {activePin && <div className="flex items-start gap-2">
              <button type="button" onClick={toggleAudio} disabled={leavingBus} aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
                className="-mt-5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-zinc-800">
                {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="audio-seek-track relative h-px w-full bg-zinc-400/50">
                  <div aria-hidden="true" className="h-full bg-zinc-800 transition-[width] duration-200 ease-linear"
                    style={{ width: `${duration > 0 ? Math.min(elapsed / duration, 1) * 100 : 0}%` }} />
                  <input type="range" min={0} max={duration || 1} step={0.1}
                    value={Math.min(elapsed, duration)} disabled={duration <= 0 || leavingBus}
                    aria-label="Seek audio" aria-valuetext={formatTime(elapsed)}
                    onChange={event => seekAudio(event.currentTarget.valueAsNumber)}
                    className="absolute -top-3 left-0 m-0 h-6 w-full cursor-pointer opacity-0 disabled:cursor-default" />
                </div>
                <div className="mt-2 flex justify-between font-mono text-[11px] tabular-nums text-zinc-500">
                  <span aria-label="Elapsed time">{formatTime(elapsed)}</span>
                  <span aria-label="Remaining time">-{formatTime(duration - elapsed)}</span>
                </div>
              </div>
            </div>}
            {audioError && <p role="status" className="mt-1 text-xs text-red-700">{audioError}</p>}
          </motion.div>
        )}
      </AnimatePresence>
      {arScene && <ARLoadBoundary key={arScene.launch.id} launch={arScene.launch} onClose={closeAR}><React.Suspense fallback={createPortal(<div className="ar-loading" role="dialog" aria-modal="true" aria-label="Loading AR"><p>Opening ground tracking…</p><button type="button" className="ar-capsule" onClick={closeAR}>Back to map</button></div>, arScene.launch.overlayRoot)}>
        <ARExperience kind={arScene.kind} launch={arScene.launch} trackId={arScene.trackId} audioUrl={arScene.audioUrl}
          audioRef={audioRef} playing={isPlaying} onToggleAudio={toggleAudio} onClose={closeAR} onRetry={retryAR} />
      </React.Suspense></ARLoadBoundary>}
      {handScene && <ARLoadBoundary key={`hand-${handScene.launch.id}`} launch={handScene.launch} onClose={closeHandAR}>
        <React.Suspense fallback={createPortal(<div className="ar-loading" role="dialog" aria-modal="true" aria-label="Loading hand AR"><p>Opening hand filter…</p><button type="button" className="ar-capsule" onClick={closeHandAR}>Back to map</button></div>, handScene.launch.overlayRoot)}>
          <HandARExperience launch={handScene.launch} trackId={handScene.trackId} audioUrl={handScene.audioUrl} audioRef={audioRef}
            playing={isPlaying} onToggleAudio={toggleAudio} onClose={closeHandAR} onRetry={retryHandAR} />
        </React.Suspense>
      </ARLoadBoundary>}
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onLoadStart={() => { setElapsed(0); setDuration(0); }}
        onLoadedMetadata={e => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onDurationChange={e => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onTimeUpdate={e => setElapsed(e.currentTarget.currentTime)}
        onError={(e) => {
          console.error('Audio playback error:', e);
          setIsPlaying(false);
          setAudioError('Failed to load audio file. Please check if the file exists.');
        }}
        className="hidden"
      />

      {showOpening && <JourneyOpening settings={fieldSettings} onContinue={handleStart} />}
    </div>
  );
}


