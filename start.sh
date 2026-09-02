#!/bin/bash
# StockLab quick start
# Installs dependencies and starts both servers

export PATH="$HOME/nodejs/bin:$PATH"

cd "$(dirname "$0")"

if [ ! -d "backend/node_modules" ]; then
  echo "Installing backend dependencies..."
  (cd backend && npm install)
fi
if [ ! -d "frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  (cd frontend && npm install)
fi

echo "Starting StockLab..."
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3001"

npm run dev
