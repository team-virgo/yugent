import { example, Tool } from "../../../tools";
import * as fs from "fs";
import { ToolLayer } from "../../../type";
interface ReadFileInput {
  path: string;
}

interface ReadFileOutput {
  content: string;
}

@example(`
    interface ReadFile {
      /**
       * Absolute path of the file to read.
       */
      path: string
    }
  `)
export class ReadFileTool extends Tool<ReadFileInput, ReadFileOutput> {
  constructor() {
    super("read_file", "Reads and returns the content of a file.");
  }
  async handler(params: ReadFileInput): Promise<ReadFileOutput> {
    const fileExists = fs.existsSync(params.path);
    if (!fileExists) {
      return { content: "" };
    }

    return { content: fs.readFileSync(params.path, "utf-8") };
  }
}

export class ReadFile implements ToolLayer {
  id = "read_file";
  type = "tool" as const;

  tool: Tool<any, any>;
  constructor() {
    this.tool = new ReadFileTool();
  }
}
