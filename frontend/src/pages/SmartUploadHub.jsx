import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import DashHeader from '../components/DashHeader';
import { LoadingSkeleton, EmptyState, ErrorState } from '../components/PageStates';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  Upload,
  Link as LinkIcon,
  Youtube,
  FileText,
  Sparkles,
  Send,
  Lightbulb,
  Network,
  PlayCircle,
  MessageSquare,
  ChevronRight,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════
   CONCEPT MAP — auto-generated interactive node graph
   ═══════════════════════════════════════════════════ */
function ConceptMap({ lesson, subject }) {
  const svgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [hoveredNode, setHoveredNode] = useState(null);

  const sections = lesson?.sections || [];
  const objectives = lesson?.objectives || [];
  const title = lesson?.title || subject || 'Topic';

  // Build nodes: center = title, ring 1 = sections, ring 2 = objectives
  const centerX = 400;
  const centerY = 300;
  const r1 = 160;
  const r2 = 280;

  const sectionNodes = sections.map((s, i) => {
    const angle = (2 * Math.PI * i) / Math.max(sections.length, 1) - Math.PI / 2;
    return {
      id: `s-${i}`,
      label: s.heading || `Section ${i + 1}`,
      detail: (s.content || '').slice(0, 140) + ((s.content || '').length > 140 ? '\u2026' : ''),
      x: centerX + r1 * Math.cos(angle),
      y: centerY + r1 * Math.sin(angle),
      color: ['#FFB6C1', '#FFFF66', '#87CEEB', '#C4B5FD', '#FCA5A5', '#6EE7B7', '#FDE68A', '#A5B4FC'][i % 8],
      type: 'section',
    };
  });

  const objectiveNodes = objectives.map((o, i) => {
    const parentIdx = i % Math.max(sections.length, 1);
    const parent = sectionNodes[parentIdx] || { x: centerX, y: centerY };
    const subAngle = (2 * Math.PI * i) / Math.max(objectives.length, 1) - Math.PI / 2;
    return {
      id: `o-${i}`,
      label: o.length > 48 ? o.slice(0, 45) + '\u2026' : o,
      detail: o,
      x: centerX + r2 * Math.cos(subAngle),
      y: centerY + r2 * Math.sin(subAngle),
      parentId: `s-${parentIdx}`,
      parentX: parent.x,
      parentY: parent.y,
      color: '#E0E0E0',
      type: 'objective',
    };
  });

  const allNodes = [{ id: 'center', label: title, x: centerX, y: centerY, color: '#0D0D0D', type: 'center' }, ...sectionNodes, ...objectiveNodes];

  if (sections.length === 0 && objectives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#555555]">
        <Network size={32} className="mb-3 opacity-40" />
        <p className="text-sm">Generate a study package first to see the concept map.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute top-3 right-3 z-10 flex gap-1.5">
        <button onClick={() => setZoom(z => Math.min(z + 0.15, 2))} className="w-8 h-8 bg-white border-2 border-[#E0E0E0] rounded-lg flex items-center justify-center hover:border-[#0D0D0D] transition-colors">
          <ZoomIn size={14} />
        </button>
        <button onClick={() => setZoom(z => Math.max(z - 0.15, 0.5))} className="w-8 h-8 bg-white border-2 border-[#E0E0E0] rounded-lg flex items-center justify-center hover:border-[#0D0D0D] transition-colors">
          <ZoomOut size={14} />
        </button>
        <button onClick={() => setZoom(1)} className="w-8 h-8 bg-white border-2 border-[#E0E0E0] rounded-lg flex items-center justify-center hover:border-[#0D0D0D] transition-colors">
          <Maximize2 size={14} />
        </button>
      </div>

      <div className="overflow-auto rounded-[12px] border border-[#E0E0E0] bg-[#FAFAFA]" style={{ maxHeight: 480 }}>
        <svg ref={svgRef} viewBox="0 0 800 600" className="w-full min-w-[600px]" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.3s ease' }}>
          <defs>
            <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#00000020" />
            </filter>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#CCCCCC" />
            </marker>
          </defs>

          {/* Edges: center → sections */}
          {sectionNodes.map(n => (
            <line key={`e-c-${n.id}`} x1={centerX} y1={centerY} x2={n.x} y2={n.y}
              stroke={hoveredNode === n.id || hoveredNode === 'center' ? '#0D0D0D' : '#E0E0E0'}
              strokeWidth={hoveredNode === n.id ? 2.5 : 1.5} strokeDasharray={hoveredNode === n.id ? '' : '6,4'}>
              <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1.5s" repeatCount="indefinite" />
            </line>
          ))}

          {/* Edges: sections → objectives */}
          {objectiveNodes.map(n => (
            <line key={`e-${n.id}`} x1={n.parentX} y1={n.parentY} x2={n.x} y2={n.y}
              stroke={hoveredNode === n.id || hoveredNode === n.parentId ? '#CCCCCC' : '#F0F0F0'}
              strokeWidth={1} markerEnd="url(#arrowhead)" />
          ))}

          {/* Center node */}
          <g onMouseEnter={() => setHoveredNode('center')} onMouseLeave={() => setHoveredNode(null)} style={{ cursor: 'pointer' }}>
            <rect x={centerX - 80} y={centerY - 22} width={160} height={44} rx={12} fill="#0D0D0D" filter="url(#nodeShadow)">
              <animate attributeName="rx" values="12;14;12" dur="3s" repeatCount="indefinite" />
            </rect>
            <text x={centerX} y={centerY + 5} textAnchor="middle" fill="#FFFF66" fontSize="13" fontWeight="800" fontFamily="inherit">{title.slice(0, 22)}</text>
          </g>

          {/* Section nodes */}
          {sectionNodes.map((n, i) => (
            <g key={n.id} onMouseEnter={() => setHoveredNode(n.id)} onMouseLeave={() => setHoveredNode(null)} style={{ cursor: 'pointer' }}>
              <motion.rect
                x={n.x - 65} y={n.y - 18} width={130} height={36} rx={10}
                fill={hoveredNode === n.id ? n.color : `${n.color}CC`} stroke={hoveredNode === n.id ? '#0D0D0D' : `${n.color}`}
                strokeWidth={hoveredNode === n.id ? 2.5 : 1.5} filter="url(#nodeShadow)"
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 * i, type: 'spring', stiffness: 200 }}
              />
              <text x={n.x} y={n.y + 4} textAnchor="middle" fill="#0D0D0D" fontSize="10" fontWeight="700" fontFamily="inherit">
                {n.label.slice(0, 18)}{n.label.length > 18 ? '\u2026' : ''}
              </text>
            </g>
          ))}

          {/* Objective nodes */}
          {objectiveNodes.map((n, i) => (
            <g key={n.id} onMouseEnter={() => setHoveredNode(n.id)} onMouseLeave={() => setHoveredNode(null)} style={{ cursor: 'pointer' }}>
              <motion.rect
                x={n.x - 55} y={n.y - 14} width={110} height={28} rx={8}
                fill={hoveredNode === n.id ? '#FFF' : '#F9F9F9'} stroke={hoveredNode === n.id ? '#0D0D0D' : '#E0E0E0'}
                strokeWidth={hoveredNode === n.id ? 2 : 1} filter="url(#nodeShadow)"
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 + 0.05 * i, type: 'spring', stiffness: 180 }}
              />
              <text x={n.x} y={n.y + 3} textAnchor="middle" fill="#555555" fontSize="8.5" fontWeight="600" fontFamily="inherit">
                {n.label.slice(0, 16)}{n.label.length > 16 ? '\u2026' : ''}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredNode && hoveredNode !== 'center' && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-3 left-3 right-3 bg-white border-2 border-[#0D0D0D] rounded-[12px] p-4 shadow-lg z-20"
          >
            <p className="text-xs font-bold uppercase text-[#888] mb-1">{allNodes.find(n => n.id === hoveredNode)?.type}</p>
            <p className="text-sm font-bold">{allNodes.find(n => n.id === hoveredNode)?.label}</p>
            {allNodes.find(n => n.id === hoveredNode)?.detail && (
              <p className="text-xs text-[#555555] mt-1 leading-relaxed">{allNodes.find(n => n.id === hoveredNode)?.detail}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ANIMATED WALKTHROUGH — step-by-step lesson player
   ═══════════════════════════════════════════════════ */
function AnimatedWalkthrough({ lesson, subject }) {
  const sections = lesson?.sections || [];
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (playing && sections.length > 0) {
      intervalRef.current = setInterval(() => {
        setStep(s => {
          if (s >= sections.length - 1) { setPlaying(false); return s; }
          return s + 1;
        });
      }, 4000);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, sections.length]);

  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#555555]">
        <PlayCircle size={32} className="mb-3 opacity-40" />
        <p className="text-sm">Generate a study package to see the animated walkthrough.</p>
      </div>
    );
  }

  const current = sections[step];
  const progress = ((step + 1) / sections.length) * 100;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="bg-[#E0E0E0] rounded-full h-2 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#FFFF66] via-[#FFB6C1] to-[#87CEEB]"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlaying(p => !p)}
            className="w-10 h-10 bg-[#0D0D0D] rounded-[10px] flex items-center justify-center border-none cursor-pointer hover:scale-105 transition-transform"
          >
            {playing ? <Pause size={16} className="text-[#FFFF66]" /> : <PlayCircle size={16} className="text-[#FFFF66]" />}
          </button>
          <button
            onClick={() => { setStep(0); setPlaying(false); }}
            className="w-10 h-10 bg-white border-2 border-[#E0E0E0] rounded-[10px] flex items-center justify-center cursor-pointer hover:border-[#0D0D0D] transition-colors"
          >
            <RotateCcw size={14} />
          </button>
        </div>
        <span className="text-xs font-bold text-[#555555] uppercase tracking-wide">
          Step {step + 1} of {sections.length}
        </span>
        <div className="flex gap-1.5">
          <button
            disabled={step === 0}
            onClick={() => { setStep(s => s - 1); setPlaying(false); }}
            className="px-3 py-1.5 text-xs font-bold border-2 border-[#E0E0E0] rounded-lg bg-white disabled:opacity-30 cursor-pointer hover:border-[#0D0D0D] transition-colors"
          >
            Prev
          </button>
          <button
            disabled={step === sections.length - 1}
            onClick={() => { setStep(s => s + 1); setPlaying(false); }}
            className="px-3 py-1.5 text-xs font-bold border-2 border-[#0D0D0D] rounded-lg bg-[#0D0D0D] text-[#FFFF66] disabled:opacity-30 cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>

      {/* Step timeline */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {sections.map((s, i) => (
          <button
            key={i}
            onClick={() => { setStep(i); setPlaying(false); }}
            className={`flex-shrink-0 px-3 py-2 rounded-[10px] text-[11px] font-bold border-2 transition-all cursor-pointer ${
              i === step
                ? 'bg-[#0D0D0D] text-[#FFFF66] border-[#0D0D0D] scale-105'
                : i < step
                  ? 'bg-[#FFFF66]/30 border-[#FFFF66] text-[#0D0D0D]'
                  : 'bg-white border-[#E0E0E0] text-[#555555] hover:border-[#0D0D0D]'
            }`}
          >
            {(s.heading || `Step ${i + 1}`).slice(0, 16)}
          </button>
        ))}
      </div>

      {/* Animated content card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 40, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -40, scale: 0.97 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="bg-white border-2 border-[#0D0D0D] rounded-[20px] overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-[#0D0D0D] to-[#1a1a2e]">
            <div className="flex items-center gap-3">
              <motion.div
                className="w-10 h-10 rounded-[10px] flex items-center justify-center font-display text-lg font-extrabold"
                style={{ background: ['#FFB6C1', '#FFFF66', '#87CEEB', '#C4B5FD', '#FCA5A5', '#6EE7B7', '#FDE68A', '#A5B4FC'][step % 8] }}
                initial={{ rotate: -10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                {step + 1}
              </motion.div>
              <div>
                <h4 className="text-[#FFFF66] font-bold text-[15px]">{current.heading || `Section ${step + 1}`}</h4>
                <p className="text-white/40 text-[11px]">{lesson?.title || subject}</p>
              </div>
            </div>
          </div>

          {/* Content with reveal animation */}
          <div className="px-6 py-5">
            <motion.div
              className="text-[14px] leading-relaxed text-[#333] whitespace-pre-wrap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
            >
              {current.content}
            </motion.div>

            {/* Visual connector to next */}
            {step < sections.length - 1 && (
              <motion.div
                className="mt-5 flex items-center gap-2 text-xs text-[#555555] font-semibold"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <ChevronRight size={14} className="text-[#FFB6C1]" />
                <span>Next: <strong>{sections[step + 1]?.heading || `Section ${step + 2}`}</strong></span>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CONTEXTUAL Q&A CHAT — ask about uploaded content
   ═══════════════════════════════════════════════════ */
function ContextualChat({ doc, subject }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Build context summary from the document
  const getDocContext = useCallback(() => {
    const out = doc?.outputs;
    if (!out) return '';
    const parts = [];
    if (out.summary) parts.push(`Summary: ${out.summary}`);
    if (out.lesson?.sections) {
      parts.push('Sections: ' + out.lesson.sections.map(s => `${s.heading}: ${(s.content || '').slice(0, 200)}`).join(' | '));
    }
    if (out.lesson?.objectives) parts.push('Objectives: ' + out.lesson.objectives.join(', '));
    return parts.join('\n').slice(0, 2000);
  }, [doc]);

  const sendMessage = async () => {
    if (!input.trim() || isThinking) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsThinking(true);

    try {
      const contextualQuestion = `Based on these study notes:\n${getDocContext()}\n\nStudent question: ${userMsg}\n\nProvide a clear explanation. If relevant, include:\n- A simple analogy\n- Key formula or definition\n- A concrete example`;

      const { data } = await api.post('/study/companion/explain', {
        question: contextualQuestion,
        subject: doc?.subject || subject,
      });

      const note = data.note;
      let aiResponse = '';
      if (note?.analogy) aiResponse += `\uD83C\uDFA8 **Analogy**\n${note.analogy}\n\n`;
      if (note?.technical) aiResponse += `\uD83D\uDD2C **Technical**\n${note.technical}\n\n`;
      if (note?.worked_example) aiResponse += `\u270F\uFE0F **Example**\n${note.worked_example}`;

      setMessages(prev => [...prev, {
        role: 'ai',
        content: aiResponse.trim() || 'I explained that concept. Ask me another question!',
        noteId: note?.id,
      }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', content: `\u26A0\uFE0F Sorry, I couldn\u2019t process that. ${e.message || 'Try again.'}` }]);
    }
    setIsThinking(false);
  };

  const suggestedQuestions = [
    `What is the main idea of ${subject}?`,
    'Can you simplify the hardest concept here?',
    'Give me a real-world example of this topic',
    'What are common mistakes students make here?',
    'How does this connect to other topics?',
  ];

  return (
    <div className="flex flex-col" style={{ height: 480 }}>
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-3 pr-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <motion.div
              className="w-16 h-16 bg-gradient-to-br from-[#87CEEB]/30 to-[#FFB6C1]/30 border-2 border-[#E0E0E0] rounded-[16px] flex items-center justify-center mb-4"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <MessageSquare size={24} className="text-[#555555]" />
            </motion.div>
            <p className="text-sm font-bold text-[#0D0D0D] mb-1">Ask about your notes</p>
            <p className="text-xs text-[#555555] mb-5 max-w-sm">
              I have read your uploaded material. Ask me anything \u2014 I will explain with analogies, formulas, and worked examples.
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center max-w-md">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(q); }}
                  className="text-[11px] font-semibold px-3 py-1.5 bg-[#F4F4F4] border border-[#E0E0E0] rounded-full hover:bg-[#FFFF66]/40 hover:border-[#FFFF66] transition-all cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] rounded-[16px] px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[#0D0D0D] text-white rounded-br-[4px]'
                : 'bg-white border-2 border-[#E0E0E0] text-[#333] rounded-bl-[4px]'
            }`}>
              {msg.role === 'ai' ? (
                <div className="space-y-2">
                  {msg.content.split('\n\n').map((block, bi) => {
                    if (block.startsWith('\uD83C\uDFA8 **') || block.startsWith('\uD83D\uDD2C **') || block.startsWith('\u270F\uFE0F **')) {
                      const headerEnd = block.indexOf('\n');
                      const header = block.slice(0, headerEnd);
                      const body = block.slice(headerEnd + 1);
                      const emoji = header.slice(0, 2);
                      const label = header.replace(/[*]/g, '').slice(2).trim();
                      const bgColor = emoji === '\uD83C\uDFA8' ? '#87CEEB' : emoji === '\uD83D\uDD2C' ? '#FFB6C1' : '#FFFF66';
                      return (
                        <div key={bi} className="rounded-[10px] overflow-hidden border border-[#E0E0E0]">
                          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ background: `${bgColor}50` }}>
                            <span>{emoji}</span> {label}
                          </div>
                          <div className="px-3 py-2.5 text-[13px] whitespace-pre-wrap">{body}</div>
                        </div>
                      );
                    }
                    return <p key={bi} className="whitespace-pre-wrap">{block}</p>;
                  })}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </motion.div>
        ))}

        {isThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-white border-2 border-[#E0E0E0] rounded-[16px] rounded-bl-[4px] px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map(d => (
                  <motion.div
                    key={d}
                    className="w-2 h-2 bg-[#555555] rounded-full"
                    animate={{ y: [-2, 2, -2] }}
                    transition={{ duration: 0.6, delay: d * 0.15, repeat: Infinity }}
                  />
                ))}
              </div>
              <span className="text-xs text-[#555555]">Analyzing your notes\u2026</span>
            </div>
          </motion.div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="border-t-2 border-[#E0E0E0] pt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
          placeholder="Ask anything about your uploaded notes\u2026"
          disabled={isThinking}
          className="flex-1 border-2 border-[#E0E0E0] rounded-xl px-4 py-3 text-sm focus:border-[#87CEEB] outline-none transition-colors disabled:opacity-50"
        />
        <button
          type="button"
          disabled={isThinking || !input.trim()}
          onClick={sendMessage}
          className="px-4 py-3 bg-[#0D0D0D] text-[#FFFF66] rounded-xl border-none cursor-pointer disabled:opacity-40 hover:scale-105 transition-transform flex items-center gap-2"
        >
          {isThinking ? (
            <span className="w-4 h-4 border-2 border-[#FFFF66] border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════ */
export default function SmartUploadHub() {
  const { eduData } = useAuth();
  const subjects = eduData?.subjects || ['General'];

  const [subject, setSubject] = useState('General');
  const [url, setUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [doc, setDoc] = useState(null);
  const [tab, setTab] = useState('lesson');

  /* ── Deep Explain sub-tab inside results ── */
  const [explainMode, setExplainMode] = useState('map');

  const process = async () => {
    setError('');
    setLoading(true);
    setDoc(null);
    try {
      const fd = new FormData();
      fd.append('subject', subject);
      if (file) fd.append('file', file);
      if (url.trim()) fd.append('url', url.trim());
      if (youtubeUrl.trim()) fd.append('youtubeUrl', youtubeUrl.trim());
      if (rawText.trim()) fd.append('rawText', rawText.trim());
      const { data } = await api.postMultipart('/study/hub/process', fd);
      setDoc(data.document);
      setTab('lesson');
    } catch (e) {
      setError(e.message || 'Processing failed');
    }
    setLoading(false);
  };

  const out = doc?.outputs;
  const lesson = out?.lesson;

  const EXPLAIN_MODES = [
    { key: 'map', label: 'Concept Map', icon: Network, color: '#87CEEB' },
    { key: 'walkthrough', label: 'Animated Steps', icon: PlayCircle, color: '#FFB6C1' },
    { key: 'chat', label: 'Ask Questions', icon: MessageSquare, color: '#FFFF66' },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9]">
        <DashHeader title="Study Studio" />
        <div className="p-8 flex-1 max-w-4xl w-full mx-auto max-sm:p-4 space-y-8">
          <p className="text-sm text-[#555555]">
            One upload \u2192 a full <strong>study package</strong> with an <strong>AI explainer</strong> that generates concept maps,
            animated walkthroughs, and answers your questions about the material.
          </p>

          {/* ═══════════ UPLOAD SECTION ═══════════ */}
          <div className="bg-white border-2 border-[#0D0D0D] rounded-[20px] p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-[#FFFF66] border-2 border-[#0D0D0D] rounded-[8px] flex items-center justify-center">
                <Upload size={15} />
              </div>
              <h3 className="text-[17px] font-extrabold">Upload & Generate</h3>
            </div>
            <p className="text-xs text-[#555555] -mt-2">
              Drop a PDF, URL, YouTube link, or raw text \u2192 get lesson + flashcards + quiz + practice + roadmap + videos + AI explainer.
            </p>

            <label className="block text-xs font-bold uppercase tracking-wide text-[#555555]">Subject / topic</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border-2 border-[#E0E0E0] rounded-xl px-4 py-3 text-[15px]"
            />

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-[#555555] mb-2">
                  <Upload size={14} /> PDF or .txt
                </label>
                <input type="file" accept=".pdf,.txt,text/plain,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-[#555555] mb-2">
                  <LinkIcon size={14} /> Article URL
                </label>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://\u2026"
                  className="w-full border-2 border-[#E0E0E0] rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-[#555555] mb-2">
                  <Youtube size={14} /> YouTube URL
                </label>
                <input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="w-full border-2 border-[#E0E0E0] rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-[#555555] mb-2">
                <FileText size={14} /> Raw text
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={5}
                className="w-full border-2 border-[#E0E0E0] rounded-xl px-4 py-3 text-sm"
                placeholder="Paste notes\u2026"
              />
            </div>

            {error && <ErrorState message={error} onRetry={() => setError('')} />}

            <button
              type="button"
              onClick={process}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-[#0D0D0D] text-[#FFFF66] font-bold px-6 py-3 rounded-xl border-none cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-[#FFFF66] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles size={18} />
              )}
              Generate full study package
            </button>
          </div>

          {loading && <LoadingSkeleton lines={6} />}

          {!loading && !doc && !error && (
            <EmptyState
              title="Nothing generated yet"
              hint="Try a lecture PDF or a Wikipedia URL — you\u2019ll get lesson + drills + cards + AI explainer in one pass."
            />
          )}

          {/* ═══════════ RESULTS ═══════════ */}
          <AnimatePresence>
            {out && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border-2 border-[#FFFF66] rounded-[20px] overflow-hidden"
              >
                <Tabs value={tab} onValueChange={setTab} className="p-4 md:p-6">
                  <TabsList className="flex h-auto gap-1 w-full justify-start overflow-x-auto scrollbar-hide" style={{ flexWrap: 'nowrap' }}>
                    <TabsTrigger value="lesson">Lesson</TabsTrigger>
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
                    <TabsTrigger value="questions">Quiz bank</TabsTrigger>
                    <TabsTrigger value="practice">Practice</TabsTrigger>
                    <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
                    <TabsTrigger value="videos">Videos</TabsTrigger>
                    <TabsTrigger value="deep-explain"
                      className="!bg-gradient-to-r !from-[#87CEEB]/25 !to-[#FFB6C1]/25 !border-[#87CEEB]/50 font-extrabold"
                    >
                      <Lightbulb size={13} className="mr-1 text-[#0369a1]" /> Deep Explain
                    </TabsTrigger>
                  </TabsList>

                  <div className="max-h-[600px] overflow-y-auto text-[15px] leading-relaxed mt-4">
                    <TabsContent value="lesson" className="mt-0">
                      <h4 className="font-display font-bold text-xl mb-2">{lesson?.title || subject}</h4>
                      <ul className="list-disc pl-5 text-sm text-[#555555] mb-4">
                        {(lesson?.objectives || []).map((o, i) => (
                          <li key={i}>{o}</li>
                        ))}
                      </ul>
                      {(lesson?.sections || []).map((sec, i) => (
                        <div key={i} className="mb-6 border border-[#ECECEC] rounded-xl p-4">
                          <h5 className="font-bold text-[#0D0D0D] mb-2">{sec.heading}</h5>
                          <div className="whitespace-pre-wrap text-[#333]">{sec.content}</div>
                        </div>
                      ))}
                    </TabsContent>
                    <TabsContent value="summary" className="mt-0 whitespace-pre-wrap">
                      {out.summary}
                    </TabsContent>
                    <TabsContent value="flashcards" className="mt-0">
                      <ul className="space-y-3">
                        {(out.flashcards || []).map((c, i) => (
                          <li key={i} className="border border-[#E0E0E0] rounded-xl p-4">
                            <p className="font-bold text-[#0D0D0D]">{c.front}</p>
                            <p className="text-[#555555] mt-2">{c.back}</p>
                          </li>
                        ))}
                      </ul>
                    </TabsContent>
                    <TabsContent value="questions" className="mt-0">
                      <ul className="space-y-4">
                        {[...(out.self_test_questions || []), ...(out.question_bank || [])].map((q, i) => (
                          <li key={i} className="border border-[#E0E0E0] rounded-xl p-4">
                            <p className="font-semibold">{q.question}</p>
                            {q.type === 'mcq' && q.options && (
                              <ul className="mt-2 text-sm text-[#555555] list-disc pl-5">
                                {q.options.map((o, j) => (
                                  <li key={j}>{o}</li>
                                ))}
                              </ul>
                            )}
                            <p className="mt-2 text-sm text-green-800">Answer: {String(q.answer)}</p>
                          </li>
                        ))}
                      </ul>
                    </TabsContent>
                    <TabsContent value="practice" className="mt-0">
                      <ul className="space-y-4">
                        {(out.practice_problems || []).map((p, i) => (
                          <li key={i} className="border border-[#E0E0E0] rounded-xl p-4">
                            <p className="font-bold text-[#0D0D0D]">
                              {p.title || `Problem ${i + 1}`}{' '}
                              <span className="text-xs font-normal text-[#888]">difficulty {p.difficulty ?? '\u2014'}</span>
                            </p>
                            <p className="mt-2 whitespace-pre-wrap">{p.prompt}</p>
                            {p.hints?.length > 0 && (
                              <p className="mt-2 text-sm text-[#555555]">
                                <span className="font-bold">Hints:</span> {p.hints.join(' \u00B7 ')}
                              </p>
                            )}
                            <p className="mt-2 text-sm text-[#333]">
                              <span className="font-bold">Approach:</span> {p.solution_outline}
                            </p>
                            {p.rubric_points?.length > 0 && (
                              <ul className="mt-2 text-xs list-disc pl-5 text-[#666]">
                                {p.rubric_points.map((r, j) => (
                                  <li key={j}>{r}</li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </TabsContent>
                    <TabsContent value="roadmap" className="mt-0">
                      <div>
                        <h4 className="font-display font-bold text-lg mb-3">{out.roadmap?.title}</h4>
                        <ul className="space-y-4">
                          {(out.roadmap?.phases || []).map((p, i) => (
                            <li key={i} className="border rounded-xl p-4">
                              <p className="font-bold">
                                {p.title}{' '}
                                <span className="text-xs font-normal text-[#555555]">~{p.estimated_days} days</span>
                              </p>
                              <ul className="list-disc pl-5 mt-2 text-sm">
                                {p.tasks?.map((t, j) => (
                                  <li key={j}>{t}</li>
                                ))}
                              </ul>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </TabsContent>
                    <TabsContent value="videos" className="mt-0">
                      <ul className="space-y-3">
                        {(out.recommended_videos || []).map((v, i) => (
                          <li key={i}>
                            <a href={v.url} target="_blank" rel="noreferrer" className="text-[#0D0D0D] font-bold underline">
                              {v.title || v.videoId}
                            </a>
                            {v.reason && <p className="text-sm text-[#555555]">{v.reason}</p>}
                          </li>
                        ))}
                      </ul>
                    </TabsContent>

                    {/* ═══════ DEEP EXPLAIN TAB ═══════ */}
                    <TabsContent value="deep-explain" className="mt-0">
                      <div className="space-y-4">
                        {/* Mode selector pills */}
                        <div className="flex gap-1.5 bg-[#F4F4F4] p-1.5 rounded-[14px]">
                          {EXPLAIN_MODES.map(({ key, label, icon: Icon, color }) => (
                            <button
                              key={key}
                              onClick={() => setExplainMode(key)}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] text-[12px] font-bold transition-all border-none cursor-pointer ${
                                explainMode === key
                                  ? 'bg-white border-2 shadow-sm text-[#0D0D0D]'
                                  : 'bg-transparent text-[#555555] hover:bg-white/60'
                              }`}
                              style={explainMode === key ? { borderColor: color, borderWidth: 2, borderStyle: 'solid' } : {}}
                            >
                              <Icon size={14} style={explainMode === key ? { color } : {}} />
                              <span className="hidden sm:inline">{label}</span>
                            </button>
                          ))}
                        </div>

                        {/* Content */}
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={explainMode}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.2 }}
                          >
                            {explainMode === 'map' && (
                              <ConceptMap lesson={lesson} subject={subject} />
                            )}
                            {explainMode === 'walkthrough' && (
                              <AnimatedWalkthrough lesson={lesson} subject={subject} />
                            )}
                            {explainMode === 'chat' && (
                              <ContextualChat doc={doc} subject={subject} />
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
