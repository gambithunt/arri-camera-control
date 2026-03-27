#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_LOG="$ROOT_DIR/.codex/xcodebuild.log"
ERROR_LOG="$ROOT_DIR/.codex/xcodebuild-errors.log"
SUMMARY_LOG="$ROOT_DIR/.codex/xcodebuild-summary.log"

if [[ ! -f "$BUILD_LOG" ]]; then
  echo "Missing build log: $BUILD_LOG" >&2
  exit 1
fi

grep -E "error:|warning:|BUILD FAILED|BUILD SUCCEEDED" "$BUILD_LOG" > "$ERROR_LOG" || true

if [[ -f "$SUMMARY_LOG" ]]; then
  cat "$SUMMARY_LOG"
  echo
fi

tail -n 120 "$ERROR_LOG"
