import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useWorld } from '../../context/WorldContext';

export default function WorldRouteTracker() {
  const location = useLocation();
  const { recordPath, syncActiveWorld } = useWorld();

  useEffect(() => {
    const path = `${location.pathname}${location.search || ''}${location.hash || ''}`;
    const world = location.pathname.startsWith('/career') ? 'career' : 'study';
    recordPath(world, path);
    syncActiveWorld(world);
  }, [location.pathname, location.search, location.hash, recordPath, syncActiveWorld]);

  return null;
}

