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

export default function BoatScene({ accent, accent2, enabled, visible }) {
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const oceanRef = useRef(null);
  const t0Ref = useRef(0);

  const [webglOk] = useState(() => canUseWebGL());

  const palette = useMemo(() => ({
    oceanA: new THREE.Color('#060A1E'),
    oceanB: new THREE.Color('#0A1033'),
    glow: new THREE.Color(accent || '#7C3AED'),
    glow2: new THREE.Color(accent2 || '#22D3EE'),
  }), [accent, accent2]);

  useEffect(() => {
    if (!enabled || !visible) return;
    if (!webglOk) return;
    const el = containerRef.current;
    if (!el) return;

    const w = el.clientWidth;
    const h = el.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(new THREE.Color('#050816'), 3, 20);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100);
    camera.position.set(0, 1.2, 4.5);
    camera.lookAt(0, 0.4, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    el.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(new THREE.Color('#AAB3FF'), 0.18));
    const key = new THREE.DirectionalLight(palette.glow2, 0.55);
    key.position.set(4, 6, 2);
    scene.add(key);

    // Ocean
    const oceanGeo = new THREE.PlaneGeometry(16, 16, 64, 64);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: palette.oceanA,
      metalness: 0.35,
      roughness: 0.35,
      emissive: palette.oceanB,
      emissiveIntensity: 0.08,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.15;
    scene.add(ocean);
    oceanRef.current = ocean;

    // Boat (simple silhouette)
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.18, 0.28),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#0E0F1A'), metalness: 0.2, roughness: 0.85 }),
    );
    hull.position.y = 0.05;
    boat.add(hull);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.03, 0.5, 10),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#111325'), metalness: 0.1, roughness: 0.8 }),
    );
    mast.position.set(-0.1, 0.35, 0);
    boat.add(mast);
    const sail = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.35, 1, 1),
      new THREE.MeshStandardMaterial({ color: palette.glow2, emissive: palette.glow2, emissiveIntensity: 0.18, side: THREE.DoubleSide }),
    );
    sail.position.set(0.18, 0.35, 0);
    sail.rotation.y = Math.PI / 2;
    boat.add(sail);
    boat.position.set(0, 0.05, 0.6);
    scene.add(boat);

    // Portal ring
    const ringGeo = new THREE.TorusGeometry(0.9, 0.05, 10, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: palette.glow,
      emissive: palette.glow,
      emissiveIntensity: 0.85,
      roughness: 0.35,
      metalness: 0.1,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0, 0.75, -1.7);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    // Particles (cheap points)
    const pts = new THREE.BufferGeometry();
    const count = 140;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 5;
      pos[i * 3 + 1] = Math.random() * 1.8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 5 - 0.5;
    }
    pts.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pMat = new THREE.PointsMaterial({ color: palette.glow2, size: 0.02, transparent: true, opacity: 0.65 });
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

      // Ocean waves (vertex wobble)
      const g = ocean.geometry;
      const a = g.attributes.position;
      const time = t / 1000;
      for (let i = 0; i < a.count; i++) {
        const x = a.getX(i);
        const y = a.getY(i);
        const z = Math.sin(time * 1.4 + x * 1.25) * 0.03 + Math.cos(time * 1.15 + y * 1.15) * 0.025;
        a.setZ(i, z);
      }
      a.needsUpdate = true;
      g.computeVertexNormals();

      // Boat bob + drift
      boat.position.y = 0.06 + Math.sin(time * 2.0) * 0.02;
      boat.rotation.z = Math.sin(time * 1.6) * 0.06;
      boat.position.z -= dt * 0.65;
      if (boat.position.z < -1.0) boat.position.z = 0.8;

      // Portal pulse
      ring.rotation.z += dt * 0.6;
      ring.scale.setScalar(1 + Math.sin(time * 3.0) * 0.03);

      // Particles swirl
      particles.rotation.y += dt * 0.1;

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
      // dispose geometries/materials best-effort
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
    };
  }, [enabled, visible, webglOk, palette]);

  if (!visible) return null;

  if (!enabled || !webglOk) {
    return (
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(900px 600px at 50% 40%, rgba(124,58,237,0.20), rgba(5,8,22,0.95)),' +
            'linear-gradient(180deg, rgba(2,6,23,0.9), rgba(2,6,23,0.98))',
        }}
      >
        <div className="absolute inset-0 opacity-60">
          <div className="absolute left-1/2 top-1/2 w-[420px] h-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ boxShadow: `0 0 0 2px ${accent2}33, 0 0 80px ${accent}55` }} />
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="absolute inset-0" />;
}

