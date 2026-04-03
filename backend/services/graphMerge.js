import { readDB, writeDB } from '../middleware/db.js';

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function saveDocumentGraph(userId, documentId, mindMap) {
  const nodes = (mindMap?.nodes || []).map((n) => ({
    id: String(n.id),
    label: n.label || n.id,
  }));
  const edges = (mindMap?.edges || []).map((e) => ({
    source: String(e.source),
    target: String(e.target),
    label: e.label || '',
  }));
  const all = readDB('knowledge_graphs').filter((r) => !(r.userId === userId && r.documentId === documentId));
  all.push({
    userId,
    documentId,
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
  });
  writeDB('knowledge_graphs', all);
}

/** Merge all document graphs for a user into one react-flow graph */
export function getMergedGraphForUser(userId) {
  const graphs = readDB('knowledge_graphs').filter((g) => g.userId === userId);
  const labelKeyToFlowId = new Map();
  const nodes = [];
  let nid = 0;
  const edges = [];
  const seenEdge = new Set();

  function ensureNode(label) {
    const k = norm(label);
    if (!k) return null;
    if (!labelKeyToFlowId.has(k)) {
      const id = `n${nid++}`;
      labelKeyToFlowId.set(k, id);
      nodes.push({
        id,
        label: label.replace(/\s+/g, ' ').trim(),
        data: { label: label.replace(/\s+/g, ' ').trim() },
        documentIds: [],
      });
    }
    const id = labelKeyToFlowId.get(k);
    return { id, k };
  }

  for (const g of graphs) {
    const localToFlow = new Map();
    for (const n of g.nodes || []) {
      const label = n.label || n.id;
      const info = ensureNode(label);
      if (!info) continue;
      localToFlow.set(String(n.id), info.id);
      const node = nodes.find((x) => x.id === info.id);
      if (node && g.documentId && !node.documentIds.includes(g.documentId)) {
        node.documentIds.push(g.documentId);
      }
    }
    for (const e of g.edges || []) {
      const s = localToFlow.get(String(e.source));
      const t = localToFlow.get(String(e.target));
      if (!s || !t || s === t) continue;
      const ek = `${s}|${t}|${norm(e.label)}`;
      if (seenEdge.has(ek)) continue;
      seenEdge.add(ek);
      edges.push({
        id: `e${edges.length}`,
        source: s,
        target: t,
        label: e.label || 'relates',
      });
    }
  }

  return {
    nodes: nodes.map(({ id, data, documentIds }) => ({
      id,
      data,
      documentIds: documentIds || [],
    })),
    edges,
  };
}
