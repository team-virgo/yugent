import { Client } from "undici";
import {
  AttachType,
  ExecuteOptions,
  LLMLayer,
  OpenAIMessage,
  Tool,
  ToolLayer,
} from "../../type";
import { PassThrough, Readable } from "node:stream";

export type Role = "assistant" | "user" | "system" | "tool" | "tool_call";

export interface OpenAIResponse {
  id: string;
  object: "chat.completion";
  choices: {
    index: number;
    message: {
      role: Role;
      content:
        | null
        | string
        | {
            type: "text";
            text: string;
          };
      tool_calls?: {
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }[];
      refusal?: any;
    };
    finish_reason: "stop" | "tool_calls" | "content_filter" | "length";
  }[];
}

export interface OpenAIMessageChunk {
  id: string;
  created: number;
  model?: string;
  system_fingerprint: string;
  object: "chat.completion.chunk";
  usage?: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
  choices: {
    delta: {
      content?: string;
      role: Role;
      tool_calls?: {
        index: number;
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      };
    };
    index: number;
    finish_reason?: "stop" | "length" | "content_filter" | "tool_calls";
  }[];
}

export class OpenAI extends LLMLayer<OpenAIMessage> {
  protected name: string = "OpenAI";
  messages: OpenAIMessage[] = [];
  #tools: ToolLayer[] = [];
  #toolsJson: string[] = [];
  type = "llm" as const;

  private _model: string = "";
  protected envKey: string = "";
  protected completionsPath = "/v1/chat/completions";

  protected _client: Client | null = null;

  get url() {
    return "https://api.openai.com";
  }

  public get model() {
    return this._model;
  }

  public set model(_model: string) {
    this._model = _model;
  }

  constructor(model: string, envKey: string) {
    super();
    this._model = model;
    this.envKey = envKey;
  }

  get client() {
    this._client = new Client(this.url, { connectTimeout: 60 * 1000 });
    return this._client;
  }

  public human = (input: string) => {
    this.messages.push({ content: input, role: "user" });
  };

  protected tool = async (tool: Tool, params: any) => {
    const toolToExecute = this.#tools.find(
      (_tool) => tool.id === _tool.id || tool.id === _tool.tool.name
    );

    if (!toolToExecute) {
      throw new Error("Passed tool doesn't exist");
    }

    const result = await toolToExecute.tool.handler(params);

    this.messages.push({
      role: "tool",
      tool_call_id: tool.call_id,
      content: typeof result === "object" ? JSON.stringify(result) : result,
    });
  };

  private getBody = (stream?: boolean) => {
    const tools = this.#tools.map((tool) => tool.tool.toTool?.());
    const toolJson = this.#toolsJson
      .map((json) => {
        try {
          JSON.parse(json);
        } catch (error) {
          return false;
        }
      })
      .filter(Boolean);

    tools.push(...(toolJson ?? []));

    return {
      messages: this.messages,
      ...(tools?.length > 0 ? { tools: tools, tool_choice: "auto" } : {}),
      model: this.model,
      ...(typeof stream === "boolean" && { stream }),
    };
  };

  protected getHeaders(): Record<string, string> {
    const key = process.env[this.envKey] ?? "";
    const headers = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
    return headers;
  }

  transformToJSON = () => {
    let message = { content: "" } as Record<string, unknown>;
    const llmInstance = this;
    let fullLine = "";
    return function (rawChunk: string) {
      // Generate Lines.
      const lines = rawChunk.split("\n");
      for (const line of lines) {
        if (!line || line.trim().length === 0) {
          continue;
        }
        const _chunk = line.replace("data:", "").trim();

        // End the stream and push the message
        if (_chunk === "[DONE]") {
          llmInstance.messages.push(message as any);
          return;
        }

        try {
          // Try appending the chunk and then try parsing it, multiple chunks should make the JSON.
          if (fullLine.length > 0) {
            fullLine += _chunk;
          } else {
            fullLine = _chunk;
          }
          const chunk = JSON.parse(fullLine) as OpenAIMessageChunk;
          fullLine = "";
          const chunkData = chunk.choices ?? [];
          chunkData.forEach((item) => {
            if (item.delta.content) {
              message.content += item.delta.content;
            }
            if (item.delta.tool_calls) {
              message.tool_calls = item.delta.tool_calls;
            }
            if (item.delta.role) {
              message.role = item.delta.role;
            }
          });
        } catch (error) {
          // fullLine += _chunk;
        }
      }
    };
  };

  execute = async (options?: ExecuteOptions) => {
    const { stream, autoToolCall = true, streamer } = options ?? {};
    const body = this.getBody(stream);

    if (stream) {
      const transformer = this.transformToJSON();
      await this.client.stream(
        {
          path: this.completionsPath,
          method: "POST",
          body: JSON.stringify(body),
          headers: this.getHeaders(),
          signal: options?.signal,
        },
        ({ statusCode, headers }) => {
          if (statusCode !== 200) {
            streamer?.end("Invalid request");
          }

          return new PassThrough({
            transform: function (chunk, _, cb) {
              try {
                const decoded = chunk.toString();
                transformer(decoded);
                if (streamer) {
                  streamer.write(decoded);
                }
                cb();
              } catch (error) {
                streamer?.end(error);
                this.end();
              }
            },
            final: () => {
              streamer?.end();
            },
          });
        }
      );
    }

    const request = await this.client.request({
      path: this.completionsPath,
      method: "POST",
      body: JSON.stringify(body),
      headers: this.getHeaders(),
      signal: options?.signal,
    });

    if (request.statusCode !== 200) {
      const errorText = await request.body.text();
      throw new Error(errorText);
    }
    try {
      const response = (await request.body.json()) as OpenAIResponse;
      const choice = response.choices[0];
      const finish_reason = choice.finish_reason;

      if (finish_reason === "tool_calls") {
        this.messages.push(choice.message);
        const tool_call = choice.message.tool_calls?.[0];
        if (!tool_call) {
          return;
        }
        // Only execute if `autoToolCall` presents.
        if (autoToolCall) {
          const params = JSON.parse(tool_call.function.arguments);
          await this.tool(
            {
              id: tool_call.function.name,
              call_id: tool_call.id,
            },
            params
          );
          await this.execute({ autoToolCall: false, stream: stream });
        }
        return;
      }

      this.messages.push(choice.message);
    } catch (error) {
      throw error;
    }
  };

  attach = (attachType: AttachType) => {
    if (attachType.key === "tools") {
      if (attachType.json) {
        this.#toolsJson.push(attachType.json);
      } else {
        this.#tools.push(...(attachType.value ?? []));
      }
    }
  };
}
