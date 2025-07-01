#!/bin/bash

# 远程设备控制系统启动脚本

echo "🚀 启动远程设备控制系统..."

# 检查是否安装了依赖
if [ ! -d "node_modules" ]; then
  echo "📦 安装依赖..."
  pnpm install
fi

# 启动开发服务器
echo "🌐 启动 Cloudflare Workers 开发服务器..."
pnpm run dev &

# 等待服务器启动
sleep 5

echo ""
echo "✅ 系统已启动！"
echo ""
echo "🎛️  控制面板: http://localhost:8787"
echo "📡 设备连接: ws://localhost:8787/device/ws"
echo ""
echo "📋 测试命令:"
echo "   node device-client.js --id sensor-001 --name '温度传感器' --url ws://localhost:8787/device/ws"
echo ""
echo "按 Ctrl+C 停止服务器"

# 等待用户中断
wait
