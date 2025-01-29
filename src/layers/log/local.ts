import { LocalLogger, LogMessage } from "../../type";

export class LocalLog implements LocalLogger {
  type = "log" as const;
  connector = "local" as const;
  execute = async (input: LogMessage) => {};
}
