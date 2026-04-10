import React, { useEffect, useRef, useState } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { useSpeechTracker } from '../../../hooks/useSpeechTracker';
import { useFaceMonitor } from '../../../hooks/useFaceMonitor';
import api from '../../../utils/api';

export default function GDVideoRoom({ roomId, participants, duration, topic, onEnd }) {
  const containerRef = useRef(null);
  const localVideoRef = useRef(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [initError, setInitError] = useState(null);
  const zpRef = useRef(null);
  const timerRef = useRef(null);
  const hasJoinedRef = useRef(false); // Guard: only true after successful room join
  
  const { transcript, startListening, stopListening } = useSpeechTracker();
  const { metrics, startMonitoring, stopMonitoring } = useFaceMonitor(localVideoRef);

  useEffect(() => {
    let cancelled = false;

    const initZego = async () => {
      try {
        const appID = parseInt(import.meta.env.VITE_ZEGO_APP_ID || "123456789", 10); 
        const serverSecret = import.meta.env.VITE_ZEGO_SERVER_SECRET || "fallback_secret";
        
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID, serverSecret, roomId, Date.now().toString(), 'User_' + Math.floor(Math.random() * 1000)
        );
        
        if (cancelled) return;

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zpRef.current = zp;

        await zp.joinRoom({
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
          showLeavingView: false,
          showLeaveRoomConfirmDialog: false,
          onJoinRoom: () => {
            hasJoinedRef.current = true; // Mark as successfully joined
            
            // Start the GD duration timer ONLY after successful join
            const safeDuration = (duration && duration > 0) ? duration : 10;
            timerRef.current = setTimeout(() => {
              handleComplete();
            }, safeDuration * 60 * 1000);

            navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
              if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
                startMonitoring();
                startListening();
              }
            }).catch(err => console.warn('Failed to obtain stream for AI', err));
          },
          onLeaveRoom: () => {
            // Only trigger completion if the room was actually joined
            if (hasJoinedRef.current) {
              handleComplete();
            }
          }
        });
      } catch (err) {
        console.error('ZegoCloud initialization failed:', err);
        if (!cancelled) {
          setInitError(err?.message || String(err));
        }
      }
    };

    initZego();

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
      try { if (zpRef.current) zpRef.current.destroy(); } catch (e) { console.warn("Zego destroy blocked", e); }
      stopListening();
      stopMonitoring();
    };
  }, [roomId]);

  const handleComplete = async () => {
    if (isAnalyzing) return;
    if (!hasJoinedRef.current) return; // Never end if room was never joined
    setIsAnalyzing(true);
    stopListening();
    stopMonitoring();
    clearTimeout(timerRef.current);
    
    try {
      const response = await api.post('/interview/analyze-gd', {
        transcript,
        faceMetrics: metrics,
        duration,
        topic
      });
      try { if (zpRef.current) zpRef.current.destroy(); } catch(e){}
      onEnd(response.data.report);
    } catch (err) {
      console.error(err);
      try { if (zpRef.current) zpRef.current.destroy(); } catch(e){}
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

  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-white h-[60vh] bg-white/[0.02] border border-amber-500/30 rounded-2xl">
        <h2 className="text-3xl font-bold mb-4 text-amber-400">Video Room Failed to Initialize</h2>
        <p className="text-gray-400 max-w-lg text-center mb-4">
          The video conferencing engine could not start. This is commonly caused by:
        </p>
        <ul className="text-sm text-white/60 list-disc list-inside mb-6 max-w-md space-y-1">
          <li>Two browsers on the <strong>same device</strong> fighting for the camera/mic hardware</li>
          <li>Camera or microphone permissions being blocked</li>
          <li>Invalid or missing ZegoCloud API credentials</li>
        </ul>
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 w-full max-w-lg mb-6">
          <code className="text-xs font-mono text-red-400 block break-all whitespace-pre-wrap">
            {initError}
          </code>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-white/10 text-white font-medium rounded-lg border border-white/20 hover:bg-white/20 transition-all"
          >
            Retry
          </button>
          <button 
            onClick={() => {
              hasJoinedRef.current = true; // Allow handleComplete to proceed for skip
              handleComplete();
            }}
            className="px-6 py-2 bg-[var(--career-accent)] text-white font-medium rounded-lg shadow-lg hover:opacity-80 transition-all"
          >
            Skip &amp; Get AI Feedback
          </button>
        </div>
      </div>
    );
  }

  if (!import.meta.env.VITE_ZEGO_APP_ID) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-white h-[60vh] bg-white/[0.02] border border-red-500/20 rounded-2xl">
        <h2 className="text-3xl font-bold mb-4 text-red-400">Missing Video Provider Keys</h2>
        <p className="text-gray-400 max-w-lg text-center mb-6">
          You successfully matched with peers, but the live WebRTC room couldn't be launched because the <strong>ZegoCloud</strong> API keys are missing in your frontend <code>.env</code>.
        </p>
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 w-full max-w-lg mb-6">
          <code className="text-sm font-mono text-green-400 block break-all">
            VITE_ZEGO_APP_ID=your_id_here<br/>
            VITE_ZEGO_SERVER_SECRET=your_secret_here
          </code>
        </div>
        <button 
          onClick={() => {
            hasJoinedRef.current = true;
            handleComplete();
          }}
          className="px-6 py-2 bg-[var(--career-accent)] text-white font-medium rounded-lg shadow-lg hover:opacity-80 transition-all"
        >
          Simulate GD Completion &amp; Get Feedback
        </button>
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
          className="px-6 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium rounded-lg shadow-lg hover:shadow-red-500/20 transition-all z-10"
        >
          End Discussion
        </button>
      </div>
       
      <video ref={localVideoRef} autoPlay muted playsInline className="opacity-0 absolute pointer-events-none w-0 h-0" />
       
      <div ref={containerRef} className="w-full h-full flex-grow bg-black"></div>
    </div>
  );
}
