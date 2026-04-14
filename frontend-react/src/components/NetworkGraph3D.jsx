import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { clusterColor, cssVar, hexToNumber } from '../utils/colors';

// 3D view of the correlation network. When a `path` is supplied (ordered
// ticker list), its edges are drawn as thick glowing lines on top of the
// faded base graph, and its nodes pulse. A force-directed relaxation
// step spreads the nodes so labels don't overlap.
export default function NetworkGraph3D({
  nodes = [],
  edges = [],
  path = null,
  height = 640,
}) {
  const mountRef = useRef(null);
  const [hover, setHover] = useState(null); // {x,y,node}

  // Normalize path — accept either backend-shape (ticker) or client-shape (id).
  const pathNodeIds = useMemo(() => {
    if (!path?.nodes) return new Set();
    return new Set(path.nodes.map(n => n.ticker ?? n.id));
  }, [path]);

  const pathOrder = useMemo(() => {
    if (!path?.nodes) return new Map();
    const m = new Map();
    path.nodes.forEach((n, i) => m.set(n.ticker ?? n.id, i));
    return m;
  }, [path]);

  const pathEdgeKeys = useMemo(() => {
    if (!path?.edges) return new Set();
    return new Set(path.edges.flatMap(e => [
      `${e.source}|${e.target}`,
      `${e.target}|${e.source}`,
    ]));
  }, [path]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !nodes.length) return;

    const getSize = () => ({ w: mount.clientWidth, h: height });
    let { w, h } = getSize();

    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(hexToNumber(cssVar('--cream-white')), 40, 90);

    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 1000);
    camera.position.set(0, 0, 34);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // Soft, luminous lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dir = new THREE.DirectionalLight(0xffffff, 0.55);
    dir.position.set(15, 20, 15);
    scene.add(dir);
    const rim = new THREE.DirectionalLight(hexToNumber(cssVar('--gold')), 0.25);
    rim.position.set(-12, -8, 8);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);

    const clusters = [...new Set(nodes.map(n => n.cluster))];
    const weightMax = Math.max(...nodes.map(n => n.weight || 0.001), 1e-6);

    // ── Layout: start from provided x/y, spread by cluster, then relax ──
    const SPREAD = 16; // larger spread → more readable
    const pos = new Map();
    nodes.forEach((n) => {
      const cIdx = clusters.indexOf(n.cluster);
      // Stack clusters along Z with gentle jitter so each cluster sits on its
      // own "plate" in 3D, aiding depth perception.
      const zOff = (cIdx - (clusters.length - 1) / 2) * 3.2
                 + (Math.sin(n.x * 7 + n.y * 11) * 0.6);
      pos.set(n.id, new THREE.Vector3(n.x * SPREAD, n.y * SPREAD, zOff));
    });

    // Force-directed relaxation — pushes overlapping nodes apart
    const adjacency = new Map();
    nodes.forEach(n => adjacency.set(n.id, []));
    edges.forEach(e => {
      if (adjacency.has(e.source) && adjacency.has(e.target)) {
        adjacency.get(e.source).push(e.target);
        adjacency.get(e.target).push(e.source);
      }
    });
    for (let iter = 0; iter < 90; iter++) {
      const force = new Map();
      nodes.forEach(n => force.set(n.id, new THREE.Vector3()));
      // Repulsion (all pairs)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = pos.get(nodes[i].id);
          const b = pos.get(nodes[j].id);
          const d = new THREE.Vector3().subVectors(a, b);
          const dist = Math.max(d.length(), 0.1);
          const f = 2.2 / (dist * dist);
          d.normalize().multiplyScalar(f);
          force.get(nodes[i].id).add(d);
          force.get(nodes[j].id).sub(d);
        }
      }
      // Attraction along edges
      edges.forEach(e => {
        const a = pos.get(e.source);
        const b = pos.get(e.target);
        if (!a || !b) return;
        const d = new THREE.Vector3().subVectors(b, a);
        const dist = Math.max(d.length(), 0.1);
        const f = dist * 0.012;
        d.normalize().multiplyScalar(f);
        force.get(e.source).add(d);
        force.get(e.target).sub(d);
      });
      // Center gravity
      nodes.forEach(n => {
        const p = pos.get(n.id);
        force.get(n.id).add(p.clone().multiplyScalar(-0.008));
      });
      // Apply
      const step = iter < 30 ? 0.8 : 0.35;
      nodes.forEach(n => {
        const p = pos.get(n.id);
        const f = force.get(n.id).clampLength(0, 1.5);
        p.add(f.multiplyScalar(step));
      });
    }

    // ── Base edges (dimmed when a path is highlighted) ──────────────────
    const hasPath = pathEdgeKeys.size > 0;
    const nodeClusterMap = new Map(nodes.map(n => [n.id, n.cluster]));
    edges.forEach(e => {
      const a = pos.get(e.source);
      const b = pos.get(e.target);
      if (!a || !b) return;
      const key = `${e.source}|${e.target}`;
      if (pathEdgeKeys.has(key)) return;
      // Color edges by intra/inter-cluster: intra = cluster color, inter = neutral
      const ca = nodeClusterMap.get(e.source);
      const cb = nodeClusterMap.get(e.target);
      const sameCluster = ca === cb;
      const edgeCol = sameCluster
        ? new THREE.Color(clusterColor(ca))
        : new THREE.Color(cssVar('--beige-dark'));
      const weight = e.weight ?? e.value ?? 1;
      const opacity = hasPath
        ? 0.08
        : sameCluster ? 0.45 : 0.18;
      const mat = new THREE.LineBasicMaterial({
        color: edgeCol,
        transparent: true,
        opacity,
      });
      const g = new THREE.BufferGeometry().setFromPoints([a, b]);
      group.add(new THREE.Line(g, mat));
    });

    // ── Highlighted path edges (thick tubes with glow) ──────────────────
    const pathEdges = [];
    if (hasPath && path?.edges) {
      const goldColor = new THREE.Color(cssVar('--gold'));
      path.edges.forEach((e, idx) => {
        const a = pos.get(e.source);
        const b = pos.get(e.target);
        if (!a || !b) return;
        const curve = new THREE.LineCurve3(a, b);
        const tubeGeo = new THREE.TubeGeometry(curve, 1, 0.09, 12, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: goldColor,
          transparent: true,
          opacity: 0.95,
        });
        const tube = new THREE.Mesh(tubeGeo, tubeMat);
        tube.userData.pathIndex = idx;
        group.add(tube);
        pathEdges.push(tube);

        const glowGeo = new THREE.TubeGeometry(curve, 1, 0.22, 12, false);
        const glowMat = new THREE.MeshBasicMaterial({
          color: goldColor,
          transparent: true,
          opacity: 0.3,
        });
        group.add(new THREE.Mesh(glowGeo, glowMat));
      });
    }

    // ── Nodes ───────────────────────────────────────────────────────────
    const nodeMeshes = [];
    nodes.forEach(n => {
      const p = pos.get(n.id);
      const inPath = pathNodeIds.has(n.id);
      const baseRadius = 0.32 + 1.45 * Math.sqrt((n.weight || 0) / weightMax);
      const radius = inPath ? baseRadius * 1.3 : baseRadius;

      const geo = new THREE.SphereGeometry(radius, 28, 28);
      const color = new THREE.Color(clusterColor(n.cluster));
      const mat = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.3,
        roughness: 0.45,
        emissive: color,
        emissiveIntensity: inPath ? 0.5 : 0.12,
        transparent: true,
        opacity: hasPath && !inPath ? 0.38 : 1.0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(p);
      mesh.userData = { ...n, inPath, baseRadius };
      group.add(mesh);
      nodeMeshes.push(mesh);

      // Halo for path nodes — source is green, target is red, middle is gold
      if (inPath) {
        const order = pathOrder.get(n.id);
        const isSource = order === 0;
        const isTarget = order === path.nodes.length - 1;
        const haloColor = isSource
          ? new THREE.Color(cssVar('--green-deep'))
          : isTarget
            ? new THREE.Color(cssVar('--red-muted'))
            : new THREE.Color(cssVar('--gold'));
        const haloGeo = new THREE.SphereGeometry(radius * 1.55, 28, 28);
        const haloMat = new THREE.MeshBasicMaterial({
          color: haloColor,
          transparent: true,
          opacity: 0.22,
          side: THREE.BackSide,
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.position.copy(p);
        halo.userData.isHalo = true;
        group.add(halo);
      }
    });

    // ── Labels with background chip for readability ────────────────────
    const labelCanvas = (text, textColor, bgColor, bold) => {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      c.width = 300; c.height = 84;
      // Rounded chip background
      const r = 18;
      const x = 40, y = 18, bw = 220, bh = 48;
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + bw, y, x + bw, y + bh, r);
      ctx.arcTo(x + bw, y + bh, x, y + bh, r);
      ctx.arcTo(x, y + bh, x, y, r);
      ctx.arcTo(x, y, x + bw, y, r);
      ctx.closePath();
      ctx.fill();
      // Text
      ctx.font = `${bold ? 700 : 600} 30px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = textColor;
      ctx.fillText(text, 150, 44);
      return new THREE.CanvasTexture(c);
    };

    nodes.forEach(n => {
      const p = pos.get(n.id);
      const inPath = pathNodeIds.has(n.id);
      const baseRadius = 0.32 + 1.45 * Math.sqrt((n.weight || 0) / weightMax);
      const bg = inPath
        ? `rgba(250, 244, 230, 0.95)`
        : `rgba(250, 244, 230, 0.75)`;
      const txt = inPath ? cssVar('--green-deep') : cssVar('--brown-dark');
      const tex = labelCanvas(n.id, txt, bg, inPath);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const s = new THREE.Sprite(mat);
      const scale = inPath ? 2.4 : 2.0;
      s.scale.set(scale, scale * 0.28, 1);
      s.position.copy(p).add(new THREE.Vector3(0, baseRadius + 0.9, 0));
      s.renderOrder = 10;
      group.add(s);
    });

    // ── Numbered sequence badges for path order ────────────────────────
    if (hasPath && path?.nodes) {
      path.nodes.forEach((pn, i) => {
        const id = pn.ticker ?? pn.id;
        const p = pos.get(id);
        if (!p) return;
        const c = document.createElement('canvas');
        c.width = 80; c.height = 80;
        const ctx = c.getContext('2d');
        // Drop shadow
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(40, 40, 32, 0, Math.PI * 2);
        ctx.fillStyle = cssVar('--gold');
        ctx.fill();
        ctx.shadowColor = 'transparent';
        // Inner ring
        ctx.beginPath();
        ctx.arc(40, 40, 28, 0, Math.PI * 2);
        ctx.strokeStyle = cssVar('--cream-white');
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = '700 36px "DM Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = cssVar('--cream-white');
        ctx.fillText(String(i + 1), 40, 43);
        const tex = new THREE.CanvasTexture(c);
        const m = new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        });
        const s = new THREE.Sprite(m);
        s.scale.set(1.1, 1.1, 1);
        s.position.copy(p).add(new THREE.Vector3(1.6, 1.4, 0));
        s.renderOrder = 20;
        group.add(s);
      });
    }

    // ── Interaction (rotate, zoom, hover tooltip) ─────────────────────
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const state = { dragging: false, lastX: 0, lastY: 0, rotX: -0.2, rotY: 0 };
    const onDown = (e) => {
      state.dragging = true;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      renderer.domElement.style.cursor = 'grabbing';
    };
    const onUp = () => {
      state.dragging = false;
      renderer.domElement.style.cursor = 'grab';
    };
    const onMove = (e) => {
      if (state.dragging) {
        state.rotY += (e.clientX - state.lastX) * 0.005;
        state.rotX += (e.clientY - state.lastY) * 0.005;
        state.rotX = Math.max(-1.3, Math.min(1.3, state.rotX));
        state.lastX = e.clientX;
        state.lastY = e.clientY;
        setHover(null);
        return;
      }
      // Hover detection
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(nodeMeshes);
      if (hits.length) {
        const n = hits[0].object.userData;
        setHover({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          node: n,
        });
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHover(null);
        renderer.domElement.style.cursor = 'grab';
      }
    };
    const onLeave = () => setHover(null);
    const onWheel = (e) => {
      e.preventDefault();
      camera.position.z = Math.max(14, Math.min(70, camera.position.z + e.deltaY * 0.025));
    };
    renderer.domElement.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    renderer.domElement.addEventListener('mouseleave', onLeave);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.style.cursor = 'grab';

    let raf = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const t = clock.getElapsedTime();
      const autoY = state.dragging ? state.rotY : state.rotY + 0.0004;
      state.rotY = autoY;
      group.rotation.y = autoY;
      group.rotation.x = state.rotX;

      // Pulsing glow on highlighted edges
      const pulse = 0.78 + 0.22 * Math.sin(t * 2.8);
      pathEdges.forEach(tube => { tube.material.opacity = pulse; });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const sz = getSize();
      w = sz.w; h = sz.h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
      renderer.domElement.removeEventListener('mousedown', onDown);
      renderer.domElement.removeEventListener('mouseleave', onLeave);
      renderer.domElement.removeEventListener('wheel', onWheel);
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, [nodes, edges, height, path, pathNodeIds, pathEdgeKeys, pathOrder]);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'relative',
        width: '100%',
        height,
        background: 'linear-gradient(160deg, var(--cream-white) 0%, var(--beige-light) 100%)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(180,170,150,0.22)',
        overflow: 'hidden',
      }}
    >
      {hover && (
        <div
          style={{
            position: 'absolute',
            left: hover.x + 14,
            top: hover.y + 14,
            background: 'rgba(40, 30, 20, 0.92)',
            color: 'var(--cream-white)',
            padding: '10px 14px',
            borderRadius: 10,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13,
            pointerEvents: 'none',
            zIndex: 5,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            minWidth: 160,
          }}
        >
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700,
            fontSize: 15,
            color: clusterColor(hover.node.cluster),
            marginBottom: 4,
          }}>
            {hover.node.id}
          </div>
          <div style={{ opacity: 0.85 }}>
            Cluster {hover.node.cluster}
          </div>
          <div style={{ opacity: 0.85 }}>
            Weight: {((hover.node.weight || 0) * 100).toFixed(2)}%
          </div>
          {hover.node.inPath && (
            <div style={{
              color: 'var(--gold)',
              marginTop: 4,
              fontWeight: 600,
            }}>
              ★ On investment path
            </div>
          )}
        </div>
      )}
      {/* Legend overlay */}
      <div
        style={{
          position: 'absolute',
          left: 16,
          bottom: 16,
          background: 'rgba(250, 244, 230, 0.9)',
          padding: '10px 14px',
          borderRadius: 10,
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 12,
          color: 'var(--brown-dark)',
          border: '1px solid rgba(180,170,150,0.25)',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Graph Legend</div>
        <div>● Node size = portfolio weight</div>
        <div>● Node color = cluster</div>
        <div>── Edge = correlation link</div>
        {pathNodeIds.size > 0 && (
          <div style={{ color: 'var(--gold)', fontWeight: 600, marginTop: 2 }}>
            ━ Gold = investment path
          </div>
        )}
      </div>
    </div>
  );
}
