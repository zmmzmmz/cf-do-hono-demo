#!/usr/bin/env node

/**
 * 快速 WebSocket 连接测试脚本
 * 用于验证设备连接是否正常工作
 */

const WebSocket = require('ws');

const testConfig = {
  url: process.env.WS_URL || 'ws://localhost:8787/device/ws',
  deviceId: 'test-device-001',
  deviceName: '测试设备'
};

console.log('🧪 开始 WebSocket 连接测试...');
console.log(`📡 连接地址: ${testConfig.url}`);

const ws = new WebSocket(testConfig.url);

ws.on('open', () => {
  console.log('✅ WebSocket 连接成功');

  // 发送注册消息
  const registerMessage = {
    type: 'register',
    deviceInfo: {
      id: testConfig.deviceId,
      name: testConfig.deviceName,
      type: 'test',
      capabilities: ['status', 'echo']
    }
  };

  console.log('📝 发送注册消息...');
  ws.send(JSON.stringify(registerMessage));
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📨 收到消息:', message);

    if (message.type === 'register_ack') {
      console.log('✅ 设备注册成功');

      // 发送心跳测试
      setTimeout(() => {
        const heartbeat = {
          type: 'heartbeat',
          deviceInfo: {
            id: testConfig.deviceId,
            name: testConfig.deviceName,
            type: 'test',
            status: 'online',
            lastSeen: new Date(),
            capabilities: ['status', 'echo']
          }
        };

        console.log('💓 发送心跳消息...');
        ws.send(JSON.stringify(heartbeat));
      }, 1000);
    } else if (message.type === 'command') {
      console.log('🎯 收到命令:', message);

      // 模拟命令处理
      const response = {
        type: 'response',
        commandId: message.commandId,
        success: true,
        data: {
          echo: message.params,
          timestamp: new Date().toISOString()
        }
      };

      console.log('📤 发送响应...');
      ws.send(JSON.stringify(response));
    }
  } catch (error) {
    console.error('❌ 消息解析错误:', error);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket 错误:', error);
});

ws.on('close', (code, reason) => {
  console.log(`🔌 连接已关闭 (${code}): ${reason}`);
  process.exit(0);
});

// 5秒后自动关闭测试
setTimeout(() => {
  console.log('⏰ 测试完成，关闭连接...');
  ws.close();
}, 5000);

console.log('⏳ 等待连接结果... (5秒后自动关闭)');
