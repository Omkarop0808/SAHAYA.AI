import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { useWorld } from '../../context/WorldContext';
import AbstractTransition from './three/AbstractTransition';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = () => setReduced(Boolean(mq.matches));
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

/** Ensures refs exist after AnimatePresence paints (fixes blank / stuck transitions). */
function useRefsReady(isOpen, rootRef, foldRef, progressRef) {
  const [ready, setReady] = useState(0);
  useLayoutEffect(() => {
    if (!isOpen) {
      setReady(0);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const tryReady = () => {
      if (cancelled) return;
      attempts += 1;
      if (rootRef.current && foldRef.current && progressRef.current) {
        setReady(2);
        return;
      }
      if (attempts < 24) requestAnimationFrame(tryReady);
      else setReady(2);
    };
    requestAnimationFrame(() => requestAnimationFrame(tryReady));
    return () => {
      cancelled = true;
    };
  }, [isOpen, rootRef, foldRef, progressRef]);
  return ready;
}

export default function WorldTransitionOverlay() {
  const navigate = useNavigate();
  const { switchState, completeWorldSwitch, endWorldSwitch } = useWorld();
  const reducedMotion = usePrefersReducedMotion();

  const [phase, setPhase] = useState('idle');
  const rootRef = useRef(null);
  const foldRef = useRef(null);
  const progressRef = useRef(null);
  const progressFillRef = useRef(null);
  const hasNavigatedRef = useRef(false);
  const tlRef = useRef(null);

  const isOpen = switchState.status === 'running' || switchState.status === 'settling';
  const targetWorld = switchState.targetWorld;
  const toCareer = targetWorld === 'career';

  const refsReady = useRefsReady(isOpen, rootRef, foldRef, progressFillRef);
  const worldContentRef = useRef(null);

  useEffect(() => {
    if (switchState.status === 'running' && switchState.startedAt) {
      hasNavigatedRef.current = false;
    }
  }, [switchState.status, switchState.startedAt]);

  useEffect(() => {
    // Cache world content element for blur/scale animation; never blur overlay/canvas.
    worldContentRef.current = document.getElementById('world-content');
  }, []);

  const palette = useMemo(() => {
    if (toCareer) {
      return {
        label: 'Entering Career World',
        sub: 'Calibrating technical prep suite…',
        bgA: '#0A0A0F',
        bgB: '#14532d',
        accent: '#8B5CF6',
        accent2: '#06B6D4',
        foldFrom: 'linear-gradient(145deg, rgba(236,253,245,0.95) 0%, rgba(224,242,254,0.88) 45%, rgba(15,23,42,0.92) 100%)',
        foldTo: 'linear-gradient(155deg, rgba(10,10,15,0.98) 0%, rgba(20,83,45,0.35) 55%, rgba(10,10,15,0.99) 100%)',
      };
    }
    return {
      label: 'Returning to Study World',
      sub: 'Restoring your learning space…',
      bgA: '#022c22', // Very dark emerald
      bgB: '#0f172a', // Dark slate
      accent: '#8B5CF6',
      accent2: '#10b981',
      foldFrom: 'linear-gradient(145deg, rgba(17,17,24,0.96) 0%, rgba(88,28,135,0.45) 45%, rgba(10,10,15,0.98) 100%)',
      foldTo: 'linear-gradient(155deg, rgba(6,78,59,0.97) 0%, rgba(2,44,34,0.92) 50%, rgba(15,23,42,0.95) 100%)',
    };
  }, [toCareer]);

  /* Safety: never leave user stuck behind overlay */
  useEffect(() => {
    if (switchState.status !== 'running') return;
    const started = switchState.startedAt || Date.now();
    const failSafe = setTimeout(() => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      try {
        completeWorldSwitch(navigate);
      } catch {
        /* ignore */
      }
      setTimeout(() => endWorldSwitch(), 400);
    }, 2800);
    const maxAnim = setTimeout(() => {
      endWorldSwitch();
    }, 3500);
    return () => {
      clearTimeout(failSafe);
      clearTimeout(maxAnim);
    };
  }, [switchState.status, switchState.startedAt, completeWorldSwitch, endWorldSwitch, navigate]);

  useLayoutEffect(() => {
    if (!isOpen || !targetWorld) {
      setPhase('idle');
      tlRef.current?.kill();
      return;
    }
    if (refsReady < 2) return;

    const root = rootRef.current;
    const fold = foldRef.current;
    const bar = progressFillRef.current;
    const worldContent = worldContentRef.current;
    if (!root || !fold || !bar) return;

    const foldFrom = palette.foldFrom;
    const foldTo = palette.foldTo;

    setPhase('fold');
    tlRef.current?.kill();

    gsap.set(bar, { scaleX: 0, transformOrigin: '0% 50%' });
    gsap.set(fold, { opacity: 0, rotateX: 0, scale: 1, filter: 'blur(0px)', background: foldFrom });
    if (worldContent) gsap.set(worldContent, { filter: 'blur(0px)', scale: 1, transformOrigin: '50% 50%' });

    // Exact timing sequence (non-reduced):
    // 0–150ms: world content blur(0)->blur(20), scale(1)->scale(0.98)
    // 150ms: canvas fully visible, particles at intensity
    // 150–700ms: hold overlay
    // 700ms: apply new theme behind canvas (route change)
    // 700–900ms: canvas opacity 1->0 AND world content blur(20)->0
    // 900ms: overlay removed from DOM, no residual blur
    const tBlurOut = reducedMotion ? 0.01 : 0.15;
    const tHold = reducedMotion ? 0.02 : 0.55;
    const tFade = reducedMotion ? 0.01 : 0.2;

    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      onComplete: () => setPhase('travel'),
    });

    // t=0–150ms: blur world content out; fold flashes in for extra punch
    if (worldContent) {
      tl.to(worldContent, { filter: 'blur(20px)', scale: 0.98, duration: tBlurOut }, 0);
    }
    tl.to(bar, { scaleX: 1, duration: tBlurOut + tHold + tFade, ease: 'none' }, 0)
      .to(fold, { opacity: 1, duration: tBlurOut * 0.9 }, 0)
      .to(
        fold,
        {
          rotateX: reducedMotion ? 0 : -10,
          scale: reducedMotion ? 1 : 0.92,
          filter: reducedMotion ? 'blur(0px)' : 'blur(2px)',
          background: foldTo,
          duration: tBlurOut,
        },
        0,
      )
      // t=150ms: canvas appears over everything
      .call(() => setPhase('travel'), null, tBlurOut)
      // t=700ms: navigate to new world behind overlay
      .call(() => {
        if (hasNavigatedRef.current) return;
        hasNavigatedRef.current = true;
        completeWorldSwitch(navigate);
      }, null, tBlurOut + tHold)
      // t=700–900ms: fade overlay/canvas; bring content blur back to 0
      .call(() => setPhase('burst'), null, tBlurOut + tHold)
      .to(root, { opacity: 0, duration: tFade, ease: 'power2.out' }, tBlurOut + tHold)
      .to(fold, { opacity: 0, duration: tFade * 0.9 }, tBlurOut + tHold)
      .to(worldContent || {}, { filter: 'blur(0px)', scale: 1, duration: tFade, ease: 'power2.out' }, tBlurOut + tHold)
      // t=900ms: remove overlay and hard-reset world content filters
      .call(() => {
        if (worldContent) {
          gsap.set(worldContent, { filter: 'none', scale: 1 });
        }
        endWorldSwitch();
      }, null, tBlurOut + tHold + tFade);

    tlRef.current = tl;

    return () => {
      tl.kill();
      if (worldContent) {
        gsap.set(worldContent, { filter: 'none', scale: 1 });
      }
    };
  }, [isOpen, targetWorld, refsReady, completeWorldSwitch, endWorldSwitch, navigate, reducedMotion, toCareer, palette]);

  return (
    <AnimatePresence>
      {isOpen && targetWorld && (
        <motion.div
          ref={rootRef}
          key="world-transition"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.1 : 0.15 }}
          className="fixed inset-0 z-[9999] flex flex-col"
          style={{ pointerEvents: 'auto' }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(1000px 700px at 50% 38%, ${palette.bgB}, ${palette.bgA})`,
            }}
          />

          <div className="absolute inset-0 flex items-center justify-center perspective-[1400px]">
            <div
              ref={foldRef}
              className="absolute inset-[8%] rounded-2xl shadow-2xl"
              style={{
                transformStyle: 'preserve-3d',
                transformOrigin: '50% 60%',
                border: `1px solid ${toCareer ? 'rgba(139,92,246,0.35)' : 'rgba(5,150,105,0.25)'}`,
              }}
            />
          </div>

          <div className="absolute inset-0 pointer-events-none">
            <AbstractTransition
              accent={palette.accent}
              accent2={palette.accent2}
              variant={toCareer ? 'vortex' : 'bloom'}
              enabled={!reducedMotion}
              visible={phase === 'travel' || phase === 'burst'}
            />
          </div>

          <div className="relative z-[2] mt-auto w-full px-6 pb-8 pt-4">
            <div
              ref={progressRef}
              className="mx-auto max-w-md rounded-full border border-white/15 bg-black/30 px-1 py-1 backdrop-blur-md"
            >
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  ref={progressFillRef}
                  className="h-full rounded-full"
                  style={{
                    width: '100%',
                    transform: 'scaleX(0)',
                    transformOrigin: '0% 50%',
                    background: `linear-gradient(90deg, ${palette.accent}, ${palette.accent2})`,
                  }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/55">
                <span>{toCareer ? 'Study → Career' : 'Career → Study'}</span>
                <span>Warp</span>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center -mt-16 px-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{
                scale: phase === 'burst' || phase === 'travel' ? 1.05 : 1,
                opacity: 1,
                y: 0,
              }}
              transition={{ 
                duration: reducedMotion ? 0.12 : 0.6,
                ease: "easeOut"
              }}
              className="flex flex-col items-center text-center drop-shadow-2xl"
            >
              <div className="text-[12px] font-extrabold uppercase tracking-[0.35em] mb-3" style={{ color: palette.accent2, textShadow: `0 0 15px ${palette.accent}55` }}>
                Dimensional Warp
              </div>
              <div
                className="font-display text-4xl sm:text-6xl tracking-tight font-extrabold transparent drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]"
                style={{ color: '#FFFFFF' }}
              >
                {palette.label}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
