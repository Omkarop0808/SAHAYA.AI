import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

function canUseWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

export default function AbstractTransition({ accent, accent2, enabled, visible, variant = 'vortex' }) {
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const t0Ref = useRef(0);
  const particlesMetaRef = useRef(null);

  const [webglOk] = useState(() => canUseWebGL());

  const palette = useMemo(() => ({
    bgMain: new THREE.Color('#0A0A0F'),
    glow: new THREE.Color(accent || '#7C3AED'),
    glow2: new THREE.Color(accent2 || '#22D3EE'),
  }), [accent, accent2]);

  useEffect(() => {
    if (!enabled || !visible || !webglOk) return;
    const el = containerRef.current;
    if (!el) return;

    const w = el.clientWidth;
    const h = el.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(palette.bgMain.getHex(), 0.08);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    el.appendChild(renderer.domElement);

    // Flowing geometric rings
    const rings = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const ringGeo = new THREE.TorusGeometry(1.5 + (i * 0.4), 0.02, 16, 100);
      const ringMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? palette.glow : palette.glow2,
        transparent: true,
        opacity: 0.8 - (i * 0.2),
        blending: THREE.AdditiveBlending,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2 + (i * 0.1);
      ring.rotation.y = (i * 0.2);
      rings.add(ring);
    }
    rings.position.set(0, 0, -2);
    scene.add(rings);

    // High-fidelity Particle System
    const pts = new THREE.BufferGeometry();
    const count = 5000;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const meta = new Float32Array(count * 4); // r, theta, phi, speed/seed
    
    for (let i = 0; i < count; i++) {
      const seed = Math.random();
      const r = variant === 'vortex' ? (0.5 + Math.random() * 8) : (0.1 + Math.random() * 4);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      
      meta[i * 4 + 0] = r;
      meta[i * 4 + 1] = theta;
      meta[i * 4 + 2] = phi;
      meta[i * 4 + 3] = seed;

      // Initial layout
      pos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = variant === 'vortex' ? (Math.random() - 0.5) * 15 : r * Math.cos(phi);

      const colorMix = seed;
      const baseCol = variant === 'bloom' ? new THREE.Color('#FBBF24') : palette.glow;
      const highlightCol = variant === 'bloom' ? new THREE.Color('#34D399') : palette.glow2;
      const c = baseCol.clone().lerp(highlightCol, colorMix);
      col[i * 3 + 0] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    pts.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pts.setAttribute('color', new THREE.BufferAttribute(col, 3));
    particlesMetaRef.current = meta;
    
    const pMat = new THREE.PointsMaterial({
      vertexColors: true,
      size: 0.05,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(pts, pMat);
    scene.add(particles);

    const onResize = () => {
      const ww = el.clientWidth;
      const hh = el.clientHeight;
      camera.aspect = ww / hh;
      camera.updateProjectionMatrix();
      renderer.setSize(ww, hh);
    };
    window.addEventListener('resize', onResize);

    t0Ref.current = performance.now();
    const tick = (t) => {
      const dt = (t - t0Ref.current) / 1000;
      t0Ref.current = t;
      const time = t / 1000;

      // Animate rings
      rings.rotation.x += dt * 0.4;
      rings.rotation.y += dt * 0.6;
      rings.scale.setScalar(1 + Math.sin(time * 2.0) * 0.1);

      // Animate particles abstractly
      const p = particles.geometry.attributes.position;
      const metaArr = particlesMetaRef.current;

      for (let i = 0; i < p.count; i++) {
        const r0 = metaArr[i * 4 + 0];
        const th0 = metaArr[i * 4 + 1];
        const phi0 = metaArr[i * 4 + 2];
        const seed = metaArr[i * 4 + 3];

        if (variant === 'vortex') {
          // Dynamic data-tunnel warp effect
          const zSpeed = 8.0 + (seed * 5);
          let currentZ = p.getZ(i) + (zSpeed * dt);
          if (currentZ > 6) currentZ = -10;
          
          const angle = th0 + time * (1.5 + seed);
          const currentR = r0 * (0.8 + Math.sin(time * 2 + seed) * 0.2);
          
          p.setX(i, Math.cos(angle) * currentR);
          p.setY(i, Math.sin(angle) * currentR);
          p.setZ(i, currentZ);
        } else {
          // Smooth blooming sphere / wave effect
          const pulse = 1.0 + Math.sin(time * 1.5 + seed * Math.PI) * 0.2;
          const currentR = r0 * pulse;
          const th = th0 + time * 0.5 * (seed > 0.5 ? 1 : -1);
          const ph = phi0 + Math.sin(time * 0.2) * 0.1;
          
          p.setX(i, currentR * Math.sin(ph) * Math.cos(th));
          p.setY(i, currentR * Math.sin(ph) * Math.sin(th));
          p.setZ(i, currentR * Math.cos(ph));
        }
      }
      p.needsUpdate = true;

      camera.position.x = Math.sin(time * 0.5) * 0.5;
      camera.position.y = Math.cos(time * 0.4) * 0.3;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (rendererRef.current) {
        const r = rendererRef.current;
        r.dispose();
        if (r.domElement?.parentNode) r.domElement.parentNode.removeChild(r.domElement);
      }
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
    };
  }, [enabled, visible, webglOk, palette, variant]);

  if (!visible) return null;

  if (!enabled || !webglOk) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[420px] h-[420px] rounded-full opacity-60"
          style={{ boxShadow: `0 0 0 2px ${accent2}33, 0 0 80px ${accent}55` }} />
      </div>
    );
  }

  return <div ref={containerRef} className="absolute inset-0 mix-blend-screen opacity-90" />;
}
