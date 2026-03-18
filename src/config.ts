import audio1 from "./assets/audio/01AngMoKioInt.mp3";
import audio2 from "./assets/audio/02AngMoKioIntExit.mp3";
import audio3 from "./assets/audio/03Blk324.mp3";
import audio4 from "./assets/audio/04Blk209.mp3";
import audio5 from "./assets/audio/05AngMoKioPrSch.mp3";
import audio6 from "./assets/audio/06OppBlk244.mp3";
import audio7 from "./assets/audio/07AftAngMoKioAve1.mp3";
import audio8 from "./assets/audio/08AftWindsorPkRd.mp3";
import audio9 from "./assets/audio/09ShunfuEst.mp3";
import audio10 from "./assets/audio/10OppStTheresasHme.mp3";
import audio11 from "./assets/audio/11WalktoMacritchie1.mp3";
import audio12 from "./assets/audio/12WalktoMacritchie2.mp3";
import audio13 from "./assets/audio/13WalktoMacritchie3.mp3";
import audio14 from "./assets/audio/14MtAlverniaHosp.mp3";
import audio15 from "./assets/audio/15OppSporePoloClub.mp3";
import audio16 from "./assets/audio/16OppNovenaLodge.mp3";
import audio17 from "./assets/audio/17ParishofChristCh.mp3";

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

export const STORAGE_KEY = "geoguide_pins";

export const DEFAULT_PINS: LocationPin[] = [
  {
    id: "pin-1",
    name: "Ang Mo Kio Int",
    lat: 1.3698061175541025,
    lng: 103.84847350608551,
    radius: 50,
    audioUrl: audio1,
    buttonLabel: "Play Audio 1",
    description: "Stop 1",
  },
  {
    id: "pin-2",
    name: "Ang Mo Kio Int Exit",
    lat: 1.370050598938354,
    lng: 103.84907773928799,
    radius: 25,
    audioUrl: audio2,
    buttonLabel: "Play Audio 2",
    description: "Stop 2",
  },
  {
    id: "pin-3",
    name: "Blk 324",
    lat: 1.369087795889759,
    lng: 103.84660152883492,
    radius: 50,
    audioUrl: audio3,
    buttonLabel: "Play Audio 3",
    description: "Stop 3",
  },
  {
    id: "pin-4",
    name: "Blk 209",
    lat: 1.3693759060776907,
    lng: 103.84321244576203,
    radius: 50,
    audioUrl: audio4,
    buttonLabel: "Play Audio 4",
    description: "Stop 4",
  },
  {
    id: "pin-5",
    name: "Ang Mo Kio Pr Sch",
    lat: 1.369841965569264,
    lng: 103.8399457253944,
    radius: 50,
    audioUrl: audio5,
    buttonLabel: "Play Audio 5",
    description: "Stop 5",
  },
  {
    id: "pin-6",
    name: "Opp Blk 244",
    lat: 1.3670701595812227,
    lng: 103.834052996558,
    radius: 50,
    audioUrl: audio6,
    buttonLabel: "Play Audio 6",
    description: "Stop 6",
  },
  {
    id: "pin-7",
    name: "Aft Ang Mo Kio Ave 1",
    lat: 1.366766885384622,
    lng: 103.82846218306724,
    radius: 50,
    audioUrl: audio7,
    buttonLabel: "Play Audio 7",
    description: "Stop 7",
  },
  {
    id: "pin-8",
    name: "Aft Windsor Pk Rd",
    lat: 1.357917885984446,
    lng: 103.82892908121242,
    radius: 50,
    audioUrl: audio8,
    buttonLabel: "Play Audio 8",
    description: "Stop 8",
  },
  {
    id: "pin-9",
    name: "Shunfu Est",
    lat: 1.3498494641059218,
    lng: 103.83737461004887,
    radius: 50,
    audioUrl: audio9,
    buttonLabel: "Play Audio 9",
    description: "Stop 9",
  },
  {
    id: "pin-10",
    name: "Opp St. Theresa's Hme",
    lat: 1.346172442028104,
    lng: 103.83878951004885,
    radius: 50,
    audioUrl: audio10,
    buttonLabel: "Play Audio 10",
    description: "Stop 10",
  },
  {
    id: "pin-11",
    name: "Walk to Macritchie 1",
    lat: 1.346115820602865,
    lng: 103.83831926864019,
    radius: 25,
    audioUrl: audio11,
    buttonLabel: "Play Audio 11",
    description: "Stop 11",
  },
  {
    id: "pin-12",
    name: "Walk to Macritchie 2",
    lat: 1.3455313814691061,
    lng: 103.83641533873757,
    radius: 50,
    audioUrl: audio12,
    buttonLabel: "Play Audio 12",
    description: "Stop 12",
  },
  {
    id: "pin-13",
    name: "Walk to Macritchie 3",
    lat: 1.343477669418711,
    lng: 103.83558584711426,
    radius: 50,
    audioUrl: audio13,
    buttonLabel: "Play Audio 13",
    description: "Stop 13",
  },
  {
    id: "pin-14",
    name: "Mt Alvernia Hosp",
    lat: 1.3412381142448144,
    lng: 103.83664695336662,
    radius: 50,
    audioUrl: audio14,
    buttonLabel: "Play Audio 14",
    description: "Stop 14",
  },
  {
    id: "pin-15",
    name: "Opp S'pore Polo Club",
    lat: 1.3318450399118509,
    lng: 103.8389047763409,
    radius: 50,
    audioUrl: audio15,
    buttonLabel: "Play Audio 15",
    description: "Stop 15",
  },
  {
    id: "pin-16",
    name: "Opp Novena Lodge",
    lat: 1.3236401441148236,
    lng: 103.84185833888529,
    radius: 50,
    audioUrl: audio16,
    buttonLabel: "Play Audio 16",
    description: "Stop 16",
  },
  {
    id: "pin-17",
    name: "Parish of Christ Ch",
    lat: 1.3119184308486453,
    lng: 103.8472393237936,
    radius: 50,
    audioUrl: audio17,
    buttonLabel: "Play Audio 17",
    description: "Stop 17",
  },
];

export const getStoredPins = (): LocationPin[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed: LocationPin[] = JSON.parse(stored);

      const isOldVersion =
        parsed.some(
          (pin) =>
            pin.radius === undefined ||
            pin.audioUrl.includes("soundhelix.com") ||
            pin.audioUrl.includes("audio1.mp3") ||
            pin.audioUrl === "/01AmkInt.mp3",
        ) || parsed.length !== 17;

      if (isOldVersion) {
        localStorage.removeItem(STORAGE_KEY);
        return DEFAULT_PINS;
      }

      return parsed;
    } catch (e) {
      console.error("Failed to parse stored pins", e);
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
