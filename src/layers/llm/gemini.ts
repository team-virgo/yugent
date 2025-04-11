import { OpenAI } from "./openai";

export class Gemini extends OpenAI {
  protected _url: string = "https://generativelanguage.googleapis.com/";
  protected name: string = "Gemini";

  protected completionsPath: string = "/v1beta/openai/chat/completions";

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
