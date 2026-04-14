import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cssVar, CLUSTER_COLORS, hexToNumber } from '../utils/colors';

// Rotating wireframe icosahedron with scattered point cloud — mirrors the
// look of the existing HTML hero but rebuilt as a self-contained component.
export default function HeroGlobe({ className = '' }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const getSize = () => ({
      w: mount.clientWidth,
      h: mount.clientHeight || 560,
    });
    let { w, h } = getSize();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Wireframe sphere
    const sphereGeo = new THREE.IcosahedronGeometry(1.8, 2);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: hexToNumber(cssVar('--green-sage')),
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(sphere);

    // Scatter data points
    const N = 220;
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const palette = CLUSTER_COLORS.slice(0, 5).map(h => new THREE.Color(h));
    for (let i = 0; i < N; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 1.8 + (Math.random() - 0.5) * 0.3;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3]     = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pointsGeo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    const pointsMat = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(pointsGeo, pointsMat);
    scene.add(points);

    // Edge lines (random subset of points, like a knowledge graph)
    const lineGeo = new THREE.BufferGeometry();
    const linePositions = [];
    for (let i = 0; i < 40; i++) {
      const a = Math.floor(Math.random() * N);
      const b = Math.floor(Math.random() * N);
      linePositions.push(
        positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2],
        positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2],
      );
    }
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: hexToNumber(cssVar('--green-sage')),
      transparent: true,
      opacity: 0.2,
    });
    scene.add(new THREE.LineSegments(lineGeo, lineMat));

    // Gentle ambient + directional to light the sphere
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    let raf = 0;
    const clock = new THREE.Clock();
    const group = new THREE.Group();
    scene.add(group);
    group.add(sphere, points);
    scene.children
      .filter(c => c instanceof THREE.LineSegments)
      .forEach(c => group.add(c));

    const animate = () => {
      const t = clock.getElapsedTime();
      group.rotation.y = t * 0.15;
      group.rotation.x = Math.sin(t * 0.3) * 0.08;
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
      sphereGeo.dispose(); sphereMat.dispose();
      pointsGeo.dispose(); pointsMat.dispose();
      lineGeo.dispose();   lineMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return <div className={`hero-globe ${className}`} ref={mountRef} />;
}
