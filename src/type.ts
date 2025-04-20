type TSNode = import("typescript").Node;
export type NodeCallback = (node: TSNode, push?: boolean) => void;

export interface ArrayType {
  type: "array";
  items: NodeProperty | NodePropertyValue;
  description?: string;
}

export interface ObjectType {
  type: "object";
  properties: NodeProperty;
  required?: string[];
  description?: string;
}

export interface LiteralType<T> {
  type: T;
  description?: string;
}

export type NodePropertyValue =
  | ArrayType
  | ObjectType
  | LiteralType<string>
  | LiteralType<boolean>
  | LiteralType<number>;

export type NodeProperty = Record<string, NodePropertyValue>;

export interface ToolType {
  type: "function";
  description: string;
  parameters: NodeProperty;
}

export interface LayerType<T extends "llm" | "log" | "tool" | "execute"> {
  type: T;
}

export interface OpenAIMessage {
  role: "user" | "assistant" | "system" | "tool" | "tool_call";
  tool_call_id?: string;
  content:
    | null
    | string
    | {
        type: "text";
        text: string;
      };
}

export interface OpenAIPayload {
  model: string;
  response_format?: {
    type: "json_schema";
    json_schema: unknown;
  };
  messages: OpenAIMessage[];
}

export interface Tool {
  id: string;
  call_id: string;
}

export type ToolBase = import("./tools/base").Tool<any, any>;

export type AttachType =
  | { key: "tools"; value?: ToolLayer[]; json?: string }
  | { key: "messages"; value: OpenAIMessage[] }
  | { key: "client"; value: import("undici").Client };

export abstract class LLMLayer<Message> implements LayerType<"llm"> {
  type = "llm" as const;
  protected abstract set url(_url: string);
  protected abstract get url();

  abstract set model(model: string);
  abstract get model();

  protected abstract name: string;
  abstract messages: Message[] | OpenAIMessage[];
  public abstract human: (input: string) => void;
  protected abstract tool: (tool: Tool, params: any) => Promise<void>;
  abstract execute: (options?: ExecuteOptions) => Promise<void | ErrorResponse>;

  protected abstract getHeaders(): Record<string, string>;

  abstract attach: (attachType: AttachType) => void;
}

export interface ToolLayer extends LayerType<"tool"> {
  tool: ToolBase;
  id: string;
}

export interface LogMessage {
  message: OpenAIMessage;
}

export interface DBLogger extends BaseLogger {
  connector: "db";
  db: {
    type: "mysql" | "sqlite" | "clickhouse" | "duckdb";
    connection:
      | string
      | {
          host: string;
          port: string | number;
          username: string;
          password: string;
        };
    database: string;
  };
}

export interface HTTPLogger extends BaseLogger {
  connector: "http";
  url: {
    endpoint: string;
    // Headers to pass, if string passed as `Authorization` header, not headers are mapped.
    auth: string | Record<string, string>;
  };
}

export interface LocalLogger extends BaseLogger {
  connector: "local";
}

export interface BaseLogger {
  type: "log";
  execute: (message: LogMessage) => Promise<void>;
}

type LogLayer = LocalLogger | HTTPLogger | DBLogger;

export type Layer<T extends Record<string, unknown>> =
  | LLMLayer<T>
  | LogLayer
  | ToolLayer;

export type ErrorResponse = any;

export type ExecuteOptions = {
  autoToolCall?: boolean;
  stream?: boolean;
  streamer?: import("stream").Writable;
  signal?: AbortSignal;
};
