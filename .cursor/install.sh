#!/usr/bin/env bash
set -euo pipefail

required_node_major=22

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js ${required_node_major}.x and npm are required in the Cloud Agent image." >&2
  exit 1
fi

node_version="$(node --version)"
node_major="${node_version#v}"
node_major="${node_major%%.*}"
if [[ "${node_major}" != "${required_node_major}" ]]; then
  echo "Expected Node.js ${required_node_major}.x, found ${node_version}." >&2
  exit 1
fi

echo "Using Node.js ${node_version}"
echo "Using npm $(npm --version)"

npm ci
npx playwright install --with-deps chromium

# Node 22.23+ exposes a disabled global localStorage unless a backing file is
# supplied. jsdom inherits that behavior, so provide an isolated file for the
# deterministic storage tests during the Cloud build.
localstorage_file="${TMPDIR:-/tmp}/evolutionsandbox-localstorage"
touch "${localstorage_file}"
export NODE_OPTIONS="${NODE_OPTIONS:+${NODE_OPTIONS} }--localstorage-file=${localstorage_file}"

# Cloud builds should not reuse an unrelated server on the fixed Playwright
# port if one happens to be present in the base image.
export CI=true
npm run ship:check
