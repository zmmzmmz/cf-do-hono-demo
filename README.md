# 基于 Cloudflare Durable Object + WebSocket Hibernation 的远程设备控制系统

本项目实现了一个完整的远程设备控制解决方案，使用 Hono 框架和 Cloudflare Workers 技术栈。

## 🏗️ 系统架构

### 核心组件

1. **DeviceManager (Durable Object)**

   - 管理设备连接状态和 WebSocket 会话
   - 支持 WebSocket Hibernation 以节省资源
   - 处理设备注册、心跳和命令分发
   - 持久化设备信息和命令历史

2. **ControlCenter (Durable Object)**

   - 提供统一的控制接口
   - 支持单设备和批量设备操作
   - 命令路由和负载均衡

3. **Web 控制面板**

   - 实时显示设备状态
   - 发送单个或批量命令
   - 友好的用户界面

4. **设备客户端示例**
   - 自动重连机制
   - 心跳保活
   - 命令处理框架

### 技术特性

- ✅ **WebSocket Hibernation**: 降低资源消耗，支持大规模设备连接
- ✅ **自动重连**: 设备断线后自动重连
- ✅ **持久化存储**: 设备状态和命令历史持久化
- ✅ **批量操作**: 支持一次性控制多个设备
- ✅ **实时监控**: Web 面板实时显示设备状态
- ✅ **命令追踪**: 完整的命令执行状态追踪

## 🚀 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 本地开发

```bash
pnpm run dev
```

### 3. 部署到 Cloudflare

```bash
pnpm run deploy
```

### 4. 测试设备连接

安装 Node.js WebSocket 客户端依赖：

```bash
npm install ws
```

运行设备客户端：

```bash
node device-client.js \
  --id device-001 \
  --name "温湿度传感器" \
  --type sensor \
  --capabilities temperature,humidity,status \
  --url wss://your-worker.workers.dev/device/ws
```

## 📡 设备集成指南

### WebSocket 连接

设备需要连接到：`wss://your-worker.workers.dev/device/ws`

### 消息协议

#### 1. 设备注册

设备连接后需要发送注册消息：

```json
{
  "type": "register",
  "deviceInfo": {
    "id": "device-001",
    "name": "温湿度传感器",
    "type": "sensor",
    "capabilities": ["temperature", "humidity", "status"]
  }
}
```

#### 2. 心跳消息

定期发送心跳保持连接：

```json
{
  "type": "heartbeat",
  "deviceInfo": {
    "id": "device-001",
    "name": "温湿度传感器",
    "type": "sensor",
    "status": "online",
    "lastSeen": "2025-07-01T12:00:00.000Z",
    "capabilities": ["temperature", "humidity", "status"]
  }
}
```

#### 3. 命令响应

接收到命令后需要响应：

```json
{
  "type": "response",
  "commandId": "cmd-uuid-123",
  "success": true,
  "data": {
    "temperature": 23.5,
    "unit": "°C",
    "timestamp": "2025-07-01T12:00:00.000Z"
  }
}
```

#### 4. 接收命令

系统会发送以下格式的命令：

```json
{
  "type": "command",
  "commandId": "cmd-uuid-123",
  "action": "get_temperature",
  "params": {
    "unit": "celsius"
  }
}
```

## 🎛️ 控制面板使用

### 访问控制面板

部署后访问：`https://your-worker.workers.dev/`

### 主要功能

1. **设备状态监控**

   - 实时显示所有连接设备
   - 设备在线/离线状态
   - 最后连接时间

2. **单设备控制**

   - 输入设备 ID 和命令
   - 支持 JSON 格式参数
   - 实时反馈执行结果

3. **批量控制**
   - 同时控制多个设备
   - 逗号分隔设备 ID 列表
   - 统一命令和参数

## 🔌 API 接口

### 获取设备列表

```http
GET /api/devices
```

响应：

```json
[
  {
    "id": "device-001",
    "name": "温湿度传感器",
    "type": "sensor",
    "status": "online",
    "lastSeen": "2025-07-01T12:00:00.000Z",
    "capabilities": ["temperature", "humidity", "status"]
  }
]
```

### 发送单个命令

```http
POST /api/command
Content-Type: application/json

{
  "deviceId": "device-001",
  "action": "get_temperature",
  "params": {
    "unit": "celsius"
  }
}
```

响应：

```json
{
  "success": true,
  "commandId": "cmd-uuid-123"
}
```

### 发送批量命令

```http
POST /api/batch-command
Content-Type: application/json

{
  "deviceIds": ["device-001", "device-002"],
  "action": "restart",
  "params": {}
}
```

## 🛠️ 自定义扩展

### 添加新的命令类型

在 `device-client.js` 的 `handleCommand` 方法中添加新的 case：

```javascript
case 'custom_action':
  response.data = await performCustomAction(params);
  break;
```

### 扩展设备信息

修改 `src/types.ts` 中的 `DeviceInfo` 接口：

```typescript
export interface DeviceInfo {
  id: string;
  name: string;
  type: string;
  status: "online" | "offline";
  lastSeen: Date;
  capabilities: string[];
  // 添加自定义字段
  location?: string;
  firmware?: string;
  customData?: Record<string, any>;
}
```

### 自定义设备类型

可以继承 `DeviceClient` 类创建特定类型的设备：

```javascript
class TemperatureSensor extends DeviceClient {
  constructor(options) {
    super({
      ...options,
      type: "temperature_sensor",
      capabilities: ["temperature", "calibrate", "reset"],
    });
  }

  async handleCommand(commandMessage) {
    // 处理温度传感器特定的命令
    // ...
  }
}
```

## 🔧 配置说明

### Durable Object 配置

在 `wrangler.jsonc` 中配置：

```json
{
  "durable_objects": {
    "bindings": [
      {
        "name": "DEVICE_MANAGER",
        "class_name": "DeviceManager"
      },
      {
        "name": "CONTROL_CENTER",
        "class_name": "ControlCenter"
      }
    ]
  }
}
```

### 环境变量（可选）

```json
{
  "vars": {
    "MAX_DEVICES_PER_MANAGER": "1000",
    "HEARTBEAT_TIMEOUT": "60000",
    "COMMAND_TIMEOUT": "30000"
  }
}
```

## 📊 性能特性

- **WebSocket Hibernation**: 空闲连接自动休眠，节省资源
- **水平扩展**: 通过多个 DeviceManager 实例支持大规模设备
- **持久化**: 设备状态和命令历史持久保存
- **低延迟**: 边缘计算，全球低延迟访问

## 🐛 故障排除

### 设备无法连接

1. 检查 WebSocket URL 是否正确
2. 确认防火墙允许 WebSocket 连接
3. 查看浏览器开发者工具的网络选项卡

### 命令执行失败

1. 检查设备是否在线
2. 确认命令格式正确
3. 查看设备端日志输出

### 性能问题

1. 监控 Durable Object 的 CPU 使用率
2. 考虑将设备分布到多个 DeviceManager 实例
3. 优化心跳频率

## 📝 开发计划

- [ ] 添加设备认证和授权
- [ ] 实现设备分组管理
- [ ] 添加历史数据查询接口
- [ ] 支持设备固件远程更新
- [ ] 添加告警和通知系统
- [ ] 实现数据可视化图表

## 📄 许可证

MIT License

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```
