import NetworkGraph3D from '../components/NetworkGraph3D';
import PathExplorer from '../components/PathExplorer';
import { usePortfolio } from '../hooks/usePortfolio';
import { clusterColor } from '../utils/colors';

export default function Network() {
  const { data, path } = usePortfolio();
  const nodes = data?.graph_nodes || [];
  const edges = data?.graph_edges || [];
  const clusters = [...new Set(nodes.map(n => n.cluster))].sort((a, b) => a - b);

  return (
    <div className="page">
      <div className="section-header">
        <h2>Correlation Network</h2>
        <p>
          The market modeled as a network — each stock is a node, price-correlation defines weighted edges.
          Drag to rotate, scroll to zoom, hover for details.
        </p>
      </div>

      <div className="card" style={{
        padding: '18px 22px',
        marginBottom: 24,
        background: 'linear-gradient(135deg, rgba(107,143,78,0.06) 0%, rgba(212,165,116,0.04) 100%)',
        borderLeft: '3px solid var(--green-sage)',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--green-deep)',
          marginBottom: 8,
        }}>
          Why graph theory for stock selection?
        </div>
        <div style={{
          fontSize: 13.5,
          lineHeight: 1.65,
          color: 'var(--brown-dark)',
        }}>
          <strong>MST</strong> simplifies the network by keeping only essential connections —
          helping you pick representatives from different branches for diversification without redundancy.
          <strong style={{ marginLeft: 4 }}>Dijkstra</strong> traces how price shocks propagate between stocks,
          surfacing leading indicators that move first.
          <strong style={{ marginLeft: 4 }}>Max-Flow / Min-Cut</strong> reveals dominant sectors and natural
          partitions by modeling capital strength flowing between groups. Together they don't directly pick
          stocks — they expose the structural and relational framework behind better portfolio construction,
          risk management, and timing.
        </div>
      </div>

      <PathExplorer />

      <div className="card" style={{ padding: 16, marginBottom: 24 }}>
        <NetworkGraph3D nodes={nodes} edges={edges} path={path} height={620} />
      </div>

      <div className="card">
        <div className="card-title">Cluster legend</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {clusters.map(c => (
            <div
              key={c}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 20,
                background: clusterColor(c) + '18',
                color: clusterColor(c),
                fontFamily: 'DM Sans',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: clusterColor(c),
                }}
              />
              Cluster {c} · {nodes.filter(n => n.cluster === c).length} assets
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
