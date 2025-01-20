import { Client } from "undici";
import {
  AttachType,
  LLMLayer,
  OpenAIMessage,
  Tool,
  ToolLayer,
} from "../../type";

interface Params {
  model: string;
  envKey: string;
}

interface OpenAIResponse {
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

export class OpenAI implements LLMLayer<OpenAIMessage>, Params {
  url: string = "https://api.openai.com/";
  name: string = "OpenAI";
  messages: OpenAIMessage[] = [];
  tools: ToolLayer[] = [];
  type = "llm" as const;

  model: string = "";
  envKey: string = "";

  private client: Client;

  constructor(model: string, envKey: string) {
    this.model = model;
    this.client = new Client(this.url, { connectTimeout: 60 * 1000 });
    this.envKey = envKey;
  }

  human = (input: string) => {
    this.messages.push({ content: input, role: "user" });
  };

  tool = async (tool: Tool, params: any) => {
    const toolToExecute = this.tools.find(
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

  getBody = () => {
    const tools = this.tools.map((tool) => tool.tool.toTool?.());

    return {
      messages: this.messages,
      ...(tools?.length > 0 ? { tools: tools, tool_choice: "auto" } : {}),
      model: this.model,
    };
  };

  execute = async () => {
    const body = this.getBody();
    const key = process.env[this.envKey] ?? "";
    const request = await this.client.request({
      path: "/v1/chat/completions",
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });

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
      this.tools.push(...attachType.value);
    }
  };
}
