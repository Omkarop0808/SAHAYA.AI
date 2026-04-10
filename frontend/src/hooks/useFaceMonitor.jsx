import { useState, useRef, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';

export const useFaceMonitor = (videoRef) => {
  const [metrics, setMetrics] = useState([]);
  const isMonitoringRef = useRef(false);
  const intervalRef = useRef(null);

  const loadModels = async () => {
    try {
      // Fetch models from standard CDN source
      const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
      ]);
      console.log('Face models loaded properly');
    } catch (error) {
      console.error('Error loading face-api models:', error);
    }
  };

  useEffect(() => {
    loadModels();
    
    return () => stopMonitoring();
  }, []);

  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !isMonitoringRef.current) return;
    
    try {
      const detections = await faceapi.detectSingleFace(
        videoRef.current, 
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceExpressions();

      if (detections) {
        setMetrics(prev => [...prev, {
          timestamp: new Date().toISOString(),
          expressions: detections.expressions
        }]);
      }
    } catch (err) {
      // Silent catch to prevent console spam
    }
  }, [videoRef]);

  const startMonitoring = () => {
    if (isMonitoringRef.current) return;
    isMonitoringRef.current = true;
    intervalRef.current = setInterval(captureFrame, 2000); // Analyze every 2 seconds
  };

  const stopMonitoring = () => {
    isMonitoringRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  return { metrics, startMonitoring, stopMonitoring };
};
