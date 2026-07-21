#!/usr/bin/env bash
# Stage D — daily streak test script.
#
# Simulates day changes so you can test streaks without waiting real days,
# using the dev-only endpoints (available only when NOT NODE_ENV=production).
#
# Usage:
#   1. In one terminal:  npm run dev
#   2. In another:       bash script/test-streaks.sh
#
# Optional: pass a base URL and student id, e.g.
#   bash script/test-streaks.sh http://localhost:5000 1
#
# The dev endpoints used here:
#   POST /api/dev/streak/sim-date  {date:"YYYY-MM-DD" | null}  set/clear "today"
#   POST /api/dev/streak/activity  {studentId}                 record a day's activity
#   POST /api/dev/streak/freeze    {studentId}                 grant a freeze (simulates level-up)
#   POST /api/dev/streak/reset     {studentId}                 wipe the streak
#   GET  /api/students/:id/stats                               what the dashboard reads (flame lives in .stats.streak)

set -e
B="${1:-http://localhost:5000}"
SID="${2:-1}"
J="-H Content-Type:application/json"

sim(){ curl -sS "$B/api/dev/streak/sim-date" $J -d "{\"date\":${1}}" >/dev/null; }   # pass a quoted date or the word null
day(){ sim "\"$1\""; }                                                               # convenience: day 2026-07-01
act(){ curl -sS "$B/api/dev/streak/activity" $J -d "{\"studentId\":$SID}"; echo; }
freeze(){ curl -sS "$B/api/dev/streak/freeze" $J -d "{\"studentId\":$SID}"; echo; }
reset(){ curl -sS "$B/api/dev/streak/reset" $J -d "{\"studentId\":$SID}" >/dev/null; }
look(){ curl -sS "$B/api/students/$SID/stats"; echo; }

echo "== Build a streak and hit the 3-day milestone (+15 XP) =="
reset
day 2026-07-01; act          # current 1
day 2026-07-02; act          # current 2
day 2026-07-03; act          # current 3  -> milestone notice, +15 XP

echo "== Miss a day with no freeze -> gentle loss (record kept) =="
day 2026-07-05; look         # missed 07-04 -> current 0, notice: "Start a new streak... record is 3 days!"

echo "== Freeze auto-saves a missed day =="
reset
day 2026-07-10; act          # current 1
freeze                       # freezes 1
day 2026-07-12; look         # missed 07-11 -> freeze used, current stays 1
day 2026-07-12; act          # current 2

echo "== Tidy up (reset streak, back to the real clock) =="
reset
sim null
echo "done."
