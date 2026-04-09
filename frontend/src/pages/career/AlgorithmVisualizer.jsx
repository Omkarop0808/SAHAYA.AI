import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RefreshCw, StepBack, StepForward } from 'lucide-react';
import { ErrorState } from '../../components/PageStates';
import api from '../../utils/api';

function bubbleSortSteps(arr) {
  const a = [...arr];
  const steps = [{ arr: [...a], i: -1, j: -1, swapped: false, note: 'Start' }];
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a.length - i - 1; j++) {
      steps.push({ arr: [...a], i, j, swapped: false, note: `Compare a[${j}] and a[${j + 1}]` });
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        steps.push({ arr: [...a], i, j, swapped: true, note: `Swap positions ${j} and ${j + 1}` });
      }
    }
  }
  steps.push({ arr: [...a], i: -1, j: -1, swapped: false, note: 'Sorted' });
  return steps;
}

function mergeSortSteps(arr) {
  const steps = [{ arr: [...arr], note: 'Start' }];
  const a = [...arr];

  function merge(l, m, r) {
    const left = a.slice(l, m + 1);
    const right = a.slice(m + 1, r + 1);
    let i = 0, j = 0, k = l;
    while (i < left.length && j < right.length) {
      const pickLeft = left[i] <= right[j];
      a[k] = pickLeft ? left[i++] : right[j++];
      steps.push({ arr: [...a], note: `Merge write at ${k}` });
      k++;
    }
    while (i < left.length) {
      a[k++] = left[i++];
      steps.push({ arr: [...a], note: `Flush left` });
    }
    while (j < right.length) {
      a[k++] = right[j++];
      steps.push({ arr: [...a], note: `Flush right` });
    }
  }

  function sort(l, r) {
    if (l >= r) return;
    const m = Math.floor((l + r) / 2);
    sort(l, m);
    sort(m + 1, r);
    merge(l, m, r);
  }

  sort(0, a.length - 1);
  steps.push({ arr: [...a], note: 'Sorted' });
  return steps;
}

function countBubbleOps(steps, idx) {
  let n = 0;
  const lim = Math.min(idx, steps.length - 1);
  for (let k = 0; k <= lim; k++) {
    const note = steps[k].note || '';
    if (note.includes('Compare') || note.includes('Swap')) n++;
  }
  return n;
}

function countMergeOps(steps, idx) {
  let n = 0;
  const lim = Math.min(idx, steps.length - 1);
  for (let k = 0; k <= lim; k++) {
    const note = steps[k].note || '';
    if (note.includes('Merge write') || note.includes('Flush')) n++;
  }
  return n;
}

function Bars({ step, accent }) {
  const max = Math.max(...step.arr, 1);
  return (
    <div className="flex items-end gap-2 h-56 w-full">
      {step.arr.map((v, idx) => {
        const active = idx === step.j || idx === step.j + 1;
        const h = Math.round((v / max) * 100);
        return (
          <div key={idx} className="flex-1 min-w-0">
            <div
              className="w-full rounded-xl border"
              style={{
                height: `${h}%`,
                background: active ? `linear-gradient(180deg, ${accent}, rgba(6,182,212,0.35))` : 'rgba(255,255,255,0.08)',
                borderColor: active ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.10)',
              }}
              title={`${v}`}
            />
          </div>
        );
      })}
    </div>
  );
}

async function explainStepLocal(step, algoName) {
  // lightweight backend optional: use existing /api/ai if present, otherwise local narration
  try {
    const { data } = await api.post('/career/visualizer/explain-step', { algoName, step });
    return data?.explanation || '';
  } catch {
    return step.note || '';
  }
}

export default function AlgorithmVisualizer() {
  const [input, setInput] = useState('5,1,4,2,8,3');
  const [speed, setSpeed] = useState(650);
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const [explain, setExplain] = useState('');
  const [err, setErr] = useState(null);

  const arr = useMemo(() => {
    const nums = input.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
    return nums.length ? nums : [5, 1, 4, 2, 8, 3];
  }, [input]);

  const bubble = useMemo(() => bubbleSortSteps(arr), [arr]);
  const merge = useMemo(() => mergeSortSteps(arr), [arr]);

  const stepA = bubble[Math.min(idx, bubble.length - 1)];
  const stepB = merge[Math.min(idx, merge.length - 1)];

  const timerRef = useRef(null);
  useEffect(() => {
    if (!playing) return;
    timerRef.current = setInterval(() => {
      setIdx((i) => {
        const max = Math.max(bubble.length, merge.length) - 1;
        return i >= max ? max : i + 1;
      });
    }, Math.max(120, speed));
    return () => clearInterval(timerRef.current);
  }, [playing, speed, bubble.length, merge.length]);

  useEffect(() => {
    let alive = true;
    setExplain('');
    Promise.all([
      explainStepLocal(stepA, 'Bubble Sort'),
      explainStepLocal(stepB, 'Merge Sort'),
    ]).then(([a, b]) => {
      if (!alive) return;
      setExplain(`Bubble: ${a}\nMerge: ${b}`);
    }).catch(() => {
      if (!alive) return;
      setExplain(stepA.note || '');
    });
    return () => { alive = false; };
  }, [idx]);

  const reset = () => { setIdx(0); setPlaying(false); };
  const maxIdx = Math.max(bubble.length, merge.length) - 1;
  const bubbleOpCount = countBubbleOps(bubble, idx);
  const mergeOpCount = countMergeOps(merge, idx);

  if (err) return <ErrorState message={err} />;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55">Algorithm Visualizer</div>
          <h1 className="font-display font-extrabold text-3xl mt-1">Side-by-side: Bubble vs Merge</h1>
          <p className="text-sm text-white/65 mt-2 max-w-2xl">
            Step through and compare how algorithms transform the same input. Narration is AI-assisted when backend keys are available.
          </p>
        </div>
        <div className="career-card p-4 flex items-center gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none w-[260px] max-sm:w-[180px]"
          />
          <button type="button" onClick={reset} className="career-btn">
            <RefreshCw size={16} /> Reset
          </button>
        </div>
      </div>

      <div className="career-card p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-white/70">Step {idx}/{maxIdx}</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} className="career-btn" disabled={idx <= 0}>
              <StepBack size={16} /> Prev
            </button>
            <button type="button" onClick={() => setPlaying((p) => !p)} className="career-btn">
              {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? 'Pause' : 'Play'}
            </button>
            <button type="button" onClick={() => setIdx((i) => Math.min(maxIdx, i + 1))} className="career-btn" disabled={idx >= maxIdx}>
              <StepForward size={16} /> Next
            </button>
            <div className="flex items-center gap-2 ml-2">
              <span className="text-xs text-white/60 font-extrabold uppercase tracking-widest">Speed</span>
              <input type="range" min="120" max="1200" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
          <div className="border border-white/10 rounded-[12px] p-4 bg-white/[0.03]">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="font-display font-extrabold text-lg">Bubble Sort</div>
              <div className="career-chip tabular-nums">Ops {bubbleOpCount}</div>
            </div>
            <Bars step={stepA} accent="var(--career-accent2)" />
            <div className="text-xs text-white/60 mt-3 font-mono">{stepA.note}</div>
          </div>
          <div className="border border-white/10 rounded-[12px] p-4 bg-white/[0.03]">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="font-display font-extrabold text-lg">Merge Sort</div>
              <div className="career-chip tabular-nums">Ops {mergeOpCount}</div>
            </div>
            <Bars step={{ arr: stepB.arr, j: -1 }} accent="var(--career-accent)" />
            <div className="text-xs text-white/60 mt-3 font-mono">{stepB.note}</div>
          </div>
        </div>

        {explain && (
          <div className="mt-5 border border-[rgba(6,182,212,0.25)] bg-[rgba(6,182,212,0.06)] rounded-[12px] p-5">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-accent2)] mb-2">Step narration (Groq)</div>
            <div className="text-sm text-white/80 whitespace-pre-wrap">{explain}</div>
          </div>
        )}
      </div>
    </div>
  );
}

