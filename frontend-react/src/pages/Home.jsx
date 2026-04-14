import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import anime from 'animejs';
import HeroGlobe from '../components/HeroGlobe';
import AnimatedNumber from '../components/AnimatedNumber';
import { usePortfolio } from '../hooks/usePortfolio';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const { data } = usePortfolio();
  const metrics = data?.metrics;
  const config  = data?.config;
  const heroRef = useRef(null);

  useEffect(() => {
    anime.timeline({ easing: 'easeOutQuart' })
      .add({ targets: '.hero-eyebrow', opacity: [0, 1], translateY: [12, 0], duration: 500 })
      .add({ targets: '.hero-title',   opacity: [0, 1], translateY: [24, 0], duration: 700 }, '-=300')
      .add({ targets: '.hero-sub',     opacity: [0, 1], translateY: [16, 0], duration: 600 }, '-=400')
      .add({ targets: '.hero-cta',     opacity: [0, 1], translateY: [10, 0], duration: 500 }, '-=300')
      .add({ targets: '.stat-card',    opacity: [0, 1], translateY: [20, 0], delay: anime.stagger(80), duration: 500 }, '-=200');
  }, []);

  return (
    <div ref={heroRef}>
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-content">
          <div className="hero-text">
            <div className="hero-eyebrow">Graph-Theoretic Portfolio Optimization</div>
            <h1 className="hero-title">
              Portfolios, <em>structured</em><br />by the graph.
            </h1>
            <p className="hero-sub">
              ORBE applies network-theoretic clustering to the correlation structure of global
              equities, then solves a convex Markowitz program per cluster to find the efficient
              mix — visualized in real time.
            </p>
            <button className="hero-cta" onClick={() => navigate('/dashboard')}>
              Explore the dashboard
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="hero-3d">
            <HeroGlobe />
          </div>
        </div>
      </section>

      <div className="stats-strip">
        <div className="stat-card">
          <div className="stat-value">
            {metrics ? <AnimatedNumber value={metrics.sharpe_ratio} format="num" decimals={2} /> : '—'}
          </div>
          <div className="stat-label">Sharpe Ratio</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {metrics ? <AnimatedNumber value={metrics.annual_return} format="pct" decimals={2} /> : '—'}
          </div>
          <div className="stat-label">Annual Return</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {metrics ? <AnimatedNumber value={metrics.annual_volatility} format="pct" decimals={2} /> : '—'}
          </div>
          <div className="stat-label">Volatility</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {config ? <AnimatedNumber value={config.n_assets} format="int" /> : '—'}
          </div>
          <div className="stat-label">Assets</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {metrics ? <AnimatedNumber value={metrics.n_clusters} format="int" /> : '—'}
          </div>
          <div className="stat-label">Clusters</div>
        </div>
      </div>
    </div>
  );
}
