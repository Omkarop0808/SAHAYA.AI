import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RefreshCw, StepBack, StepForward, Volume2, VolumeX, Sparkles } from 'lucide-react';
import api from '../../utils/api';

const SPEEDS = [
  { label: '0.25x', ms: 1400 },
  { label: '0.5x', ms: 900 },
  { label: '1x', ms: 500 },
  { label: '2x', ms: 260 },
  { label: '4x', ms: 150 },
];

const RECENT_KEY = 'career-visualizer-recent-v1';

function safeSpeak(text, { enabled, voiceName } = {}) {
  if (!enabled) return;
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(String(text || '').slice(0, 2000));
  const voices = synth.getVoices?.() || [];
  const picked = voiceName ? voices.find((v) => v.name === voiceName) : null;
  if (picked) u.voice = picked;
  u.rate = 1.0;
  u.pitch = 1.0;
  synth.speak(u);
}

function normalizeStep(step, i) {
  const fallback = `Step ${i + 1}`;
  const state = step?.state || {};
  return {
    label: String(step?.label || fallback),
    stepText: String(step?.stepText || ''),
    voiceText: String(step?.voiceText || ''),
    state: {
      array: Array.isArray(state.array) ? state.array : [],
      pointers: Array.isArray(state.pointers) ? state.pointers : [],
      window: state.window && typeof state.window === 'object' ? state.window : null,
      stack: Array.isArray(state.stack) ? state.stack : [],
      queue: Array.isArray(state.queue) ? state.queue : [],
      graph: state.graph && typeof state.graph === 'object' ? state.graph : null,
      tree: state.tree && typeof state.tree === 'object' ? state.tree : null,
    },
  };
}

function sanitizeAnalysis(raw) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const steps = Array.isArray(safe?.visualization?.steps) ? safe.visualization.steps.slice(0, 120).map(normalizeStep) : [];
  return {
    problem: safe.problem && typeof safe.problem === 'object' ? safe.problem : null,
    pattern: safe.pattern && typeof safe.pattern === 'object' ? safe.pattern : null,
    visualization: {
      steps,
      primaryStructure: String(safe?.visualization?.primaryStructure || 'mixed'),
    },
    final: safe.final && typeof safe.final === 'object' ? safe.final : null,
  };
}

function readRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function writeRecent(items) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 6)));
}

function ArrayViz({ array = [], pointers = [], window }) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-flex gap-2 items-end">
        {array.map((cell, idx) => {
          const hl = cell.highlight || 'none';
          const bg =
            hl === 'active'
              ? 'rgba(6,182,212,0.18)'
              : hl === 'compare'
                ? 'rgba(139,92,246,0.18)'
                : hl === 'swap'
                  ? 'rgba(239,68,68,0.18)'
                  : hl === 'window'
                    ? 'rgba(34,197,94,0.14)'
                    : 'rgba(255,255,255,0.04)';
          const border =
            hl === 'active'
              ? 'rgba(6,182,212,0.45)'
              : hl === 'compare'
                ? 'rgba(139,92,246,0.45)'
                : hl === 'swap'
                  ? 'rgba(239,68,68,0.45)'
                  : hl === 'window'
                    ? 'rgba(34,197,94,0.45)'
                    : 'rgba(255,255,255,0.10)';

          const pointerMarks = pointers.filter((p) => Number(p.index) === idx);
          const rawValue = String(cell.value ?? '');
          const valueLower = rawValue.toLowerCase();
          const boolLike = valueLower === 'true' || valueLower === 'false' || valueLower === 't' || valueLower === 'f';
          const inWindow = window && idx >= Number(window.l) && idx <= Number(window.r);
          return (
            <div key={idx} className="flex flex-col items-center gap-1">
              <div className="h-4">
                {pointerMarks.length ? (
                  <div className="flex gap-1">
                    {pointerMarks.slice(0, 2).map((p) => (
                      <div
                        key={`${p.name}-${idx}`}
                        className="text-[10px] font-extrabold"
                        style={{ color: p.color || '#06b6d4' }}
                      >
                        {p.name}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div
                className="w-12 h-12 rounded-xl border flex items-center justify-center font-mono text-sm text-white/90"
                style={{
                  background: inWindow ? 'rgba(34,197,94,0.10)' : bg,
                  borderColor: inWindow ? 'rgba(34,197,94,0.35)' : border,
                }}
                title={`idx ${idx}`}
              >
                {boolLike ? (valueLower.startsWith('t') ? 'T' : 'F') : rawValue}
              </div>
              <div className="text-[10px] text-white/45 font-mono">{idx}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StackViz({ stack = [], title = 'Stack' }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="font-semibold">{title}</div>
      <div className="mt-3 flex flex-col-reverse gap-2">
        {(stack || []).slice(0, 12).map((v, idx) => (
          <div key={`${v}-${idx}`} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-sm">
            {String(v)}
          </div>
        ))}
        {!stack?.length ? <div className="text-sm text-white/60">Empty</div> : null}
      </div>
    </div>
  );
}

function QueueViz({ queue = [], title = 'Queue' }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="font-semibold">{title}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(queue || []).slice(0, 16).map((v, idx) => (
          <div key={`${v}-${idx}`} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-sm">
            {String(v)}
          </div>
        ))}
        {!queue?.length ? <div className="text-sm text-white/60">Empty</div> : null}
      </div>
    </div>
  );
}

function buildGraphFallback(step, primaryStructure = 'mixed') {
  const state = step?.state || {};
  const fromGraph = state.graph && Array.isArray(state.graph.nodes) && state.graph.nodes.length
    ? state.graph
    : null;
  if (fromGraph) return fromGraph;

  const isGraphLike = primaryStructure === 'graph' || /graph|bfs|dfs|node|adjacency/i.test(`${step?.label || ''} ${step?.stepText || ''}`);
  if (!isGraphLike) return null;

  const array = Array.isArray(state.array) ? state.array : [];
  if (!array.length && !state.queue?.length && !state.stack?.length) return null;

  const pointers = Array.isArray(state.pointers) ? state.pointers : [];
  const activeIndex = pointers.find((p) => Number.isInteger(Number(p.index)))?.index;
  const frontier = new Set((state.queue || []).map((x) => Number(x)).filter(Number.isFinite));
  const values = array.map((cell) => String(cell?.value ?? ''));
  const nodes = values.map((v, i) => {
    const low = v.toLowerCase();
    const visited = low === 'true' || low === 't' || low === '1';
    let st = visited ? 'visited' : 'idle';
    if (frontier.has(i)) st = 'frontier';
    if (Number(activeIndex) === i) st = 'active';
    return { id: String(i), label: `${i}`, state: st };
  });

  return { nodes, edges: [], active: Number.isFinite(Number(activeIndex)) ? String(activeIndex) : '' };
}

function getJourneyCheckpoints(steps = []) {
  if (!steps.length) return [];
  if (steps.length <= 6) return steps.map((s, i) => ({ ...s, stepNo: i + 1 }));
  const mid = Math.floor(steps.length / 2);
  const picks = [0, 1, mid - 1, mid, steps.length - 2, steps.length - 1]
    .filter((x) => x >= 0 && x < steps.length);
  const uniq = Array.from(new Set(picks)).sort((a, b) => a - b);
  return uniq.map((i) => ({ ...steps[i], stepNo: i + 1 }));
}

function GraphViz({ graph }) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  if (!nodes.length) return <div className="text-sm text-white/60">No graph state in this step.</div>;

  const W = 560;
  const H = 280;
  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.max(90, Math.min(120, Math.floor((Math.min(W, H) - 50) / 2)));

  const positions = new Map();
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    positions.set(n.id, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  });

  const nodeColor = (state) => {
    if (state === 'active') return '#06B6D4';
    if (state === 'frontier') return '#8B5CF6';
    if (state === 'visited') return '#22C55E';
    return '#94A3B8';
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 overflow-x-auto">
      <div className="font-semibold">Graph state</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-3 min-w-[520px]">
        {edges.map((e, i) => {
          const a = positions.get(e.from);
          const b = positions.get(e.to);
          if (!a || !b) return null;
          const isActiveEdge = graph?.active && (e.from === graph.active || e.to === graph.active);
          return (
            <line
              key={`${e.from}-${e.to}-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={isActiveEdge ? 'career-viz-edge-active' : 'career-viz-edge'}
              stroke={isActiveEdge ? 'rgba(6,182,212,0.75)' : 'rgba(148,163,184,0.45)'}
              strokeWidth={isActiveEdge ? 2.8 : 1.8}
              style={{ transition: 'stroke 260ms ease, stroke-width 260ms ease, opacity 260ms ease' }}
            />
          );
        })}
        {nodes.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          const isActive = n.id === graph?.active || n.state === 'active';
          return (
            <g key={n.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isActive ? 18 : 15}
                className={isActive ? 'career-viz-node-active' : 'career-viz-node'}
                fill="rgba(10,10,15,0.9)"
                stroke={nodeColor(n.state)}
                strokeWidth={isActive ? 3 : 2}
                style={{ transition: 'r 260ms ease, stroke 260ms ease, stroke-width 260ms ease, filter 260ms ease' }}
              />
              <text x={p.x} y={p.y + 4} textAnchor="middle" fill="#E2E8F0" fontSize="11" fontWeight="700">
                {String(n.label || n.id)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function TreeViz({ tree }) {
  const nodes = Array.isArray(tree?.nodes) ? tree.nodes : [];
  const edges = Array.isArray(tree?.edges) ? tree.edges : [];
  if (!nodes.length) return <div className="text-sm text-white/60">No tree state in this step.</div>;

  const childSet = new Set(edges.map((e) => e.to));
  const rootId = nodes.find((n) => !childSet.has(n.id))?.id || nodes[0]?.id;
  const kids = new Map();
  edges.forEach((e) => {
    if (!kids.has(e.from)) kids.set(e.from, []);
    kids.get(e.from).push(e.to);
  });

  const levels = [];
  const seen = new Set();
  const q = [{ id: rootId, depth: 0 }];
  while (q.length) {
    const cur = q.shift();
    if (!cur || seen.has(cur.id)) continue;
    seen.add(cur.id);
    if (!levels[cur.depth]) levels[cur.depth] = [];
    levels[cur.depth].push(cur.id);
    const arr = kids.get(cur.id) || [];
    arr.forEach((id) => q.push({ id, depth: cur.depth + 1 }));
  }
  nodes.forEach((n) => {
    if (!seen.has(n.id)) {
      if (!levels[0]) levels[0] = [];
      levels[0].push(n.id);
    }
  });

  const W = 560;
  const H = Math.max(240, 120 + levels.length * 70);
  const positions = new Map();
  levels.forEach((row, depth) => {
    const y = 48 + depth * 70;
    row.forEach((id, i) => {
      const x = ((i + 1) * W) / (row.length + 1);
      positions.set(id, { x, y });
    });
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nodeColor = (state) => {
    if (state === 'active') return '#06B6D4';
    if (state === 'visited') return '#22C55E';
    return '#94A3B8';
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 overflow-x-auto">
      <div className="font-semibold">Tree state</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-3 min-w-[520px]">
        {edges.map((e, i) => {
          const a = positions.get(e.from);
          const b = positions.get(e.to);
          if (!a || !b) return null;
          const isActiveEdge = tree?.active && (e.from === tree.active || e.to === tree.active);
          return (
            <line
              key={`${e.from}-${e.to}-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={isActiveEdge ? 'career-viz-edge-active' : 'career-viz-edge'}
              stroke={isActiveEdge ? 'rgba(6,182,212,0.75)' : 'rgba(148,163,184,0.45)'}
              strokeWidth={isActiveEdge ? 2.8 : 1.8}
              style={{ transition: 'stroke 260ms ease, stroke-width 260ms ease, opacity 260ms ease' }}
            />
          );
        })}
        {Array.from(positions.entries()).map(([id, p]) => {
          const n = byId.get(id) || { id, label: id, state: 'idle' };
          const isActive = id === tree?.active || n.state === 'active';
          return (
            <g key={id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isActive ? 18 : 15}
                className={isActive ? 'career-viz-node-active' : 'career-viz-node'}
                fill="rgba(10,10,15,0.9)"
                stroke={nodeColor(n.state)}
                strokeWidth={isActive ? 3 : 2}
                style={{ transition: 'r 260ms ease, stroke 260ms ease, stroke-width 260ms ease, filter 260ms ease' }}
              />
              <text x={p.x} y={p.y + 4} textAnchor="middle" fill="#E2E8F0" fontSize="11" fontWeight="700">
                {String(n.label || n.id)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function AlgorithmVisualizer() {
  const [query, setQuery] = useState('https://leetcode.com/problems/two-sum/');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [data, setData] = useState(null);
  const [recentQueries, setRecentQueries] = useState(readRecent);
  const [voiceCache, setVoiceCache] = useState({});

  const steps = data?.visualization?.steps || [];
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(500);
  const [muted, setMuted] = useState(false);

  const step = steps[Math.min(idx, Math.max(0, steps.length - 1))] || null;
  const maxIdx = Math.max(steps.length - 1, 0);
  const primaryStructure = data?.visualization?.primaryStructure || 'mixed';
  const graphData = useMemo(() => buildGraphFallback(step, primaryStructure), [step, primaryStructure]);
  const checkpoints = useMemo(() => getJourneyCheckpoints(steps), [steps]);
  const firstExample = data?.problem?.examples?.[0] || null;

  const timerRef = useRef(null);
  useEffect(() => {
    if (!playing) return;
    timerRef.current = setInterval(() => {
      setIdx((i) => {
        const max = Math.max(steps.length - 1, 0);
        return i >= max ? max : i + 1;
      });
    }, Math.max(120, speedMs));
    return () => clearInterval(timerRef.current);
  }, [playing, speedMs, steps.length]);

  useEffect(() => {
    if (playing && idx >= maxIdx) setPlaying(false);
  }, [idx, maxIdx, playing]);

  useEffect(() => {
    return () => {
      if (window?.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (!step || muted) return;
    if (step.voiceText) {
      safeSpeak(step.voiceText, { enabled: !muted });
      return;
    }
    const cached = voiceCache[idx];
    if (cached) {
      safeSpeak(cached, { enabled: !muted });
      return;
    }
    if (!data?.pattern?.name) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.post('/career/visualizer/explain-step', {
          algoName: data.pattern.name,
          step: { label: step.label, stepText: step.stepText, state: step.state },
        });
        const explanation = String(res?.data?.explanation || '').trim();
        if (!explanation || cancelled) return;
        setVoiceCache((prev) => ({ ...prev, [idx]: explanation }));
        safeSpeak(explanation, { enabled: !muted });
      } catch {
        // Ignore fallback narration errors and keep UI interactive.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.pattern?.name, idx, muted, step, voiceCache]);

  useEffect(() => {
    if (!steps.length) return;
    const handler = (e) => {
      const tag = e?.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(maxIdx, i + 1));
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [maxIdx, steps.length]);

  const analyze = async () => {
    const input = query.trim();
    if (!input) return;
    setLoading(true);
    setErr(null);
    setData(null);
    setIdx(0);
    setPlaying(false);
    setVoiceCache({});
    try {
      const res = await api.post('/career/visualizer/analyze', { input });
      setData(sanitizeAnalysis(res.data));
      const nextRecent = [input, ...recentQueries.filter((x) => x !== input)].slice(0, 6);
      setRecentQueries(nextRecent);
      writeRecent(nextRecent);
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || 'Failed to analyze problem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="career-kicker">Algorithm Visualizer</div>
          <h1 className="font-display font-extrabold text-3xl mt-1">AI-powered interactive teaching</h1>
          <p className="text-sm text-white/65 mt-2 max-w-2xl">
            Paste a LeetCode URL or type a problem name. You’ll get pattern detection + an accurate step walkthrough + final solution.
          </p>
        </div>
        <div className="career-card p-4 flex items-center gap-3 flex-wrap">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') analyze();
            }}
            className="career-input !w-[420px] max-sm:!w-[260px]"
            placeholder="LeetCode URL or problem name"
          />
          <button type="button" onClick={analyze} className="career-btn" disabled={loading || !query.trim()}>
            <Sparkles size={16} /> {loading ? 'Analyzing…' : 'Analyze'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIdx(0);
              setPlaying(false);
              if (window?.speechSynthesis) window.speechSynthesis.cancel();
            }}
            className="career-btn opacity-80 hover:opacity-100"
            disabled={!steps.length}
          >
            <RefreshCw size={16} /> Reset
          </button>
        </div>
      </div>
      {recentQueries.length ? (
        <div className="career-card p-4">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55">Recent inputs</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {recentQueries.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setQuery(r)}
                className="career-chip hover:opacity-100 opacity-85"
                title={r}
              >
                {r.length > 62 ? `${r.slice(0, 62)}...` : r}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {err ? (
        <div className="career-card border border-red-400/35 bg-red-500/10">
          <div className="font-semibold text-red-200">Analyzer error</div>
          <p className="text-sm text-red-100/85 mt-2">{err}</p>
          <button type="button" onClick={analyze} className="career-btn mt-3">Retry</button>
        </div>
      ) : null}

      {data?.pattern ? (
        <div className="career-card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="career-kicker">Pattern identified</div>
              <div className="font-display font-extrabold text-2xl mt-1">{data.pattern.name}</div>
              <div className="text-sm text-white/70 mt-2">{data.pattern.ruleOfThumb}</div>
            </div>
            <div className="career-chip">Steps: {steps.length || 0}</div>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="font-semibold">Approach blueprint</div>
              <ul className="mt-2 text-sm text-white/70 space-y-2">
                {(data.pattern.approach || []).slice(0, 8).map((x, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="career-chip !px-2 !py-0.5 !text-[10px]">{i + 1}</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="font-semibold">How to recognize it next time</div>
              <ul className="mt-2 text-sm text-white/70 space-y-1">
                {(data.pattern.recognitionHints || []).slice(0, 6).map((x, i) => <li key={i}>- {x}</li>)}
              </ul>
            </div>
          </div>
          {data.pattern.whenToUse?.length ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mt-4">
              <div className="font-semibold">When this approach is correct</div>
              <ul className="mt-2 text-sm text-white/70 space-y-1">
                {data.pattern.whenToUse.slice(0, 6).map((x, i) => <li key={i}>- {x}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {data?.problem ? (
        <div className="career-card">
          <div className="font-semibold">{data.problem.title}</div>
          <div className="text-sm text-white/70 mt-2 whitespace-pre-wrap">{data.problem.description}</div>
          {data.problem.examples?.length ? (
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.problem.examples.slice(0, 2).map((ex, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="font-semibold">Example {i + 1}</div>
                  <div className="mt-2 text-sm text-white/70 whitespace-pre-wrap">
                    <div><span className="text-white/85 font-semibold">Input:</span> {ex.input}</div>
                    <div><span className="text-white/85 font-semibold">Output:</span> {ex.output}</div>
                    {ex.explanation ? <div className="mt-2"><span className="text-white/85 font-semibold">Why:</span> {ex.explanation}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {(firstExample || data?.final?.complexity) ? (
        <div className="career-card">
          <div className="career-kicker">Start to end journey</div>
          <div className="font-display font-extrabold text-xl mt-1">Input → Process → Output map</div>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="font-semibold">Start (Input)</div>
              <div className="text-sm text-white/70 mt-2 whitespace-pre-wrap">
                {firstExample?.input || 'Input will appear here from example #1.'}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="font-semibold">Core process</div>
              <div className="text-sm text-white/70 mt-2">
                {data?.pattern?.ruleOfThumb || 'Pattern explanation unavailable.'}
              </div>
              {data?.final?.complexity ? (
                <div className="mt-3 text-xs text-white/60">
                  Time: {data.final.complexity.time || 'N/A'} · Space: {data.final.complexity.space || 'N/A'}
                </div>
              ) : null}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="font-semibold">End (Expected output)</div>
              <div className="text-sm text-white/70 mt-2 whitespace-pre-wrap">
                {firstExample?.output || 'Output will appear here from example #1.'}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {steps.length ? (
        <div className="career-card">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="text-sm text-white/70">Step {idx + 1}/{steps.length}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} className="career-btn" disabled={idx <= 0}>
                <StepBack size={16} /> Back
              </button>
              <button type="button" onClick={() => setPlaying((p) => !p)} className="career-btn">
                {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIdx(0);
                  setPlaying(true);
                }}
                className="career-btn opacity-90 hover:opacity-100"
              >
                <Play size={16} /> Run full journey
              </button>
              <button type="button" onClick={() => setIdx((i) => Math.min(maxIdx, i + 1))} className="career-btn" disabled={idx >= maxIdx}>
                <StepForward size={16} /> Next
              </button>
              <button type="button" onClick={() => setMuted((m) => !m)} className="career-btn opacity-90 hover:opacity-100">
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />} {muted ? 'Muted' : 'Voice'}
              </button>
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-white/60 font-extrabold uppercase tracking-widest">Speed</span>
                <select className="career-input !w-[110px]" value={speedMs} onChange={(e) => setSpeedMs(Number(e.target.value))}>
                  {SPEEDS.map((s) => (
                    <option key={s.label} value={s.ms}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <input
              type="range"
              min={0}
              max={maxIdx}
              value={idx}
              onChange={(e) => setIdx(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
              aria-label="Step scrubber"
            />
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="font-semibold">Execution checkpoints</div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {checkpoints.map((cp) => (
                <button
                  key={`cp-${cp.stepNo}`}
                  type="button"
                  onClick={() => {
                    setIdx(Math.max(0, cp.stepNo - 1));
                    setPlaying(false);
                  }}
                  className="text-left rounded-xl border border-white/10 bg-black/20 hover:bg-black/35 transition-colors p-3"
                >
                  <div className="career-kicker">Step {cp.stepNo}</div>
                  <div className="font-semibold mt-1">{cp.label || `Step ${cp.stepNo}`}</div>
                  <div className="text-xs text-white/65 mt-1 line-clamp-2">{cp.stepText || 'No detail available.'}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="font-semibold">{step?.label || 'Step'}</div>
              <div className="text-sm text-white/70 mt-1">{step?.stepText || ''}</div>
              <div className="mt-4 space-y-4">
                {step?.state?.array?.length ? (
                  <ArrayViz array={step.state.array} pointers={step.state.pointers || []} window={step.state.window} />
                ) : (
                  <div className="text-sm text-white/60">No array visualization for this step.</div>
                )}
                {graphData?.nodes?.length ? <GraphViz graph={graphData} /> : null}
                {step?.state?.tree?.nodes?.length ? <TreeViz tree={step.state.tree} /> : null}
              </div>
            </div>

            <div className="space-y-4">
              <StackViz stack={step?.state?.stack || []} />
              <QueueViz queue={step?.state?.queue || []} />
              {(step?.voiceText || voiceCache[idx]) ? (
                <div className="rounded-xl border border-[rgba(6,182,212,0.25)] bg-[rgba(6,182,212,0.06)] p-4">
                  <div className="career-kicker">Teacher voice (text)</div>
                  <div className="text-sm text-white/80 mt-2 whitespace-pre-wrap">{step.voiceText || voiceCache[idx]}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {data?.final ? (
        <div className="career-card">
          <div className="font-semibold">Optimal solution</div>
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 overflow-x-auto">
            <pre className="text-sm text-white/80 whitespace-pre">{data.final.code}</pre>
          </div>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="font-semibold">Complexity</div>
              <div className="text-sm text-white/70 mt-2">
                <div><span className="font-semibold text-white/85">Time:</span> {data.final.complexity?.time}</div>
                <div><span className="font-semibold text-white/85">Space:</span> {data.final.complexity?.space}</div>
                {data.final.complexity?.explain ? <div className="mt-2">{data.final.complexity.explain}</div> : null}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="font-semibold">Similar problems to practice now</div>
              <ul className="mt-2 text-sm text-white/70 space-y-1">
                {(data.final.similar || []).slice(0, 6).map((p, i) => <li key={i}>- {p.title} ({p.pattern})</li>)}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

