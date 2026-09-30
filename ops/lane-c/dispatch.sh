#!/usr/bin/env bash
# Retired: this legacy wrapper pulled and launched planners in D:\ATLAS, creating
# shared-root races. Use launch.ps1 with a manager-provisioned E: worktree instead.
echo "DISPATCH_RETIRED: use powershell -File ops/lane-c/launch.ps1 -Dir E:\\ATLAS-worktrees\\<packet>"
exit 2
