import { OpenAI } from "./openai";

export class Groq extends OpenAI {
  protected _url: string = "https://api.groq.com/";
  protected name: string = "Mistral";

  protected completionsPath: string = "/openai/v1/chat/completions";

  get url() {
    return this._url;
  }

  set url(_url) {
    this._url = _url;
  }

  updateEnv(envKey: string) {
    this.envKey = envKey;
  }

  protected getHeaders(): Record<string, string> {
    const key = process.env[this.envKey] ?? "";
    const headers = {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    };

    return headers;
  }
}
