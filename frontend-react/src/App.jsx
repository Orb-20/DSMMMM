import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import anime from 'animejs';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import PortfolioPage from './pages/Portfolio';
import Analysis from './pages/Analysis';
import Network from './pages/Network';
import { PortfolioProvider, usePortfolio } from './hooks/usePortfolio';

function PageTransition({ children }) {
  const location = useLocation();
  const ref = useRef(null);

  // Fade pages in on route change via anime.js
  useEffect(() => {
    if (!ref.current) return;
    anime({
      targets: ref.current,
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 450,
      easing: 'easeOutQuart',
    });
  }, [location.pathname]);

  return <div ref={ref}>{children}</div>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"          element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/portfolio" element={<PortfolioPage />} />
      <Route path="/analysis"  element={<Analysis />} />
      <Route path="/network"   element={<Network />} />
      <Route path="*"          element={<Home />} />
    </Routes>
  );
}

function Shell() {
  const { loading, error } = usePortfolio();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <div className="loading-text">Computing graph-theoretic portfolio…</div>
      </div>
    );
  }

  // On error we still render the UI — the user can upload a CSV on the Dashboard
  // and explore that data even without the backend running.
  return (
    <>
      {error && (
        <div style={{ padding: '0 40px', marginTop: 88 }}>
          <div className="error-banner">
            <strong>Backend unreachable.</strong> {error} — start the Flask server
            (<span className="mono">python backend/app.py</span>) or upload a CSV on the Dashboard
            to visualize your own data.
          </div>
        </div>
      )}
      <PageTransition>
        <AppRoutes />
      </PageTransition>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <PortfolioProvider>
        <div className="app-shell">
          <Navbar />
          <Shell />
          <footer className="footer">
            <strong>ORBE</strong> · Graph-Theoretic Portfolio Optimization · built with React + Three.js + Recharts
          </footer>
        </div>
      </PortfolioProvider>
    </BrowserRouter>
  );
}
