import React, { useEffect, useRef, useState } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { useSpeechTracker } from '../../../hooks/useSpeechTracker';
import { useFaceMonitor } from '../../../hooks/useFaceMonitor';
import { useSocket } from '../../../context/SocketContext';
import api from '../../../utils/api';

export default function GDVideoRoom({ roomId, participants, duration, topic, onEnd }) {
  const socket = useSocket();
  const containerRef = useRef(null);
  const localVideoRef = useRef(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [initError, setInitError] = useState(null);
  
  // Safe duration fallback
  const safeDuration = (duration && duration > 0) ? duration : 10;
  const [timeLeft, setTimeLeft] = useState(safeDuration * 60);
  
  const zpRef = useRef(null);
  const timerRef = useRef(null);
  const intervalRef = useRef(null);
  const hasJoinedRef = useRef(false); // Guard: only true after successful room join
  
  const { transcript, startListening, stopListening } = useSpeechTracker();
  const { metrics, startMonitoring, stopMonitoring } = useFaceMonitor(localVideoRef);

  // Sync session end across all participants
  useEffect(() => {
    if (!socket || !roomId) return;

    // Join the specific socket room for this GD
    socket.emit('join_gd_room', { roomId });

    const handleSessionEnded = () => {
      console.log('Synchronized session end received from peer');
      handleComplete();
    };

    socket.on('gd_session_ended_broadcast', handleSessionEnded);

    return () => {
      socket.off('gd_session_ended_broadcast', handleSessionEnded);
    };
  }, [socket, roomId]);

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
          layout: "Auto",
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
            timerRef.current = setTimeout(() => {
              handleComplete();
            }, safeDuration * 60 * 1000);
            
            // Start the visual countdown
            intervalRef.current = setInterval(() => {
              setTimeLeft((prev) => {
                if (prev <= 1) {
                  clearInterval(intervalRef.current);
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);

            navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
              if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
                startMonitoring();
                startListening();
              }
            }).catch(err => console.warn('Failed to obtain stream for AI', err));
          },
          // Trigger completion remotely if someone else disconnected or left
          onLeaveRoom: () => {
            if (hasJoinedRef.current && !isAnalyzing) {
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
      clearInterval(intervalRef.current);
      try { if (zpRef.current) zpRef.current.destroy(); } catch (e) { console.warn("Zego destroy block caught quietly", e); }
      stopListening();
      stopMonitoring();
    };
  }, [roomId]);

  const handleComplete = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    stopListening();
    stopMonitoring();
    clearTimeout(timerRef.current);
    clearInterval(intervalRef.current);
    
    // Notify others that we ended it (if they haven't ended yet)
    if (socket && roomId) {
      socket.emit('gd_end_session', { roomId });
    }

    // Explicitly leave room gracefully before api call if we can
    try { 
      if (zpRef.current && typeof zpRef.current.leaveRoom === 'function') {
         zpRef.current.leaveRoom();
      }
    } catch(e) {}

    try {
      const response = await api.post('/interview/analyze-gd', {
        transcript,
        faceMetrics: metrics,
        duration: safeDuration,
        topic
      });
      // Component will unmount via parent state change, letting the useEffect cleanup handle actual destroy()
      onEnd(response.data.report);
    } catch (err) {
      console.error(err);
      onEnd(null);
    }
  };

  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-[var(--career-text)] h-[60vh] bg-[var(--career-surface)] border border-amber-500/30 rounded-2xl">
        <h2 className="text-3xl font-bold mb-4 text-amber-400">Video Room Failed to Initialize</h2>
        <p className="text-[var(--career-muted)] max-w-lg text-center mb-4">
          The video conferencing engine could not start. This is commonly caused by:
        </p>
        <ul className="text-sm text-[var(--career-muted)] list-disc list-inside mb-6 max-w-md space-y-1">
          <li>Two browsers on the <strong>same device</strong> fighting for the camera/mic hardware</li>
          <li>Camera or microphone permissions being blocked</li>
          <li>Invalid or missing ZegoCloud API credentials</li>
        </ul>
        <div className="bg-[var(--career-surface)] p-4 rounded-lg border border-[var(--career-border)] w-full max-w-lg mb-6">
          <code className="text-xs font-mono text-red-400 block break-all whitespace-pre-wrap">
            {initError}
          </code>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-[var(--career-surface)] text-[var(--career-text)] font-medium rounded-lg border border-[var(--career-border)] hover:bg-[var(--career-border)] hover:bg-opacity-30 transition-all"
          >
            Retry
          </button>
          <button 
            onClick={() => {
              hasJoinedRef.current = true; // Allow handleComplete to proceed for skip
              handleComplete();
            }}
            className="px-6 py-2 bg-[var(--career-accent)] text-[var(--career-text)] font-medium rounded-lg shadow-lg hover:opacity-80 transition-all"
          >
            Skip &amp; Get AI Feedback
          </button>
        </div>
      </div>
    );
  }

  if (!import.meta.env.VITE_ZEGO_APP_ID || import.meta.env.VITE_ZEGO_APP_ID.includes('your_real')) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-[var(--career-text)] h-[60vh] bg-[var(--career-surface)] border border-red-500/20 rounded-2xl">
        <h2 className="text-3xl font-bold mb-4 text-red-400">Missing Video Provider Keys</h2>
        <p className="text-[var(--career-muted)] max-w-lg text-center mb-6">
          You successfully matched with peers, but the live WebRTC room couldn't be launched because the <strong>ZegoCloud</strong> API keys are missing in your frontend <code>.env</code>.
        </p>
        <button 
          onClick={() => {
            hasJoinedRef.current = true;
            handleComplete();
          }}
          className="px-6 py-2 bg-[var(--career-accent)] text-[var(--career-text)] font-medium rounded-lg shadow-lg hover:opacity-80 transition-all"
        >
          Simulate GD Completion &amp; Get Feedback
        </button>
      </div>
    );
  }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-[85vh] bg-[var(--career-surface)] rounded-xl overflow-hidden flex flex-col border border-[var(--career-border)] shadow-2xl">
      {/* Absolute Loading Overlay. We do this instead of returning a different node tree, so Zego Container isn't unmounted before destruction, preventing null node crashes */}
      {isAnalyzing && (
        <div className="absolute inset-0 z-50 bg-[var(--career-surface)] bg-opacity-95 flex flex-col items-center justify-center p-12 text-[var(--career-text)] backdrop-blur-sm">
          <h2 className="text-3xl font-bold mb-4">Generating AI Performance Report</h2>
          <div className="animate-pulse h-12 w-12 bg-[var(--career-accent)] rounded-full mb-4"></div>
          <p className="text-[var(--career-muted)]">Processing transcripts and evaluating your facial metrics...</p>
        </div>
      )}

      <div className="flex justify-between items-center bg-[var(--career-surface)] p-4 shrink-0 relative z-10 box-border">
        <div className="flex items-center gap-4 bg-[var(--career-surface)] bg-opacity-80 px-4 py-2 rounded-lg border border-[var(--career-border)]">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="text-[var(--career-muted)] text-xs font-medium uppercase tracking-wider">Group Discussion Topic</span>
            <h3 className="text-[var(--career-text)] font-bold text-lg sm:text-xl leading-tight">{topic}</h3>
          </div>
        </div>
        
        <div className="flex items-center gap-4 shrink-0">
          <div className={`px-4 py-2 rounded-lg font-mono font-bold text-lg border ${timeLeft < 60 ? 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse' : 'bg-[var(--career-surface)] text-emerald-400 border-[var(--career-border)]'}`}>
            {formatTime(timeLeft)}
          </div>
          <button 
            onClick={handleComplete}
            disabled={isAnalyzing}
            className="px-6 py-2 bg-gradient-to-r from-red-600 to-rose-700 text-[var(--career-text)] font-medium rounded-lg shadow-lg shadow-red-900/20 hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
          >
            End Discussion
          </button>
        </div>
      </div>
       
      <video ref={localVideoRef} autoPlay muted playsInline className="opacity-0 absolute pointer-events-none w-0 h-0" />
       
      {/* Explicitly bounded flex-1 container to ensure Zego controls are not pushed out of view */}
      <div className="flex-1 w-full min-h-0 relative z-0 overflow-hidden bg-black rounded-b-xl">
        <div ref={containerRef} className="w-full h-full absolute inset-0"></div>
        
        {/* Live Speech Captions Overlay */}
        {transcript && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-4 pointer-events-none z-[99]">
            <div className="bg-black bg-opacity-60 backdrop-blur-md border border-white/10 rounded-xl p-3 text-center shadow-2xl">
              <p className="text-white text-base md:text-lg font-medium tracking-wide drop-shadow-md">
                <span className="text-[var(--career-accent)] mr-2 font-bold opacity-80">You:</span>
                {transcript}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
