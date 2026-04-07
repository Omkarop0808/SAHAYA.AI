import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { useWorld } from '../../context/WorldContext';
import BoatScene from './three/BoatScene';

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

export default function WorldTransitionOverlay() {
  const navigate = useNavigate();
  const { switchState, completeWorldSwitch, endWorldSwitch, cancelWorldSwitch, activeWorld } = useWorld();
  const reducedMotion = usePrefersReducedMotion();

  const [phase, setPhase] = useState('idle'); // idle | fold | travel | burst
  const rootRef = useRef(null);
  const foldRef = useRef(null);
  const hasNavigatedRef = useRef(false);

  const isOpen = switchState.status === 'running' || switchState.status === 'settling';
  const targetWorld = switchState.targetWorld;

  const palette = useMemo(() => {
    if (targetWorld === 'career') {
      // Study → Career: warm greens / blues washing into deep navy + neon violet
      return { bgA: '#0A0A0F', bgB: '#14532d', accent: '#8B5CF6', accent2: '#06B6D4' };
    }
    // Career → Study: navy/violet fading to soft blues & greens
    return { bgA: '#E0F2FE', bgB: '#ECFDF5', accent: '#8B5CF6', accent2: '#059669' };
  }, [targetWorld]);

  useEffect(() => {
    if (!isOpen) {
      setPhase('idle');
      hasNavigatedRef.current = false;
      return;
    }
    if (!targetWorld) {
      cancelWorldSwitch();
      return;
    }

    const root = rootRef.current;
    const fold = foldRef.current;
    if (!root || !fold) return;

    setPhase('fold');
    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      onComplete: () => {
        setPhase('travel');
      },
    });

    // ~800ms cinematic: fold → navigate → burst (GSAP timeline; Three.js particles in BoatScene)
    tl.set(root, { opacity: 1 })
      .fromTo(
        fold,
        { opacity: 0, rotateX: 0, scale: 1, filter: 'blur(0px)' },
        { opacity: 1, duration: reducedMotion ? 0.06 : 0.1, ease: 'power1.out' },
      )
      .to(fold, {
        duration: reducedMotion ? 0.1 : 0.22,
        rotateX: reducedMotion ? 0 : 14,
        scale: reducedMotion ? 0.99 : 0.9,
        filter: reducedMotion ? 'blur(0px)' : 'blur(3px)',
      }, 0)
      .to(fold, {
        duration: reducedMotion ? 0.1 : 0.22,
        opacity: 0.55,
      }, 0);

    tl.call(() => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      completeWorldSwitch(navigate);
    }, [], '+=0.18');

    tl.call(() => setPhase('burst'), [], '+=0.22');
    tl.call(() => endWorldSwitch(), [], '+=0.18');

    return () => tl.kill();
  }, [isOpen, targetWorld, activeWorld, cancelWorldSwitch, completeWorldSwitch, endWorldSwitch, navigate, reducedMotion]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={rootRef}
          key="world-transition"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.12 : 0.18 }}
          className="fixed inset-0 z-[9999]"
          style={{ pointerEvents: 'auto' }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(1200px 800px at 50% 40%, ${palette.bgB}, ${palette.bgA})`,
            }}
          />

          {/* Fold layer (fake “page” being folded) */}
          <div className="absolute inset-0 flex items-center justify-center perspective-[1200px]">
            <div
              ref={foldRef}
              className="absolute inset-0"
              style={{
                background:
                  activeWorld === 'career'
                    ? 'linear-gradient(135deg, rgba(10,14,35,0.92), rgba(5,8,22,0.98))'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.92), rgba(249,249,249,0.98))',
                transformOrigin: '50% 70%',
              }}
            />
          </div>

          {/* Travel scene */}
          <div className="absolute inset-0">
            <BoatScene
              accent={palette.accent}
              accent2={palette.accent2}
              enabled={!reducedMotion}
              visible={phase === 'travel' || phase === 'burst'}
            />
          </div>

          {/* Burst-in chrome */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: phase === 'burst' ? 1 : 0.96, opacity: phase === 'burst' ? 1 : 0 }}
              transition={{ duration: reducedMotion ? 0.12 : 0.22 }}
              className="px-6 py-4 rounded-2xl border"
              style={{
                borderColor: `${palette.accent}33`,
                background: 'rgba(0,0,0,0.20)',
                backdropFilter: 'blur(14px)',
              }}
            >
              <div className="text-center">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.28em]" style={{ color: palette.accent2 }}>
                  Transitioning Worlds
                </div>
                <div className="mt-1 font-display font-extrabold text-xl text-white">
                  {targetWorld === 'career' ? 'Entering Career World' : 'Returning to Study World'}
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

