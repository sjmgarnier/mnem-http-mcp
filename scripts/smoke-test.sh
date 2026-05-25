#!/usr/bin/env bash
set -euo pipefail

# Requires: mnem binary on PATH, bun on PATH, a local .mnem repo in $LOCAL_REPO
# Usage: LOCAL_REPO=/path/to/project bash scripts/smoke-test.sh

BINARY="${BINARY:-bun run src/index.ts}"
LOCAL_REPO="${LOCAL_REPO:-$(pwd)}"
PASS=0; FAIL=0

check() {
  local desc="$1"; local got="$2"; local expect="$3"
  if echo "$got" | grep -q "$expect"; then
    echo "  PASS: $desc"; ((PASS++))
  else
    echo "  FAIL: $desc (expected '$expect', got: $got)"; ((FAIL++))
  fi
}

echo "=== mnem-http-mcp smoke test ==="

# 1. Start MCP, get tools list
TOOLS=$(printf '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}\n{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}\n' \
  | $BINARY --local-repo "$LOCAL_REPO" 2>/dev/null | tail -1)
check "tools/list contains mnem_stats" "$TOOLS" "mnem_stats"
check "tools/list contains mnem_global_retrieve" "$TOOLS" "mnem_global_retrieve"

# 2. mnem_stats on local graph
STATS=$(printf '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}\n{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"mnem_stats","arguments":{}}}\n' \
  | $BINARY --local-repo "$LOCAL_REPO" 2>/dev/null | tail -1)
check "mnem_stats returns op_id" "$STATS" "op_id"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ]
