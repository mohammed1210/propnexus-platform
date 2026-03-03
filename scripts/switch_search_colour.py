#!/usr/bin/env python
"""
Flip SEARCH_INSTANCE between blue and green.
Usage:  python scripts/switch_search_colour.py green
"""

import subprocess
import sys

if len(sys.argv) < 2:
    raise SystemExit("Usage: python scripts/switch_search_colour.py <blue|green>")

colour = sys.argv[1].lower().strip()
if colour not in {"blue", "green"}:
    raise SystemExit("colour must be one of: blue, green")


def run(cmd: str) -> None:
    print(">", cmd)
    subprocess.check_call(cmd, shell=True)


run(f"vercel env add SEARCH_INSTANCE {colour} --yes")
run("vercel deploy --prod --confirm")
run(f"railway env set SEARCH_INSTANCE {colour} -s propnexus-backend")

print(f"✅ Switched traffic to {colour}")
