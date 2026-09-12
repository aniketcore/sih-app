#!/usr/bin/env python3
"""Scrape SIH 2026 problem statements from https://sih.gov.in/sih2026PS
Generates data/sih2026_ps.json and data/sih2026_ps.csv with only:
PS ID, Organization, Title, Category, Theme.
"""

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

try:
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("beautifulsoup4 is required: pip install beautifulsoup4")

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
URL = "https://sih.gov.in/sih2026PS"

def fetch_html(url: str, attempts: int = 5) -> str:
    cmd = [
        "curl", "-sS", "-L", "--max-time", "90", "--compressed",
        "-H", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        url,
    ]
    last_err = None
    for i in range(attempts):
        try:
            result = subprocess.run(cmd, capture_output=True, timeout=120)
            if result.returncode != 0:
                raise RuntimeError(f"curl exited {result.returncode}")
            return result.stdout.decode("utf-8", errors="replace")
        except Exception as e:
            last_err = e
            time.sleep(5)
    raise RuntimeError(f"Fetch failed: {last_err}")

def parse(html_text: str):
    soup = BeautifulSoup(html_text, "html.parser")
    table = soup.find("table", id="dataTablePS")
    if not table:
        sys.exit("Could not find #dataTablePS")
    rows = table.find("tbody").find_all("tr")
    records = []
    for tr in rows:
        tds = tr.find_all("td", recursive=False)
        if len(tds) < 8:
            continue
        title_cell = tds[2]
        link = title_cell.find("a")
        title = (link.get_text(strip=True) if link else title_cell.get_text(strip=True))

        records.append({
            "ps_number": tds[4].get_text(strip=True),
            "org": tds[1].get_text(strip=True),
            "title": title.strip(),
            "category": tds[3].get_text(strip=True),
            "theme": tds[6].get_text(strip=True),
        })
    return records

def write_ts(records: list):
    lib_dir = ROOT / "lib"
    lib_dir.mkdir(parents=True, exist_ok=True)
    ts_content = "export const problemStatements = " + json.dumps(records, ensure_ascii=False, indent=2) + ";\n"
    (lib_dir / "problem-statements.ts").write_text(ts_content, encoding="utf-8")

def main():
    print(f"Fetching {URL} ...")
    html_text = fetch_html(URL)
    records = parse(html_text)
    write_ts(records)
    print(f"OK: {len(records)} problem statements")
    print(f"TS -> {ROOT / 'lib' / 'problem-statements.ts'}")

if __name__ == "__main__":
    main()
