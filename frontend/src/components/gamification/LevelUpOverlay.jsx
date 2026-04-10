import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useGamification } from '../../context/GamificationContext';

export default function LevelUpOverlay() {
  const { levelUp, setLevelUp } = useGamification();
  const overlayRef = useRef(null);
  const textRef = useRef(null);
  const badgeRef = useRef(null);
  const particlesRef = useRef(null);

  useEffect(() => {
    if (levelUp && overlayRef.current) {
      const tl = gsap.timeline({
        onComplete: () => {
          setTimeout(() => setLevelUp(null), 3000);
        }
      });

      tl.set(overlayRef.current, { autoAlpha: 1 });
      
      // Screen flash
      tl.to(overlayRef.current, { backgroundColor: 'rgba(255, 255, 255, 0.9)', duration: 0.1 })
        .to(overlayRef.current, { backgroundColor: 'rgba(13, 13, 13, 0.95)', duration: 0.4 });

      // Badge pop
      tl.fromTo(badgeRef.current, 
        { scale: 0, rotation: -180 }, 
        { scale: 1.2, rotation: 10, duration: 0.8, ease: "elastic.out(1, 0.3)" }, 
        "-=0.3"
      );
      tl.to(badgeRef.current, { scale: 1, rotation: 0, duration: 0.2 });

      // Text stagger
      tl.fromTo(textRef.current.children,
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.2, duration: 0.6, ease: "back.out(1.7)" },
        "-=0.8"
      );

      // Confetti logic if we wanted, for now just particles
      const particles = particlesRef.current.children;
      gsap.fromTo(particles,
        { scale: 0, x: "50vw", y: "50vh", opacity: 1 },
        { 
          scale: () => Math.random() * 2,
          x: () => `${Math.random() * 100}vw`,
          y: () => `${Math.random() * 100}vh`,
          opacity: 0,
          duration: 1.5,
          stagger: 0.02,
          ease: "power2.out"
        },
        "-=1.0"
      );
    }
  }, [levelUp]);

  if (!levelUp) return null;

  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 z-[10000] flex items-center justify-center invisible overflow-hidden"
    >
      <div ref={particlesRef} className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="absolute w-3 h-3 rounded-full" 
               style={{ backgroundColor: ['#FFFF66', '#FFB6C1', '#0D0D0D', '#fff'][i % 4] }} />
        ))}
      </div>

      <div className="flex flex-col items-center gap-6 relative z-10">
        <div 
          ref={badgeRef}
          className="w-48 h-48 bg-gradient-to-br from-[#FFFF66] to-[#FFD700] rounded-full shadow-[0_0_50px_rgba(255,255,102,0.5)] flex items-center justify-center border-4 border-white"
        >
          <span className="text-7xl font-bold text-[#0D0D0D]">{levelUp.newLevel}</span>
        </div>
        
        <div ref={textRef} className="text-center font-display space-y-2">
          <h2 className="text-[#FFFF66] text-5xl font-black uppercase tracking-widest drop-shadow-lg">
            Level Up!
          </h2>
          <p className="text-white text-2xl font-bold tracking-wider">
            Rank: <span className="text-[#FFB6C1]">{levelUp.newRank}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
