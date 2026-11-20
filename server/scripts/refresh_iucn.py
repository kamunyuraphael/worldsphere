"""Fetch IUCN Red List totals and cache them in PostgreSQL.

Run from the server directory (uses DATABASE_URL and IUCN_API_TOKEN from server/.env):

    python -m scripts.refresh_iucn --max-pages 2     # quick smoke test (partial, ~minutes)
    python -m scripts.refresh_iucn                   # full run (thousands of requests; ~30+ min)

Re-run weekly or monthly; the Red List only updates a couple of times a year.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

from app import db
from app.ai_core.env import load_env
from app.iucn_stats import IucnError, build_stats, make_client


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--max-pages", type=int, default=None, help="stop each list after N pages (testing)")
    parser.add_argument("--scope-code", type=int, default=int(os.getenv("IUCN_SCOPE_CODE", "1")),
                        help="IUCN assessment scope; 1 = Global (default)")
    parser.add_argument("--dry-run", action="store_true", help="print the result instead of saving it")
    args = parser.parse_args()

    load_env()
    token = os.getenv("IUCN_API_TOKEN", "").strip()
    if not token:
        print("IUCN_API_TOKEN is not set (put it in server/.env).", file=sys.stderr)
        return 2
    try:
        with make_client(token) as client:
            stats = build_stats(client, scope_code=args.scope_code, max_pages=args.max_pages)
    except IucnError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if args.dry_run:
        print(json.dumps(stats, indent=2))
        return 0
    db.init()
    with db.connect() as conn:
        conn.execute(
            "INSERT INTO iucn_stats (key, payload) VALUES ('latest', %s::jsonb) "
            "ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = CURRENT_TIMESTAMP",
            (json.dumps(stats),),
        )
    db.close()
    print("Saved." + (" (partial: --max-pages used)" if stats["partial"] else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
