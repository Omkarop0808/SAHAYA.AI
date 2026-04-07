import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, Handle, MarkerType, Position, useEdgesState, useNodesState } from 'reactflow';
import 'reactflow/dist/style.css';
import { ErrorState, LoadingSkeleton } from '../../components/PageStates';
import { getCareerConceptMap, setCareerTopicState, fetchConceptLesson } from '../../utils/careerApi';
import { ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_COLOR = {
  not_started: '#475569',
  learning: '#06B6D4',
  review: '#F59E0B',
  completed: '#22C55E',
  mastered: '#A855F7',
};

function TopicNode({ data }) {
  const stroke = STATUS_COLOR[data.status] || STATUS_COLOR.not_started;
  return (
    <div
      className="rounded-[12px] px-3 py-2 min-w-[120px] text-center font-mono text-[13px]"
      style={{
        border: `1px solid ${stroke}`,
        background: '#111118',
        color: '#F8FAFC',
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-[var(--career-accent2)] !w-2 !h-2" />
      <div className="font-semibold leading-tight">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--career-accent)] !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { topic: TopicNode };

function toFlowElements(nodes, edges) {
  const flowNodes = nodes.map((n) => ({
    id: n.id,
    type: 'topic',
    position: { x: n.x ?? 0, y: n.y ?? 0 },
    data: { label: n.label, status: n.status, description: n.description },
  }));
  const flowEdges = edges.map((e, i) => ({
    id: `e-${i}-${e.from}-${e.to}`,
    source: e.from,
    target: e.to,
    markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(148,163,184,0.6)' },
    style: { stroke: 'rgba(148,163,184,0.45)', strokeWidth: 2 },
  }));
  return { flowNodes, flowEdges };
}

export default function ConceptMap() {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lesson, setLesson] = useState(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const load = async () => {
    setState({ loading: true, error: null, data: null });
    try {
      const data = await getCareerConceptMap();
      setState({ loading: false, error: null, data });
    } catch {
      setState({ loading: false, error: 'Failed to load concept map.', data: null });
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const d = state.data;
    if (!d?.nodes?.length) return;
    const { flowNodes, flowEdges } = toFlowElements(d.nodes, d.edges || []);
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [state.data, setNodes, setEdges]);

  const onNodeClick = useCallback((_, node) => {
    const orig = state.data?.nodes?.find((n) => n.id === node.id);
    setSelected(orig || { id: node.id, label: node.data.label, description: node.data.description, status: node.data.status });
    setLesson(null);
  }, [state.data]);

  const onSetStatus = async (topicId, status) => {
    setSaving(true);
    try {
      await setCareerTopicState({ topicId, status });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const loadLesson = async () => {
    if (!selected) return;
    setLessonLoading(true);
    setLesson(null);
    try {
      const res = await fetchConceptLesson({ topicId: selected.id, label: selected.label });
      setLesson(res);
    } catch {
      setLesson({ lesson: 'Could not load lesson. Check GROQ_API_KEY and backend.', sources: [] });
    } finally {
      setLessonLoading(false);
    }
  };

  const recommended = useMemo(() => {
    const nodesList = state.data?.nodes || [];
    const notDone = nodesList.filter((n) => n.status === 'not_started' || n.status === 'learning');
    return notDone[0] || null;
  }, [state.data]);

  if (state.loading) return <LoadingSkeleton lines={7} className="career-card p-6" />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55">Career Concept Map</div>
          <h1 className="font-display font-extrabold text-3xl mt-1">Dependency graph</h1>
          <p className="text-sm text-white/65 mt-2 max-w-2xl">
            react-flow graph with topic status. AI mini-lessons use local RAG (llmware/corpus pipeline) + Groq summarization.
          </p>
        </div>
        {recommended && (
          <div className="career-card px-4 py-3 text-sm text-white/80 max-w-md">
            <span className="text-[var(--career-accent2)] font-extrabold">Suggested next: </span>
            {recommended.label}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="career-card career-card--flush xl:col-span-2 overflow-hidden rounded-[12px] min-h-[420px] border border-[rgba(139,92,246,0.3)]">
          <div className="h-[460px]">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background color="rgba(148,163,184,0.12)" gap={20} />
              <Controls className="!bg-[#111118] !border-[rgba(139,92,246,0.3)]" />
            </ReactFlow>
          </div>
        </div>

        <div className="career-card p-6 space-y-4">
          <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-white/55">Topic</div>
          {!selected ? (
            <div className="text-sm text-white/60 border border-white/10 rounded-[12px] p-5 bg-white/[0.03]">
              Select a node. Mark progress, open related problems in the arena, or generate a RAG-grounded lesson.
            </div>
          ) : (
            <>
              <div>
                <div className="font-display font-extrabold text-2xl">{selected.label}</div>
                <div className="text-sm text-white/65 mt-2">{selected.description}</div>
                <div className="mt-2 text-xs text-[var(--career-accent2)]">
                  Status: <span className="font-mono">{selected.status}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55">Progress</div>
                {['not_started', 'learning', 'mastered'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={saving}
                    onClick={() => onSetStatus(selected.id, s)}
                    className={`w-full text-left px-4 py-3 rounded-[12px] border transition-colors ${
                      selected.status === s ? 'border-[rgba(139,92,246,0.45)] bg-white/[0.08]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="font-semibold capitalize">{s.replace('_', ' ')}</span>
                  </button>
                ))}
              </div>

              <Link to={`/career/arena`} className="career-btn inline-flex no-underline">
                <ExternalLink size={16} /> Open DSA Arena
              </Link>

              <button type="button" className="career-btn w-full justify-center" onClick={loadLesson} disabled={lessonLoading}>
                {lessonLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                AI lesson (RAG + Groq)
              </button>

              {lesson && (
                <div className="border border-[rgba(139,92,246,0.3)] rounded-[12px] p-4 bg-[rgba(139,92,246,0.05)] text-sm text-white/85 whitespace-pre-wrap max-h-[320px] overflow-auto">
                  {lesson.lesson || lesson}
                  {lesson.sources?.length > 0 && (
                    <div className="mt-3 text-xs text-white/50 font-mono">
                      Sources: {lesson.sources.slice(0, 4).join(', ')}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
