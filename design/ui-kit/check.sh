#!/bin/sh
# 檢查這個專案有沒有違反設計系統的規則。改完畫面就跑一次。
set -e
cd "$(dirname "$0")"
python3 scripts/check_usage.py \
  --tokens ui/mist.tokens.css \
  --components ui/components.css \
  --pages pages/*.html \
  --overrides local-overrides.css
