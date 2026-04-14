// Client-side graph algorithms for ORBE
//
//   nodes : [{ id, cluster, weight, annual_return, annual_vol }]
//   edges : [{ source, target, weight /* = correlation distance */ }]

// ─ Adjacency helpers ─────────────────────────────────────────────────────────
function buildAdjacency(edges, costFn) {
  const adj = new Map();
  for (const e of edges) {
    const c = costFn ? costFn(e) : e.weight;
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source).push({ to: e.target, cost: c, raw: e });
    adj.get(e.target).push({ to: e.source, cost: c, raw: e });
  }
  return adj;
}

// ─ Min-heap ──────────────────────────────────────────────────────────────────
class MinHeap {
  constructor() { this.h = []; }
  push(item) {
    this.h.push(item);
    let i = this.h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.h[p].cost <= this.h[i].cost) break;
      [this.h[p], this.h[i]] = [this.h[i], this.h[p]];
      i = p;
    }
  }
  pop() {
    if (!this.h.length) return null;
    const top = this.h[0];
    const last = this.h.pop();
    if (this.h.length) {
      this.h[0] = last;
      let i = 0, n = this.h.length;
      while (true) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let s = i;
        if (l < n && this.h[l].cost < this.h[s].cost) s = l;
        if (r < n && this.h[r].cost < this.h[s].cost) s = r;
        if (s === i) break;
        [this.h[s], this.h[i]] = [this.h[i], this.h[s]];
        i = s;
      }
    }
    return top;
  }
  get size() { return this.h.length; }
}

// ─ Dijkstra from single source to all nodes ─────────────────────────────────
function dijkstraAll(adj, source) {
  const dist = new Map();
  const prev = new Map();
  const heap = new MinHeap();
  dist.set(source, 0);
  heap.push({ node: source, cost: 0 });

  while (heap.size) {
    const { node, cost } = heap.pop();
    if (cost > (dist.get(node) ?? Infinity)) continue;
    for (const { to, cost: edgeCost } of (adj.get(node) || [])) {
      const nd = cost + edgeCost;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, node);
        heap.push({ node: to, cost: nd });
      }
    }
  }
  return { dist, prev };
}

function reconstructPath(prev, source, target) {
  const path = [];
  let cur = target;
  while (cur !== undefined && cur !== null) {
    path.unshift(cur);
    if (cur === source) break;
    cur = prev.get(cur);
  }
  if (path[0] !== source) return [];
  return path;
}

// ─ Kruskal MST ──────────────────────────────────────────────────────────────
function kruskalMST(nodes, edges) {
  const parent = new Map(nodes.map(n => [n.id, n.id]));
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra === rb) return false;
    parent.set(ra, rb);
    return true;
  };
  const sorted = [...edges].sort((a, b) => a.weight - b.weight);
  const mst = [];
  for (const e of sorted) {
    if (union(e.source, e.target)) mst.push(e);
    if (mst.length === nodes.length - 1) break;
  }
  return mst;
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODE 1 · SHOCK PROPAGATION (Dijkstra from one source)
// ══════════════════════════════════════════════════════════════════════════════
// User picks ONE source stock. We compute shortest correlation-distance to
// every other stock. Closer = higher transmitted impact. Impact is mapped from
// distance via exp(-d) so a direct neighbor gets ~near 100% transmission.
//
// Returns { source, impacts: [{id, distance, impact, ...node}], top10 }
export function computeShockPropagation({ nodes, edges, source }) {
  if (!nodes?.length || !edges?.length || !source) return null;
  if (!nodes.find(n => n.id === source)) return null;

  const adj = buildAdjacency(edges);
  const { dist } = dijkstraAll(adj, source);

  const impacts = nodes
    .filter(n => n.id !== source)
    .map(n => {
      const d = dist.get(n.id) ?? Infinity;
      // Transmission model: impact = e^(-k·d). Tuned so d≈0 → ~1, d≈2 → ~0.13
      const impact = Number.isFinite(d) ? Math.exp(-1.1 * d) : 0;
      return {
        ...n,
        distance: Number.isFinite(d) ? d : null,
        impact,
      };
    })
    .sort((a, b) => b.impact - a.impact);

  const top10 = impacts.slice(0, 10);

  // Path edges to top 10 for highlighting in 3D
  const { prev } = dijkstraAll(adj, source);
  const highlightedNodes = new Set([source, ...top10.map(n => n.id)]);
  const highlightedEdges = [];
  top10.forEach(t => {
    const p = reconstructPath(prev, source, t.id);
    for (let i = 0; i < p.length - 1; i++) {
      highlightedEdges.push({ source: p[i], target: p[i + 1] });
    }
  });

  return {
    mode: 'shock',
    source,
    impacts,
    top10,
    nodes: [{ id: source, ...nodes.find(n => n.id === source) }, ...top10],
    edges: highlightedEdges,
    highlightedNodes: [...highlightedNodes],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODE 2 · DIVERSIFIED BASKET (MST — low-risk, broad picks)
// ══════════════════════════════════════════════════════════════════════════════
// Build MST. Score each node by `diversification potential`:
//   - Prefer low correlation (far from others, large sum of MST distances)
//   - Prefer low volatility
//   - Spread across clusters (greedy cluster coverage)
//
// Returns an MST edge set + a ranked basket of diversified picks.
export function computeDiversifiedBasket({ nodes, edges, basketSize = 8 }) {
  if (!nodes?.length || !edges?.length) return null;

  const mst = kruskalMST(nodes, edges);
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  // Sum of MST edge weights incident to each node — isolation score.
  const isolation = new Map(nodes.map(n => [n.id, 0]));
  const degree = new Map(nodes.map(n => [n.id, 0]));
  mst.forEach(e => {
    isolation.set(e.source, (isolation.get(e.source) || 0) + e.weight);
    isolation.set(e.target, (isolation.get(e.target) || 0) + e.weight);
    degree.set(e.source, (degree.get(e.source) || 0) + 1);
    degree.set(e.target, (degree.get(e.target) || 0) + 1);
  });

  const maxIsolation = Math.max(...[...isolation.values()], 1e-6);
  const maxVol = Math.max(...nodes.map(n => n.annual_vol || 0), 1e-6);

  // Composite score favoring (a) high isolation, (b) low vol
  const scored = nodes.map(n => {
    const isoNorm = (isolation.get(n.id) || 0) / maxIsolation;
    const volNorm = (n.annual_vol || 0) / maxVol;
    const score = 0.7 * isoNorm + 0.3 * (1 - volNorm);
    return {
      ...n,
      isolation: isolation.get(n.id) || 0,
      mstDegree: degree.get(n.id) || 0,
      score,
    };
  }).sort((a, b) => b.score - a.score);

  // Greedy cluster coverage — pick best from each cluster first
  const seenClusters = new Set();
  const picks = [];
  for (const n of scored) {
    if (picks.length >= basketSize) break;
    if (!seenClusters.has(n.cluster)) {
      picks.push(n);
      seenClusters.add(n.cluster);
    }
  }
  // Fill remaining slots with next-best regardless of cluster
  for (const n of scored) {
    if (picks.length >= basketSize) break;
    if (!picks.find(p => p.id === n.id)) picks.push(n);
  }

  // Stats
  const avgVol = picks.reduce((s, n) => s + (n.annual_vol || 0), 0) / picks.length;
  const avgReturn = picks.reduce((s, n) => s + (n.annual_return || 0), 0) / picks.length;
  const clustersCovered = new Set(picks.map(p => p.cluster)).size;

  return {
    mode: 'mst',
    picks,
    mstEdges: mst,
    nodes: picks,
    edges: mst.filter(e =>
      picks.find(p => p.id === e.source) && picks.find(p => p.id === e.target),
    ).map(e => ({ source: e.source, target: e.target })),
    stats: { avgVol, avgReturn, clustersCovered, basketSize: picks.length },
    highlightedNodes: picks.map(p => p.id),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODE 3 · MAX-FLOW RETURN (best return path by risk tier)
// ══════════════════════════════════════════════════════════════════════════════
// Each tier solves a *different* optimization by rewriting edge costs:
//
//   low       : minimize  vol / μ  → Sharpe-like (penalize high-vol stocks hard)
//   moderate  : minimize  1/μ       → pure max-return
//   high      : minimize  1/(μ·σ)   → REWARD high volatility when μ is also high
//
// We then enumerate candidate (source, target) pairs across top-μ sources and
// all targets, pick the best single path per tier.
export function computeMaxReturnPath({ nodes, edges, riskTier = 'moderate' }) {
  if (!nodes?.length || !edges?.length) return null;

  const muByTicker = new Map(
    nodes.map(n => [n.id, Math.max(n.annual_return || 0, 0.001)]),
  );
  const volByTicker = new Map(
    nodes.map(n => [n.id, Math.max(n.annual_vol || 0, 0.001)]),
  );

  // ── Hard volatility partition ──────────────────────────────────────
  // Split ALL stocks by volatility into terciles, then each tier can only
  // use stocks from its slice. This guarantees fundamentally different paths.
  const vols = nodes.map(n => n.annual_vol || 0).sort((a, b) => a - b);
  const volLow  = vols[Math.floor(vols.length * 0.40)] || vols[0];
  const volHigh = vols[Math.floor(vols.length * 0.60)] || vols[vols.length - 1];

  let allowedSet;
  if (riskTier === 'low') {
    // Only stocks with vol in the bottom 40%
    allowedSet = new Set(
      nodes.filter(n => (n.annual_vol || 0) <= volLow).map(n => n.id),
    );
  } else if (riskTier === 'high') {
    // Only stocks with vol in the top 40%
    allowedSet = new Set(
      nodes.filter(n => (n.annual_vol || 0) >= volHigh).map(n => n.id),
    );
  } else {
    // Moderate — use the middle band
    allowedSet = new Set(
      nodes
        .filter(n => (n.annual_vol || 0) > volLow && (n.annual_vol || 0) < volHigh)
        .map(n => n.id),
    );
  }

  // Fallback if a tier's slice is empty (small universe)
  if (allowedSet.size < 2) {
    allowedSet = new Set(nodes.map(n => n.id));
  }

  // Max hops depends on tier — low-risk stays short, high-risk can concentrate
  const maxHops = riskTier === 'low' ? 3 : riskTier === 'moderate' ? 4 : 5;

  // ── Tier-specific edge cost ────────────────────────────────────────
  const costFn = (e) => {
    // Edges leaving the allowed set are forbidden (astronomical cost)
    if (!allowedSet.has(e.source) || !allowedSet.has(e.target)) return 1e9;
    const mu = (muByTicker.get(e.source) + muByTicker.get(e.target)) / 2;
    const vol = (volByTicker.get(e.source) + volByTicker.get(e.target)) / 2;
    const corrDist = e.weight || 1;

    if (riskTier === 'low') {
      // Low risk: maximize Sharpe-like quantity → minimize vol / μ, prefer
      // diversified (large corr distance) edges.
      return (vol / Math.max(mu, 1e-6)) * (1 + 0.5 * corrDist);
    }
    if (riskTier === 'high') {
      // High risk: pure max-return, vol is welcome. Cost ∝ 1/μ only.
      return 1 / Math.max(mu, 1e-6);
    }
    // Moderate: balanced — slight vol penalty
    return (1 + 0.3 * vol) / Math.max(mu, 1e-6);
  };

  const adj = buildAdjacency(edges, costFn);

  // ── Source selection per tier ──────────────────────────────────────
  let sources;
  if (riskTier === 'low') {
    // Best Sharpe candidates within the low-vol slice
    sources = [...nodes]
      .filter(n => allowedSet.has(n.id))
      .sort((a, b) => {
        const sa = (a.annual_return || 0) / Math.max(a.annual_vol || 0.001, 0.001);
        const sb = (b.annual_return || 0) / Math.max(b.annual_vol || 0.001, 0.001);
        return sb - sa;
      })
      .slice(0, Math.min(8, nodes.length));
  } else if (riskTier === 'high') {
    // Highest-μ stocks inside the high-vol slice
    sources = [...nodes]
      .filter(n => allowedSet.has(n.id))
      .sort((a, b) => (b.annual_return || 0) - (a.annual_return || 0))
      .slice(0, Math.min(8, nodes.length));
  } else {
    // Moderate — top μ in the middle band
    sources = [...nodes]
      .filter(n => allowedSet.has(n.id))
      .sort((a, b) => (b.annual_return || 0) - (a.annual_return || 0))
      .slice(0, Math.min(8, nodes.length));
  }

  if (!sources.length) return null;

  const candidates = [];
  for (const s of sources) {
    const { dist, prev } = dijkstraAll(adj, s.id);
    for (const t of nodes) {
      if (t.id === s.id) continue;
      if (!allowedSet.has(t.id)) continue;
      const d = dist.get(t.id);
      if (!Number.isFinite(d) || d > 1e8) continue; // blocked by guard cost
      const path = reconstructPath(prev, s.id, t.id);
      if (path.length < 2 || path.length > maxHops + 1) continue;
      // Reject paths that accidentally leave the allowed slice
      if (path.some(id => !allowedSet.has(id))) continue;

      const cumReturn = path.reduce((sum, id) => sum + (muByTicker.get(id) || 0), 0);
      const avgVol = path.reduce((sum, id) => sum + (volByTicker.get(id) || 0), 0) / path.length;
      const sharpe = cumReturn / Math.max(avgVol, 1e-6);
      candidates.push({
        path, cumReturn, avgVol, sharpe,
        source: s.id, target: t.id, pathCost: d,
      });
    }
  }

  if (!candidates.length) return null;

  // ── Tier-specific objective ────────────────────────────────────────
  let best;
  if (riskTier === 'low') {
    // Sharpe-maximizing (risk-adjusted return)
    candidates.sort((a, b) => b.sharpe - a.sharpe);
    best = candidates[0];
  } else if (riskTier === 'high') {
    // Maximum cumulative return — risk is accepted
    candidates.sort((a, b) => b.cumReturn - a.cumReturn);
    best = candidates[0];
  } else {
    // Moderate — balance: 0.7 × μ-rank + 0.3 × Sharpe-rank
    const muSorted = [...candidates].sort((a, b) => b.cumReturn - a.cumReturn);
    const shSorted = [...candidates].sort((a, b) => b.sharpe - a.sharpe);
    const muRank = new Map(muSorted.map((c, i) => [c, i]));
    const shRank = new Map(shSorted.map((c, i) => [c, i]));
    candidates.sort((a, b) => {
      const sa = 0.7 * muRank.get(a) + 0.3 * shRank.get(a);
      const sb = 0.7 * muRank.get(b) + 0.3 * shRank.get(b);
      return sa - sb;
    });
    best = candidates[0];
  }

  const nodesById = new Map(nodes.map(n => [n.id, n]));
  const pathNodes = best.path.map(id => nodesById.get(id)).filter(Boolean);
  const pathEdges = [];
  for (let i = 0; i < best.path.length - 1; i++) {
    pathEdges.push({ source: best.path[i], target: best.path[i + 1] });
  }

  return {
    mode: 'maxflow',
    riskTier,
    source: best.source,
    target: best.target,
    nodes: pathNodes,
    edges: pathEdges,
    cumReturn: best.cumReturn,
    avgVol: best.avgVol,
    sharpe: best.sharpe,
    hops: best.path.length - 1,
    totalCandidates: candidates.length,
    highlightedNodes: best.path,
  };
}

// ─ Legacy wrapper (kept for api/client.js compatibility) ────────────────────
export function computePath({ nodes, edges, source, target, algo = 'dijkstra' }) {
  if (algo === 'dijkstra') {
    const r = computeShockPropagation({ nodes, edges, source });
    return r;
  }
  if (algo === 'mst') {
    return computeDiversifiedBasket({ nodes, edges });
  }
  if (algo === 'maxflow') {
    return computeMaxReturnPath({ nodes, edges, riskTier: 'moderate' });
  }
  return null;
}
