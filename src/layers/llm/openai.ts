import { Client } from "undici";
import {
  AttachType,
  LLMLayer,
  OpenAIMessage,
  Tool,
  ToolLayer,
} from "../../type";

export interface OpenAIResponse {
  id: string;
  object: "chat.completion";
  choices: {
    index: number;
    message: {
      role: "assistant" | "tool";
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

export class OpenAI extends LLMLayer<OpenAIMessage> {
  protected name: string = "OpenAI";
  messages: OpenAIMessage[] = [];
  #tools: ToolLayer[] = [];
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

  private getBody = () => {
    const tools = this.#tools.map((tool) => tool.tool.toTool?.());

    return {
      messages: this.messages,
      ...(tools?.length > 0 ? { tools: tools, tool_choice: "auto" } : {}),
      model: this.model,
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

  execute = async () => {
    const body = this.getBody();
    const request = await this.client.request({
      path: this.completionsPath,
      method: "POST",
      body: JSON.stringify(body),
      headers: this.getHeaders(),
    });

    try {
      const response = (await request.body.json()) as OpenAIResponse;
      if (request.statusCode !== 200) {
        return response;
      }
      const choice = response.choices[0];
      const finish_reason = choice.finish_reason;

      if (finish_reason === "tool_calls") {
        this.messages.push(choice.message);
        const tool_call = choice.message.tool_calls?.[0];
        if (!tool_call) {
          return;
        }
        const params = JSON.parse(tool_call.function.arguments);
        await this.tool(
          {
            id: tool_call.function.name,
            call_id: tool_call.id,
          },
          params
        );
        await this.execute();
        return;
      }

      this.messages.push(choice.message);
    } catch (error) {
      throw error;
    }
  };

  attach = (attachType: AttachType) => {
    if (attachType.key === "tools") {
      this.#tools.push(...attachType.value);
    }
  };
}
