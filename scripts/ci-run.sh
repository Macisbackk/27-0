#!/usr/bin/env bash
# Run a command; on failure, surface the tail of its output as a GitHub annotation
# (annotations are readable via the API even where raw logs aren't).
set -o pipefail
title="$1"; shift
out=$(mktemp)
"$@" 2>&1 | tee "$out"
code=${PIPESTATUS[0]}
if [ "$code" -ne 0 ]; then
  msg=$(tail -n 40 "$out" | sed 's/\x1b\[[0-9;]*m//g' | sed -e 's/%/%25/g' | awk '{printf "%s%%0A", $0}')
  echo "::error title=${title} failed (exit ${code})::${msg}"
fi
exit "$code"
