import audio1 from "./assets/audio/v9 01 Ang Mo Kio Int.mp3";
import boardingAudio from "./assets/audio/v9 01 Boarding Ang Mo Kio Int (get on bus).mp3";
import audio2 from "./assets/audio/v9 02 Blk 324.mp3";
import audio3 from "./assets/audio/v9 03 Blk 209.mp3";
import audio4 from "./assets/audio/v9 04 Ang Mo Kio Pr Sch.mp3";
import audio5 from "./assets/audio/v9 05 Opp Blk 244.mp3";
import audio6 from "./assets/audio/v9 06 Aft Ang Mo Kio Ave 1.mp3";
import audio7 from "./assets/audio/v9 07 Aft Windsor Pk Rd.mp3";
import audio7b from "./assets/audio/v9 07b Between 7 & 8.mp3";
import audio8 from "./assets/audio/v9 08 Thompson CC (formerly Shunfu Est).mp3";
import audio9 from "./assets/audio/v9 09 Opp St. Theresa_s Hme.mp3";
import audio9b from "./assets/audio/v9 09b Opp St. Theresa_s Hme (Get Off).mp3";
import audio10 from "./assets/audio/v9 10 Walk to Macritchie 1.mp3";
import audio11 from "./assets/audio/v9 11 Walk to Macritchie 2 (Pavillion 1).mp3";
import audio11b from "./assets/audio/v9 11b Walk to Macritchie 2 (Pavillion 2).mp3";
import audio12 from "./assets/audio/v9 12 Walk to Macritchie 3 (Pavillion 3).mp3";
import audio12b from "./assets/audio/v9 12b End of Macritchie.mp3";
import audio13 from "./assets/audio/v9 13 Mt Alvernia Hosp.mp3";
import audio13b from "./assets/audio/v9 13b Between 13&14.mp3";
import audio14 from "./assets/audio/v9 14 Opp S_pore Polo Club.mp3";
import audio15 from "./assets/audio/v9 15 Opp Novena Lodge.mp3";
import audio15b from "./assets/audio/v9 15b Between 15&16.mp3";
import audio16 from "./assets/audio/v9 16 Parish of Christ Ch.mp3";

export const BOARDING_AUDIO_URL = boardingAudio;

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

export const STORAGE_KEY = "geoguide_pins_v9_renumbered";
const PREVIOUS_STORAGE_KEY = "geoguide_pins_v9";

export const DEFAULT_PINS: LocationPin[] = [
  {
    "id": "pin-1",
    "name": "Ang Mo Kio Int",
    "lat": 1.3695976,
    "lng": 103.8484336,
    "radius": 60,
    "audioUrl": audio1,
    "buttonLabel": "Play Audio 1",
    "description": "Stop 1"
  },
  {
    "id": "pin-2",
    "name": "Blk 324",
    "lat": 1.369087795889759,
    "lng": 103.84660152883492,
    "radius": 50,
    "audioUrl": audio2,
    "buttonLabel": "Play Audio 2",
    "description": "Stop 2"
  },
  {
    "id": "pin-3",
    "name": "Blk 209",
    "lat": 1.3693759060776907,
    "lng": 103.84321244576203,
    "radius": 50,
    "audioUrl": audio3,
    "buttonLabel": "Play Audio 3",
    "description": "Stop 3"
  },
  {
    "id": "pin-4",
    "name": "Ang Mo Kio Pr Sch",
    "lat": 1.369841965569264,
    "lng": 103.8399457253944,
    "radius": 50,
    "audioUrl": audio4,
    "buttonLabel": "Play Audio 4",
    "description": "Stop 4"
  },
  {
    "id": "pin-5",
    "name": "Opp Blk 244",
    "lat": 1.3670701595812227,
    "lng": 103.834052996558,
    "radius": 50,
    "audioUrl": audio5,
    "buttonLabel": "Play Audio 5",
    "description": "Stop 5"
  },
  {
    "id": "pin-6",
    "name": "Aft Ang Mo Kio Ave 1",
    "lat": 1.366766885384622,
    "lng": 103.82846218306724,
    "radius": 50,
    "audioUrl": audio6,
    "buttonLabel": "Play Audio 6",
    "description": "Stop 6"
  },
  {
    "id": "pin-7",
    "name": "Aft Windsor Pk Rd",
    "lat": 1.357917885984446,
    "lng": 103.82892908121242,
    "radius": 50,
    "audioUrl": audio7,
    "buttonLabel": "Play Audio 7",
    "description": "Stop 7"
  },
  {
    "id": "pin-7b",
    "name": "Between 7 & 8",
    "lat": 1.3547091471514277,
    "lng": 103.83295984751881,
    "radius": 50,
    "audioUrl": audio7b,
    "buttonLabel": "Play Audio 7b",
    "description": "Stop 7b. Provisional 50 m radius; workbook radius is blank."
  },
  {
    "id": "pin-8",
    "name": "Thompson CC",
    "lat": 1.3514877292083995,
    "lng": 103.83592250436814,
    "radius": 50,
    "audioUrl": audio8,
    "buttonLabel": "Play Audio 8",
    "description": "Stop 8"
  },
  {
    "id": "pin-9",
    "name": "Opp St. Theresa's Hme",
    "lat": 1.3463879469333586,
    "lng": 103.83875931229656,
    "radius": 60,
    "audioUrl": audio9,
    "buttonLabel": "Play Audio 9",
    "description": "Stop 9"
  },
  {
    "id": "pin-9b",
    "name": "Opp St. Theresa's Hme (Get off)",
    "lat": 1.3463879469333586,
    "lng": 103.83875931229656,
    "radius": 60,
    "audioUrl": audio9b,
    "buttonLabel": "Play Audio 9b",
    "description": "Stop 9b"
  },
  {
    "id": "pin-10",
    "name": "Walk to MacRitchie 1 (Fig)",
    "lat": 1.3458626601144086,
    "lng": 103.83792485944144,
    "radius": 50,
    "audioUrl": audio10,
    "buttonLabel": "Play Audio 10",
    "description": "Stop 10"
  },
  {
    "id": "pin-11",
    "name": "Walk to MacRitchie 2 (Pavilion 1)",
    "lat": 1.3456217097428054,
    "lng": 103.83658693895325,
    "radius": 50,
    "audioUrl": audio11,
    "buttonLabel": "Play Audio 11",
    "description": "Stop 11"
  },
  {
    "id": "pin-11b",
    "name": "Walk to MacRitchie 2b (Pavilion 2)",
    "lat": 1.345196032059016,
    "lng": 103.83560879934382,
    "radius": 50,
    "audioUrl": audio11b,
    "buttonLabel": "Play Audio 11b",
    "description": "Stop 11b"
  },
  {
    "id": "pin-12",
    "name": "Walk to MacRitchie 3 (Pavilion 3)",
    "lat": 1.3438015917681236,
    "lng": 103.83543835393914,
    "radius": 50,
    "audioUrl": audio12,
    "buttonLabel": "Play Audio 12",
    "description": "Stop 12"
  },
  {
    "id": "pin-12b",
    "name": "End of MacRitchie Walk",
    "lat": 1.342491686652401,
    "lng": 103.83502084637337,
    "radius": 50,
    "audioUrl": audio12b,
    "buttonLabel": "Play Audio 12b",
    "description": "Stop 12b"
  },
  {
    "id": "pin-13",
    "name": "Mt Alvernia Hosp",
    "lat": 1.3412381142448144,
    "lng": 103.83664695336662,
    "radius": 50,
    "audioUrl": audio13,
    "buttonLabel": "Play Audio 13",
    "description": "Stop 13"
  },
  {
    "id": "pin-13b",
    "name": "Between 13&14",
    "lat": 1.3370232780936842,
    "lng": 103.83746806717761,
    "radius": 50,
    "audioUrl": audio13b,
    "buttonLabel": "Play Audio 13b",
    "description": "Stop 13b. Provisional 50 m radius; workbook radius is blank."
  },
  {
    "id": "pin-14",
    "name": "Opp S'pore Polo Club",
    "lat": 1.3318450399118509,
    "lng": 103.8389047763409,
    "radius": 50,
    "audioUrl": audio14,
    "buttonLabel": "Play Audio 14",
    "description": "Stop 14"
  },
  {
    "id": "pin-15",
    "name": "Opp Novena Lodge",
    "lat": 1.3236401441148236,
    "lng": 103.84185833888529,
    "radius": 50,
    "audioUrl": audio15,
    "buttonLabel": "Play Audio 15",
    "description": "Stop 15"
  },
  {
    "id": "pin-15b",
    "name": "Between 15&16",
    "lat": 1.3164912748918802,
    "lng": 103.84482170757835,
    "radius": 50,
    "audioUrl": audio15b,
    "buttonLabel": "Play Audio 15b",
    "description": "Stop 15b"
  },
  {
    "id": "pin-16",
    "name": "Parish of Christ Ch",
    "lat": 1.3119184308486453,
    "lng": 103.8472393237936,
    "radius": 50,
    "audioUrl": audio16,
    "buttonLabel": "Play Audio 16",
    "description": "Stop 16"
  }
];

export const getStoredPins = (): LocationPin[] => {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    const stored = current ?? localStorage.getItem(PREVIOUS_STORAGE_KEY);
    if (!stored) return DEFAULT_PINS;
    const parsed: LocationPin[] = JSON.parse(stored);
    if (!Array.isArray(parsed)) return DEFAULT_PINS;
    // Resolve current build URLs instead of stale saved asset hashes.
    return DEFAULT_PINS.map(defaultPin => {
      const previousId = current === null
        ? defaultPin.id.replace(/\d+/, number => Number(number) === 1 ? number : String(Number(number) + 1))
        : defaultPin.id;
      const saved = parsed.find(pin => pin.id === previousId);
      if (!saved || !Number.isFinite(saved.lat) || !Number.isFinite(saved.lng) || !Number.isFinite(saved.radius) || saved.radius <= 0) return defaultPin;
      const previousLabel = 'Play Audio ' + previousId.replace('pin-', '');
      return {
        ...defaultPin,
        lat: saved.lat,
        lng: saved.lng,
        radius: saved.radius,
        buttonLabel: saved.buttonLabel && saved.buttonLabel !== previousLabel ? saved.buttonLabel : defaultPin.buttonLabel,
      };
    });
  } catch (error) {
    console.error("Failed to read stored pins", error);
    return DEFAULT_PINS;
  }
};
export const savePins = (pins: LocationPin[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
export const resetPins = () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PREVIOUS_STORAGE_KEY);
};
