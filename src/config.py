TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "META",
    "JPM",  "GS",   "BAC",   "WFC",  "C",
    "XOM",  "CVX",  "COP",   "SLB",  "EOG",
    "JNJ",  "PFE",  "MRK",   "ABT",  "UNH",
]

START_DATE          = "2019-01-01"
END_DATE            = "2024-01-01"
RISK_FREE_RATE      = 0.05
CLUSTER_METHOD      = "spectral"    # "spectral" | "louvain"
COVARIANCE_METHOD   = "ledoit_wolf" # "sample" | "ledoit_wolf" | "oas"
GRAPH_FILTER        = "mst"         # "mst" | "threshold"
THRESHOLD           = 0.7
ALLOW_SHORT         = False
MAX_WEIGHT          = 0.25
N_FRONTIER_POINTS   = 100
