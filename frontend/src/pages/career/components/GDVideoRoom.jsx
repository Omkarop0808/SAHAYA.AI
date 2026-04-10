import React, { useEffect, useRef, useState } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { useSpeechTracker } from '../../../hooks/useSpeechTracker';
import { useFaceMonitor } from '../../../hooks/useFaceMonitor';
import api from '../../../utils/api';

export default function GDVideoRoom({ roomId, participants, duration, topic, onEnd }) {
  const containerRef = useRef(null);
  const localVideoRef = useRef(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const zpRef = useRef(null);
  
  const { transcript, startListening, stopListening } = useSpeechTracker();
  const { metrics, startMonitoring, stopMonitoring } = useFaceMonitor(localVideoRef);

  useEffect(() => {
    const initZego = async () => {
      // Substitute with real APP ID & Secret if available in env vars
      const appID = parseInt(import.meta.env.VITE_ZEGO_APP_ID || "123456789", 10); 
      const serverSecret = import.meta.env.VITE_ZEGO_SERVER_SECRET || "fallback_secret";
      
      const kitToken =  ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID, serverSecret, roomId, Date.now().toString(), 'User_' + Math.floor(Math.random() * 1000)
      );
      
      zpRef.current = ZegoUIKitPrebuilt.create(kitToken);
      zpRef.current.joinRoom({
          container: containerRef.current,
          scenario: {
              mode: ZegoUIKitPrebuilt.GroupCall,
          },
          showPreJoinView: false,
          turnOnMicrophoneWhenJoining: true,
          turnOnCameraWhenJoining: true,
          showMyCameraToggleButton: true,
          showMyMicrophoneToggleButton: true,
          showAudioVideoSettingsButton: true,
          showScreenSharingButton: false,
          onJoinRoom: () => {
             // Attach local stream for hidden AI monitoring
             navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
                 if (localVideoRef.current) {
                     localVideoRef.current.srcObject = stream;
                     startMonitoring();
                     startListening();
                 }
             }).catch(err => console.warn('Silently failed to obtain extra media stream for AI tracking', err));
          }
      });
    };

    initZego();

    const timerId = setTimeout(() => {
      handleComplete();
    }, duration * 60 * 1000);

    return () => {
      clearTimeout(timerId);
      if (zpRef.current) zpRef.current.destroy();
      stopListening();
      stopMonitoring();
    };
  }, [roomId]);

  const handleComplete = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    stopListening();
    stopMonitoring();
    
    try {
      const response = await api.post('/interview/analyze-gd', {
        transcript,
        faceMetrics: metrics,
        duration,
        topic
      });
      if (zpRef.current) zpRef.current.destroy();
      onEnd(response.data.report);
    } catch (err) {
      console.error(err);
      if (zpRef.current) zpRef.current.destroy();
      onEnd(null);
    }
  };

  if (isAnalyzing) {
     return (
        <div className="flex flex-col items-center justify-center p-12 text-white h-[60vh]">
            <h2 className="text-3xl font-bold mb-4">Generating AI Performance Report</h2>
            <div className="animate-pulse h-12 w-12 bg-indigo-500 rounded-full mb-4"></div>
            <p className="text-gray-400">Processing transcripts and evaluating your facial metrics...</p>
        </div>
     );
  }

  return (
    <div className="relative w-full h-[80vh] bg-gray-900 rounded-xl overflow-hidden flex flex-col border border-gray-700 shadow-2xl">
       <div className="flex justify-between items-center bg-gray-800 p-4 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
             <h3 className="text-white font-semibold text-lg">Topic: {topic}</h3>
          </div>
          <button 
             onClick={handleComplete}
             className="px-6 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium rounded-lg shadow-lg hover:shadow-red-500/20 transition-all"
          >
             End Discussion
          </button>
       </div>
       
       {/* Hidden video element dedicated entirely to face-api tracking without affecting user UI */}
       <video ref={localVideoRef} autoPlay muted playsInline className="opacity-0 absolute pointer-events-none w-0 h-0" />
       
       {/* ZegoCloud UI handles all participant feeds here */}
       <div ref={containerRef} className="w-full h-full flex-grow bg-black"></div>
    </div>
  );
}
