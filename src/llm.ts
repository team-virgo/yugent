import { Layer, LLMLayer, LogMessage } from "./type";

export class LLM {
  private _layers: Layer<any>[] = [];

  set layers(layer: Layer<any> | Array<Layer<any>>) {
    if (Array.isArray(layer)) {
      this._layers.push(...layer);
      return;
    }
    this._layers.push(layer);
  }

  protected getLLMLayer() {
    const layers = this._layers.filter((layer) => layer.type === "llm");
    if (layers.length > 1) {
      throw new Error("LLMLayer should provided only once.");
    }

    if (layers.length === 0) {
      throw new Error("No LLM Layer provided");
    }

    return layers.at(0) as LLMLayer<any>;
  }

  async execute() {
    const llmLayer = this.getLLMLayer();
    const logLayers = this._layers.filter((layer) => layer.type === "log");
    const toolLayer = this._layers.filter((layer) => layer.type === "tool");

    const lastInput: LogMessage = { message: llmLayer.messages.at(-1)! };

    logLayers.forEach(async (layer) => layer.execute(lastInput));

    llmLayer.attach({ key: "tools", value: toolLayer });

    await llmLayer.execute();
  }
}
