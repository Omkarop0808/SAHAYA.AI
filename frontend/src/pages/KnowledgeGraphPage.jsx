import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import Sidebar from '../components/Sidebar';
import DashHeader from '../components/DashHeader';
import { LoadingSkeleton, EmptyState, ErrorState } from '../components/PageStates';
import api from '../utils/api';

function layoutNodes(nodes) {
  const cols = 4;
  return nodes.map((n, i) => ({
    id: n.id,
    position: { x: (i % cols) * 220, y: Math.floor(i / cols) * 100 },
    data: {
      label: n.data?.label || n.label || n.id,
      documentIds: n.documentIds || n.data?.documentIds || [],
    },
  }));
}

export default function KnowledgeGraphPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sel, setSel] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/study/graph');
      const rawNodes = data.nodes || [];
      if (!rawNodes.length) {
        setNodes([]);
        setEdges([]);
        setLoading(false);
        return;
      }
      const nx = layoutNodes(rawNodes);
      const ex = (data.edges || []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
      }));
      setNodes(nx);
      setEdges(ex);
    } catch (e) {
      setError(e.message || 'Failed to load graph');
    }
    setLoading(false);
  }, [setNodes, setEdges]);

  useEffect(() => { load(); }, [load]);

  const onNodeClick = useCallback((_, n) => {
    const full = nodes.find((x) => x.id === n.id);
    setSel(full || n);
  }, [nodes]);

  const panelDocs = useMemo(() => sel?.data?.documentIds || [], [sel]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9]">
        <DashHeader title="Living Knowledge Graph" />
        <div className="flex-1 flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]">
          <div className="flex-1 min-h-[420px] border-b-2 lg:border-b-0 lg:border-r-2 border-[#E0E0E0] bg-white">
            {loading && (
              <div className="p-8"><LoadingSkeleton lines={5} /></div>
            )}
            {error && !loading && (
              <div className="p-8"><ErrorState message={error} onRetry={load} /></div>
            )}
            {!loading && !error && nodes.length === 0 && (
              <div className="p-8">
                <EmptyState
                  icon="🕸️"
                  title="Graph is empty"
                  hint="Run Smart Upload on some material first — we merge concepts across all your uploads."
                />
              </div>
            )}
            {!loading && !error && nodes.length > 0 && (
              <div className="h-[min(70vh,560px)] w-full">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={onNodeClick}
                  fitView
                >
                  <Background />
                  <MiniMap />
                  <Controls />
                </ReactFlow>
              </div>
            )}
          </div>
          <aside className="w-full lg:w-80 flex-shrink-0 p-6 bg-[#FFFEEE] border-t-2 lg:border-t-0 border-[#E0E0E0]">
            <h3 className="font-display font-bold text-lg mb-2">Concept detail</h3>
            {!sel && <p className="text-sm text-[#555555]">Click a node to see linked document IDs and label.</p>}
            {sel && (
              <div className="space-y-3 text-sm">
                <p><span className="font-bold">Label:</span> {sel.data?.label}</p>
                {panelDocs.length > 0 && (
                  <div>
                    <p className="font-bold mb-1">From uploads</p>
                    <ul className="list-disc pl-5 text-[#555555]">{panelDocs.map((d) => <li key={d} className="break-all">{d}</li>)}</ul>
                  </div>
                )}
                {!panelDocs.length && <p className="text-[#555555]">Open RAG drill-down can be added per document in a future pass.</p>}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
