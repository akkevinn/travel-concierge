#!/usr/bin/env bash
# Launch the Travel Concierge locally.
set -e
cd "$(dirname "$0")"
PORT="${1:-8099}"
echo "🛕  Travel Concierge — Bangkok & Chiang Rai"
echo "    Serving at  http://localhost:${PORT}"
echo "    (Ctrl-C to stop)"
# open the browser on macOS, then serve
( sleep 1; command -v open >/dev/null && open "http://localhost:${PORT}" ) &
python3 -m http.server "${PORT}"
