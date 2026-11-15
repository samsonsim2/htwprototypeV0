import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import stairs from '../assets/images/DSC04671.jpg';
import bus from '../assets/images/DSC04692.jpg';
import pavilion from '../assets/images/DSC04667.jpg';
import thirdPavilion from '../assets/images/DSC04668.jpg';
import victorian from '../assets/images/DSC04663.jpg';
import tembusu from '../assets/images/DSC00005.jpg';
import amenitiesBridge from '../assets/images/DSC04674.jpg';
import restStop from '../assets/images/RestStop.jpg';

const busCards = [
  { image: bus, text: 'Cross the overhead bridge to the furthest end and board the next bus 166.' },
];

const landmarkCards = [{ image: victorian, text: 'Victorian Pavilion' }, { image: tembusu, text: 'Tembusu Tree' }];
const amenitiesCards = [{ image: stairs, text: 'Go down the steps' }, { image: amenitiesBridge, text: 'Cross the bridge' }, { image: restStop, text: 'Find the Amenities Centre' }];

export default function DirectionGuides({ onClose, singlePavilion = false, pavilionNumber = 2, variant = 'bus' }: { onClose: () => void; singlePavilion?: boolean; pavilionNumber?: 2 | 3; variant?: 'bus' | 'landmarks' | 'amenities' }) {
  const cards = variant === 'landmarks' ? landmarkCards : variant === 'amenities' ? amenitiesCards : busCards;
  const singleCard = singlePavilion || cards.length === 1;
  const pavilionInstruction = `Find the ${pavilionNumber === 3 ? 'third' : 'second'} pavilion`;
  const [index, setIndex] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  const next = () => setIndex(current => (current + 1) % cards.length);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (!singleCard && event.key === 'ArrowRight') setIndex(current => (current + 1) % cards.length);
      if (!singleCard && event.key === 'ArrowLeft') setIndex(current => (current + cards.length - 1) % cards.length);
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
      <button ref={closeRef} className="phone-help-close direction-guides-close" aria-label="Close direction guides" onClick={onClose}>×</button>
      <p className="direction-guide-instruction" aria-live="polite">{singlePavilion ? pavilionInstruction : <>{!singleCard && variant !== 'landmarks' && <span className="direction-guide-step">Step {index + 1}</span>}{cards[index].text}</>}</p>
      <div className="direction-photo-stack">
        <div className="direction-photo-glow" aria-hidden="true" />
        {singleCard ? <img className="direction-photo direction-photo-single" src={singlePavilion ? (pavilionNumber === 3 ? thirdPavilion : pavilion) : cards[0].image} alt={singlePavilion ? pavilionInstruction : cards[0].text} /> : Array.from({ length: cards.length }, (_, i) => cards.length - 1 - i).map(depth => {
          const cardIndex = (index + depth) % cards.length;
          return <motion.img key={cardIndex} src={cards[cardIndex].image} alt={depth === 0 ? cards[cardIndex].text : ''} aria-hidden={depth !== 0} className="direction-photo" style={{ zIndex: 3 - depth, objectPosition: cards[cardIndex].image === stairs ? 'center 80%' : 'center' }} animate={{ rotate: depth === 0 ? 0 : depth === 1 ? -6 : 7, x: 0, opacity: 1 }} transition={{ duration: reduced ? 0 : .35 }} drag={depth === 0 ? 'x' : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={.6} onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 40 || Math.abs(info.velocity.x) > 300) next(); }} />;
        })}
      </div>
      {!singleCard && <><button className="direction-guide-next" onClick={next}>Swipe to see next</button>
      <p className="direction-guide-count" aria-label={`Card ${index + 1} of ${cards.length}`}>{index + 1} / {cards.length}</p></>}
    </div>
  </motion.div>;
}
