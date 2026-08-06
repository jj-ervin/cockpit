#!/usr/bin/env bash
set -euo pipefail

pip install -e ".[test]"
python -m playwright install --with-deps chromium

npm ci --prefix desktop
npm ci --prefix host-web
