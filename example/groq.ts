import { LLM } from "../src";
import { Groq } from "../src/layers/llm";
import { Weather } from "../src/layers/tools";
import { LocalLog } from "../src/layers/log";

import "dotenv/config";

const llm = new LLM();
const mistral = new Groq("gemma2-9b-it", "GROQ_API_KEY");
const log = new LocalLog();

const weather_tool = new Weather("WEATHER_API_KEY");
llm.layers = [mistral, log, weather_tool];

mistral.human("What is the weather in Bangalore now?");

const main = async () => {
  await llm.execute();

  console.log(mistral.messages.at(-1)?.content);
  await llm.execute();
};

await main();
