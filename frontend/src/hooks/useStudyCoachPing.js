import { useEffect } from 'react';
import api from '../utils/api';

/** Sends route context to Study Coach for idle nudges */
export function useStudyCoachPing() {
  useEffect(() => {
    const ping = () => {
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      api.post('/study/coach/ping', { path }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, 45_000);
    return () => clearInterval(id);
  }, []);
}
