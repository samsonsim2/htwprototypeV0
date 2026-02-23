import audio1 from './assets/audio/01AmkInt.mp3';
import audio2 from './assets/audio/02Blk324.mp3';
import audio3 from './assets/audio/03Blk209.mp3';
import audio4 from './assets/audio/04AmkPriSch.mp3';
import audio5 from './assets/audio/05AftAmkAve.mp3';

export interface LocationPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  audioUrl: string;
  buttonLabel: string;
  description: string;
}

export const STORAGE_KEY = 'geoguide_pins';

export const DEFAULT_PINS: LocationPin[] = [
  {
    id: 'pin-1',
    name: 'Location 1',
    lat: 1.3179288936546796,
    lng: 103.91176971439205,
    radius: 50,
    audioUrl: audio1,
    buttonLabel: 'Play Audio 1',
    description: 'First historical point of interest.'
  },
  {
    id: 'pin-2',
    name: 'Location 2',
    lat: 1.3176661057893853,
    lng: 103.91228690401714,
    radius: 50,
    audioUrl: audio3,
    buttonLabel: 'Play Audio 2',
    description: 'Second historical point of interest.'
  },
  {
    id: 'pin-3',
    name: 'Location 3',
    lat: 1.3187845734739272,
    lng: 103.91161636053626,
    radius: 50,
    audioUrl: audio3,
    buttonLabel: 'Play Audio 3',
    description: 'Third historical point of interest.'
  },
  {
    id: 'pin-4',
    name: 'Location 4',
    lat: 1.3185708719523623,
    lng: 103.91103831042392,
    radius: 50,
    audioUrl: audio4,
    buttonLabel: 'Play Audio 4',
    description: 'Fourth historical point of interest.'
  },
  {
    id: 'pin-5',
    name: 'Location 5',
    lat: 1.318497914008612,
    lng: 103.9104105204259,
    radius: 50,
    audioUrl: audio5,
    buttonLabel: 'Play Audio 5',
    description: 'Fifth historical point of interest.'
  }
];

export const getStoredPins = (): LocationPin[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed: LocationPin[] = JSON.parse(stored);
      // Migration check: if any pin is missing the 'radius' property or has a placeholder URL, reset to defaults
      const isOldVersion = parsed.some(pin => 
        pin.radius === undefined || 
        pin.audioUrl.includes('soundhelix.com') ||
        pin.audioUrl.includes('audio1.mp3') ||
        pin.audioUrl === '/01AmkInt.mp3'
      );
      
      if (isOldVersion) {
        localStorage.removeItem(STORAGE_KEY);
        return DEFAULT_PINS;
      }
      
      return parsed;
    } catch (e) {
      console.error('Failed to parse stored pins', e);
    }
  }
  return DEFAULT_PINS;
};

export const savePins = (pins: LocationPin[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
};

export const resetPins = () => {
  localStorage.removeItem(STORAGE_KEY);
};
