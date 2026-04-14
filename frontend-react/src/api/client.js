// Thin API client — hits the Flask backend (proxied in dev, same-origin in prod).
// Endpoints mirror backend/app.py.

const BASE = '/api';

async function get(path) {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

export const api = {
  overview:         () => get('overview'),
  weights:          () => get('weights'),
  correlation:      () => get('correlation'),
  frontier:         () => get('frontier'),
  graph:            () => get('graph'),
  portfolioHistory: () => get('portfolio-history'),
  all:              () => get('all'),

  // Dynamic optimization (lambda-parameterized Markowitz).
  optimize: (params) => post('optimize', {
    risk_aversion: params.riskAversion ?? 1.0,
    max_weight:    params.maxWeight   ?? null,
    allow_short:   !!params.allowShort,
    target_return: params.targetReturn ?? null,
  }),

  // Investment path across the graph.
  path: ({ algo = 'dijkstra', source, target }) => {
    const qs = new URLSearchParams();
    qs.set('algo', algo);
    if (source) qs.set('source', source);
    if (target) qs.set('target', target);
    return get(`path?${qs.toString()}`);
  },
};
