#!/bin/bash
set -e
cp cashflow.html index.html
git add index.html
git diff --staged --quiet && echo "Keine Änderungen." && exit 0
git commit -m "Update $(date +'%Y-%m-%d %H:%M')"
git push
echo ""
echo "✅ Pushed. Live in ~30-60 Sek auf https://halloekes.github.io/finanzplanung/"
