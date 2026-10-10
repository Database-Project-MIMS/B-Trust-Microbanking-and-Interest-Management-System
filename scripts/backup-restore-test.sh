#!/usr/bin/env bash
# Disposable-cluster verification; never reads developer credentials or drops mims_dev.
set -euo pipefail
npm run verify:operations
