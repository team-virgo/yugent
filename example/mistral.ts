import { LLM } from "../src";
import { Mistral } from "../src/layers/llm";
import { Weather } from "../src/layers/tools";
import { LocalLog } from "../src/layers/log";

import "dotenv/config";

const llm = new LLM();
const mistral = new Mistral("mistral-small-latest", "MISTRAL_API_KEY");
const log = new LocalLog();

const weather_tool = new Weather("WEATHER_API_KEY");
llm.layers = [mistral, log, weather_tool];

mistral.human("What is weather in California now?");

const main = async () => {
  await llm.execute();

  console.log(mistral.messages.at(-1)?.content);

  mistral.url = "https://codestral.mistral.ai/";

  mistral.updateEnv("MISTRAL_CODESTRAL_API_KEY");

  mistral.model = "codestral-latest";

  mistral.human("Write a rust program for finding the n prime numbers");

  await llm.execute();
  console.log(mistral.messages.at(-1)?.content);
};

await main();
