#!/bin/bash
# enforce-builtin-tools.sh
# Block Bash tool from performing tasks that built-in tools should handle
#
# Rules:
#   - cat/head/tail/bat → Use Read tool
#   - grep → Use Grep tool
#   - find → Use Glob tool
#   - sed/awk (for file editing) → Use Edit tool
#   - echo "..." > file → Use Write tool

COMMAND=$(jq -r '.tool_input.command' 2>/dev/null)

if [ -z "$COMMAND" ] || [ "$COMMAND" = "null" ]; then
  exit 0
fi

# Extract the first command from pipeline/chain
# "cat foo.txt | grep bar" → "cat"
# "cd dir && cat file" → "cd" (allowed)
FIRST_CMD=$(echo "$COMMAND" | sed 's/^[[:space:]]*//' | awk '{print $1}')

deny() {
  local reason="$1"
  local alternative="$2"
  jq -n \
    --arg reason "$reason. Use the $alternative tool instead." \
    '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: $reason
      }
    }'
  exit 0
}

case "$FIRST_CMD" in
  cat)
    deny "Use the Read tool instead of cat for reading files" "Read"
    ;;
  head)
    deny "Use the Read tool instead of head for reading files (use offset/limit parameters)" "Read"
    ;;
  tail)
    deny "Use the Read tool instead of tail for reading files (use offset/limit parameters)" "Read"
    ;;
  bat|batcat)
    deny "Use the Read tool instead of bat for reading files" "Read"
    ;;
  grep)
    deny "Use the Grep tool instead of grep for content search" "Grep"
    ;;
  find)
    deny "Use the Glob tool instead of find for file search" "Glob"
    ;;
  sed)
    deny "Use the Edit tool instead of sed for file editing" "Edit"
    ;;
  awk)
    deny "Use the Edit or Read tool instead of awk for file editing/processing" "Edit/Read"
    ;;
  echo|printf)
    # Check if echo/printf is used for file writing via redirection (>, >>)
    if echo "$COMMAND" | grep -qE '>\s*\S'; then
      deny "Use the Write tool instead of echo/printf redirection for writing files" "Write"
    fi
    ;;
esac

# Allow
exit 0
