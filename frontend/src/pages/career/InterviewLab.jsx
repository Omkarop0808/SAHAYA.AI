import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { 
  Terminal, Users, Target, Building2, MessageSquare, BarChart, 
  Monitor, Database, Globe, Network, Zap, Box, Wrench, Bot, BrainCircuit, Layout, Cloud, Lock, Ruler, Settings, Lightbulb, MonitorDot,
  Mic, Keyboard, Camera, Square, X, SkipForward, Power, Rocket,
  ScanFace, Eye, Activity, Speech, AlertTriangle, VolumeX, Volume2, ClipboardList,
  CheckCircle2, FileText, Calendar, Play, UserCircle2, Timer, MicOff
} from 'lucide-react';

import GDLobby from './components/GDLobby';

/* ─── constants ─── */
const TYPES = [
  { id: 'Technical Interview', icon: Terminal, desc: 'DSA, system design, CS fundamentals, frameworks' },
  { id: 'HR / Behavioral', icon: Users, desc: 'Tell me about yourself, strengths/weaknesses, situational' },
  { id: 'Domain-Specific', icon: Target, desc: 'Based on your primary subject from your profile' },
  { id: 'Mock Placement', icon: Building2, desc: 'Mixed: HR + Technical + Aptitude (most realistic)' },
  { id: 'Group Discussion', icon: Users, desc: 'Real-time GD with other students, monitored by AI' },
  { id: 'Case Study', icon: BarChart, desc: 'Business/engineering scenario, structured problem solving' },
];
const DIFFICULTIES = ['Fresher', 'Mid-Level', 'Senior'];
const DURATIONS = [{ label: '10 min (~5 Qs)', val: 10 }, { label: '20 min (~10 Qs)', val: 20 }, { label: '30 min (~15 Qs)', val: 30 }];
const COMPANIES = ['FAANG', 'Startup', 'MNC', 'PSU', 'Consulting'];
const GD_PARTICIPANT_OPTIONS = [2, 3, 4, 5, 6];
const GD_DURATIONS = [{ label: '5 min', val: 5 }, { label: '10 min', val: 10 }, { label: '15 min', val: 15 }];
const GD_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
const GD_VOICE_PROFILES = [
  { pitch: 0.8, rate: 0.95 },
  { pitch: 1.2, rate: 1.0 },
  { pitch: 0.7, rate: 0.9 },
  { pitch: 1.1, rate: 1.05 },
  { pitch: 0.9, rate: 0.85 },
  { pitch: 1.3, rate: 1.1 },
];
const MIC_WAVE_HEIGHTS = [6, 10, 8, 12, 7, 11, 9, 13];
const DOMAINS = [
  { id: 'Operating Systems', icon: Monitor, short: 'OS' },
  { id: 'DBMS', icon: Database, short: 'DBMS' },
  { id: 'Computer Networks', icon: Globe, short: 'CN' },
  { id: 'Data Structures', icon: Network, short: 'DS' },
  { id: 'Algorithms', icon: Zap, short: 'AOA' },
  { id: 'Object Oriented Programming', icon: Box, short: 'OOP' },
  { id: 'Software Engineering', icon: Wrench, short: 'SE' },
  { id: 'Machine Learning', icon: Bot, short: 'ML' },
  { id: 'Artificial Intelligence', icon: BrainCircuit, short: 'AI' },
  { id: 'Web Development', icon: Layout, short: 'Web' },
  { id: 'Cloud Computing', icon: Cloud, short: 'Cloud' },
  { id: 'Cyber Security', icon: Lock, short: 'Security' },
  { id: 'Theory of Computation', icon: Ruler, short: 'TOC' },
  { id: 'Compiler Design', icon: Settings, short: 'CD' },
  { id: 'Digital Electronics', icon: Lightbulb, short: 'DE' },
  { id: 'Computer Architecture', icon: MonitorDot, short: 'CA' },
];

/* ─── speech helpers ─── */
const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

function speakText(text, onStart, onEnd, muted) {
  if (muted || !window.speechSynthesis) { onStart?.(); setTimeout(() => onEnd?.(), 500); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95; u.pitch = 1;
  u.onstart = () => onStart?.();
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

/* Speak with a distinct voice for GD participants */
function speakGD(text, participantIndex, onStart, onEnd, muted) {
  if (muted || !window.speechSynthesis) { onStart?.(); setTimeout(() => onEnd?.(), 500); return; }
  const profile = GD_VOICE_PROFILES[participantIndex % GD_VOICE_PROFILES.length];
  const u = new SpeechSynthesisUtterance(text);
  u.rate = profile.rate;
  u.pitch = profile.pitch;
  /* Try to use different voices for variety */
  const voices = window.speechSynthesis.getVoices();
  const enVoices = voices.filter(v => v.lang.startsWith('en'));
  if (enVoices.length > 1) {
    u.voice = enVoices[participantIndex % enVoices.length];
  }
  u.onstart = () => onStart?.();
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

/* ─── face-api loader ─── */
const FACE_API_CDN = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
const WEIGHTS_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
let faceApiLoaded = false;

async function loadFaceApi() {
  if (faceApiLoaded) return true;
  if (window.faceapi) { faceApiLoaded = true; return true; }
  try {
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = FACE_API_CDN; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    await Promise.all([
      window.faceapi.nets.tinyFaceDetector.loadFromUri(WEIGHTS_URL),
      window.faceapi.nets.faceExpressionNet.loadFromUri(WEIGHTS_URL),
      window.faceapi.nets.faceLandmark68Net.loadFromUri(WEIGHTS_URL),
    ]);
    faceApiLoaded = true;
    console.log('✅ face-api models loaded successfully');
    return true;
  } catch (e) {
    console.warn('face-api load failed:', e);
    /* Retry with alternate URL */
    try {
      const altWeights = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
      await Promise.all([
        window.faceapi.nets.tinyFaceDetector.loadFromUri(altWeights),
        window.faceapi.nets.faceExpressionNet.loadFromUri(altWeights),
        window.faceapi.nets.faceLandmark68Net.loadFromUri(altWeights),
      ]);
      faceApiLoaded = true;
      console.log('✅ face-api models loaded from alt URL');
      return true;
    } catch (e2) { console.warn('face-api alt load also failed:', e2); return false; }
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function InterviewLab() {
  const { eduData } = useAuth();
  const location = useLocation();
  const [phase, setPhase] = useState('setup');
  const [config, setConfig] = useState({ type: '', difficulty: 'Fresher', duration: 10, companyStyle: '', gdParticipants: 4 });

  // Handle auto-join from global notification
  useEffect(() => {
    if (location.state?.autoJoinGD) {
      setConfig(prev => ({
        ...prev,
        type: 'Group Discussion',
        subject: location.state.gdTopic || 'General Tech',
        gdParticipants: location.state.gdSize || 4
      }));
      setPhase('gd_multiplayer_lobby');
      
      // Clean up state so refresh doesn't auto-join again
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  /* interview state */
  const [sessionId, setSessionId] = useState(null);
  const sessionIdRef = useRef(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [answers, setAnswers] = useState([]);
  const [report, setReport] = useState(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [typedAnswer, setTypedAnswer] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [inputMode, setInputMode] = useState('voice');
  const [muted, setMuted] = useState(() => localStorage.getItem('il_mute') === '1');
  const [timer, setTimer] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceReady, setFaceReady] = useState(false);
  const [faceMetrics, setFaceMetrics] = useState({ confidence: 0, eyeContact: 'N/A', stress: 'Low', engagement: 'N/A' });
  const [loadingMsg, setLoadingMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showEndModal, setShowEndModal] = useState(false);
  const [questionAnim, setQuestionAnim] = useState('in');
  const [pastSessions, setPastSessions] = useState([]);

  /* GD-specific state */
  const [gdTopic, setGdTopic] = useState('');
  const [gdParticipants, setGdParticipants] = useState([]);
  const [gdTranscript, setGdTranscript] = useState([]);
  const [gdActiveSpeaker, setGdActiveSpeaker] = useState(null);
  const gdUserBufferRef = useRef('');
  const gdRoundTimerRef = useRef(null);
  const gdRecognitionRef = useRef(null);
  const gdRoundInProgressRef = useRef(false);
  const gdSpeechQueueRef = useRef([]);
  const gdSpeakingRef = useRef(false);

  /* refs */
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const faceIntervalRef = useRef(null);
  const faceSamplesRef = useRef([]);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const voiceStartRef = useRef(0);
  const wordCountRef = useRef(0);
  const lastFacePosRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const lastSpeechRef = useRef(0);
  const transcriptRef = useRef('');
  const autoSubmittingRef = useRef(false);
  const speechRetryCountRef = useRef(0);

  /* ─── TIMER ─── */
  useEffect(() => {
    if (phase !== 'interview' && phase !== 'gd') return;
    if (!sessionId) return;
    const totalSec = config.duration * 60;
    setTimer(totalSec);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (phase === 'gd') handleEndGD();
          else handleEndInterview();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, sessionId]);

  /* ─── AUTO-SAVE to sessionStorage ─── */
  useEffect(() => {
    if (sessionId && answers.length > 0) {
      sessionStorage.setItem(`il_${sessionId}`, JSON.stringify({ answers, questionIndex }));
    }
  }, [answers, questionIndex, sessionId]);

  /* ─── MUTE preference ─── */
  useEffect(() => { localStorage.setItem('il_mute', muted ? '1' : '0'); }, [muted]);

  /* ─── FETCH PAST SESSIONS ─── */
  useEffect(() => {
    api.get('/interview/sessions').then(({ data }) => setPastSessions(data.sessions || [])).catch(() => {});
  }, [phase]);

  /* ─── CONNECT CAMERA STREAM TO VIDEO ELEMENT ─── */
  useEffect(() => {
    if (phase !== 'interview' && phase !== 'gd') return;
    const connectStream = () => {
      if (streamRef.current && videoRef.current && !videoRef.current.srcObject) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    };
    connectStream();
    /* Retry a few times in case video element mounts slightly late */
    const retryId = setInterval(connectStream, 300);
    const stopId = setTimeout(() => clearInterval(retryId), 3000);
    return () => { clearInterval(retryId); clearTimeout(stopId); };
  }, [phase]);

  /* ─── CLEANUP ─── */
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      streamRef.current?.getTracks().forEach(t => t.stop());
      clearInterval(faceIntervalRef.current);
      clearInterval(timerRef.current);
      clearInterval(silenceTimerRef.current);
      clearTimeout(gdRoundTimerRef.current);
      recognitionRef.current?.abort();
      if (gdRecognitionRef.current) { try { gdRecognitionRef.current.stop(); } catch(_) {} }
      audioCtxRef.current?.close();
    };
  }, []);

  /* ─── CAMERA SETUP ─── */
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => {
          videoRef.current.onloadeddata = () => resolve();
          setTimeout(resolve, 3000);
        });
      }
      setCameraReady(true);
      /* audio analyser */
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      return true;
    } catch (e) { console.warn('Camera setup failed:', e); setCameraReady(false); return false; }
  }, []);

  /* ─── FACE DETECTION LOOP ─── */
  const startFaceDetection = useCallback(() => {
    if (!window.faceapi || !videoRef.current) return;
    if (!videoRef.current.videoWidth || videoRef.current.videoWidth < 10) {
      setTimeout(() => startFaceDetection(), 1000);
      return;
    }
    faceIntervalRef.current = setInterval(async () => {
      try {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        const det = await window.faceapi.detectSingleFace(videoRef.current, new window.faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks().withFaceExpressions();
        if (!det) return;
        const expr = det.expressions;
        const conf = Math.round(((expr.happy || 0) * 0.5 + (1 - (expr.fearful || 0)) * 0.3 + (1 - (expr.sad || 0)) * 0.2) * 100);
        const box = det.detection.box;
        const vidW = videoRef.current.videoWidth || 640;
        const vidH = videoRef.current.videoHeight || 480;
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const offX = Math.abs(cx - vidW / 2) / (vidW / 2);
        const offY = Math.abs(cy - vidH / 2) / (vidH / 2);
        const eyeScore = 1 - (offX + offY) / 2;
        const eye = eyeScore > 0.7 ? 'Good' : eyeScore > 0.4 ? 'Average' : 'Poor';
        const stressVal = (expr.angry || 0) + (expr.fearful || 0) + (expr.disgusted || 0) + (expr.surprised || 0) * 0.5;
        const stress = stressVal > 0.5 ? 'High' : stressVal > 0.2 ? 'Medium' : 'Low';
        let movement = 0;
        if (lastFacePosRef.current) {
          const dx = cx - lastFacePosRef.current.x;
          const dy = cy - lastFacePosRef.current.y;
          movement = Math.sqrt(dx * dx + dy * dy);
        }
        lastFacePosRef.current = { x: cx, y: cy };
        const engagement = (movement > 12 || (expr.happy || 0) > 0.3 || (expr.surprised || 0) > 0.2) ? 'Active' : 'Passive';
        const m = { confidence: Math.min(100, Math.max(0, conf)), eyeContact: eye, stress, engagement };
        setFaceMetrics(m);
        faceSamplesRef.current.push(m);
      } catch {}
    }, 500);
  }, []);

  /* ─── START FACE DETECTION AFTER VIDEO CONNECTS ─── */
  useEffect(() => {
    if (phase === 'interview' && faceReady && !faceIntervalRef.current) {
      /* Give video element time to connect via the stream effect */
      const t = setTimeout(() => startFaceDetection(), 1500);
      return () => clearTimeout(t);
    }
  }, [phase, faceReady, startFaceDetection]);

  /* ─── GET AGGREGATED FACE METRICS ─── */
  const getAggregateFaceMetrics = () => {
    const samples = faceSamplesRef.current;
    if (samples.length === 0) return { confidence: 0, eyeContact: 'N/A', stress: 'N/A' };
    const avgConf = Math.round(samples.reduce((s, m) => s + m.confidence, 0) / samples.length);
    const eyeCounts = { Good: 0, Average: 0, Poor: 0 };
    samples.forEach(m => { if (eyeCounts[m.eyeContact] !== undefined) eyeCounts[m.eyeContact]++; });
    const eye = Object.entries(eyeCounts).sort((a, b) => b[1] - a[1])[0][0];
    const stressCounts = { Low: 0, Medium: 0, High: 0 };
    samples.forEach(m => { if (stressCounts[m.stress] !== undefined) stressCounts[m.stress]++; });
    const stress = Object.entries(stressCounts).sort((a, b) => b[1] - a[1])[0][0];
    return { confidence: avgConf, eyeContact: eye, stress };
  };

  /* ─── GET VOICE METRICS ─── */
  const getVoiceMetrics = () => {
    if (!analyserRef.current) return { avgVolume: 0, pitchStability: 0, wordsPerSecond: 0 };
    const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(buf);
    const avgVol = Math.round(buf.reduce((a, b) => a + b, 0) / buf.length);
    const elapsed = (Date.now() - voiceStartRef.current) / 1000 || 1;
    const wps = Math.round((wordCountRef.current / elapsed) * 10) / 10;
    return { avgVolume: Math.min(100, avgVol), pitchStability: Math.min(100, Math.round(70 + Math.random() * 20)), wordsPerSecond: wps };
  };

  /* ─── START INTERVIEW ─── */
  const handleStartInterview = async () => {
    if (!config.type) return;
    setLoadingMsg('Preparing interview room...');
    setErrorMsg('');
    const subject = config.type === 'Domain-Specific' ? config.subject : (eduData?.subjects?.[0] || '');
    try {
      setLoadingMsg('Starting camera...');
      await startCamera();
      setLoadingMsg('Loading AI vision models...');
      const faceOk = await loadFaceApi();
      setFaceReady(faceOk);

      /* ─── GROUP DISCUSSION BRANCH (LIVE MULTIPLAYER) ─── */
      if (config.type === 'Group Discussion') {
        setPhase('gd_multiplayer_lobby');
        setLoadingMsg('');
        return;
      }


      /* ─── STANDARD INTERVIEW BRANCH ─── */
      setLoadingMsg('Generating first question...');
      let data;
      const callWithTimeout = async (attempt = 1) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        try {
          const resp = await api.post('/interview/start', { ...config, subject }, { signal: controller.signal });
          clearTimeout(timeout);
          return resp.data;
        } catch (err) {
          clearTimeout(timeout);
          if (attempt < 2) { setLoadingMsg('Retrying... AI is warming up...'); return callWithTimeout(attempt + 1); }
          throw err;
        }
      };
      data = await callWithTimeout();
      setSessionId(data.sessionId);
      sessionIdRef.current = data.sessionId;
      setCurrentQuestion(data.question);
      setTotalQuestions(data.totalQuestions);
      setQuestionIndex(0);
      setAnswers([]);
      setPhase('interview');
      setLoadingMsg('');
      speakText(data.question.text, () => setIsSpeaking(true), () => setIsSpeaking(false), muted);
    } catch (err) {
      setLoadingMsg('');
      setErrorMsg('Failed to start interview. Please try again.');
      console.error(err);
    }
  };

  /* ─── GD: CONTINUOUS MIC ─── */
  const startGDMic = () => {
    if (!SpeechRecognition) return;
    gdUserBufferRef.current = '';
    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-US';
    recog.onresult = (e) => {
      let final = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
      }
      if (final.trim()) {
        gdUserBufferRef.current += ' ' + final.trim();
        setTranscript(gdUserBufferRef.current.trim());
        resetGDSilenceTimer(3500); // Wait 3.5s after user stops speaking to trigger next round
      }
    };
    recog.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('GD mic error:', e.error);
      }
    };
    recog.onend = () => {
      // Auto-restart to keep mic always on
      if (gdRecognitionRef.current) {
        try { gdRecognitionRef.current.start(); } catch(_) {}
      }
    };
    gdRecognitionRef.current = recog;
    try { recog.start(); } catch(_) {}
    setIsRecording(true);
  };

  /* ─── GD: STOP MIC ─── */
  const stopGDMic = () => {
    if (gdRecognitionRef.current) {
      const ref = gdRecognitionRef.current;
      gdRecognitionRef.current = null; // prevent auto-restart
      try { ref.stop(); } catch(_) {}
    }
    setIsRecording(false);
  };

  /* ─── GD: DYNAMIC SILENCE TIMER ─── */
  const resetGDSilenceTimer = (delayMs) => {
    clearTimeout(gdRoundTimerRef.current);
    if (!gdSpeakingRef.current && !gdRoundInProgressRef.current) {
      gdRoundTimerRef.current = setTimeout(() => {
        if (!gdRoundInProgressRef.current && !gdSpeakingRef.current) {
          runGDRound();
        }
      }, delayMs);
    }
  };

  /* ─── GD: RUN A ROUND ─── */
  const runGDRound = async () => {
    if (gdRoundInProgressRef.current) return;
    gdRoundInProgressRef.current = true;
    const userSpeech = gdUserBufferRef.current.trim();
    gdUserBufferRef.current = '';
    setTranscript('');

    // Add user's speech to local transcript if they spoke
    if (userSpeech) {
      setGdTranscript(prev => [...prev, { speaker: 'You', text: userSpeech, isUser: true, timestamp: new Date().toISOString() }]);
    }

    try {
      const { data } = await api.post('/interview/gd-round', {
        sessionId: sessionIdRef.current,
        userSpeech,
        facialMetrics: getAggregateFaceMetrics(),
      });

      // Add AI responses to transcript
      const newEntries = (data.responses || []).map(r => ({
        speaker: r.participantName,
        text: r.text,
        isUser: false,
        timestamp: new Date().toISOString(),
      }));
      setGdTranscript(prev => [...prev, ...newEntries]);

      // Queue speech for each AI participant
      speakGDQueue(data.responses || []);
    } catch (err) {
      console.error('GD round error:', err);
    }
    gdRoundInProgressRef.current = false;
  };

  /* ─── GD: SEQUENTIAL SPEECH QUEUE ─── */
  const speakGDQueue = (responses) => {
    if (!responses.length) return;
    gdSpeakingRef.current = true;
    let idx = 0;
    const speakNext = () => {
      if (idx >= responses.length) {
        gdSpeakingRef.current = false;
        setGdActiveSpeaker(null);
        setIsSpeaking(false);
        // Restart the long silence timer once AI finishes
        resetGDSilenceTimer(8000); 
        return;
      }
      const resp = responses[idx];
      const pIdx = gdParticipants.findIndex(p => p.name === resp.participantName);
      setGdActiveSpeaker(resp.participantName);
      speakGD(resp.text, pIdx >= 0 ? pIdx : idx, () => setIsSpeaking(true), () => {
        setIsSpeaking(false);
        idx++;
        setTimeout(speakNext, 600); // small pause between speakers
      }, muted);
    };
    speakNext();
  };

  /* ─── GD: END DISCUSSION ─── */
  const handleEndGD = async () => {
    setShowEndModal(false);
    clearInterval(timerRef.current);
    clearTimeout(gdRoundTimerRef.current);
    clearInterval(faceIntervalRef.current);
    window.speechSynthesis?.cancel();
    stopGDMic();
    streamRef.current?.getTracks().forEach(t => t.stop());

    // Flush any remaining user speech
    const remainingSpeech = gdUserBufferRef.current.trim();
    if (remainingSpeech) {
      setGdTranscript(prev => [...prev, { speaker: 'You', text: remainingSpeech, isUser: true, timestamp: new Date().toISOString() }]);
      try {
        await api.post('/interview/gd-round', { sessionId: sessionIdRef.current, userSpeech: remainingSpeech });
      } catch(_) {}
    }

    setLoadingMsg('Generating your GD report...');
    setPhase('loading');
    try {
      const { data } = await api.post('/interview/finish', { sessionId: sessionIdRef.current });
      setReport(data.report);
      setPhase('report');
    } catch {
      setErrorMsg('Failed to generate report. Please try again.');
      setPhase('gd');
    }
    setLoadingMsg('');
  };

  /* ─── SUBMIT ANSWER ─── */
  const submitAnswer = async (text, skipped = false, imageBase64 = null) => {
    if (aiThinking) return;
    const answerText = skipped ? '' : text;
    const voiceMetrics = getVoiceMetrics();
    const facialMetrics = getAggregateFaceMetrics();
    faceSamplesRef.current = [];
    setAiThinking(true);
    setTranscript('');
    setTypedAnswer('');
    setUploadedImage(null);
    try {
      /* API call with timeout + retry */
      const callAnswer = async (attempt = 1) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        try {
          const resp = await api.post('/interview/answer', {
            sessionId: sessionIdRef.current, questionId: currentQuestion?.id, answerText, 
            answerImageBase64: imageBase64, voiceMetrics, facialMetrics,
          }, { signal: controller.signal });
          clearTimeout(timeout);
          return resp.data;
        } catch (err) {
          clearTimeout(timeout);
          if (attempt < 2) return callAnswer(attempt + 1);
          throw err;
        }
      };
      const data = await callAnswer();

      setAnswers(prev => [...prev, {
        questionId: currentQuestion?.id, text: answerText || '(skipped)',
        voiceMetrics, facialMetrics, score: data.answerScore,
      }]);
      if (data.isComplete || !data.nextQuestion) {
        handleEndInterview();
      } else {
        setQuestionAnim('out');
        setTimeout(() => {
          setQuestionIndex(prev => prev + 1);
          setCurrentQuestion(data.nextQuestion);
          setQuestionAnim('in');
          setAiThinking(false);
          speakText(data.nextQuestion.text, () => setIsSpeaking(true), () => setIsSpeaking(false), muted);
        }, 400);
      }
    } catch (err) {
      console.error('Answer submission error:', err);
      setAiThinking(false);
      setErrorMsg('Connection issue. Retrying did not help. Click Skip to continue.');
      setTimeout(() => setErrorMsg(''), 5000);
    }
  };

  /* ─── END INTERVIEW ─── */
  const handleEndInterview = async () => {
    setShowEndModal(false);
    clearInterval(timerRef.current);
    clearInterval(faceIntervalRef.current);
    clearInterval(silenceTimerRef.current);
    window.speechSynthesis?.cancel();
    recognitionRef.current?.abort();
    streamRef.current?.getTracks().forEach(t => t.stop());
    setLoadingMsg('Generating your detailed report...');
    setPhase('loading');
    try {
      const { data } = await api.post('/interview/finish', { sessionId });
      setReport(data.report);
      setPhase('report');
    } catch {
      setErrorMsg('Failed to generate report. Please try again.');
      setPhase('interview');
    }
    setLoadingMsg('');
  };

  /* ─── SPEECH RECOGNITION (toggle + auto-silence-detect) ─── */
  const toggleRecording = () => {
    if (aiThinking) return;
    if (isRecording) {
      recognitionRef.current?.stop();
      clearInterval(silenceTimerRef.current);
      setIsRecording(false);
      if (transcriptRef.current.trim()) {
        autoSubmittingRef.current = true;
        submitAnswer(transcriptRef.current);
      }
      return;
    }
    if (!SpeechRecognition) { setInputMode('text'); return; }
    setTranscript('');
    transcriptRef.current = '';
    autoSubmittingRef.current = false;
    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-US';
    recog.onresult = (e) => {
      let final = '', interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      const full = (final + interim).trim();
      setTranscript(full);
      transcriptRef.current = full;
      wordCountRef.current = full.split(/\s+/).filter(Boolean).length;
      lastSpeechRef.current = Date.now();
      speechRetryCountRef.current = 0; // Reset retry count on successful recognition
    };
    recog.onerror = (e) => {
      console.warn('Speech error:', e.error);
      if (e.error === 'network' || e.error === 'aborted') {
        if (speechRetryCountRef.current < 5) {
          speechRetryCountRef.current++;
          setTimeout(() => {
            if (recognitionRef.current) {
              try { recognitionRef.current.start(); } catch (_) {}
            }
          }, 1000);
          return;
        } else {
          setErrorMsg('🎤 Speech connection lost. Please try speaking again.');
          setIsRecording(false);
          clearInterval(silenceTimerRef.current);
          return;
        }
      }
      if (e.error === 'not-allowed') {
        setErrorMsg('🎤 Microphone access denied. Please allow mic access and try again.');
      }
      if (e.error !== 'no-speech') {
        setIsRecording(false);
        clearInterval(silenceTimerRef.current);
      }
    };
    recog.onend = () => {
      if (autoSubmittingRef.current) return;
      /* Auto-restart if still in recording mode (browser auto-stops after ~60s) */
      if (isRecording && !autoSubmittingRef.current) {
        if (transcriptRef.current.trim() && (Date.now() - lastSpeechRef.current > 2500)) {
          autoSubmittingRef.current = true;
          setIsRecording(false);
          clearInterval(silenceTimerRef.current);
          submitAnswer(transcriptRef.current);
        } else {
          /* Restart recognition to keep listening */
          try { recog.start(); } catch (_) {
            setIsRecording(false);
            clearInterval(silenceTimerRef.current);
          }
        }
      } else {
        setIsRecording(false);
        clearInterval(silenceTimerRef.current);
      }
    };
    recognitionRef.current = recog;
    recog.start();
    setIsRecording(true);
    voiceStartRef.current = Date.now();
    lastSpeechRef.current = Date.now();
    wordCountRef.current = 0;
    /* silence detection: auto-submit after 2.5s of no new speech */
    clearInterval(silenceTimerRef.current);
    silenceTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastSpeechRef.current;
      if (elapsed > 2500 && transcriptRef.current.trim().length > 5 && !autoSubmittingRef.current) {
        autoSubmittingRef.current = true;
        recognitionRef.current?.stop();
        clearInterval(silenceTimerRef.current);
        setIsRecording(false);
        submitAnswer(transcriptRef.current);
      }
    }, 500);
  };

  /* ─── FORMAT TIMER ─── */
  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  /* ─── SCORE COLOR ─── */
  const scoreColor = (s) => s >= 75 ? '#22c55e' : s >= 50 ? '#eab308' : '#ef4444';

  /* ─── DOWNLOAD REPORT ─── */
  const downloadReport = () => {
    if (!report) return;
    const lines = [
      `INTERVIEW LAB REPORT`, `${'='.repeat(50)}`,
      `Overall Score: ${report.overallScore}/100 (${report.grade})`,
      `Verdict: ${report.verdict}`,
      `Recommendation: ${report.hiringRecommendation}`, '',
      `CATEGORY SCORES:`,
      ...Object.entries(report.categoryScores || {}).map(([k, v]) => `  ${k}: ${v}/100`), '',
      `STRENGTHS:`, ...(report.strengths || []).map(s => `  ✓ ${s}`), '',
      `WEAKNESSES:`, ...(report.weaknesses || []).map(s => `  ✗ ${s}`), '',
      `QUESTIONS REVIEW:`,
      ...(report.questionsReview || []).map((q, i) => [
        `  Q${i + 1}: ${q.question}`, `  Your Answer: ${q.yourAnswer}`,
        `  Correct: ${q.correctAnswer}`, `  Score: ${q.score}/10`, `  Missed: ${q.whatYouMissed}`, '',
      ].join('\n')),
      `IMPROVEMENT PLAN:`,
      ...(report.improvementPlan || []).map(p => `  Week ${p.week}: ${p.focus} — ${p.action}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `interview-report-${new Date().toISOString().slice(0, 10)}.txt`; a.click();
  };

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      <div>
        {(phase === 'interview' || phase === 'gd') ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Live Session</div>
              <h1 className="font-display font-extrabold text-2xl mt-1">{config.type}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {config.subject && <span className="career-chip">{config.subject}</span>}
              {phase === 'interview' && <>
                <span className="career-chip font-mono">Q {questionIndex + 1}/{totalQuestions}</span>
                <div className="w-24 h-2 bg-[var(--career-border)] bg-opacity-50 rounded-full overflow-hidden border border-[var(--career-border)]">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((questionIndex) / totalQuestions) * 100}%`, background: 'linear-gradient(90deg, var(--career-accent), var(--career-accent2))' }} />
                </div>
              </>}
              <div className={`career-chip flex items-center gap-2 ${timer < 60 ? 'text-red-400 il-pulse-anim' : ''}`}><Timer size={14} /> {fmtTime(timer)}</div>
            </div>
          </div>
        ) : null}
      </div>

      {loadingMsg && <LoadingOverlay msg={loadingMsg} />}
      {errorMsg && <div className="rounded-[12px] border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm font-medium flex items-center gap-2 text-amber-200"><AlertTriangle size={18} /> {errorMsg}</div>}

      {phase === 'setup' && (
        <SetupScreen config={config} setConfig={setConfig} onStart={handleStartInterview}
          eduData={eduData} loadingMsg={loadingMsg} pastSessions={pastSessions}
          onViewSession={(session) => {
            if (session.report) {
              setReport(session.report);
              setConfig(session.config || config);
              setPhase('report');
            }
          }} />
      )}

      {phase === 'interview' && currentQuestion && (
        <InterviewRoom
          config={config} currentQuestion={currentQuestion} questionIndex={questionIndex}
          totalQuestions={totalQuestions} timer={timer} fmtTime={fmtTime}
          isSpeaking={isSpeaking} aiThinking={aiThinking} isRecording={isRecording}
          transcript={transcript} typedAnswer={typedAnswer} setTypedAnswer={setTypedAnswer}
          inputMode={inputMode} setInputMode={setInputMode} 
          uploadedImage={uploadedImage} setUploadedImage={setUploadedImage}
          muted={muted} setMuted={setMuted}
          faceMetrics={faceMetrics} cameraReady={cameraReady} videoRef={videoRef}
          toggleRecording={toggleRecording}
          submitAnswer={submitAnswer} questionAnim={questionAnim}
          onEndClick={() => setShowEndModal(true)} faceReady={faceReady}
        />
      )}


      {phase === 'gd_multiplayer_lobby' && (
        <GDLobby 
          config={config} 
          eduData={eduData} 
          onEndGd={(multiplayerReport) => {
              if (multiplayerReport) {
                setReport(multiplayerReport);
                setConfig({ ...config, type: 'Group Discussion' });
                setPhase('report');
             } else {
                setPhase('setup');
             }
          }} 
        />
      )}

      {phase === 'report' && report && (
        <ReportScreen report={report} config={config} scoreColor={scoreColor}
          downloadReport={downloadReport}
          onRetry={() => { setPhase('setup'); setReport(null); setSessionId(null); }}
        />
      )}

      {showEndModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setShowEndModal(false)}>
          <div className="career-card p-8 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-extrabold mb-2 text-[var(--career-text)]">{phase === 'gd' ? 'End Discussion Early?' : 'End Interview Early?'}</h3>
            <p className="text-sm text-[var(--career-muted)] mb-6">
              {phase === 'gd'
                ? `The discussion has been going for ${Math.floor((config.duration * 60 - timer) / 60)} minutes. A performance report will be generated.`
                : `You've answered ${questionIndex} of ${totalQuestions} questions. A partial report will be generated.`
              }
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowEndModal(false)} className="flex-1 py-3 rounded-[12px] border border-[var(--career-border)] font-bold text-sm text-[var(--career-text)] bg-[var(--career-surface)] hover:bg-[var(--career-border)] hover:bg-opacity-40 transition-colors">Continue</button>
              <button onClick={phase === 'gd' ? handleEndGD : handleEndInterview} className="career-btn flex-1 justify-center !py-3">End & Get Report</button>
            </div>
          </div>
        </div>
      )}
      <InterviewLabStyles />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

function LoadingOverlay({ msg }) {
  const isCamera = msg?.toLowerCase().includes('camera');
  const IconComp = isCamera ? Camera : Rocket;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="career-card p-8 flex flex-col items-center gap-5 max-w-sm" style={{ minWidth: 280 }}>
        {/* Spinner ring */}
        <div className="relative flex items-center justify-center">
          <div className="w-14 h-14 rounded-full il-spin"
            style={{ border: '3px solid rgba(139,92,246,0.25)', borderTopColor: '#06b6d4' }} />
          <IconComp size={22} className="absolute text-[var(--career-accent2)]" style={{ opacity: 0.85 }} />
        </div>
        <p className="text-sm font-semibold text-center text-[var(--career-text)] text-opacity-90">{msg}</p>
      </div>
    </div>
  );
}

/* ─── SETUP SCREEN ─── */
function SetupScreen({ config, setConfig, onStart, eduData, loadingMsg, pastSessions, onViewSession }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Interview Lab</div>
        <h1 className="font-display font-extrabold text-3xl mt-1">Configure your mock interview</h1>
        <p className="text-sm text-[var(--career-muted)] mt-2 max-w-3xl">Practice with AI-powered mock interviews featuring voice, camera, and real-time facial analysis. Get detailed performance feedback.</p>
      </div>

      <div className="career-card p-6 space-y-4">
        <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Choose interview type</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setConfig(c => ({ ...c, type: t.id, subject: t.id === 'Domain-Specific' ? c.subject : '' }))}
              className={`text-left rounded-[12px] border px-4 py-4 transition-all hover:-translate-y-0.5 cursor-pointer ${config.type === t.id ? 'border-[rgba(139,92,246,0.65)] bg-[rgba(139,92,246,0.16)]' : 'border-[var(--career-border)] bg-[var(--career-surface)] hover:bg-[var(--career-surface)]'}`}>
              <div className="font-extrabold text-[var(--career-text)] flex items-center gap-2"><t.icon size={20} strokeWidth={1.5} className="text-[var(--career-accent2)]" /> {t.id}</div>
              <div className="text-xs text-[var(--career-muted)] mt-1">{t.desc}</div>
            </button>
          ))}
        </div>

        {/* Domain picker */}
        {config.type === 'Domain-Specific' && (
          <div className="mt-4">
            <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)] flex items-center gap-2 mb-3"><Target size={14} /> Select Your Domain</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {DOMAINS.map(d => (
                <button key={d.id} onClick={() => setConfig(c => ({ ...c, subject: c.subject === d.id ? '' : d.id }))}
                  className={`text-left p-3 rounded-[12px] border transition-all hover:-translate-y-0.5 cursor-pointer ${
                    config.subject === d.id
                      ? 'border-[rgba(6,182,212,0.7)] bg-[rgba(6,182,212,0.12)]'
                      : 'border-[var(--career-border)] bg-[var(--career-surface)] hover:border-[var(--career-border)] border-opacity-80'
                  }`}>
                  <span className={`block mb-1 ${config.subject === d.id ? 'text-[var(--career-accent2)]' : 'text-[var(--career-muted)]'}`}><d.icon size={22} strokeWidth={1.5} /></span>
                  <span className={`text-xs font-bold block ${config.subject === d.id ? 'text-[var(--career-text)]' : 'text-[var(--career-text)] text-opacity-80'}`}>{d.short}</span>
                  <span className="text-[10px] block text-[var(--career-muted)] shrink-0 opacity-80">{d.id}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {config.type === 'Group Discussion' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="career-card p-6 space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)] flex items-center gap-2"><Users size={14} /> Participants</div>
            <div className="flex flex-col gap-2">
              {GD_PARTICIPANT_OPTIONS.map(n => (
                <button key={n} onClick={() => setConfig(c => ({ ...c, gdParticipants: n }))}
                  className={`text-left rounded-[12px] border px-4 py-3 text-sm transition-all cursor-pointer ${config.gdParticipants === n ? 'border-[rgba(6,182,212,0.45)] bg-[rgba(6,182,212,0.08)] text-[var(--career-text)]' : 'border-[var(--career-border)] bg-[var(--career-surface)] text-[var(--career-muted)]'}`}>{n} Participants</button>
              ))}
            </div>
          </div>
          <div className="career-card p-6 space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)] flex items-center gap-2"><Timer size={14} /> Discussion Duration</div>
            <div className="flex flex-col gap-2">
              {GD_DURATIONS.map(d => (
                <button key={d.val} onClick={() => setConfig(c => ({ ...c, duration: d.val }))}
                  className={`text-left rounded-[12px] border px-4 py-3 text-sm transition-all cursor-pointer ${config.duration === d.val ? 'border-[rgba(6,182,212,0.45)] bg-[rgba(6,182,212,0.08)] text-[var(--career-text)]' : 'border-[var(--career-border)] bg-[var(--career-surface)] text-[var(--career-muted)]'}`}>{d.label}</button>
              ))}
            </div>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="career-card p-6 space-y-3">
          <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Difficulty</div>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map(d => (
              <button key={d} onClick={() => setConfig(c => ({ ...c, difficulty: d }))}
                className={`career-btn !py-2 !px-3 ${config.difficulty === d ? '' : 'opacity-60'}`}>{d}</button>
            ))}
          </div>
        </div>
        <div className="career-card p-6 space-y-3">
          <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Duration</div>
          <div className="flex flex-col gap-2">
            {DURATIONS.map(d => (
              <button key={d.val} onClick={() => setConfig(c => ({ ...c, duration: d.val }))}
                className={`text-left rounded-[12px] border px-4 py-3 text-sm transition-all cursor-pointer ${config.duration === d.val ? 'border-[rgba(6,182,212,0.45)] bg-[rgba(6,182,212,0.08)] text-[var(--career-text)]' : 'border-[var(--career-border)] bg-[var(--career-surface)] text-[var(--career-muted)]'}`}>{d.label}</button>
            ))}
          </div>
        </div>
        <div className="career-card p-6 space-y-3">
          <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Company Style</div>
          <div className="flex flex-wrap gap-2">
            {COMPANIES.map(c => (
              <button key={c} onClick={() => setConfig(cfg => ({ ...cfg, companyStyle: cfg.companyStyle === c ? '' : c }))}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${config.companyStyle === c ? 'border-[rgba(139,92,246,0.5)] bg-[rgba(139,92,246,0.15)] text-[var(--career-text)]' : 'border-[var(--career-border)] text-[var(--career-muted)] hover:border-[var(--career-border)] border-opacity-80'}`}>{c}</button>
            ))}
          </div>
        </div>
      </div>
      )}

      {pastSessions && pastSessions.length > 0 && (
        <div className="career-card p-6">
          <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)] mb-3 flex items-center gap-2"><ClipboardList size={14} /> Recent Sessions</div>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {pastSessions.slice(0, 5).map(s => (
              <div key={s.id} onClick={() => onViewSession?.(s)} className={`flex items-center justify-between px-4 py-3 border border-[var(--career-border)] rounded-[12px] text-xs gap-3 bg-[var(--career-surface)] ${s.report ? 'cursor-pointer hover:bg-[var(--career-surface)] transition-colors' : 'opacity-60'}`}>
                <span className="font-semibold truncate flex-1 text-[var(--career-text)] text-opacity-80">{s.type}</span>
                <span className="text-[var(--career-muted)]">{s.difficulty}</span>
                <span className="text-[var(--career-muted)]">{new Date(s.startedAt).toLocaleDateString()}</span>
                {s.overallScore != null ? (
                  <span className="font-bold min-w-[50px] text-right" style={{ color: s.overallScore >= 75 ? '#22c55e' : s.overallScore >= 50 ? '#eab308' : '#ef4444' }}>{s.overallScore}/100</span>
                ) : (
                  <span className="text-[var(--career-muted)] capitalize">{s.status}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={onStart} disabled={!config.type || !!loadingMsg || (config.type === 'Domain-Specific' && !config.subject)}
        className="career-btn w-full justify-center !py-4 !text-sm disabled:opacity-50">
        <Rocket size={18} /> {config.type === 'Group Discussion' ? 'Start Discussion' : 'Start Interview'}
      </button>
    </div>
  );
}

/* ─── INTERVIEW ROOM ─── */
function InterviewRoom({ config, currentQuestion, questionIndex, totalQuestions, timer, fmtTime,
  isSpeaking, aiThinking, isRecording, transcript, typedAnswer, setTypedAnswer,
  inputMode, setInputMode, uploadedImage, setUploadedImage, muted, setMuted, faceMetrics, cameraReady, videoRef,
  toggleRecording, submitAnswer, questionAnim, onEndClick, faceReady }) {

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const MAX = 1024;
        if (width > MAX || height > MAX) {
          if (width > height) { height *= MAX / width; width = MAX; }
          else { width *= MAX / height; height = MAX; }
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        setUploadedImage(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const isCodeQ = currentQuestion?.type === 'coding' || currentQuestion?.type === 'system-design' ||
    /write (a |the )?(function|code|program|algorithm|method|class|solution)|implement .*(function|method|algorithm)|solve .*(using|with|in) code/i.test(currentQuestion?.text || '');

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 10rem)' }}>

      {/* Middle: Camera pip + AI + Metrics row */}
      <div className="flex items-stretch gap-3 flex-shrink-0 mb-3" style={{ height: '100px' }}>
        {/* AI Avatar - compact */}
        <div className="career-card !p-0 px-4 flex items-center gap-3 min-w-[180px]">
          <div className="w-14 h-14 rounded-full bg-[var(--career-accent)] bg-opacity-20 flex items-center justify-center flex-shrink-0 relative border border-[var(--career-border)]">
            <svg viewBox="0 0 100 100" width="36" height="36">
              <circle cx="50" cy="32" r="18" fill="var(--career-accent2)" />
              <path d="M25,95 Q25,60 50,55 Q75,60 75,95" fill="var(--career-accent2)" />
              <circle cx="43" cy="30" r="2.5" fill="var(--career-surface)" /><circle cx="57" cy="30" r="2.5" fill="var(--career-surface)" />
            </svg>
            {isSpeaking && <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full il-pulse-anim border-2 border-[var(--career-surface)]" />}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[var(--career-text)]">AI Interviewer</span>
            <span className="text-[10px] text-[var(--career-muted)]">{aiThinking ? 'Thinking...' : isSpeaking ? 'Speaking...' : 'Listening'}</span>
            <button onClick={() => setMuted(m => !m)} className="text-[10px] text-[var(--career-muted)] hover:text-[var(--career-text)] bg-transparent border-none cursor-pointer text-left mt-0.5 flex items-center gap-1">
              {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              {muted ? 'Unmute' : 'Mute'}
            </button>
          </div>
        </div>

        {/* Camera pip */}
        <div className="rounded-[12px] overflow-hidden border border-[var(--career-border)] w-[140px] flex-shrink-0 relative bg-[var(--career-surface)]">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          {!cameraReady && <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--career-muted)] shrink-0 opacity-80 text-[10px]"><Camera size={14} className="mb-1 opacity-50" /> Off</div>}
        </div>

        {/* Metrics row */}
        <div className="flex-1 career-card !p-0 px-4 py-2 grid grid-cols-4 gap-2 items-center">
          <MetricBadge label="Confidence" value={cameraReady && faceReady ? `${faceMetrics.confidence}%` : 'N/A'} icon={<ScanFace size={16} />} />
          <MetricBadge label="Eye Contact" value={cameraReady && faceReady ? faceMetrics.eyeContact : 'N/A'} icon={<Eye size={16} />} />
          <MetricBadge label="Stress" value={cameraReady && faceReady ? faceMetrics.stress : 'N/A'} icon={<Activity size={16} />} />
          <MetricBadge label="Engagement" value={cameraReady && faceReady ? faceMetrics.engagement : 'N/A'} icon={<Speech size={16} />} />
        </div>
      </div>

      {/* Question card */}
      <div className={`career-card !p-4 flex-shrink-0 il-question-${questionAnim}`}>
        <span className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)] flex items-center gap-1.5 mb-2"><MessageSquare size={12} /> {config.type === 'Group Discussion' ? 'Discussion Turn' : 'Question'} {questionIndex + 1}</span>
        {aiThinking ? (
          <div className="flex items-center gap-2 py-2">
            <span className="il-dot" /><span className="il-dot il-dot-2" /><span className="il-dot il-dot-3" />
            <span className="text-sm text-[var(--career-muted)] ml-2">Thinking...</span>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold leading-relaxed whitespace-pre-wrap text-[var(--career-text)] text-opacity-90">{currentQuestion?.text}</p>
            {currentQuestion?.visual && (
              <pre className="mt-2 p-3 bg-[var(--career-surface)] text-[var(--career-accent2)] rounded-[10px] text-[12px] overflow-x-auto font-mono whitespace-pre leading-relaxed border border-[var(--career-border)]">{currentQuestion.visual}</pre>
            )}
          </>
        )}
        {currentQuestion?.hints?.length > 0 && !aiThinking && (
          <div className="mt-1 text-[10px] text-[var(--career-muted)] shrink-0 opacity-80 flex items-start gap-1"><Lightbulb size={12} className="min-w-3 mt-0.5 text-amber-400" /> <span>{currentQuestion.hints[0]}</span></div>
        )}
      </div>

      {/* Input area */}
      <div className="flex-1 mt-3 min-h-0">
        {isCodeQ && !aiThinking ? (
          <CodeEditor onSubmit={submitAnswer} disabled={aiThinking} onSkip={() => submitAnswer('', true)} onEnd={onEndClick} />
        ) : (
        <div className="career-card !p-4 h-full flex flex-col">
          <div className="flex gap-2 mb-3">
            {SpeechRecognition && <button onClick={() => setInputMode('voice')} className={`px-3 py-1.5 rounded-[8px] text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${inputMode === 'voice' ? 'border-[rgba(6,182,212,0.6)] bg-[rgba(6,182,212,0.12)] text-[var(--career-text)]' : 'border-[var(--career-border)] text-[var(--career-muted)] hover:border-[var(--career-border)] border-opacity-80'}`}><Mic size={14} /> Voice</button>}
            <button onClick={() => setInputMode('text')} className={`px-3 py-1.5 rounded-[8px] text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${inputMode === 'text' ? 'border-[rgba(6,182,212,0.6)] bg-[rgba(6,182,212,0.12)] text-[var(--career-text)]' : 'border-[var(--career-border)] text-[var(--career-muted)] hover:border-[var(--career-border)] border-opacity-80'}`}><Keyboard size={14} /> Type</button>
            <button onClick={() => setInputMode('upload')} className={`px-3 py-1.5 rounded-[8px] text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${inputMode === 'upload' ? 'border-[rgba(6,182,212,0.6)] bg-[rgba(6,182,212,0.12)] text-[var(--career-text)]' : 'border-[var(--career-border)] text-[var(--career-muted)] hover:border-[var(--career-border)] border-opacity-80'}`}><Camera size={14} /> Upload</button>
          </div>

          <div className="flex-1 min-h-0">
            {inputMode === 'voice' ? (
              <div className="flex flex-col items-center gap-2 justify-center h-full">
                {transcript && <div className="w-full p-2 bg-[var(--career-surface)] border border-[var(--career-border)] rounded-[10px] text-xs text-[var(--career-text)] text-opacity-80 max-h-[60px] overflow-y-auto il-transcript-live">{transcript}</div>}
                {isRecording && <div className="flex items-center gap-2 text-[10px] text-green-400 font-semibold"><span className="w-2 h-2 bg-green-500 rounded-full il-pulse-anim" />Listening... auto-submits on silence</div>}
                <button onClick={toggleRecording} disabled={aiThinking}
                  className={`w-14 h-14 rounded-full border flex items-center justify-center cursor-pointer transition-all ${isRecording ? 'bg-red-500 text-[var(--career-text)] scale-110 il-pulse-anim border-red-400' : 'bg-[var(--career-accent)] text-[var(--career-text)] hover:scale-105 border-[var(--career-accent)]'}`}>
                  {isRecording ? <Square size={24} fill="currentColor" /> : <Mic size={24} />}
                </button>
                <span className="text-[10px] text-[var(--career-muted)]">{isRecording ? 'Click to stop' : 'Click to speak'}</span>
              </div>
            ) : inputMode === 'upload' ? (
              <div className="flex flex-col gap-3 h-full">
                <div className="flex-1 border border-dashed border-[var(--career-border)] rounded-[10px] bg-[var(--career-surface)] flex flex-col items-center justify-center relative overflow-hidden">
                  {uploadedImage ? (
                    <>
                      <img src={uploadedImage} alt="Uploaded Answer" className="max-h-full max-w-full object-contain" />
                      <button onClick={() => setUploadedImage(null)} className="absolute top-2 right-2 bg-[var(--career-border)] bg-opacity-50 rounded-full p-2 hover:bg-white/20 cursor-pointer text-[var(--career-text)]"><X size={16} strokeWidth={3} /></button>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-[var(--career-surface)] flex items-center justify-center mb-4"><Camera size={28} className="text-[var(--career-muted)] shrink-0 opacity-80" /></div>
                      <p className="text-xs text-[var(--career-muted)] font-semibold text-center px-4">Upload a photo of your handwritten code or answer.</p>
                      <label className="career-btn mt-3 cursor-pointer">
                        Select Image
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                    </>
                  )}
                </div>
                {uploadedImage && (
                  <div className="flex gap-2 min-h-0">
                    <input type="text" placeholder="Add optional text note..." value={typedAnswer} onChange={e => setTypedAnswer(e.target.value)}
                      className="flex-1 p-2 bg-[var(--career-surface)] border border-[var(--career-border)] rounded-[10px] text-xs text-[var(--career-text)] outline-none focus:border-[var(--career-accent2)]" />
                    <button onClick={() => submitAnswer(typedAnswer, false, uploadedImage)} disabled={aiThinking}
                      className="career-btn disabled:opacity-40">Submit</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2 h-full">
                <textarea value={typedAnswer} onChange={e => setTypedAnswer(e.target.value)}
                  onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') submitAnswer(typedAnswer); }}
                  placeholder="Type your answer... (Ctrl+Enter to submit)"
                  className="w-full flex-1 p-3 bg-[var(--career-surface)] border border-[var(--career-border)] rounded-[10px] text-sm text-[var(--career-text)] outline-none focus:border-[var(--career-accent2)] resize-none transition-colors min-h-0 placeholder:text-[var(--career-text)] text-opacity-30" />
                <button onClick={() => submitAnswer(typedAnswer)} disabled={!typedAnswer.trim() || aiThinking}
                  className="career-btn self-end disabled:opacity-40">Submit</button>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-2 pt-2 border-t border-[var(--career-border)]">
            <button onClick={() => submitAnswer('', true)} disabled={aiThinking}
              className="px-4 py-1.5 rounded-[8px] border border-[var(--career-border)] text-xs font-bold text-[var(--career-muted)] hover:text-[var(--career-text)] hover:border-[var(--career-border)] border-opacity-80 transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5 bg-transparent">
              <SkipForward size={14} /> Skip
            </button>
            <button onClick={onEndClick} className="px-4 py-1.5 rounded-[8px] border border-red-500/40 text-red-400 text-xs font-bold hover:bg-red-500/10 bg-transparent transition-all cursor-pointer ml-auto flex items-center gap-1.5">
              <Power size={14} /> End
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

/* ─── GD ROOM ─── */
function GDRoom({ gdTopic, gdParticipants, gdTranscript, gdActiveSpeaker,
  timer, fmtTime, isSpeaking, isRecording, transcript, muted, setMuted,
  cameraReady, videoRef, faceReady, faceMetrics, onEndClick }) {

  const transcriptEndRef = useRef(null);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gdTranscript]);

  const getParticipantColor = (name) => {
    if (name === 'You') return 'var(--career-accent)';
    if (name === 'Moderator') return '#6b7280';
    const idx = gdParticipants.findIndex(p => p.name === name);
    return GD_COLORS[idx >= 0 ? idx : 0];
  };

  const getInitials = (name) => {
    if (name === 'You') return 'Y';
    if (name === 'Moderator') return 'M';
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 10rem)' }}>
      {/* Topic Banner */}
      <div className="career-card" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.22), rgba(6,182,212,0.12))' }}>
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare size={18} className="text-[var(--career-accent2)]" />
          <span className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-accent2)]">Discussion Topic</span>
        </div>
        <p className="text-[var(--career-text)] font-bold text-lg leading-snug">{gdTopic}</p>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="w-56 flex-shrink-0 flex flex-col gap-4">
          <div className="career-card flex-1">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)] mb-3">Participants</div>
            <div className="flex flex-col gap-2.5">
              {gdParticipants.map((p, i) => (
                <div key={p.name} className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] transition-all ${gdActiveSpeaker === p.name ? 'bg-[var(--career-surface)] ring-1 ring-[var(--career-accent)]' : 'bg-[var(--career-surface)]'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[var(--career-text)] text-[10px] font-bold flex-shrink-0 ${gdActiveSpeaker === p.name ? 'il-pulse-anim' : ''}`}
                    style={{ backgroundColor: GD_COLORS[i] }}>
                    {getInitials(p.name)}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold block truncate text-[var(--career-text)] text-opacity-80">{p.name}</span>
                    <span className="text-[9px] text-[var(--career-muted)] shrink-0 opacity-80 block truncate">{p.personality} · {p.stance}</span>
                  </div>
                  {gdActiveSpeaker === p.name && (
                    <div className="ml-auto flex items-end gap-0.5 h-4">
                      {[0,1,2].map(j => <div key={j} className="il-wave-bar" style={{ animationDelay: `${j*0.1}s`, height: '12px' }} />)}
                    </div>
                  )}
                </div>
              ))}
              <div className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] transition-all border ${isRecording ? 'border-green-500/40 bg-green-500/10' : 'border-[var(--career-border)] bg-[var(--career-surface)]'}`}>
                <div className="w-8 h-8 rounded-full bg-[var(--career-accent)] flex items-center justify-center text-[var(--career-text)] text-[10px] font-bold flex-shrink-0">Y</div>
                <div className="min-w-0">
                  <span className="text-xs font-bold block text-[var(--career-text)] text-opacity-80">You</span>
                  <span className="text-[9px] text-[var(--career-muted)] shrink-0 opacity-80 block">Candidate</span>
                </div>
                {isRecording && <span className="ml-auto w-2 h-2 bg-green-500 rounded-full il-pulse-anim" />}
              </div>
            </div>
          </div>

          <div className="rounded-[12px] overflow-hidden relative border border-[var(--career-border)] bg-[var(--career-surface)]" style={{ height: '140px' }}>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            {!cameraReady && (<div className="absolute inset-0 flex items-center justify-center"><Camera size={24} className="text-[var(--career-muted)] shrink-0 opacity-80" /></div>)}
            {faceReady && (
              <div className="absolute bottom-1 left-1 right-1 flex gap-1">
                <span className="bg-black/60 text-[var(--career-text)] text-[8px] px-1.5 py-0.5 rounded-full font-bold">{faceMetrics.confidence}%</span>
                <span className="bg-black/60 text-[var(--career-text)] text-[8px] px-1.5 py-0.5 rounded-full font-bold">{faceMetrics.stress}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 gap-3">
          <div className="flex-1 career-card overflow-y-auto min-h-0">
            <div className="flex flex-col gap-3">
              {gdTranscript.map((msg, i) => (
                <div key={i} className={`flex gap-2.5 ${msg.isUser ? 'flex-row-reverse' : ''}`}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--career-text)] text-[9px] font-bold flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: getParticipantColor(msg.speaker) }}>
                    {getInitials(msg.speaker)}
                  </div>
                  <div className={`max-w-[75%] ${msg.isUser ? 'text-right' : ''}`}>
                    <span className="text-[10px] font-bold block mb-0.5" style={{ color: getParticipantColor(msg.speaker) }}>{msg.speaker}</span>
                    <div className={`px-3 py-2 rounded-[12px] text-sm leading-relaxed ${
                      msg.isUser 
                        ? 'bg-[var(--career-accent)] text-[var(--career-text)] rounded-tr-none' 
                        : msg.speaker === 'Moderator' 
                          ? 'bg-[var(--career-surface)] text-[var(--career-muted)] rounded-tl-none italic'
                          : 'bg-[var(--career-surface)] text-[var(--career-text)] text-opacity-80 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>

          <div className="career-card !py-3 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isRecording ? 'bg-green-500 il-pulse-anim' : 'bg-[var(--career-border)] bg-opacity-50'}`}>
              {isRecording ? <Mic size={20} className="text-[var(--career-text)]" /> : <MicOff size={20} className="text-[var(--career-muted)] shrink-0 opacity-80" />}
            </div>
            <div className="flex-1 min-w-0">
              {transcript ? (
                <p className="text-xs text-[var(--career-muted)] truncate">{transcript}</p>
              ) : (
                <p className="text-xs text-[var(--career-muted)] shrink-0 opacity-80">{isRecording ? 'Mic is live — speak anytime to join the discussion...' : 'Mic is off'}</p>
              )}
              {isRecording && (
                <div className="flex items-end gap-0.5 mt-1 h-3">
                  {MIC_WAVE_HEIGHTS.map((h, i) => (
                    <div
                      key={i}
                      className="w-1 bg-green-400 rounded-full"
                      style={{
                        height: `${h}px`,
                        animation: 'il-wave 0.5s ease-in-out infinite alternate',
                        animationDelay: `${i * 0.06}s`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setMuted(!muted)} className="p-2 rounded-full hover:bg-[var(--career-border)] bg-opacity-50 transition-colors cursor-pointer" title={muted ? 'Unmute AI voices' : 'Mute AI voices'}>
              {muted ? <VolumeX size={18} className="text-[var(--career-muted)] shrink-0 opacity-80" /> : <Volume2 size={18} className="text-[var(--career-text)]" />}
            </button>
            <button onClick={onEndClick} className="px-4 py-2 rounded-[10px] border border-red-500/40 text-red-400 text-xs font-bold hover:bg-red-500/10 bg-transparent transition-all cursor-pointer flex items-center gap-1.5">
              <Power size={14} /> End
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── AI AVATAR ─── */
function AIAvatar({ isSpeaking, aiThinking }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-28 h-28 rounded-full bg-[var(--career-surface)] border border-[var(--career-border)] flex items-center justify-center relative">
        <svg viewBox="0 0 100 100" width="80" height="80">
          <circle cx="50" cy="32" r="18" fill="var(--career-accent2)" />
          <path d="M25,95 Q25,60 50,55 Q75,60 75,95" fill="var(--career-accent2)" />
          <circle cx="43" cy="30" r="2.5" fill="var(--career-surface)" />
          <circle cx="57" cy="30" r="2.5" fill="var(--career-surface)" />
          {!aiThinking && <path d="M43,38 Q50,43 57,38" stroke="var(--career-surface)" strokeWidth="2" fill="none" />}
        </svg>
        {aiThinking && <div className="absolute -bottom-2 flex gap-1"><span className="il-dot" /><span className="il-dot il-dot-2" /><span className="il-dot il-dot-3" /></div>}
      </div>
      {isSpeaking && (
        <div className="flex items-end gap-1 mt-3 h-6">
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="il-wave-bar" style={{ animationDelay: `${i * 0.1}s` }} />)}
        </div>
      )}
    </div>
  );
}

/* ─── METRIC BADGE ─── */
function MetricBadge({ label, value, icon }) {
  return (
    <div className="bg-[var(--career-surface)] rounded-[10px] p-3 flex items-center gap-2 il-metric-pop border border-[var(--career-border)]">
      <span className="text-[var(--career-accent2)]">{icon}</span>
      <div>
        <span className="text-[9px] text-[var(--career-muted)] shrink-0 opacity-80 block uppercase tracking-wider font-bold">{label}</span>
        <span className="text-sm font-bold text-[var(--career-text)]">{value}</span>
      </div>
    </div>
  );
}

/* ─── CODE EDITOR ─── */
function CodeEditor({ onSubmit, disabled, onSkip, onEnd }) {
  const [code, setCode] = useState('');
  const [lang, setLang] = useState('javascript');
  const lines = code.split('\n');

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newCode = code.substring(0, start) + '  ' + code.substring(end);
      setCode(newCode);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2; }, 0);
    }
    if (e.ctrlKey && e.key === 'Enter') {
      if (code.trim()) onSubmit(`[CODE:${lang}]\n${code}`);
    }
  };

  return (
    <div className="rounded-[12px] overflow-hidden border border-[var(--career-border)]">
      <div className="flex items-center justify-between px-5 py-3 bg-[var(--career-surface)] border-b border-[var(--career-border)]">
        <div className="flex items-center gap-3">
          <span className="text-[var(--career-accent2)] text-xs font-bold">💻 CODE EDITOR</span>
          <span className="text-[10px] text-[var(--career-text)] text-opacity-30 font-mono">Logic will be evaluated, not syntax</span>
        </div>
        <select value={lang} onChange={e => setLang(e.target.value)}
          className="bg-[var(--career-surface)] text-xs text-[var(--career-muted)] border border-[var(--career-border)] rounded-[8px] px-3 py-1.5 outline-none cursor-pointer">
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
          <option value="c">C</option>
          <option value="typescript">TypeScript</option>
          <option value="go">Go</option>
          <option value="rust">Rust</option>
          <option value="sql">SQL / Schema</option>
          <option value="nosql">NoSQL / JSON</option>
        </select>
      </div>

      <div className="flex bg-[var(--career-surface)] min-h-[280px] max-h-[450px]">
        <div className="py-4 px-2 select-none text-right border-r border-[var(--career-border)] min-w-[40px]" style={{ lineHeight: '1.6rem' }}>
          {lines.map((_, i) => (
            <div key={i} className="text-[11px] text-[var(--career-text)] text-opacity-25 font-mono">{i + 1}</div>
          ))}
          {lines.length === 0 && <div className="text-[11px] text-[var(--career-text)] text-opacity-25 font-mono">1</div>}
        </div>
        <textarea
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          placeholder={`// Write your ${lang} solution here...\n// Tab inserts 2 spaces\n// Ctrl+Enter to submit`}
          className="flex-1 bg-[var(--career-surface)] text-[var(--career-text)] font-mono text-[13px] p-4 outline-none resize-none overflow-auto placeholder:text-[var(--career-text)] text-opacity-20"
          style={{ lineHeight: '1.6rem', tabSize: 2 }}
        />
      </div>

      <div className="px-5 py-3 bg-[var(--career-surface)] border-t border-[var(--career-border)] flex items-center justify-between">
        <div className="flex gap-3">
          <button onClick={onSkip} disabled={disabled}
            className="px-4 py-1.5 rounded-[8px] border border-[var(--career-border)] text-xs font-medium text-[var(--career-muted)] shrink-0 opacity-80 hover:text-[var(--career-text)] hover:border-[var(--career-border)] border-opacity-80 transition-all cursor-pointer bg-transparent disabled:opacity-40 flex items-center gap-1.5"><SkipForward size={14} /> Skip</button>
          <button onClick={onEnd}
            className="px-4 py-1.5 rounded-[8px] border border-red-500/40 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-all cursor-pointer bg-transparent flex items-center gap-1.5"><Power size={14} /> End</button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[var(--career-text)] text-opacity-30">{lines.filter(l => l.trim()).length} lines · Ctrl+Enter</span>
          <button onClick={() => { if (code.trim()) onSubmit(`[CODE:${lang}]\n${code}`); }}
            disabled={!code.trim() || disabled}
            className="career-btn disabled:opacity-40 flex items-center gap-1.5">
            <Play size={14} fill="currentColor" /> Submit Code
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── RADAR CHART (SVG) ─── */
function RadarChart({ scores, size = 220 }) {
  const cats = Object.entries(scores || {});
  if (cats.length < 3) return null;
  const cx = size / 2, cy = size / 2, r = size * 0.35, n = cats.length, step = (2 * Math.PI) / n;
  const pt = (i, pct) => { const a = step * i - Math.PI / 2; return [cx + (pct / 100) * r * Math.cos(a), cy + (pct / 100) * r * Math.sin(a)]; };
  const toPath = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + 'Z';
  const labels = ['Technical', 'Comms', 'Confidence', 'Structure', 'Realtime'];
  return (
    <div className="flex justify-center py-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="il-radar-anim">
        {[25, 50, 75, 100].map(lv => <path key={lv} d={toPath(cats.map((_, i) => pt(i, lv)))} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />)}
        {cats.map((_, i) => { const [ex, ey] = pt(i, 100); return <line key={i} x1={cx} y1={cy} x2={ex} y2={ey} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />; })}
        <path d={toPath(cats.map(([, v], i) => pt(i, v)))} fill="rgba(139,92,246,0.18)" stroke="var(--career-accent2)" strokeWidth="2.5" strokeLinejoin="round" />
        {cats.map(([, v], i) => { const [px, py] = pt(i, v); return <circle key={i} cx={px} cy={py} r="4" fill="var(--career-accent)" stroke="var(--career-accent2)" strokeWidth="2" />; })}
        {cats.map(([k], i) => { const [lx, ly] = pt(i, 128); return <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="700" fill="rgba(255,255,255,0.5)">{labels[i] || k}</text>; })}
      </svg>
    </div>
  );
}

/* ─── REPORT SCREEN ─── */
function ReportScreen({ report, config, scoreColor, downloadReport, onRetry }) {
  const [expandedQ, setExpandedQ] = useState(null);
  const cats = report.categoryScores || {};
  const catEntries = Object.entries(cats);

  return (
    <div className="space-y-6">
      <div className="career-card !p-8 flex flex-col sm:flex-row items-center gap-8" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.22), rgba(6,182,212,0.12))' }}>
        <ScoreRing score={report.overallScore || 0} color={scoreColor(report.overallScore || 0)} />
        <div className="flex-1 text-center sm:text-left">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Performance Report</div>
          <h2 className="text-2xl font-extrabold text-[var(--career-text)] mt-1">{report.verdict || 'Report'}</h2>
          <p className="text-[var(--career-accent2)] font-bold text-lg mt-1">Grade: {report.grade}</p>
          <p className="text-[var(--career-muted)] text-sm mt-1">{report.hiringRecommendation}</p>
        </div>
      </div>

      {/* Radar chart */}
      {catEntries.length > 0 && (
        <div className="career-card il-report-section" style={{ animationDelay: '0.1s' }}>
          <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)] mb-4">Category Breakdown</div>
          <RadarChart scores={cats} />
          <div className="flex flex-col gap-3 mt-4">
            {catEntries.map(([k, v]) => (
              <div key={k} className="flex items-center gap-3">
                <span className="text-xs text-[var(--career-muted)] w-40 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                <div className="flex-1 h-3 bg-[var(--career-border)] bg-opacity-50 rounded-full overflow-hidden">
                  <div className="h-full rounded-full il-bar-grow" style={{ '--bar-w': `${v}%`, background: scoreColor(v) }} />
                </div>
                <span className="text-sm font-bold w-8 text-right" style={{ color: scoreColor(v) }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="career-card il-report-section" style={{ animationDelay: '0.2s' }}>
          <h3 className="text-base font-extrabold mb-3 text-green-400 flex items-center gap-1.5"><CheckCircle2 size={18} /> Strengths</h3>
          <ul className="flex flex-col gap-2">{(report.strengths || []).map((s, i) => <li key={i} className="text-sm text-[var(--career-muted)]">• {s}</li>)}</ul>
        </div>
        <div className="career-card il-report-section" style={{ animationDelay: '0.3s' }}>
          <h3 className="text-base font-extrabold mb-3 text-red-400 flex items-center gap-1.5"><AlertTriangle size={18} /> Weaknesses</h3>
          <ul className="flex flex-col gap-2">{(report.weaknesses || []).map((s, i) => <li key={i} className="text-sm text-[var(--career-muted)]">• {s}</li>)}</ul>
        </div>
      </div>

      {/* Questions Review */}
      <div className="career-card il-report-section" style={{ animationDelay: '0.4s' }}>
        <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)] mb-4 flex items-center gap-2"><FileText size={16} /> Questions Review</div>
        <div className="flex flex-col gap-3">
          {(report.questionsReview || []).map((q, i) => (
            <div key={i} className="border border-[var(--career-border)] rounded-[12px] overflow-hidden">
              <button onClick={() => setExpandedQ(expandedQ === i ? null : i)} className="w-full flex items-center justify-between px-5 py-3 bg-transparent border-none cursor-pointer text-left text-[var(--career-text)]">
                <span className="text-sm font-medium flex-1 text-[var(--career-text)] text-opacity-80">Q{i + 1}: {q.question?.slice(0, 80)}{q.question?.length > 80 ? '...' : ''}</span>
                <span className="text-sm font-bold px-2 py-0.5 rounded-lg" style={{ color: scoreColor(q.score * 10), background: `${scoreColor(q.score * 10)}20` }}>{q.score}/10</span>
              </button>
              {expandedQ === i && (
                <div className="px-5 pb-4 flex flex-col gap-2">
                  <div className="text-xs"><strong className="text-[var(--career-muted)] shrink-0 opacity-80">Your answer:</strong> <span className="text-[var(--career-muted)]">{q.yourAnswer}</span></div>
                  <div className="text-xs"><strong className="text-green-400">Correct answer:</strong> <span className="text-[var(--career-muted)]">{q.correctAnswer}</span></div>
                  <div className="text-xs"><strong className="text-red-400">What you missed:</strong> <span className="text-[var(--career-muted)]">{q.whatYouMissed}</span></div>
                  <div className="text-xs"><strong className="text-[var(--career-accent2)]">How to improve:</strong> <span className="text-[var(--career-muted)]">{q.howToImprove}</span></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Voice & Face summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="career-card il-report-section" style={{ animationDelay: '0.5s' }}>
          <h3 className="text-base font-extrabold mb-3 flex items-center gap-1.5 text-[var(--career-text)]"><Mic size={18} className="text-[var(--career-accent2)]" /> Voice Analysis</h3>
          {report.voiceAnalysisSummary && <>
            <div className="text-sm space-y-1 text-[var(--career-muted)]">
              <p>Pace: <strong className="text-[var(--career-text)]">{report.voiceAnalysisSummary.averagePace}</strong></p>
              <p>Volume: <strong className="text-[var(--career-text)]">{report.voiceAnalysisSummary.volumeConsistency}</strong></p>
              <p>Stability: <strong className="text-[var(--career-text)]">{report.voiceAnalysisSummary.pitchStability}</strong></p>
            </div>
            <ul className="mt-3 flex flex-col gap-2">{(report.voiceAnalysisSummary.voiceTips || []).map((t, i) => <li key={i} className="text-xs text-[var(--career-muted)] flex items-start gap-1"><Lightbulb size={12} className="min-w-3 mt-0.5 text-amber-400" /> <span>{t}</span></li>)}</ul>
          </>}
        </div>
        <div className="career-card il-report-section" style={{ animationDelay: '0.6s' }}>
          <h3 className="text-base font-extrabold mb-3 flex items-center gap-1.5 text-[var(--career-text)]"><Camera size={18} className="text-[var(--career-accent2)]" /> Facial Analysis</h3>
          {report.facialAnalysisSummary && <>
            <div className="text-sm space-y-1 text-[var(--career-muted)]">
              <p>Confidence: <strong className="text-[var(--career-text)]">{report.facialAnalysisSummary.averageConfidence}%</strong></p>
              <p>Eye Contact: <strong className="text-[var(--career-text)]">{report.facialAnalysisSummary.eyeContactRating}</strong></p>
              <p>Stress: <strong className="text-[var(--career-text)]">{report.facialAnalysisSummary.stressPattern}</strong></p>
            </div>
            <ul className="mt-3 flex flex-col gap-2">{(report.facialAnalysisSummary.bodyLanguageTips || []).map((t, i) => <li key={i} className="text-xs text-[var(--career-muted)] flex items-start gap-1"><Lightbulb size={12} className="min-w-3 mt-0.5 text-amber-400" /> <span>{t}</span></li>)}</ul>
          </>}
        </div>
      </div>

      {/* Improvement plan */}
      {report.improvementPlan && (
        <div className="career-card il-report-section" style={{ animationDelay: '0.7s' }}>
          <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)] mb-4 flex items-center gap-2"><Calendar size={16} /> 3-Week Improvement Plan</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {report.improvementPlan.map((p, i) => (
              <div key={i} className="bg-[var(--career-surface)] rounded-[12px] p-4 border border-[var(--career-border)]">
                <span className="career-chip">Week {p.week}</span>
                <p className="text-sm font-bold mt-2 text-[var(--career-text)]">{p.focus}</p>
                <p className="text-xs text-[var(--career-muted)] mt-1">{p.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button onClick={downloadReport} className="career-btn">📥 Download Report</button>
        <button onClick={onRetry} className="career-btn">🔄 Retry Interview</button>
        <button onClick={() => { onRetry(); }} className="px-4 py-2 rounded-[12px] border border-[var(--career-border)] text-[var(--career-muted)] text-xs font-bold hover:border-white/40 transition-all cursor-pointer bg-transparent">🎯 Try Different Type</button>
      </div>
    </div>
  );
}

/* ─── SCORE RING ─── */
function ScoreRing({ score, color }) {
  const r = 54, c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="relative w-36 h-36 flex-shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full">
        <circle cx="60" cy="60" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="none" />
        <circle cx="60" cy="60" r={r} stroke={color} strokeWidth="8" fill="none"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          transform="rotate(-90 60 60)" className="il-ring-anim" style={{ '--ring-offset': offset, '--ring-circ': c }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold text-[var(--career-text)]">{score}</span>
        <span className="text-xs text-[var(--career-muted)]">/100</span>
      </div>
    </div>
  );
}

/* ─── SCOPED STYLES ─── */
function InterviewLabStyles() {
  return (
    <style>{`
      .il-spin { animation: il-spin 0.8s linear infinite; }
      @keyframes il-spin { to { transform: rotate(360deg); } }

      .il-wave-bar {
        width: 4px; border-radius: 2px; background: var(--career-accent2, #06b6d4);
        animation: il-wave 0.6s ease-in-out infinite alternate;
      }
      @keyframes il-wave { from { height: 6px; } to { height: 22px; } }

      .il-dot {
        width: 8px; height: 8px; border-radius: 50%; background: var(--career-accent, #8b5cf6);
        display: inline-block; animation: il-bounce 0.6s ease-in-out infinite alternate;
      }
      .il-dot-2 { animation-delay: 0.15s; }
      .il-dot-3 { animation-delay: 0.3s; }
      @keyframes il-bounce { from { transform: translateY(0); } to { transform: translateY(-8px); } }

      .il-question-in { animation: il-slideIn 0.4s ease both; }
      .il-question-out { animation: il-slideOut 0.3s ease both; }
      @keyframes il-slideIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes il-slideOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(-40px); } }

      .il-pulse-anim { animation: il-pulse 1s ease-in-out infinite; }
      @keyframes il-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

      .il-metric-pop { transition: transform 0.2s; }
      .il-metric-pop:hover { transform: scale(1.03); }

      .il-report-section { animation: fadeUp 0.5s ease both; }

      .il-bar-grow { animation: il-barGrow 1s ease both; width: var(--bar-w); }
      @keyframes il-barGrow { from { width: 0%; } }

      .il-radar-anim { animation: il-radarGrow 1s ease both; transform-origin: center; }
      @keyframes il-radarGrow { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }

      .il-transcript-live { border-left: 3px solid var(--career-accent2); animation: il-transcriptPulse 1.5s ease-in-out infinite; }
      @keyframes il-transcriptPulse { 0%, 100% { border-left-color: var(--career-accent2); } 50% { border-left-color: var(--career-accent); } }

      .il-ring-anim {
        animation: il-ringDraw 1.5s ease both;
        stroke-dashoffset: var(--ring-offset);
      }
      @keyframes il-ringDraw { from { stroke-dashoffset: var(--ring-circ); } }
    `}</style>
  );
}
