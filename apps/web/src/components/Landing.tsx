import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { Icon } from '@iconify/react/offline';
import solar from './solar-icons.json';
const arrowDown = solar['arrow-down-linear'];
const arrowRight = solar['arrow-right-linear'];
const pen = solar['pen-new-square-linear'];
const lock = solar['lock-keyhole-minimalistic-linear'];
const layers = solar['layers-minimalistic-linear'];
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FlipCard } from './FlipCard';

type Props = {
  configured: boolean;
  busy: boolean;
  error: string;
  cancelled: boolean;
  onSignin: () => void;
};
function Words({ children }: { children: string }) {
  return (
    <>
      <span className="sr-only">{children}</span>
      <span aria-hidden="true">
        {children.split(' ').map((word, index) => (
          <span className="heading-word" key={index}>
            {word}{' '}
          </span>
        ))}
      </span>
    </>
  );
}
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" data-icon="inline-start" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.87h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.35ZM12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22ZM6.41 13.91a6 6 0 0 1 0-3.82V7.5H3.07a10 10 0 0 0 0 9l3.34-2.59ZM12 5.97c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.5l3.34 2.59A6 6 0 0 1 12 5.97Z"
      />
    </svg>
  );
}

export function Landing({
  configured,
  busy,
  error,
  cancelled,
  onSignin,
}: Props) {
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    const context = gsap.context(() => {
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Lenis is the only scroll engine and lives only while this landing mounts.
        const lenis = new Lenis({
          duration: 1.05,
          smoothWheel: true,
          syncTouch: false,
          anchors: true,
        });
        const update = () => ScrollTrigger.update();
        const tick = (time: number) => lenis.raf(time * 1000);
        lenis.on('scroll', update);
        gsap.ticker.add(tick);
        const refresh = () => {
          lenis.resize();
          ScrollTrigger.refresh();
        };
        let alive = true;
        void document.fonts.ready.then(() => {
          if (alive) refresh();
        });
        window.addEventListener('resize', refresh);
        const visibility = () => {
          if (document.hidden) lenis.stop();
          else {
            lenis.start();
            refresh();
          }
        };
        document.addEventListener('visibilitychange', visibility);
        // Only transforms animate: every word and action remains legible on first paint.
        gsap.from('.landing-hero .heading-word', {
          y: 26,
          rotation: 1.5,
          stagger: 0.045,
          duration: 0.9,
          ease: 'power3.out',
          clearProps: 'transform',
        });
        gsap.from(
          '.landing-hero .hero-description,.landing-hero .hero-actions',
          {
            y: 16,
            stagger: 0.1,
            duration: 0.8,
            ease: 'power3.out',
            clearProps: 'transform',
          },
        );
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((section) => {
          gsap.from(section.querySelectorAll('.heading-word'), {
            y: 24,
            stagger: 0.04,
            duration: 0.8,
            ease: 'power3.out',
            clearProps: 'transform',
            scrollTrigger: { trigger: section, start: 'top 82%', once: true },
          });
          gsap.from(section.querySelectorAll('[data-reveal-copy]'), {
            y: 18,
            stagger: 0.08,
            duration: 0.8,
            ease: 'power3.out',
            clearProps: 'transform',
            scrollTrigger: { trigger: section, start: 'top 78%', once: true },
          });
        });
        refresh();
        return () => {
          alive = false;
          window.removeEventListener('resize', refresh);
          document.removeEventListener('visibilitychange', visibility);
          lenis.off('scroll', update);
          gsap.ticker.remove(tick);
          lenis.destroy();
        };
      });
    }, root);
    return () => {
      mm.revert();
      context.revert();
    };
  }, []);
  const cta = (label = 'Continue with Google') => (
    <Button size="lg" disabled={!configured || busy} onClick={onSignin}>
      <GoogleMark />
      {busy ? 'Opening Google…' : label}
    </Button>
  );
  return (
    <main id="main" className="landing" ref={root}>
      <section
        className="landing-hero landing-width"
        aria-labelledby="hero-heading"
      >
        <h1 id="hero-heading">
          <Words>A little practice.</Words>
          <br />
          <Words>A lot remembered.</Words>
        </h1>
        <p className="hero-description">
          Big ideas, little cards. Give what you’re learning
          <br className="desktop-break" /> a place to stay.
        </p>
        <div className="hero-actions">
          {cta()}
          <Button variant="ghost" size="lg" asChild>
            <a href="#try-a-card">
              Try a little card
              <Icon icon={arrowDown} data-icon="inline-end" />
            </a>
          </Button>
        </div>
        <p className="hero-note">Just you and the things you want to know.</p>
        <div className="landing-notices">
          {cancelled && (
            <Alert>
              <AlertTitle>Sign-in wasn’t completed</AlertTitle>
              <AlertDescription>
                You can try Google again whenever you’re ready.
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert>
              <AlertTitle>Sign-in needs another try</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!configured && (
            <Alert>
              <AlertTitle>Sign-in is being set up</AlertTitle>
              <AlertDescription>
                Connect Google and the database to open your study space.
              </AlertDescription>
            </Alert>
          )}
        </div>
        <div id="try-a-card" className="hero-demo">
          <FlipCard />
        </div>
      </section>
      <section
        id="a-little-different"
        className="landing-dark"
        data-reveal
        aria-labelledby="principles-heading"
      >
        <div className="landing-width principles-layout">
          <div className="principles-heading">
            <span className="section-note">Less noise. More knowing.</span>
            <h2 id="principles-heading">
              <Words>For the things you want to keep.</Words>
            </h2>
            <p data-reveal-copy>
              That term from class. The definition that won’t stick. Give each
              one a little space of its own.
            </p>
          </div>
          <div className="principles-list" data-reveal-copy>
            <article>
              <Icon icon={pen} />
              <div>
                <h3>In your own words.</h3>
                <p>
                  Write your questions and answers the way they make sense to
                  you.
                </p>
              </div>
            </article>
            <article>
              <Icon icon={layers} />
              <div>
                <h3>One idea at a time.</h3>
                <p>
                  Gather related cards into a deck. Add a little now, come back
                  for more later.
                </p>
              </div>
            </article>
            <article>
              <Icon icon={lock} />
              <div>
                <h3>Your own corner.</h3>
                <p>
                  Your decks are private to your account. Nothing to compete
                  for. Just something to learn.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>
      <section
        id="make-it-yours"
        className="landing-workflow landing-width"
        data-reveal
        aria-labelledby="workflow-heading"
      >
        <div className="workflow-copy">
          <span className="section-note">A beginning, on both sides.</span>
          <h2 id="workflow-heading">
            <Words>Small cards. Your kind of thinking.</Words>
          </h2>
          <p data-reveal-copy>
            Start a deck. Write a question. Turn it over and put the answer in
            your own words. Save it for the next time you need a little
            reminder.
          </p>
          <a className="workflow-link" href="#get-started">
            Make a little room
            <Icon icon={arrowRight} />
          </a>
        </div>
        <div
          className="workflow-specimen"
          data-reveal-copy
          aria-label="Example of a private deck with a flashcard"
        >
          <div className="specimen-title">
            <span>The cell, simply</span>
            <span>Private deck</span>
          </div>
          <div className="specimen-face">
            <span>Front</span>
            <p>What is a cell?</p>
          </div>
          <div className="specimen-face specimen-answer">
            <span>Back</span>
            <p>
              The smallest living unit. A tiny beginning for every living thing.
            </p>
          </div>
          <p className="specimen-note">A sample of what you can make.</p>
        </div>
      </section>
      <section
        id="get-started"
        className="landing-close"
        data-reveal
        aria-labelledby="close-heading"
      >
        <div className="landing-width">
          <span className="section-note">Bring a little curiosity.</span>
          <h2 id="close-heading">
            <Words>Leave with a little more.</Words>
          </h2>
          <p data-reveal-copy>
            Your first deck starts with one thing you want to remember.
          </p>
          <div className="close-action" data-reveal-copy>
            {cta()}
            <span>Private decks. A pace that’s yours.</span>
          </div>
          <div className="landing-footer">
            <a
              href="#main"
              aria-label="Quibbi, back to top"
              className="landing-footer-brand"
            >
              quibbi.
            </a>
            <span>A little space to learn.</span>
            <a href="#try-a-card">
              One more card?
              <Icon icon={arrowRight} />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
