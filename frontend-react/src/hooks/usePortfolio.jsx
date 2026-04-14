import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

// Single-fetch context that loads the full pipeline payload once and shares
// it across pages. /api/all returns every slice the UI needs.
//
// Also tracks:
//   uploadedData — parsed user CSV (Dashboard upload)
//   optimized    — latest /api/optimize response (reactive to slider)
//   path         — latest investment path (from /api/path or client-side)
const PortfolioContext = createContext(null);

export function PortfolioProvider({ children }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const [uploadedData, setUploadedData] = useState(null);
  const [optimized,    setOptimized]    = useState(null);
  const [path,         setPath]         = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await api.all();
      setData(all);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load portfolio data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const value = {
    data, loading, error, refresh: load,
    uploadedData, setUploadedData,
    optimized,    setOptimized,
    path,         setPath,
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used inside PortfolioProvider');
  return ctx;
}
