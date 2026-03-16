#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$ROOT/KUBECENTER-API"
FRONT_DIR="$ROOT/KUBECENTER-FRONT"

cleanup() {
  echo ""
  echo "Parando serviços..."
  kill $PID_API $PID_FRONT 2>/dev/null
  wait $PID_API $PID_FRONT 2>/dev/null
  echo "Encerrado."
}
trap cleanup EXIT INT TERM

echo "==> Instalando dependências do backend..."
(cd "$API_DIR" && pnpm install --frozen-lockfile)

echo "==> Instalando dependências do frontend..."
(cd "$FRONT_DIR" && pnpm install --frozen-lockfile)

echo ""
echo "==> Iniciando API (porta 3000)..."
(cd "$API_DIR" && pnpm dev) &
PID_API=$!

echo "==> Iniciando Frontend (porta 3001)..."
(cd "$FRONT_DIR" && pnpm dev) &
PID_FRONT=$!

echo ""
echo "  API:      http://localhost:3000"
echo "  Frontend: http://localhost:3001"
echo ""
echo "Ctrl+C para parar."

wait
