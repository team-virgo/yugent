import { LLM } from "yugent";
import { OpenAI } from "yugent/llm";
import { Weather } from "yugent/tools";
import { LocalLog } from "yugent/log";

import "dotenv/config";

const llm = new LLM();
const openai = new OpenAI("gpt-4o", "OPEN_AI_KEY");
const log = new LocalLog();

const weather_tool = new Weather("WEATHER_API_KEY");
llm.layers = [openai, log, weather_tool];

openai.human("What is weather in banglore now?");

llm.execute().then(() => {
  const response = openai.messages.at(-1);
  console.log(response.content);
});
