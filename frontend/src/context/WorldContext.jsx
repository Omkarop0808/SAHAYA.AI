import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const WorldContext = createContext(null);

const LS_ACTIVE_WORLD = 'sahaya_active_world';
const LS_LAST_STUDY = 'sahaya_last_study_path';
const LS_LAST_CAREER = 'sahaya_last_career_path';

function safeGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function WorldProvider({ children }) {
  const [activeWorld, setActiveWorld] = useState(() => safeGet(LS_ACTIVE_WORLD, 'study'));
  const [lastStudyPath, setLastStudyPath] = useState(() => safeGet(LS_LAST_STUDY, '/dashboard'));
  const [lastCareerPath, setLastCareerPath] = useState(() => safeGet(LS_LAST_CAREER, '/career/dashboard'));

  const [switchState, setSwitchState] = useState(() => ({
    status: 'idle', // 'idle' | 'running' | 'settling'
    targetWorld: null, // 'study' | 'career' | null
    startedAt: null,
  }));
  const switchRef = useRef(switchState);
  useEffect(() => {
    switchRef.current = switchState;
  }, [switchState]);

  const recordPath = useCallback((world, path) => {
    if (!path) return;
    if (world === 'career') {
      setLastCareerPath(path);
      safeSet(LS_LAST_CAREER, path);
    } else {
      setLastStudyPath(path);
      safeSet(LS_LAST_STUDY, path);
    }
  }, []);

  const requestWorldSwitch = useCallback((targetWorld) => {
    if (!targetWorld) return;
    // do not block if activeWorld is stale; overlay will validate against current route
    setSwitchState({ status: 'running', targetWorld, startedAt: Date.now() });
  }, []);

  const completeWorldSwitch = useCallback((navigate) => {
    const s = switchRef.current;
    if (s.status !== 'running') return;
    const target = s.targetWorld;
    const nextPath = target === 'career' ? lastCareerPath : lastStudyPath;
    setActiveWorld(target);
    safeSet(LS_ACTIVE_WORLD, target);
    navigate(nextPath, { replace: false });
    setSwitchState({ status: 'settling', targetWorld: target, startedAt: s.startedAt });
  }, [lastCareerPath, lastStudyPath]);

  const endWorldSwitch = useCallback(() => {
    setSwitchState({ status: 'idle', targetWorld: null, startedAt: null });
  }, []);

  const cancelWorldSwitch = useCallback(() => {
    setSwitchState({ status: 'idle', targetWorld: null, startedAt: null });
  }, []);

  const syncActiveWorld = useCallback((world) => {
    if (!world) return;
    setActiveWorld(world);
    safeSet(LS_ACTIVE_WORLD, world);
  }, []);

  const value = useMemo(() => ({
    activeWorld,
    lastStudyPath,
    lastCareerPath,
    switchState,
    recordPath,
    requestWorldSwitch,
    completeWorldSwitch,
    endWorldSwitch,
    cancelWorldSwitch,
    syncActiveWorld,
  }), [
    activeWorld,
    lastStudyPath,
    lastCareerPath,
    switchState,
    recordPath,
    requestWorldSwitch,
    completeWorldSwitch,
    endWorldSwitch,
    cancelWorldSwitch,
    syncActiveWorld,
  ]);

  return (
    <WorldContext.Provider value={value}>
      {children}
    </WorldContext.Provider>
  );
}

export function useWorld() {
  const ctx = useContext(WorldContext);
  if (!ctx) throw new Error('useWorld must be used within WorldProvider');
  return ctx;
}

