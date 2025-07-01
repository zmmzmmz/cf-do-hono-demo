export interface CloudflareBindings {
  DEVICE_MANAGER: DurableObjectNamespace;
  CONTROL_CENTER: DurableObjectNamespace;
}

export interface DeviceInfo {
  id: string;
  name: string;
  type: string;
  status: "online" | "offline";
  lastSeen: Date;
  capabilities: string[];
}

export interface Command {
  id: string;
  deviceId: string;
  action: string;
  params?: Record<string, any>;
  timestamp: Date;
  status: "pending" | "sent" | "completed" | "failed";
  response?: any;
}

export interface CommandMessage {
  type: "command";
  commandId: string;
  action: string;
  params?: Record<string, any>;
}

export interface ResponseMessage {
  type: "response";
  commandId: string;
  success: boolean;
  data?: any;
  error?: string;
}

export interface HeartbeatMessage {
  type: "heartbeat";
  deviceInfo: DeviceInfo;
}

export interface RegisterMessage {
  type: "register";
  deviceInfo: Omit<DeviceInfo, "status" | "lastSeen">;
}

export type WebSocketMessage =
  | CommandMessage
  | ResponseMessage
  | HeartbeatMessage
  | RegisterMessage;
