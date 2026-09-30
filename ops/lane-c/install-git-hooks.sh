#!/usr/bin/env bash
# Installs the shared git hooks into D:\ATLAS\.git\hooks (all worktrees use them). Re-run after editing a hook.
set -e
H=$(git -C D:/ATLAS rev-parse --git-common-dir)/hooks
cp "$(dirname "$0")/git-hooks/pre-push" "$H/pre-push" && chmod +x "$H/pre-push" && echo "installed $H/pre-push"
