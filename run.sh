#!/usr/bin/env bash
cd "$(dirname "$0")"

if ! command -v npm &>/dev/null; then
  echo "需要先安装 Node.js 和 npm。"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "正在安装依赖..."
  npm install
fi

echo "启动游戏..."
npm run dev
