# Graph-Theoretic Portfolio Optimization — Implementation Roadmap

---

## PART 1: SYSTEM PIPELINE (EXECUTION ORDER)

```
RAW OHLCV DATA
      │
      ▼
[Stage 1] Data Preprocessing
  → cleaned price matrix, log-return matrix
      │
      ▼
[Stage 2] Statistical Estimation
  → μ (mean return vector), Σ (covariance matrix)
      │
      ▼
[Stage 3] Correlation Computation
  → Pearson correlation matrix C, distance matrix D
      │
      ▼
[Stage 4] Graph Construction
  → weighted undirected graph G = (V, E, W)
      │
      ▼
[Stage 5] Graph Processing
  → filtered/pruned graph (MST or threshold-filtered)
  → clusters via spectral or Louvain clustering
      │
      ▼
[Stage 6] Portfolio Optimization (per cluster + global)
  → optimal weight vector w*
      │
      ▼
[Stage 7] Result Generation
  → portfolio metrics, weight allocation, visualizations
```

**Stage Dependencies:**

| Stage | Depends On |
|-------|-----------|
| Statistical Estimation | Preprocessing |
| Correlation | Statistical Estimation (Σ) |
| Graph Construction | Correlation (C, D) |
| Graph Processing | Graph Construction (G) |
| Optimization | Statistical Estimation (μ, Σ) + Graph Processing (clusters) |
| Result Generation | Optimization output |

---

## PART 2: TECHNICAL ARCHITECTURE

### Language & Libraries

| Component | Choice | Reason |
|-----------|--------|--------|
| Language | Python 3.10+ | Scientific ecosystem, readable, fast prototyping |
| Data handling | `pandas`, `numpy` | Vectorized matrix ops, time-series alignment |
| Stats/Estimation | `numpy`, `scipy.stats` | Covariance, eigendecomposition |
| Graph processing | `networkx`, `python-louvain` | MST, Laplacian, community detection |
| Optimization | `cvxpy` | Convex QP solver with constraint API |
| Visualization | `matplotlib`, `seaborn`, `plotly` | Heatmaps, graph plots, efficient frontier |
| Data sourcing | `yfinance` or flat CSV | Reproducibility + free historical data |
| Testing | `pytest` | Module-level unit + integration tests |

### Why CVXPY over scipy.optimize?
- Native support for convex constraints (sum=1, w≥0)
- Works with multiple solvers (OSQP, ECOS, SCS) as fallback
- Accepts matrix expressions directly

---

## PART 3: FOLDER STRUCTURE

```
graph_portfolio/
│
├── data/
│   ├── raw/                    # Raw downloaded OHLCV CSV files
│   └── processed/              # Cleaned return matrices (parquet/csv)
│
├── src/
│   ├── __init__.py
│   ├── config.py               # Global params: tickers, date range, thresholds
│   │
│   ├── preprocessing/
│   │   ├── __init__.py
│   │   ├── loader.py           # Load raw data, align dates
│   │   └── cleaner.py          # Handle missing values, compute log returns
│   │
│   ├── estimation/
│   │   ├── __init__.py
│   │   ├── returns.py          # Compute μ (mean returns)
│   │   └── covariance.py       # Compute Σ (shrinkage / sample / Ledoit-Wolf)
│   │
│   ├── correlation/
│   │   ├── __init__.py
│   │   └── distance.py         # Pearson C → distance matrix D
│   │
│   ├── graph/
│   │   ├── __init__.py
│   │   ├── builder.py          # Build adjacency matrix / NetworkX graph from D
│   │   ├── filters.py          # MST + threshold filtering
│   │   └── laplacian.py        # Compute graph Laplacian L = D_deg - A
│   │
│   ├── clustering/
│   │   ├── __init__.py
│   │   ├── spectral.py         # Spectral clustering on Laplacian eigenvectors
│   │   └── louvain.py          # Community detection (Louvain method)
│   │
│   ├── optimization/
│   │   ├── __init__.py
│   │   ├── markowitz.py        # QP solver: min w'Σw s.t. w'μ=r*, 1'w=1, w≥0
│   │   ├── frontier.py         # Sweep target returns → efficient frontier
│   │   └── cluster_weights.py  # Intra-cluster + inter-cluster weight allocation
│   │
│   ├── results/
│   │   ├── __init__.py
│   │   ├── metrics.py          # Sharpe, Sortino, portfolio σ, β, VaR
│   │   └── reporter.py         # Export weights CSV + metrics JSON
│   │
│   └── visualization/
│       ├── __init__.py
│       ├── plot_graph.py        # Draw filtered graph with cluster coloring
│       ├── plot_frontier.py     # Plot efficient frontier + selected portfolio
│       └── plot_heatmap.py      # Correlation / covariance heatmaps
│
├── tests/
│   ├── test_preprocessing.py
│   ├── test_estimation.py
│   ├── test_graph.py
│   ├── test_clustering.py
│   ├── test_optimization.py
│   └── test_integration.py
│
├── notebooks/
│   └── exploration.ipynb       # Ad-hoc research and visualization
│
├── outputs/
│   ├── weights.csv
│   ├── metrics.json
│   └── plots/
│
├── main.py                     # CLI entry point — runs full pipeline
├── requirements.txt
└── README.md
```

---

## PART 4: MODULE-WISE IMPLEMENTATION PLAN

---

### MODULE 1 — Data Preprocessing
**Files:** `loader.py`, `cleaner.py`

**Input:** Ticker list, start/end dates (from `config.py`)  
**Output:** `pd.DataFrame` of log-returns, shape `(T, N)` — T trading days × N assets

**Core Logic:**
1. Download/load adjusted close prices
2. Drop tickers with >5% missing data
3. Forward-fill then backward-fill remaining NaNs (max 3 consecutive)
4. Align all tickers to common trading calendar
5. Compute log-returns: `r_t = ln(P_t / P_{t-1})`

**Key Functions:**
```python
def load_prices(tickers: list[str], start: str, end: str) -> pd.DataFrame:
    # Returns adjusted close prices, aligned on date index

def compute_log_returns(prices: pd.DataFrame) -> pd.DataFrame:
    # Returns log-return matrix, drops first row (NaN)

def validate_returns(returns: pd.DataFrame, max_missing_pct: float = 0.05) -> pd.DataFrame:
    # Drops columns exceeding missing threshold BEFORE fill
    # Raises ValueError if fewer than 5 tickers survive
```

**Edge Cases:**
- All-NaN column → drop before any fill
- Constant price series (zero variance) → drop with warning
- Fewer than required tickers after cleaning → raise `InsufficientDataError`

---

### MODULE 2 — Statistical Estimation
**Files:** `returns.py`, `covariance.py`

**Input:** Log-return matrix `R` shape `(T, N)`  
**Output:** `μ` (N,), `Σ` (N, N)

**Core Logic:**

```python
# Mean return vector
μ = R.mean(axis=0)  # shape (N,)

# Covariance — use Ledoit-Wolf shrinkage by default
from sklearn.covariance import LedoitWolf
Σ = LedoitWolf().fit(R).covariance_  # shape (N, N)
```

**Key Functions:**
```python
def estimate_mean_returns(R: np.ndarray) -> np.ndarray:
    return R.mean(axis=0)

def estimate_covariance(R: np.ndarray, method: str = "ledoit_wolf") -> np.ndarray:
    # method: "sample" | "ledoit_wolf" | "oas"
    # Always validate output is PSD before returning

def ensure_psd(Sigma: np.ndarray, epsilon: float = 1e-8) -> np.ndarray:
    # Eigendecomposition → clip negative eigenvalues → reconstruct
    # Returns nearest PSD matrix
```

**Edge Cases:**
- T < N (underdetermined) → **force** Ledoit-Wolf or OAS; never use sample covariance
- Near-singular Σ → `ensure_psd()` clips eigenvalues to `epsilon`
- Infinite/NaN values in R → caught in preprocessing; assert here as guard

---

### MODULE 3 — Correlation & Distance Matrix
**File:** `distance.py`

**Input:** Log-return matrix `R` (T, N)  
**Output:** Correlation matrix `C` (N, N), distance matrix `D` (N, N)

**Core Logic:**
```python
C = np.corrcoef(R.T)  # (N, N), values in [-1, 1]

# Mantegna distance (from financial network literature)
D = np.sqrt(2 * (1 - C))  # values in [0, 2], metric space
```

**Key Functions:**
```python
def compute_correlation(R: np.ndarray) -> np.ndarray:
    C = np.corrcoef(R.T)
    np.fill_diagonal(C, 1.0)  # numerical safety
    C = np.clip(C, -1.0, 1.0)
    return C

def correlation_to_distance(C: np.ndarray) -> np.ndarray:
    D = np.sqrt(np.clip(2 * (1 - C), 0, None))  # clip prevents sqrt(-ε)
    np.fill_diagonal(D, 0.0)
    return D
```

**Edge Cases:**
- Perfectly correlated pair (C=1 → D=0) → valid, but check for duplicate assets
- `C[i,j] > 1` due to floating point → `np.clip` handles it
- All-zero return asset → produces NaN correlation → removed in Module 1

---

### MODULE 4 — Graph Construction
**File:** `builder.py`

**Input:** Distance matrix `D` (N, N), ticker list  
**Output:** `networkx.Graph` G with edge weights = distances

**Core Logic:**
```python
import networkx as nx

def build_graph(D: np.ndarray, tickers: list[str]) -> nx.Graph:
    G = nx.Graph()
    G.add_nodes_from(tickers)
    N = len(tickers)
    for i in range(N):
        for j in range(i + 1, N):
            if D[i, j] > 0:  # skip self-loops and zero-distance pairs
                G.add_edge(tickers[i], tickers[j], weight=D[i, j])
    return G
```

**Edge Cases:**
- D[i,j] = 0 for i≠j (duplicate assets) → skip edge, log warning
- Disconnected graph after filtering → handle in `filters.py`
- N=1 (single asset) → raise `GraphTooSmallError`

---

### MODULE 5 — Graph Processing (Filtering + Clustering)
**Files:** `filters.py`, `laplacian.py`, `spectral.py`, `louvain.py`

#### 5a. Graph Filtering

**Input:** Full graph G  
**Output:** Filtered sparse graph G' (MST or threshold-based)

```python
def apply_mst_filter(G: nx.Graph) -> nx.Graph:
    # Kruskal's MST on distance weights → keeps N-1 edges minimum
    return nx.minimum_spanning_tree(G, weight="weight")

def apply_threshold_filter(G: nx.Graph, threshold: float) -> nx.Graph:
    # Keep edges where weight (distance) < threshold
    G_filtered = nx.Graph()
    G_filtered.add_nodes_from(G.nodes)
    for u, v, d in G.edges(data=True):
        if d["weight"] < threshold:
            G_filtered.add_edge(u, v, **d)
    return G_filtered
```

**Edge Cases:**
- MST on disconnected graph → apply per component, then union
- Threshold too low → empty graph → fallback: increase threshold by 10% and retry (max 5 attempts)
- Threshold too high → fully connected → warn, use MST instead

#### 5b. Graph Laplacian

```python
def compute_laplacian(G: nx.Graph, normalized: bool = False) -> np.ndarray:
    nodelist = sorted(G.nodes())
    if normalized:
        L = nx.normalized_laplacian_matrix(G, nodelist=nodelist).toarray()
    else:
        L = nx.laplacian_matrix(G, nodelist=nodelist).toarray()
    return L.astype(float), nodelist
```

#### 5c. Spectral Clustering

```python
def spectral_cluster(L: np.ndarray, k: int, nodelist: list) -> dict[str, int]:
    # Eigendecomposition of L
    eigenvalues, eigenvectors = np.linalg.eigh(L)
    # Use k smallest non-trivial eigenvectors (skip λ₀ ≈ 0)
    k_vecs = eigenvectors[:, 1:k+1]  # shape (N, k)
    # Normalize rows
    norms = np.linalg.norm(k_vecs, axis=1, keepdims=True)
    norms = np.where(norms < 1e-10, 1.0, norms)
    k_vecs_normalized = k_vecs / norms
    # K-Means on eigenvectors
    from sklearn.cluster import KMeans
    labels = KMeans(n_clusters=k, n_init=20, random_state=42).fit_predict(k_vecs_normalized)
    return {node: int(label) for node, label in zip(nodelist, labels)}
```

#### 5d. Louvain Clustering (alternative)

```python
def louvain_cluster(G: nx.Graph) -> dict[str, int]:
    import community as community_louvain
    # Convert distance weights to similarity for modularity maximization
    G_sim = G.copy()
    for u, v, d in G_sim.edges(data=True):
        G_sim[u][v]["weight"] = 1.0 / (d["weight"] + 1e-9)
    partition = community_louvain.best_partition(G_sim, weight="weight", random_state=42)
    return partition  # {node: cluster_id}
```

**Edge Cases:**
- k > number of connected nodes → reduce k to max feasible
- Single-node cluster → merge into nearest cluster by average distance
- Eigenvector with NaN (from degenerate Laplacian) → fallback to Louvain

---

### MODULE 6 — Portfolio Optimization
**Files:** `markowitz.py`, `frontier.py`, `cluster_weights.py`

#### 6a. Core Markowitz QP

```python
import cvxpy as cp

def markowitz_optimize(
    mu: np.ndarray,
    Sigma: np.ndarray,
    target_return: float | None = None,
    allow_short: bool = False,
    risk_free_rate: float = 0.0,
) -> dict:
    n = len(mu)
    w = cp.Variable(n)

    portfolio_return = mu @ w
    portfolio_variance = cp.quad_form(w, Sigma)

    constraints = [cp.sum(w) == 1]
    if not allow_short:
        constraints.append(w >= 0)

    if target_return is not None:
        constraints.append(portfolio_return >= target_return)
        objective = cp.Minimize(portfolio_variance)
    else:
        # Maximize Sharpe (approximate via parametric sweep)
        objective = cp.Minimize(portfolio_variance)

    problem = cp.Problem(objective, constraints)

    solvers = [cp.OSQP, cp.ECOS, cp.SCS]
    for solver in solvers:
        try:
            problem.solve(solver=solver, warm_start=True)
            if problem.status in ["optimal", "optimal_inaccurate"] and w.value is not None:
                weights = np.clip(w.value, 0, 1) if not allow_short else w.value
                weights /= weights.sum()  # renormalize after clip
                return {
                    "weights": weights,
                    "expected_return": float(mu @ weights),
                    "variance": float(weights @ Sigma @ weights),
                    "status": problem.status,
                }
        except cp.SolverError:
            continue

    raise OptimizationFailedError(f"All solvers failed. Status: {problem.status}")
```

#### 6b. Efficient Frontier

```python
def compute_efficient_frontier(
    mu: np.ndarray,
    Sigma: np.ndarray,
    n_points: int = 100,
) -> pd.DataFrame:
    r_min = float(mu.min())
    r_max = float(mu.max())
    # Shrink range slightly to avoid infeasible boundary targets
    targets = np.linspace(r_min * 0.99, r_max * 0.99, n_points)
    
    results = []
    for r in targets:
        try:
            res = markowitz_optimize(mu, Sigma, target_return=r)
            results.append({
                "target_return": r,
                "portfolio_return": res["expected_return"],
                "portfolio_std": np.sqrt(res["variance"]),
                "weights": res["weights"],
            })
        except OptimizationFailedError:
            continue  # skip infeasible points silently
    return pd.DataFrame(results)
```

#### 6c. Two-Level Cluster Optimization

```python
def cluster_aware_optimize(
    mu: np.ndarray,
    Sigma: np.ndarray,
    cluster_map: dict[str, int],
    tickers: list[str],
) -> np.ndarray:
    """
    Step 1: Optimize within each cluster → get intra-cluster weights
    Step 2: Treat each cluster as a synthetic asset
    Step 3: Optimize across clusters → get inter-cluster weights
    Step 4: Combine: final_w[i] = inter_weight[c] * intra_weight[i|c]
    """
    clusters = {}
    for ticker, cid in cluster_map.items():
        clusters.setdefault(cid, []).append(ticker)

    intra_weights = {}
    cluster_mu = []
    cluster_var = []

    for cid, members in clusters.items():
        idx = [tickers.index(t) for t in members]
        mu_c = mu[idx]
        Sigma_c = Sigma[np.ix_(idx, idx)]
        try:
            res = markowitz_optimize(mu_c, Sigma_c)
            intra_weights[cid] = (members, res["weights"])
            cluster_mu.append(res["expected_return"])
            cluster_var.append(res["variance"])
        except OptimizationFailedError:
            # Equal-weight fallback for this cluster
            ew = np.ones(len(members)) / len(members)
            intra_weights[cid] = (members, ew)
            cluster_mu.append(float(mu_c.mean()))
            cluster_var.append(float(ew @ Sigma_c @ ew))

    # Inter-cluster optimization
    mu_inter = np.array(cluster_mu)
    Sigma_inter = np.diag(cluster_var)  # assume cluster independence for inter-level
    res_inter = markowitz_optimize(mu_inter, Sigma_inter)

    # Combine
    final_weights = np.zeros(len(tickers))
    for cluster_idx, (cid, (members, w_intra)) in enumerate(intra_weights.items()):
        inter_w = res_inter["weights"][cluster_idx]
        for ticker, w_i in zip(members, w_intra):
            final_weights[tickers.index(ticker)] = inter_w * w_i

    final_weights /= final_weights.sum()  # normalize
    return final_weights
```

---

### MODULE 7 — Result Generation
**Files:** `metrics.py`, `reporter.py`

**Input:** `weights` (N,), `mu` (N,), `Sigma` (N,N), `R` (T,N), `tickers`  
**Output:** `weights.csv`, `metrics.json`

**Key Functions:**
```python
def compute_portfolio_metrics(
    weights: np.ndarray,
    mu: np.ndarray,
    Sigma: np.ndarray,
    R: np.ndarray,
    risk_free_rate: float = 0.0,
    periods_per_year: int = 252,
) -> dict:
    port_return = float(mu @ weights) * periods_per_year
    port_variance = float(weights @ Sigma @ weights)
    port_std = np.sqrt(port_variance) * np.sqrt(periods_per_year)
    sharpe = (port_return - risk_free_rate) / port_std if port_std > 0 else 0.0

    # Sortino
    daily_returns = R @ weights
    downside = daily_returns[daily_returns < 0]
    downside_std = np.std(downside) * np.sqrt(periods_per_year) if len(downside) > 1 else port_std
    sortino = (port_return - risk_free_rate) / downside_std if downside_std > 0 else 0.0

    # Historical VaR (95%)
    var_95 = float(np.percentile(daily_returns, 5))

    # Diversification ratio
    weighted_vols = np.sqrt(np.diag(Sigma)) @ weights
    div_ratio = weighted_vols / np.sqrt(port_variance) if port_variance > 0 else 1.0

    return {
        "annual_return": port_return,
        "annual_volatility": port_std,
        "sharpe_ratio": sharpe,
        "sortino_ratio": sortino,
        "var_95_daily": var_95,
        "diversification_ratio": div_ratio,
    }
```

---

## PART 5: DATA FLOW & INTEGRATION

```
loader.py
  → prices: DataFrame(T, N) [adjusted close]

cleaner.py
  → log_returns: DataFrame(T, N) [validated, filled, log-transformed]

returns.py + covariance.py
  → mu: ndarray(N,)
  → Sigma: ndarray(N, N) [PSD-guaranteed]

distance.py
  → C: ndarray(N, N) [clipped Pearson]
  → D: ndarray(N, N) [Mantegna distance]

builder.py
  → G: nx.Graph [nodes=tickers, edges=D[i,j]]

filters.py
  → G_filtered: nx.Graph [sparse, MST or threshold]

laplacian.py
  → L: ndarray(N, N)
  → nodelist: list[str] [ordered]

spectral.py / louvain.py
  → cluster_map: dict[str → int]

cluster_weights.py + markowitz.py
  → final_weights: ndarray(N,)
  → frontier_df: DataFrame [100 points]

metrics.py + reporter.py
  → weights.csv, metrics.json, plots/
```

**Transformation checkpoints:**
| Transition | Transformation |
|-----------|---------------|
| prices → log_returns | `ln(P_t/P_{t-1})`, drop row 0 |
| Σ → Pearson C | `np.corrcoef(R.T)` |
| C → D | `sqrt(2*(1-C))` |
| D → G | adjacency with edge weight = D[i,j] |
| G → G_filtered | MST (Kruskal) or edge-threshold |
| G_filtered → L | `D_deg - A` matrix |
| L → clusters | eigenvectors + k-means |
| clusters + μ,Σ → w* | hierarchical CVXPY QP |

---

## PART 6: KEY IMPLEMENTATION DETAILS

### Covariance Matrix Computation

```python
# T >= N: sample covariance is valid
S = (1 / (T - 1)) * (R - R.mean(0)).T @ (R - R.mean(0))

# T < N or ill-conditioned: Ledoit-Wolf
from sklearn.covariance import LedoitWolf
S_lw = LedoitWolf().fit(R).covariance_

# Always make PSD:
def ensure_psd(S, eps=1e-8):
    eigvals, eigvecs = np.linalg.eigh(S)
    eigvals = np.maximum(eigvals, eps)
    return eigvecs @ np.diag(eigvals) @ eigvecs.T
```

### Graph Laplacian

```python
# Degree matrix D_deg
A = nx.to_numpy_array(G, nodelist=nodelist, weight="weight")
D_deg = np.diag(A.sum(axis=1))
L = D_deg - A  # unnormalized Laplacian

# Normalized Laplacian (for spectral clustering)
D_inv_sqrt = np.diag(1.0 / np.sqrt(np.maximum(np.diag(D_deg), 1e-10)))
L_norm = np.eye(len(nodelist)) - D_inv_sqrt @ A @ D_inv_sqrt
```

### Markowitz QP (full constraint set)

```
Minimize:     w^T Σ w
Subject to:   1^T w = 1           (fully invested)
              μ^T w >= r*          (target return)
              w >= 0               (long-only)
              w_i <= w_max         (optional concentration limit)
```

### Spectral Clustering — Number of Clusters k

```python
def estimate_k(eigenvalues: np.ndarray, max_k: int = 10) -> int:
    # Eigengap heuristic: find largest gap between consecutive eigenvalues
    gaps = np.diff(eigenvalues[1:max_k+2])  # skip λ₀ ≈ 0
    return int(np.argmax(gaps) + 1)
```

---

## PART 7: EDGE CASES & FAILURE HANDLING

| Scenario | Detection | Handling |
|----------|-----------|----------|
| Singular Σ | `np.linalg.cond(Σ) > 1e10` | `ensure_psd()` with `eps=1e-6` |
| T < N | `R.shape[0] < R.shape[1]` | Force Ledoit-Wolf; warn user |
| Empty cluster | `len(cluster_members) == 0` | Impossible post-clustering; assertion guard |
| Single-member cluster | `len(cluster_members) == 1` | Assign weight directly; skip intra QP |
| Infeasible target return | `r* > max(μ)` | Clip to `0.99 * max(μ)` |
| QP solver failure | `problem.status not in ["optimal",...]` | Try ECOS → SCS → equal-weight fallback |
| Graph too sparse (MST only) | Detected by edge count | No action needed; MST is minimum viable |
| Graph too dense | All edges present after threshold | Use MST instead; log warning |
| Zero-variance asset | `np.std(R[:,i]) < 1e-10` | Drop in `validate_returns()` |
| Non-PSD after shrinkage | Negative eigenvalue in Σ | `ensure_psd()` mandatory post-step |
| Duplicate tickers | `D[i,j] == 0, i != j` | Drop duplicate; warn user |
| Optimization returns negative weights | Numerical noise | `np.clip(w, 0, 1)` then renormalize |

**Global Fallback Chain:**
```
Ledoit-Wolf fails → OAS → diagonal Σ (variance-only)
Spectral clustering fails → Louvain → equal single-cluster
CVXPY QP fails → equal-weight within cluster
```

---

## PART 8: VALIDATION & TESTING PLAN

### Unit Tests

#### `test_preprocessing.py`
```python
def test_log_returns_shape():
    prices = pd.DataFrame(np.random.rand(100, 5) + 1)
    returns = compute_log_returns(prices)
    assert returns.shape == (99, 5)

def test_missing_data_drop():
    prices = pd.DataFrame(np.random.rand(100, 5))
    prices.iloc[:, 2] = np.nan  # fully NaN column
    result = validate_returns(compute_log_returns(prices))
    assert 2 not in result.columns or result.shape[1] == 4
```

#### `test_estimation.py`
```python
def test_covariance_is_psd():
    R = np.random.randn(50, 20)
    Sigma = estimate_covariance(R)
    eigenvalues = np.linalg.eigvalsh(Sigma)
    assert np.all(eigenvalues >= -1e-9)

def test_ensure_psd_fixes_negative_eigenvalue():
    S = np.array([[1, 2], [2, 1]])  # not PSD (det < 0)
    S_fixed = ensure_psd(S)
    assert np.all(np.linalg.eigvalsh(S_fixed) >= 0)
```

#### `test_graph.py`
```python
def test_mst_has_n_minus_1_edges():
    D = np.random.rand(10, 10)
    D = (D + D.T) / 2
    np.fill_diagonal(D, 0)
    G = build_graph(D, [str(i) for i in range(10)])
    mst = apply_mst_filter(G)
    assert len(mst.edges) == 9

def test_distance_matrix_symmetry():
    C = np.corrcoef(np.random.randn(50, 8).T)
    D = correlation_to_distance(C)
    assert np.allclose(D, D.T)
    assert np.all(D >= 0)
```

#### `test_optimization.py`
```python
def test_weights_sum_to_one():
    mu = np.array([0.10, 0.12, 0.08, 0.15])
    Sigma = np.diag([0.04, 0.05, 0.03, 0.06])
    result = markowitz_optimize(mu, Sigma)
    assert abs(result["weights"].sum() - 1.0) < 1e-6

def test_weights_non_negative_long_only():
    mu = np.array([0.10, 0.12, 0.08])
    Sigma = np.eye(3) * 0.04
    result = markowitz_optimize(mu, Sigma, allow_short=False)
    assert np.all(result["weights"] >= -1e-8)

def test_target_return_satisfied():
    mu = np.array([0.10, 0.15, 0.08])
    Sigma = np.diag([0.04, 0.05, 0.03])
    target = 0.12
    result = markowitz_optimize(mu, Sigma, target_return=target)
    assert result["expected_return"] >= target - 1e-5

def test_singular_covariance_handled():
    mu = np.array([0.1, 0.2, 0.15])
    Sigma = np.ones((3, 3))  # rank-1, singular
    Sigma_fixed = ensure_psd(Sigma)
    result = markowitz_optimize(mu, Sigma_fixed)
    assert result["weights"] is not None
```

### Integration Tests

#### `test_integration.py`
```python
def test_full_pipeline_small():
    """Run full pipeline on 10 synthetic assets, 252 days"""
    np.random.seed(42)
    R = pd.DataFrame(np.random.randn(252, 10) * 0.01 + 0.0005)
    R.columns = [f"A{i}" for i in range(10)]
    # Run stages sequentially and assert no exceptions
    ...
    assert 0.99 < weights.sum() < 1.01
    assert np.all(weights >= -1e-6)
```

### Sanity Checks (built into `main.py`)
```python
assert abs(weights.sum() - 1.0) < 1e-4, "Weights must sum to 1"
assert np.all(weights >= -1e-4), "Negative weights in long-only mode"
assert portfolio_std > 0, "Portfolio volatility must be positive"
assert len(clusters) >= 2, "Must have at least 2 clusters for diversification"
```

---

## PART 9: OUTPUT SPECIFICATION

### `outputs/weights.csv`
```
ticker,weight,cluster
AAPL,0.0842,0
MSFT,0.1123,0
GOOGL,0.0654,1
...
```

### `outputs/metrics.json`
```json
{
  "annual_return": 0.1423,
  "annual_volatility": 0.1872,
  "sharpe_ratio": 1.034,
  "sortino_ratio": 1.287,
  "var_95_daily": -0.0182,
  "diversification_ratio": 1.34,
  "n_assets": 18,
  "n_clusters": 4,
  "optimization_status": "optimal"
}
```

### `outputs/plots/`
| File | Content |
|------|---------|
| `correlation_heatmap.png` | Pearson correlation matrix heatmap |
| `distance_graph.png` | MST/filtered graph, nodes colored by cluster |
| `efficient_frontier.png` | Risk-return frontier + selected portfolio point |
| `weight_allocation.png` | Bar chart of final portfolio weights |
| `cluster_composition.png` | Stacked bar: cluster membership breakdown |

---

## PART 10: EXECUTION FLOW

```python
# main.py

# ── STEP 1: Load Config ──────────────────────────────────────────────────────
from src.config import TICKERS, START_DATE, END_DATE, RISK_FREE_RATE, CLUSTER_METHOD

# ── STEP 2: Load & Clean Data ────────────────────────────────────────────────
prices    = load_prices(TICKERS, START_DATE, END_DATE)
log_ret   = compute_log_returns(prices)
log_ret   = validate_returns(log_ret)          # drops bad tickers
tickers   = list(log_ret.columns)
R         = log_ret.values                     # shape (T, N)

# ── STEP 3: Statistical Estimation ──────────────────────────────────────────
mu    = estimate_mean_returns(R)               # (N,)
Sigma = estimate_covariance(R, method="ledoit_wolf")  # (N, N) PSD
Sigma = ensure_psd(Sigma)                      # safety pass

# ── STEP 4: Correlation & Distance ──────────────────────────────────────────
C = compute_correlation(R)                     # (N, N)
D = correlation_to_distance(C)                 # (N, N)

# ── STEP 5: Build Graph ──────────────────────────────────────────────────────
G_full     = build_graph(D, tickers)
G_filtered = apply_mst_filter(G_full)          # or threshold filter

# ── STEP 6: Compute Laplacian & Cluster ─────────────────────────────────────
L, nodelist = compute_laplacian(G_filtered, normalized=True)

if CLUSTER_METHOD == "spectral":
    eigenvalues, _ = np.linalg.eigh(L)
    k = estimate_k(eigenvalues)
    cluster_map = spectral_cluster(L, k, nodelist)
else:
    cluster_map = louvain_cluster(G_filtered)

# ── STEP 7: Portfolio Optimization ──────────────────────────────────────────
final_weights = cluster_aware_optimize(mu, Sigma, cluster_map, tickers)

# ── STEP 8: Efficient Frontier ───────────────────────────────────────────────
frontier_df = compute_efficient_frontier(mu, Sigma)

# ── STEP 9: Compute Metrics ──────────────────────────────────────────────────
metrics = compute_portfolio_metrics(
    final_weights, mu, Sigma, R,
    risk_free_rate=RISK_FREE_RATE
)

# ── STEP 10: Validate ────────────────────────────────────────────────────────
assert abs(final_weights.sum() - 1.0) < 1e-4
assert np.all(final_weights >= -1e-4)

# ── STEP 11: Export ──────────────────────────────────────────────────────────
export_weights(final_weights, tickers, cluster_map, path="outputs/weights.csv")
export_metrics(metrics, path="outputs/metrics.json")

# ── STEP 12: Visualize ───────────────────────────────────────────────────────
plot_correlation_heatmap(C, tickers)
plot_graph(G_filtered, cluster_map)
plot_efficient_frontier(frontier_df, final_weights, mu, Sigma)
plot_weight_allocation(final_weights, tickers)
```

---

## `src/config.py` Template

```python
TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "META",
    "JPM",  "GS",   "BAC",   "WFC",  "C",
    "XOM",  "CVX",  "COP",   "SLB",  "EOG",
    "JNJ",  "PFE",  "MRK",   "ABT",  "UNH",
]

START_DATE          = "2019-01-01"
END_DATE            = "2024-01-01"
RISK_FREE_RATE      = 0.05          # annualized
CLUSTER_METHOD      = "spectral"    # "spectral" | "louvain"
COVARIANCE_METHOD   = "ledoit_wolf" # "sample" | "ledoit_wolf" | "oas"
GRAPH_FILTER        = "mst"         # "mst" | "threshold"
THRESHOLD           = 0.7           # distance threshold (if GRAPH_FILTER="threshold")
ALLOW_SHORT         = False
MAX_WEIGHT          = 0.25          # max single-asset weight
N_FRONTIER_POINTS   = 100
```

---

## `requirements.txt`

```
numpy>=1.26
pandas>=2.1
scipy>=1.11
scikit-learn>=1.3
networkx>=3.2
python-louvain>=0.16
cvxpy>=1.4
matplotlib>=3.8
seaborn>=0.13
plotly>=5.18
yfinance>=0.2.36
pytest>=7.4
```

---

*End of Implementation Roadmap*
