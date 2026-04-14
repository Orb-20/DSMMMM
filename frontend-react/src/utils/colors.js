// Centralized color utilities — sourced from CSS custom properties so the
// JS-driven visualisations (Three.js, Recharts) stay in sync with the palette.

const FALLBACK = {
  '--green-deep':   '#1a3a1a',
  '--green-forest': '#2d5016',
  '--green-mid':    '#3d6b24',
  '--green-sage':   '#6b8f4e',
  '--green-light':  '#8ba872',
  '--green-pale':   '#c8dbb0',
  '--beige-dark':   '#b8a88c',
  '--beige':        '#d4c5a9',
  '--beige-light':  '#e8dcc8',
  '--cream':        '#f5f0e8',
  '--cream-light':  '#faf7f0',
  '--cream-white':  '#fffcf5',
  '--brown-dark':   '#2c2c1e',
  '--gold':         '#b8a04e',
  '--gold-light':   '#d4c070',
  '--red-muted':    '#a85a4a',
  '--blue-muted':   '#4a6a8a',
};

export function cssVar(name) {
  if (typeof window === 'undefined') return FALLBACK[name] || '#000';
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || FALLBACK[name] || '#000';
}

// Cluster palette — matches the html version.
export const CLUSTER_COLORS = [
  '#6b8f4e', '#b8a04e', '#a85a4a', '#4a6a8a',
  '#8b6b4e', '#5a7a6a', '#7a6b8f', '#8fa86b',
  '#6a8b9a', '#9a7a5a',
];

export const CLUSTER_BG = [
  'rgba(107,143,78,0.12)',  'rgba(184,160,78,0.12)',
  'rgba(168,90,74,0.12)',   'rgba(74,106,138,0.12)',
  'rgba(139,107,78,0.12)',  'rgba(90,122,106,0.12)',
  'rgba(122,107,143,0.12)', 'rgba(143,168,107,0.12)',
  'rgba(106,139,154,0.12)', 'rgba(154,122,90,0.12)',
];

export const clusterColor = (i = 0) => CLUSTER_COLORS[i % CLUSTER_COLORS.length];
export const clusterBg    = (i = 0) => CLUSTER_BG[i % CLUSTER_BG.length];

// Convert "#rrggbb" → THREE-friendly 0xrrggbb number.
export function hexToNumber(hex) {
  return parseInt(hex.replace('#', ''), 16);
}
