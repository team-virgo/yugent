### Creating a Tool

```typescript
import { example, ToolBase } from "yugent";

@example(`
    interface Input {
      /**
       * city to get the weather for
       */
      city: string;
    }
`)
class WeatherTool extends ToolBase<{ city: string }, { temperature: string }> {
  constructor() {
    super("get_weather", "Returns weather info for given city");
  }

  async handler(params: { city: string }): Promise<{ temperature: string }> {
    // Handle API to fetch temp.
    return { temperature: "16.7 C" };
  }
}
```

### Creating a logger layer

> Local Logger

```typescript
import { LocalLogger, LogMessage } from "yugent";

export class LocalLog implements LocalLogger<"local"> {
  type = "log" as const;
  connector = "local" as const;
  execute = async (input: LogMessage) => {
    // Handler the logging part here.
    console.log(input, "input");
  };
}
```

> HTTP Logger

```typescript
import { Client } from "undici";
import { HTTPLogger, LogMessage } from "yugent";

export class DiscordLog implements HTTPLogger {
  url: { endpoint: string; auth: string | Record<string, string> } = {
    endpoint: "https://discord.gg/",
    auth: "bearer auth",
  };
  type = "log" as const;
  connector = "http" as const;

  client: Client;

  constructor() {
    this.client = new Client(this.url.endpoint);
  }

  execute = async (input: LogMessage) => {
    const auth = this.url.auth;
    let headers = {};
    if (typeof auth === "string") {
      headers["Authorization"] = auth;
    } else {
      headers = { ...auth };
    }
    await this.client.request({
      method: "POST",
      path: "/webhook",
      body: JSON.stringify(input.message),
      headers,
    });
  };
}
```

### Creating a tool layer

```typescript
export class Weather implements ToolLayer {
  tool: Tool<any, any>;
  id = "get_weather";
  type = "tool" as const;

  constructor(apiKey: string) {
    this.tool = new WeatherTool(apiKey);
  }
}
```

### Combining Layers and running agent.

```typescript
import { LLM } from "yugent";
import { OpenAI } from "yugent/llm";
import { WeatherTool } from "yugent/tools";
import { LocalLog } from "yugent/log";

// Create a top-level LLM class
const llm = new LLM();

/**
 * @param {String} model
 * @param {String} envKey - key to look for in `process.env`.
 */
const openai = new OpenAI("gpt-4o", "API_KEY"); // LLM class to communicate.
// `weather_api_key` should be present in `process.env`
const weather = new WeatherTool("weather_api_key"); // Tool
const local_log = new LocalLog(); // Log the body to local.
llm.layers = [openai, weather, local_log]; // Add layers to the llm class

openai.human("What is the current weather in banglore?"); // Ask a question to trigger tool

llm.execute().then(() => {
  // Execute the LLM request with last `human` message.
  const finalResponse = openai.messages.at(-1);
  console.log("OpenAI: ", finalResponse?.content);
});
```

### Demo

<img width="715" alt="Screenshot 2025-01-21 at 3 49 15 AM" src="https://github.com/user-attachments/assets/14283331-07d2-4f5d-9c6c-ec1688ebe96a" />

