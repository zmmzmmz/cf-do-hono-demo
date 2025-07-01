import {
  DeviceInfo,
  Command,
  WebSocketMessage,
  CommandMessage,
  ResponseMessage,
  HeartbeatMessage,
  RegisterMessage,
} from "./types";

export class DeviceManager implements DurableObject {
  private state: DurableObjectState;
  private devices: Map<string, DeviceInfo> = new Map();
  private connections: Map<string, WebSocket> = new Map();
  private commands: Map<string, Command> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === "/websocket") {
      return this.handleWebSocket(request);
    }

    if (pathname === "/devices") {
      return this.handleDevicesAPI(request);
    }

    if (pathname === "/command") {
      return this.handleCommandAPI(request);
    }

    return new Response("Not found", { status: 404 });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const [client, server] = Object.values(new WebSocketPair());

    // 使用 WebSocket Hibernation 时，由 Durable Object 接受连接
    this.state.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async handleWebSocketMessage(
    ws: WebSocket,
    message: WebSocketMessage
  ) {
    switch (message.type) {
      case "register":
        await this.handleDeviceRegister(ws, message);
        break;
      case "heartbeat":
        await this.handleHeartbeat(ws, message);
        break;
      case "response":
        await this.handleCommandResponse(message);
        break;
      default:
        console.warn("Unknown message type:", message);
    }
  }

  private async handleDeviceRegister(ws: WebSocket, message: RegisterMessage) {
    const device: DeviceInfo = {
      ...message.deviceInfo,
      status: "online",
      lastSeen: new Date(),
    };

    this.devices.set(device.id, device);
    this.connections.set(device.id, ws);

    // 持久化设备信息
    await this.state.storage.put(`device:${device.id}`, device);

    // 发送注册成功确认
    ws.send(
      JSON.stringify({
        type: "register_ack",
        deviceId: device.id,
        success: true,
      })
    );

    console.log(`Device registered: ${device.id} (${device.name})`);
  }

  private async handleHeartbeat(ws: WebSocket, message: HeartbeatMessage) {
    const device = message.deviceInfo;
    device.status = "online";
    device.lastSeen = new Date();

    this.devices.set(device.id, device);
    this.connections.set(device.id, ws);

    // 更新持久化的设备信息
    await this.state.storage.put(`device:${device.id}`, device);
  }

  private async handleCommandResponse(message: ResponseMessage) {
    const command = this.commands.get(message.commandId);
    if (command) {
      command.status = message.success ? "completed" : "failed";
      command.response = message.data || message.error;

      // 更新持久化的命令状态
      await this.state.storage.put(`command:${command.id}`, command);

      console.log(`Command ${command.id} ${command.status}:`, command.response);
    }
  }

  private handleWebSocketClose(ws: WebSocket) {
    // 查找并移除断开连接的设备
    for (const [deviceId, connection] of this.connections.entries()) {
      if (connection === ws) {
        const device = this.devices.get(deviceId);
        if (device) {
          device.status = "offline";
          this.devices.set(deviceId, device);
          // 异步更新持久化状态
          this.state.storage.put(`device:${deviceId}`, device);
        }
        this.connections.delete(deviceId);
        console.log(`Device disconnected: ${deviceId}`);
        break;
      }
    }
  }

  private async handleDevicesAPI(request: Request): Promise<Response> {
    if (request.method === "GET") {
      // 从持久化存储加载设备信息
      await this.loadDevicesFromStorage();

      const deviceList = Array.from(this.devices.values());
      return new Response(JSON.stringify(deviceList), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405 });
  }

  private async handleCommandAPI(request: Request): Promise<Response> {
    if (request.method === "POST") {
      const { deviceId, action, params } = (await request.json()) as {
        deviceId: string;
        action: string;
        params?: Record<string, any>;
      };

      const command: Command = {
        id: crypto.randomUUID(),
        deviceId,
        action,
        params,
        timestamp: new Date(),
        status: "pending",
      };

      // 检查设备是否在线
      const device = this.devices.get(deviceId);
      console.log("device:", device);
      if (!device || device.status !== "online") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Device is offline or not found",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // 发送命令到设备
      const connection = this.connections.get(deviceId);
      if (connection) {
        const commandMessage: CommandMessage = {
          type: "command",
          commandId: command.id,
          action: command.action,
          params: command.params,
        };

        connection.send(JSON.stringify(commandMessage));
        command.status = "sent";
      }

      // 保存命令
      this.commands.set(command.id, command);
      await this.state.storage.put(`command:${command.id}`, command);

      return new Response(
        JSON.stringify({
          success: true,
          commandId: command.id,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response("Method not allowed", { status: 405 });
  }

  private async loadDevicesFromStorage() {
    const deviceKeys = await this.state.storage.list({ prefix: "device:" });
    for (const [key, device] of deviceKeys) {
      const deviceInfo = device as DeviceInfo;
      this.devices.set(deviceInfo.id, deviceInfo);
    }
  }

  // WebSocket Hibernation 支持
  async webSocketMessage(ws: WebSocket, message: string) {
    try {
      const parsedMessage: WebSocketMessage = JSON.parse(message);
      await this.handleWebSocketMessage(ws, parsedMessage);
    } catch (error) {
      console.error("Hibernation message parsing error:", error);
      ws.send(
        JSON.stringify({ type: "error", message: "Invalid message format" })
      );
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ) {
    this.handleWebSocketClose(ws);
  }

  // WebSocket 连接建立时的处理
  async webSocketError(ws: WebSocket, error: Error) {
    console.error("WebSocket error:", error);
  }
}
