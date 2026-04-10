import { useState, useEffect, useRef } from 'react';

export const useSpeechTracker = () => {
  const [transcript, setTranscript] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const startTimeRef = useRef(null);
  const totalSpeakingTimeRef = useRef(0);
  const isIntentionalStopRef = useRef(false);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window)) {
      console.warn('Speech recognition not supported in this browser.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const current = event.resultIndex;
      const result = event.results[current][0].transcript;
      
      setTranscript(prev => [...prev, {
        text: result,
        timestamp: new Date().toISOString()
      }]);
    };

    recognition.onstart = () => {
      setIsListening(true);
      startTimeRef.current = Date.now();
      isIntentionalStopRef.current = false;
    };

    recognition.onend = () => {
      setIsListening(false);
      if (startTimeRef.current) {
        totalSpeakingTimeRef.current += (Date.now() - startTimeRef.current) / 1000;
        startTimeRef.current = null;
      }
      
      // Auto-restart if we want continuous listening
      if (recognitionRef.current && !isIntentionalStopRef.current) {
         try { recognition.start(); } catch(e){}
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        isIntentionalStopRef.current = true;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      isIntentionalStopRef.current = false;
      try {
         recognitionRef.current.start();
      } catch(e) {}
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      isIntentionalStopRef.current = true;
      recognitionRef.current.stop();
    }
  };

  return {
    transcript,
    isListening,
    startListening,
    stopListening,
    getTotalSpeakingTime: () => totalSpeakingTimeRef.current
  };
};
