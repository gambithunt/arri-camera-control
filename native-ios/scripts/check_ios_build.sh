#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.codex"
PROJECT_PATH="$ROOT_DIR/ARRICameraControlApp.xcodeproj"
SCHEME="ARRICameraControlApp"
DEFAULT_DESTINATION_ID="7FC346C1-B083-4207-801F-1E397B9E431E"
DESTINATION_ID="${1:-$DEFAULT_DESTINATION_ID}"

mkdir -p "$LOG_DIR"

PACKAGE_LOG="$LOG_DIR/package-test.log"
BUILD_LOG="$LOG_DIR/xcodebuild.log"
ERROR_LOG="$LOG_DIR/xcodebuild-errors.log"
DEST_LOG="$LOG_DIR/showdestinations.log"
SUMMARY_LOG="$LOG_DIR/xcodebuild-summary.log"

echo "== swift test ==" | tee "$PACKAGE_LOG"
(
  cd "$ROOT_DIR"
  swift test --scratch-path /tmp/native-ios-check
) 2>&1 | tee -a "$PACKAGE_LOG"

echo "== xcodebuild -showdestinations ==" | tee "$DEST_LOG"
xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme "$SCHEME" \
  -showdestinations 2>&1 | tee -a "$DEST_LOG"

echo "== xcodebuild build ==" | tee "$BUILD_LOG"
set +e
xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -destination "id=$DESTINATION_ID" \
  ONLY_ACTIVE_ARCH=YES \
  build 2>&1 | tee -a "$BUILD_LOG"
BUILD_EXIT=$?
set -e

grep -E "error:|warning:|BUILD FAILED|BUILD SUCCEEDED" "$BUILD_LOG" > "$ERROR_LOG" || true
{
  echo "swift test: PASS"
  echo "xcodebuild exit code: $BUILD_EXIT"
  if [[ $BUILD_EXIT -eq 0 ]]; then
    echo "xcodebuild result: BUILD SUCCEEDED"
  else
    echo "xcodebuild result: BUILD FAILED"
  fi
} > "$SUMMARY_LOG"

echo
echo "Logs written to:"
echo "  $PACKAGE_LOG"
echo "  $DEST_LOG"
echo "  $BUILD_LOG"
echo "  $ERROR_LOG"
echo "  $SUMMARY_LOG"
echo
echo "xcodebuild exit code: $BUILD_EXIT"

exit "$BUILD_EXIT"
