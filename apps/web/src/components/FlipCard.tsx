import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Icon } from '@iconify/react/offline';
import solar from './solar-icons.json';
const refresh = solar['restart-linear'];

/** Real two-sided card. GSAP owns rotation; React owns accessible face state. */
export function FlipCard() {
  const [flipped, setFlipped] = useState(false);
  const inner = useRef<HTMLSpanElement>(null);
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useLayoutEffect(() => {
    const element = inner.current;
    if (!element) return;
    if (reduced) {
      gsap.set(element, { rotationY: 0 });
      return;
    }
    const tween = gsap.to(element, {
      rotationY: flipped ? 180 : 0,
      duration: 0.68,
      ease: 'power3.inOut',
      overwrite: true,
    });
    return () => {
      tween.kill();
    };
  }, [flipped, reduced]);
  return (
    <div className="flashcard-demo">
      <div className="demo-toolbar">
        <span>Biology, one idea at a time</span>
        <span>Sample card</span>
      </div>
      <button
        type="button"
        className="flip-card"
        data-flipped={flipped}
        data-reduced={reduced}
        aria-pressed={flipped}
        aria-label={`Sample card. ${flipped ? 'Answer: The mitochondrion.' : 'Question: What powers a cell?'} ${flipped ? 'See question.' : 'Reveal answer.'}`}
        onClick={() => setFlipped((value) => !value)}
      >
        <span className="flip-card-inner" ref={inner}>
          <span
            className="flip-card-face flip-card-front"
            aria-hidden={flipped}
          >
            <span className="face-label">A little question</span>
            <span className="face-question">
              What powers
              <br />a cell?
            </span>
            <span className="face-action">
              <Icon icon={refresh} />
              Reveal answer
            </span>
          </span>
          <span
            className="flip-card-face flip-card-back"
            aria-hidden={!flipped}
          >
            <span className="face-label">A little knowledge</span>
            <span className="face-question">
              The
              <br /> mitochondrion.
            </span>
            <span className="face-action">
              <Icon icon={refresh} />
              See question
            </span>
          </span>
        </span>
      </button>
      <p className="demo-caption">
        A question. A pause. A little more remembered.
      </p>
      <span className="sr-only" role="status" aria-live="polite">
        {flipped
          ? 'Answer: The mitochondrion.'
          : 'Question: What powers a cell?'}
      </span>
    </div>
  );
}
