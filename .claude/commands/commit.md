---
name: commit
description: Auto-generate git commits (analyze changes + generate message)
---

# /commit - Git Commit

Analyzes changes and auto-generates a commit message to create a commit.

## Usage

```
/commit                  # Auto-generate message + commit
/commit -m "message"     # Manual message
/commit --dry-run        # Preview message only, no commit
```

## Execution Order

### 1. Check Status (parallel execution)

Run the following 3 commands **in parallel**:

```bash
git status
git diff --staged && git diff
git log --oneline -5
```

- Check list of changed/added/deleted files
- Check staged + unstaged change contents
- Reference recent commit message style

### 2. Sensitive File Check

Warn if sensitive files (credentials, secret, key, etc.) not defined in `.gitignore` are included in the change list.
Files already in `.gitignore` are automatically excluded by git, so no separate handling is needed.

### 3. Generate Commit Message

Analyze the changes and compose a message.

**Format**: `<type>: <description>`

**Type classification**:
| type | When to use |
|------|----------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code improvement without behavior change |
| `test` | Add/modify tests |
| `docs` | Documentation changes |
| `chore` | Config, dependencies, build, etc. |

**Message rules**:
- 1-line summary (under 70 characters)
- Focus on "why" the change was made
- Summarize the core change when multiple files are modified
- **Never** add `Co-Authored-By` line

### 4. Stage and Commit

```bash
# Stage specific files only (never use git add -A)
git add <file1> <file2> ...

# Commit with HEREDOC (without Co-Authored-By)
git commit -m "$(cat <<'EOF'
<type>: <message>
EOF
)"
```

### 5. Verify Result

```bash
git status
```

Check whether the commit succeeded and report the result.

## Important Notes

- Never use `git add -A` or `git add .` (to prevent including sensitive files)
- Never skip hooks with `--no-verify`, etc.
- Never use `--amend` (always create a new commit)
- On pre-commit hook failure: fix the issue, then create a **new commit**
- Never add `Co-Authored-By` line

## $ARGUMENTS

- (none): Auto-generate message + commit
- `-m "message"`: Commit with manual message
- `--dry-run`: Generate message only, do not commit
