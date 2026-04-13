"""Generate realistic synthetic OHLCV data for 20 tickers.

Each sector has correlated returns, sector-appropriate volatility,
and realistic price levels. Output: one CSV per ticker in data/raw/.
"""

import numpy as np
import pandas as pd
import os

np.random.seed(42)

# Trading days from 2019-01-02 to 2023-12-29
dates = pd.bdate_range("2019-01-02", "2023-12-29")
T = len(dates)

# Sector definitions: (tickers, start_prices, annual_drift, annual_vol)
sectors = {
    "tech": {
        "tickers": ["AAPL", "MSFT", "GOOGL", "AMZN", "META"],
        "start_prices": [157.0, 101.0, 1045.0, 1540.0, 135.0],
        "drift": 0.22,
        "vol": 0.30,
        "intra_corr": 0.55,
    },
    "finance": {
        "tickers": ["JPM", "GS", "BAC", "WFC", "C"],
        "start_prices": [100.0, 196.0, 25.0, 46.0, 58.0],
        "drift": 0.08,
        "vol": 0.25,
        "intra_corr": 0.60,
    },
    "energy": {
        "tickers": ["XOM", "CVX", "COP", "SLB", "EOG"],
        "start_prices": [68.0, 108.0, 55.0, 37.0, 89.0],
        "drift": 0.06,
        "vol": 0.32,
        "intra_corr": 0.65,
    },
    "health": {
        "tickers": ["JNJ", "PFE", "MRK", "ABT", "UNH"],
        "start_prices": [129.0, 43.0, 76.0, 72.0, 249.0],
        "drift": 0.12,
        "vol": 0.20,
        "intra_corr": 0.40,
    },
}

# Cross-sector correlation
cross_sector_corr = 0.20

# Generate sector factors + idiosyncratic noise
all_tickers = []
all_prices = {}

# Global market factor
market_factor = np.random.randn(T)

sector_factors = {}
for sname in sectors:
    sector_factors[sname] = np.random.randn(T)

for sname, sinfo in sectors.items():
    n = len(sinfo["tickers"])
    daily_drift = sinfo["drift"] / 252
    daily_vol = sinfo["vol"] / np.sqrt(252)
    
    for i, ticker in enumerate(sinfo["tickers"]):
        # Combine market, sector, and idiosyncratic components
        idio = np.random.randn(T)
        
        w_market = np.sqrt(cross_sector_corr)
        w_sector = np.sqrt(sinfo["intra_corr"] - cross_sector_corr)
        w_idio = np.sqrt(1.0 - sinfo["intra_corr"])
        
        combined = w_market * market_factor + w_sector * sector_factors[sname] + w_idio * idio
        
        # Add a slight individual drift variation
        ticker_drift = daily_drift + np.random.uniform(-0.02, 0.02) / 252
        
        # Daily log returns
        log_returns = ticker_drift + daily_vol * combined
        
        # Inject COVID crash (Mar 2020) and recovery
        covid_start = np.searchsorted(dates, pd.Timestamp("2020-02-20"))
        covid_bottom = np.searchsorted(dates, pd.Timestamp("2020-03-23"))
        covid_recovery = np.searchsorted(dates, pd.Timestamp("2020-06-01"))
        
        crash_severity = np.random.uniform(0.8, 1.2)
        if covid_start < T and covid_bottom < T:
            crash_days = covid_bottom - covid_start
            if crash_days > 0:
                log_returns[covid_start:covid_bottom] -= crash_severity * 0.015
        if covid_bottom < T and covid_recovery < T:
            recovery_days = covid_recovery - covid_bottom
            if recovery_days > 0:
                log_returns[covid_bottom:covid_recovery] += crash_severity * 0.008
        
        # 2022 rate hike drawdown for tech
        if sname == "tech":
            hike_start = np.searchsorted(dates, pd.Timestamp("2022-01-01"))
            hike_end = np.searchsorted(dates, pd.Timestamp("2022-10-01"))
            if hike_start < T and hike_end < T:
                log_returns[hike_start:hike_end] -= 0.002
        
        # Energy boom 2021-2022
        if sname == "energy":
            boom_start = np.searchsorted(dates, pd.Timestamp("2021-06-01"))
            boom_end = np.searchsorted(dates, pd.Timestamp("2022-06-01"))
            if boom_start < T and boom_end < T:
                log_returns[boom_start:boom_end] += 0.002
        
        # Build price series from log returns
        log_price = np.log(sinfo["start_prices"][i]) + np.cumsum(log_returns)
        close = np.exp(log_price)
        
        # Generate OHLCV from close
        daily_range = daily_vol * close * np.random.uniform(0.5, 1.5, T)
        high = close + np.abs(np.random.randn(T)) * daily_range * 0.6
        low = close - np.abs(np.random.randn(T)) * daily_range * 0.6
        low = np.maximum(low, close * 0.90)  # prevent crazy lows
        
        # Open is close of previous day + small gap
        open_price = np.roll(close, 1) * (1 + np.random.randn(T) * 0.002)
        open_price[0] = sinfo["start_prices"][i]
        
        # Ensure OHLC consistency
        high = np.maximum(high, np.maximum(open_price, close))
        low = np.minimum(low, np.minimum(open_price, close))
        
        # Volume: base volume with some randomness and trend
        base_vol = np.random.uniform(5e6, 80e6)
        volume = (base_vol * np.exp(np.random.randn(T) * 0.4)).astype(int)
        # Higher volume during crash
        if covid_start < T and covid_recovery < T:
            volume[covid_start:covid_recovery] = (volume[covid_start:covid_recovery] * 2.5).astype(int)
        
        df = pd.DataFrame({
            "Date": dates,
            "Open": np.round(open_price, 2),
            "High": np.round(high, 2),
            "Low": np.round(low, 2),
            "Close": np.round(close, 2),
            "Adj Close": np.round(close, 2),
            "Volume": volume,
        })
        df.set_index("Date", inplace=True)
        
        all_prices[ticker] = df
        all_tickers.append(ticker)

# Save to data/raw/
out_dir = os.path.join(os.path.dirname(__file__), "data", "raw")
os.makedirs(out_dir, exist_ok=True)

for ticker, df in all_prices.items():
    path = os.path.join(out_dir, f"{ticker}.csv")
    df.to_csv(path)
    print(f"  {ticker}: {len(df)} days, ${df['Close'].iloc[0]:.2f} -> ${df['Close'].iloc[-1]:.2f}")

print(f"\nGenerated {len(all_prices)} CSV files in {out_dir}")
