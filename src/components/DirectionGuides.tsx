import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import closeIcon from '../assets/images/Close.png';
import forwardIcon from '../assets/images/Arrow Forward.png';
import stairs from '../assets/images/cards/DSC04671.jpg';
import bus from '../assets/images/cards/DSC04692.jpg';
import pavilion from '../assets/images/cards/DSC04667.jpg';
import thirdPavilion from '../assets/images/cards/DSC04668.jpg';
import victorian from '../assets/images/cards/DSC04663.jpg';
import tembusu from '../assets/images/cards/DSC00005.jpg';
import amenitiesBridge from '../assets/images/cards/DSC04674.jpg';
import restStop from '../assets/images/cards/RestStop.jpg';
import parkStairs from '../assets/images/cards/DSC04538.jpg';
import underpass from '../assets/images/cards/macritchie-viaduct-underpass.jpg';
import towardsPark from '../assets/images/cards/DSC04559.jpg';

const busCards = [
  { image: bus, text: 'Cross the overhead bridge to the furthest end and board the next bus 166.' },
];

const landmarkCards = [{ image: victorian, text: 'Victorian Pavilion' }, { image: tembusu, text: 'Tembusu Tree' }];
const amenitiesCards = [{ image: stairs, text: 'Go down the steps' }, { image: amenitiesBridge, text: 'Cross the bridge' }, { image: restStop, text: 'Find the Amenities Centre' }];

const parkRouteCards = [
  { image: parkStairs, text: 'Go down the stairs' },
  { image: underpass, text: 'Through the MacRitchie Viaduct Underpass' },
  { image: towardsPark, text: 'Towards the park' },
];

export default function DirectionGuides({ onClose, singlePavilion = false, pavilionNumber = 2, variant = 'bus' }: { onClose: () => void; singlePavilion?: boolean; pavilionNumber?: 2 | 3; variant?: 'bus' | 'landmarks' | 'amenities' | 'park-route' | 'fig-route' }) {
  const cards = variant === 'fig-route' ? [{ image: pavilion, text: 'Walk towards the reservoir and find the first pavilion' }] : variant === 'park-route' ? parkRouteCards : variant === 'landmarks' ? landmarkCards : variant === 'amenities' ? amenitiesCards : busCards;
  const singleCard = singlePavilion || cards.length === 1;
  const pavilionInstruction = `Find the ${pavilionNumber === 3 ? 'third' : 'second'} pavilion`;
  const [index, setIndex] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  const activeCard = singlePavilion ? { image: pavilionNumber === 3 ? thirdPavilion : pavilion, text: pavilionInstruction } : cards[index];
  const next = () => setIndex(current => (current + 1) % cards.length);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (!singleCard && event.key === 'ArrowRight') setIndex(current => (current + 1) % cards.length);
      if (!singleCard && event.key === 'ArrowLeft') setIndex(current => Math.max(current - 1, 0));
      if (event.key === 'Tab') {
        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.direction-guides button'));
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        buttons[(current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => { window.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [onClose, singleCard, cards.length]);
  return <motion.div className="direction-guides" role="dialog" aria-modal="true" aria-label="Direction guides" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .3 }}>
    <div className="direction-guides-content">
      <button ref={closeRef} className="direction-guides-close" aria-label="Close direction guides" onClick={onClose}><img src={closeIcon} alt="" /></button>
      <div className="direction-photo-frame">
        <AnimatePresence initial={false}>
          <motion.img key={activeCard.image} src={activeCard.image} alt={activeCard.text} className="direction-photo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .15 }} />
        </AnimatePresence>
      </div>
      <div className="direction-guide-footer">
      <p className="direction-guide-instruction" aria-live="polite">{!singleCard && `(${index + 1}) `}{activeCard.text}</p>
      {!singleCard && <button className="direction-guide-next" onClick={next} aria-label="Next card"><img src={forwardIcon} alt="" /></button>}
      </div>
    </div>
  </motion.div>;
}



