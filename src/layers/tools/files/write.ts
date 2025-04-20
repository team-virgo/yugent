import { example, Tool } from "../../../tools";
import * as fs from "fs";
import { ToolLayer } from "../../../type";

interface WriteFileInput {
  path: string;
  overwrite?: boolean;
  content: string;
}

interface WriteFileOutput {
  success: boolean;
  content: string;
}

@example(`
    interface ReadFile {
      /**
       * Absolute path of the file to read.
       */
      path: string
      /**
       * Should overwrite the contents of the file.
       */
      overwrite?: boolean
      /**
       * Content to write into file
       */
      content: string
    }
  `)
export class WriteFileTool extends Tool<WriteFileInput, WriteFileOutput> {
  async handler(params: WriteFileInput): Promise<WriteFileOutput> {
    if (params.overwrite) {
      fs.writeFileSync(params.path, params.content);
    } else {
      fs.appendFileSync(params.path, params.content);
    }

    return {
      success: true,
      content: fs.readFileSync(params.path, { encoding: "utf-8" }),
    };
  }
}

export class WriteFile implements ToolLayer {
  id = "write_file";
  type = "tool" as const;

  tool: Tool<any, any>;
  constructor(envKey: string) {
    this.tool = new WriteFileTool();
  }
}
