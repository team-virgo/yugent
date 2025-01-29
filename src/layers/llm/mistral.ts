import { OpenAI } from "./openai";

export class Mistral extends OpenAI {
  protected _url: string = "https://api.mistral.ai/";
  protected name: string = "Mistral";

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
