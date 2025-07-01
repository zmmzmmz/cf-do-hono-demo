#!/bin/bash

# 部署前检查脚本

echo "🔍 进行部署前检查..."

# 检查 wrangler 配置
echo "📄 检查 wrangler.jsonc 配置..."
if [ ! -f "wrangler.jsonc" ]; then
  echo "❌ 找不到 wrangler.jsonc"
  exit 1
fi

# 检查 Durable Object 配置
if ! grep -q "durable_objects" wrangler.jsonc; then
  echo "❌ wrangler.jsonc 中缺少 durable_objects 配置"
  exit 1
fi

# 检查必要文件
files=("src/index.ts" "src/device-manager.ts" "src/control-center.ts" "src/types.ts")
for file in "${files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ 找不到必要文件: $file"
    exit 1
  fi
done

echo "✅ 所有检查通过！"
echo ""
echo "🚀 准备部署："
echo "   pnpm run deploy"
echo ""
echo "📋 部署后测试："
echo "   1. 访问 https://your-worker.workers.dev 查看控制面板"
echo "   2. 使用设备客户端连接："
echo "      node device-client.js --id test-001 --name '测试设备' --url wss://your-worker.workers.dev/device/ws"
