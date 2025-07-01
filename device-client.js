#!/usr/bin/env node

/**
 * 设备端示例代码
 * 演示如何连接到远程控制中心
 * 
 * 运行方式：
 * node device-client.js --id device-001 --name "测试传感器" --url wss://your-worker.workers.dev/device/ws
 */

const WebSocket = require('ws');

class DeviceClient {
  constructor(options) {
    this.deviceInfo = {
      id: options.id || `device-${Date.now()}`,
      name: options.name || '未命名设备',
      type: options.type || 'generic',
      capabilities: options.capabilities || ['status']
    };
    this.serverUrl = options.url;
    this.ws = null;
    this.reconnectInterval = 5000; // 5秒重连
    this.heartbeatInterval = 30000; // 30秒心跳
    this.heartbeatTimer = null;
  }

  connect() {
    console.log(`正在连接到控制中心: ${this.serverUrl}`);

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.on('open', () => {
        console.log('✅ 已连接到控制中心');
        this.register();
        this.startHeartbeat();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('消息解析错误:', error);
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log(`❌ 连接已断开 (${code}): ${reason}`);
        this.stopHeartbeat();
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket 错误:', error);
      });

    } catch (error) {
      console.error('连接失败:', error);
      this.scheduleReconnect();
    }
  }

  register() {
    const registerMessage = {
      type: 'register',
      deviceInfo: this.deviceInfo
    };

    this.send(registerMessage);
    console.log(`📝 已发送注册信息: ${this.deviceInfo.name} (${this.deviceInfo.id})`);
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      const heartbeatMessage = {
        type: 'heartbeat',
        deviceInfo: {
          ...this.deviceInfo,
          status: 'online',
          lastSeen: new Date()
        }
      };
      this.send(heartbeatMessage);
      console.log('💓 发送心跳');
    }, this.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  scheduleReconnect() {
    setTimeout(() => {
      console.log('🔄 尝试重新连接...');
      this.connect();
    }, this.reconnectInterval);
  }

  handleMessage(message) {
    console.log('📨 收到消息:', message);

    switch (message.type) {
      case 'register_ack':
        console.log('✅ 注册成功');
        break;

      case 'command':
        this.handleCommand(message);
        break;

      case 'error':
        console.error('❌ 服务器错误:', message.message);
        break;

      default:
        console.log('❓ 未知消息类型:', message.type);
    }
  }

  async handleCommand(commandMessage) {
    const { commandId, action, params } = commandMessage;
    console.log(`🎯 执行命令: ${action}`, params);

    let response = {
      type: 'response',
      commandId,
      success: true,
      data: null
    };

    try {
      // 模拟不同的命令处理
      switch (action) {
        case 'get_status':
          response.data = {
            status: 'online',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString()
          };
          break;

        case 'get_temperature':
          // 模拟温度传感器
          response.data = {
            temperature: (20 + Math.random() * 10).toFixed(1),
            unit: '°C',
            timestamp: new Date().toISOString()
          };
          break;

        case 'get_humidity':
          // 模拟湿度传感器
          response.data = {
            humidity: (40 + Math.random() * 40).toFixed(1),
            unit: '%',
            timestamp: new Date().toISOString()
          };
          break;

        case 'restart':
          response.data = { message: '设备将在3秒后重启' };
          setTimeout(() => {
            console.log('🔄 模拟设备重启...');
            process.exit(0);
          }, 3000);
          break;

        case 'update_config':
          response.data = {
            message: '配置已更新',
            newConfig: params
          };
          break;

        default:
          response.success = false;
          response.error = `不支持的命令: ${action}`;
      }

    } catch (error) {
      console.error('命令执行错误:', error);
      response.success = false;
      response.error = error.message;
    }

    // 模拟处理延迟
    await new Promise(resolve => setTimeout(resolve, 1000));

    this.send(response);
    console.log(`✅ 命令执行${response.success ? '成功' : '失败'}: ${action}`);
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('⚠️  WebSocket 未连接，无法发送消息');
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
    }
  }
}

// 命令行参数解析
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    options[key] = value;
  }

  return options;
}

// 主函数
async function main() {
  const options = parseArgs();

  if (!options.url) {
    console.error('请提供服务器URL: --url wss://your-worker.workers.dev/device/ws');
    process.exit(1);
  }

  // 创建设备客户端
  const client = new DeviceClient({
    id: options.id,
    name: options.name,
    type: options.type || 'sensor',
    capabilities: options.capabilities ? options.capabilities.split(',') : ['status', 'temperature', 'humidity'],
    url: options.url
  });

  // 优雅关闭处理
  process.on('SIGINT', () => {
    console.log('\n🛑 正在关闭设备客户端...');
    client.disconnect();
    process.exit(0);
  });

  // 启动连接
  client.connect();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DeviceClient;
