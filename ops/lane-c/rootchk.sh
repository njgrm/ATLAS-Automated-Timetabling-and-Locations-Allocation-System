#!/usr/bin/env bash
# ROOT-CLEAN, or ROOT-DIRTY with counts: tracked edits and stray .ts/.tsx in D:\ATLAS (planners must not write there).
cd /d/ATLAS || exit 0
n=$(git status --porcelain 2>/dev/null | grep -v '^??' | wc -l)
m=$(ls *.ts *.tsx 2>/dev/null | grep -v -E '^(playwright\.|prisma\.config)' | wc -l)
if [ "$n" -eq 0 ] && [ "$m" -eq 0 ]; then echo ROOT-CLEAN; else echo "ROOT-DIRTY tracked=$n strays=$m"; fi
