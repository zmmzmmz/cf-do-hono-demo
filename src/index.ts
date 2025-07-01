import { Hono } from "hono";
import { DeviceManager } from "./device-manager";
import { ControlCenter } from "./control-center";
import { CloudflareBindings } from "./types";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// 主页面 - 提供控制面板
app.get("/", (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>远程设备控制中心</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .container { max-width: 1200px; margin: 0 auto; }
            .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
            .device { padding: 10px; margin: 5px 0; border: 1px solid #ccc; border-radius: 3px; }
            .online { background-color: #e8f5e8; }
            .offline { background-color: #f5e8e8; }
            button { padding: 8px 16px; margin: 5px; border: none; border-radius: 3px; cursor: pointer; }
            .btn-primary { background-color: #007bff; color: white; }
            .btn-danger { background-color: #dc3545; color: white; }
            .btn-success { background-color: #28a745; color: white; }
            input, select { padding: 8px; margin: 5px; border: 1px solid #ddd; border-radius: 3px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>远程设备控制中心</h1>
            
            <div class="section">
                <h2>设备连接指南</h2>
                <p>设备 WebSocket 连接地址: <code>wss://your-worker-domain.workers.dev/device/ws</code></p>
                <p>设备需要发送注册消息:</p>
                <pre>{
  "type": "register",
  "deviceInfo": {
    "id": "device-001",
    "name": "测试设备",
    "type": "sensor",
    "capabilities": ["temperature", "humidity"]
  }
}</pre>
            </div>

            <div class="section">
                <h2>在线设备</h2>
                <div id="devices">
                    <p>正在加载设备列表...</p>
                </div>
                <button onclick="refreshDevices()" class="btn-primary">刷新设备列表</button>
            </div>

            <div class="section">
                <h2>发送命令</h2>
                <div>
                    <input type="text" id="deviceId" placeholder="设备ID" />
                    <input type="text" id="action" placeholder="动作 (如: get_temperature)" />
                    <input type="text" id="params" placeholder="参数 (JSON格式)" />
                    <button onclick="sendCommand()" class="btn-success">发送命令</button>
                </div>
            </div>

            <div class="section">
                <h2>批量命令</h2>
                <div>
                    <input type="text" id="batchDeviceIds" placeholder="设备ID列表(逗号分隔)" />
                    <input type="text" id="batchAction" placeholder="批量动作" />
                    <input type="text" id="batchParams" placeholder="批量参数 (JSON格式)" />
                    <button onclick="sendBatchCommand()" class="btn-success">发送批量命令</button>
                </div>
            </div>
        </div>

        <script>
            async function refreshDevices() {
                try {
                    const response = await fetch('/api/devices');
                    const devices = await response.json();
                    const devicesDiv = document.getElementById('devices');
                    
                    if (devices.length === 0) {
                        devicesDiv.innerHTML = '<p>暂无在线设备</p>';
                        return;
                    }
                    
                    devicesDiv.innerHTML = devices.map(device => \`
                        <div class="device \${device.status}">
                            <strong>\${device.name}</strong> (ID: \${device.id})
                            <br>类型: \${device.type} | 状态: \${device.status}
                            <br>功能: \${device.capabilities.join(', ')}
                            <br>最后连接: \${new Date(device.lastSeen).toLocaleString()}
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Error fetching devices:', error);
                    document.getElementById('devices').innerHTML = '<p>加载设备列表失败</p>';
                }
            }

            async function sendCommand() {
                const deviceId = document.getElementById('deviceId').value;
                const action = document.getElementById('action').value;
                const paramsStr = document.getElementById('params').value;
                
                if (!deviceId || !action) {
                    alert('请填写设备ID和动作');
                    return;
                }
                
                let params = {};
                if (paramsStr) {
                    try {
                        params = JSON.parse(paramsStr);
                    } catch (e) {
                        alert('参数格式错误，请使用JSON格式');
                        return;
                    }
                }
                
                try {
                    const response = await fetch('/api/command', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ deviceId, action, params })
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        alert(\`命令已发送，命令ID: \${result.commandId}\`);
                    } else {
                        alert(\`发送失败: \${result.error}\`);
                    }
                } catch (error) {
                    alert('发送命令失败');
                }
            }

            async function sendBatchCommand() {
                const deviceIdsStr = document.getElementById('batchDeviceIds').value;
                const action = document.getElementById('batchAction').value;
                const paramsStr = document.getElementById('batchParams').value;
                
                if (!deviceIdsStr || !action) {
                    alert('请填写设备ID列表和动作');
                    return;
                }
                
                const deviceIds = deviceIdsStr.split(',').map(id => id.trim());
                let params = {};
                if (paramsStr) {
                    try {
                        params = JSON.parse(paramsStr);
                    } catch (e) {
                        alert('参数格式错误，请使用JSON格式');
                        return;
                    }
                }
                
                try {
                    const response = await fetch('/api/batch-command', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ deviceIds, action, params })
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        alert(\`批量命令已发送到 \${result.results.length} 个设备\`);
                    } else {
                        alert('批量命令发送失败');
                    }
                } catch (error) {
                    alert('发送批量命令失败');
                }
            }

            // 页面加载时获取设备列表
            refreshDevices();
            
            // 每30秒自动刷新设备列表
            setInterval(refreshDevices, 30000);
        </script>
    </body>
    </html>
  `);
});

// 设备 WebSocket 连接路由
app.get("/device/ws", async (c) => {
  const deviceManagerId = c.env.DEVICE_MANAGER.idFromName("global");
  const deviceManager = c.env.DEVICE_MANAGER.get(deviceManagerId);

  // 创建新的请求，指向 websocket 端点
  const url = new URL(c.req.url);
  url.pathname = "/websocket";
  const newRequest = new Request(url.toString(), c.req.raw);

  return deviceManager.fetch(newRequest);
});

// API 路由 - 获取设备列表
app.get("/api/devices", async (c) => {
  const deviceManagerId = c.env.DEVICE_MANAGER.idFromName("global");
  const deviceManager = c.env.DEVICE_MANAGER.get(deviceManagerId);

  const url = new URL(c.req.url);
  url.pathname = "/devices";
  const newRequest = new Request(url.toString(), c.req.raw);

  return deviceManager.fetch(newRequest);
});

// API 路由 - 发送单个命令
app.post("/api/command", async (c) => {
  const deviceManagerId = c.env.DEVICE_MANAGER.idFromName("global");
  const deviceManager = c.env.DEVICE_MANAGER.get(deviceManagerId);

  const url = new URL(c.req.url);
  url.pathname = "/command";
  const newRequest = new Request(url.toString(), c.req.raw);

  return deviceManager.fetch(newRequest);
});

// API 路由 - 发送批量命令
app.post("/api/batch-command", async (c) => {
  const controlCenterId = c.env.CONTROL_CENTER.idFromName("global");
  const controlCenter = c.env.CONTROL_CENTER.get(controlCenterId);

  const url = new URL(c.req.url);
  url.pathname = "/control/batch-command";
  const newRequest = new Request(url.toString(), c.req.raw);

  return controlCenter.fetch(newRequest);
});

// 导出 Durable Object 类
export { DeviceManager, ControlCenter };

export default app;
