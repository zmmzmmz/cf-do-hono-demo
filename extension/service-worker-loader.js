// 全局 DeviceClient 实例
let deviceClient = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('CRAWL_TASK_STATUS_ALARM', {
    periodInMinutes: 2,
  });

  // 创建并启动 DeviceClient
  initializeDeviceClient();

  console.log("Service worker installed");
});

// 初始化 DeviceClient
function initializeDeviceClient() {
  // 从存储中获取设备配置，或使用默认配置
  chrome.storage.local.get(['deviceConfig'], (result) => {
    const config = result?.deviceConfig || {
      id: `browser-device-${Date.now()}`,
      name: '浏览器设备',
      type: 'browser-extension',
      capabilities: ['status', 'get_temperature', 'get_humidity'],
      url: 'ws://localhost:8787/device/ws' // 默认 WebSocket URL
    };

    deviceClient = new DeviceClient(config);
    deviceClient.connect();

    console.log('DeviceClient 已初始化并开始连接');
  });
}

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

      this.ws.onopen = () => {
        console.log('✅ 已连接到控制中心');
        this.register();
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('消息解析错误:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log(`❌ 连接已断开 (${event.code}): ${event.reason}`);
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket 错误:', error);
      };

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
            uptime: Date.now() - chrome.runtime.getManifest().version_name,
            memory: 'N/A (Browser Environment)',
            userAgent: navigator.userAgent,
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
          response.data = { message: '设备将在3秒后重新连接' };
          setTimeout(() => {
            console.log('🔄 模拟设备重新连接...');
            this.disconnect();
            setTimeout(() => this.connect(), 1000);
          }, 3000);
          break;

        case 'update_config':
          response.data = {
            message: '配置已更新',
            newConfig: params
          };
          break;

        case 'open_side':
          chrome.sidePanel.open({
            tabId: 1
          })
          break
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

// chrome.alarms 监听器 - 保持设备在线状态
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log('Alarm triggered:', alarm.name);

  if (alarm.name === 'CRAWL_TASK_STATUS_ALARM') {
    // 检查 DeviceClient 状态并确保保持连接
    ensureDeviceClientOnline();
  }
});

// 确保 DeviceClient 保持在线
function ensureDeviceClientOnline() {
  if (!deviceClient) {
    console.log('DeviceClient 不存在，重新初始化...');
    initializeDeviceClient();
    return;
  }

  // 检查 WebSocket 连接状态
  if (!deviceClient.ws || deviceClient.ws.readyState !== WebSocket.OPEN) {
    console.log('WebSocket 连接已断开，尝试重新连接...');
    deviceClient.connect();
  } else {
    console.log('DeviceClient 状态正常');
  }
}

// Service Worker 启动时也要初始化（处理重启情况）
chrome.runtime.onStartup.addListener(() => {
  console.log('Service worker started');
  initializeDeviceClient();
});

// 保存设备配置到存储
function saveDeviceConfig(config) {
  chrome.storage.local.set({ deviceConfig: config }, () => {
    console.log('设备配置已保存');
  });
}

// 处理来自 popup 或其他页面的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ping') {
    ensureDeviceClientOnline();
    sendResponse({ status: 'pong' });
  } else if (message.type === 'get_device_status') {
    const status = {
      connected: deviceClient && deviceClient.ws && deviceClient.ws.readyState === WebSocket.OPEN,
      deviceInfo: deviceClient ? deviceClient.deviceInfo : null
    };
    sendResponse(status);
  } else if (message.type === 'update_device_config') {
    // 更新设备配置并重新连接
    saveDeviceConfig(message.config);
    if (deviceClient) {
      deviceClient.disconnect();
    }
    setTimeout(() => {
      initializeDeviceClient();
    }, 1000);
    sendResponse({ success: true });
  }
  return true; // 保持消息通道开放
});