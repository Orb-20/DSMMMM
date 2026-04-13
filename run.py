#!/usr/bin/env python
"""Start the Graph Portfolio Optimizer — Flask API + React Frontend."""

import subprocess
import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

def main():
    print()
    print("  ╔══════════════════════════════════════════╗")
    print("  ║   ORBE — Graph Portfolio Optimizer       ║")
    print("  ║   Starting server on http://localhost:5000 ║")
    print("  ╚══════════════════════════════════════════╝")
    print()

    # Generate data if not present
    raw_dir = os.path.join(PROJECT_ROOT, "data", "raw")
    if not os.path.exists(raw_dir) or len(os.listdir(raw_dir)) == 0:
        print("  [*] Generating synthetic market data...")
        subprocess.run([sys.executable, os.path.join(PROJECT_ROOT, "generate_data.py")], cwd=PROJECT_ROOT)
        print()

    # Start Flask
    print("  [*] Starting Flask server...")
    print("  [*] Open http://localhost:5000 in your browser")
    print()

    os.chdir(PROJECT_ROOT)
    subprocess.run([sys.executable, os.path.join(PROJECT_ROOT, "backend", "app.py")])

if __name__ == "__main__":
    main()
