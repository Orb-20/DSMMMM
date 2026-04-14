import { useRef, useState } from 'react';
import anime from 'animejs';
import { parseCsv } from '../utils/csvToPortfolio';
import { usePortfolio } from '../hooks/usePortfolio';
import './CsvUpload.css';

// Drop-zone + button combo. Parses the CSV client-side and stores the result
// in the portfolio context so every page can react to it.
export default function CsvUpload() {
  const inputRef = useRef(null);
  const dropRef = useRef(null);
  const [status, setStatus] = useState(null); // { kind, message }
  const { setUploadedData, uploadedData } = usePortfolio();

  const handleFile = async (file) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setStatus({ kind: 'error', message: 'Please upload a .csv file.' });
      return;
    }
    setStatus({ kind: 'loading', message: `Parsing ${file.name}…` });
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.kind === 'unknown') {
        setStatus({ kind: 'error', message: parsed.error || 'Unrecognized CSV layout.' });
        return;
      }
      setUploadedData({ ...parsed, fileName: file.name, rows: (parsed.weights || parsed.priceHistory || []).length });
      setStatus({
        kind: 'ok',
        message: `Loaded ${file.name} (${parsed.kind === 'prices' ? `${parsed.tickers.length} tickers · ${parsed.priceHistory.length} rows` : `${parsed.weights.length} holdings`})`,
      });
      // celebratory pulse
      anime({
        targets: dropRef.current,
        scale: [{ value: 1.02, duration: 200 }, { value: 1, duration: 300 }],
        easing: 'easeOutCubic',
      });
    } catch (err) {
      setStatus({ kind: 'error', message: err.message || 'Failed to read file.' });
    }
  };

  const onChange = (e) => handleFile(e.target.files?.[0]);
  const onDrop = (e) => {
    e.preventDefault();
    dropRef.current?.classList.remove('drag-over');
    handleFile(e.dataTransfer.files?.[0]);
  };
  const onDragOver = (e) => {
    e.preventDefault();
    dropRef.current?.classList.add('drag-over');
  };
  const onDragLeave = () => dropRef.current?.classList.remove('drag-over');

  const clear = () => {
    setUploadedData(null);
    setStatus(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      ref={dropRef}
      className="csv-upload"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={onChange}
        hidden
      />
      <div className="csv-upload-body">
        <div className="csv-upload-icon" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7-7 7 7" />
          </svg>
        </div>
        <div className="csv-upload-text">
          <div className="csv-upload-title">Upload a CSV of stocks</div>
          <div className="csv-upload-sub">
            Drag &amp; drop or click to browse. We accept <span className="mono">date,TICKER1,TICKER2,…</span> price histories or <span className="mono">ticker,weight</span> tables.
          </div>
        </div>
        <div className="csv-upload-actions">
          <button className="csv-btn primary" onClick={() => inputRef.current?.click()}>
            Choose file
          </button>
          {uploadedData && (
            <button className="csv-btn ghost" onClick={clear}>
              Clear
            </button>
          )}
        </div>
      </div>

      {status && (
        <div className={`csv-status csv-status-${status.kind}`}>
          {status.message}
        </div>
      )}
    </div>
  );
}
