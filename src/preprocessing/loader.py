"""Load raw price data from yfinance or CSV."""

import pandas as pd
import numpy as np
import os
import warnings


def load_prices(tickers: list[str], start: str, end: str, data_dir: str = None) -> pd.DataFrame:
    """Load adjusted close prices, aligned on date index.
    
    Tries yfinance first; falls back to CSV files in data_dir/raw/.
    """
    if data_dir and os.path.exists(os.path.join(data_dir, "raw")):
        return _load_from_csv(tickers, start, end, os.path.join(data_dir, "raw"))
    
    return _load_from_yfinance(tickers, start, end)


def _load_from_yfinance(tickers: list[str], start: str, end: str) -> pd.DataFrame:
    import yfinance as yf
    
    data = yf.download(tickers, start=start, end=end, auto_adjust=True, progress=False)
    
    if isinstance(data.columns, pd.MultiIndex):
        prices = data["Close"]
    else:
        prices = data[["Close"]]
        prices.columns = tickers
    
    prices = prices[tickers]  # ensure column order
    return prices


def _load_from_csv(tickers: list[str], start: str, end: str, raw_dir: str) -> pd.DataFrame:
    frames = {}
    for ticker in tickers:
        path = os.path.join(raw_dir, f"{ticker}.csv")
        if os.path.exists(path):
            df = pd.read_csv(path, index_col=0, parse_dates=True)
            col = "Adj Close" if "Adj Close" in df.columns else "Close"
            frames[ticker] = df[col]
        else:
            warnings.warn(f"CSV not found for {ticker}, skipping.")
    
    prices = pd.DataFrame(frames)
    prices = prices.loc[start:end]
    return prices
