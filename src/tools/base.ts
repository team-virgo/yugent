import { Node, isInterfaceDeclaration, isPropertySignature } from "typescript";
import {
  generateAST,
  populatePropertyDescription,
  populatePropertyName,
  populatePropertyType,
} from "./util";
import { NodeCallback, NodeProperty, NodePropertyValue } from "../type";

const traverseNode = (source: Node, callback: NodeCallback) => {
  source.forEachChild((node) => {
    if (isInterfaceDeclaration(node)) {
      node.members.forEach((member) => callback(member, true));
      return;
    }
  });
};

export const generateProperties = (code: string) => {
  const { source: ast } = generateAST(code);

  const properties: NodeProperty = {};
  const createPropertyObject = (member: Node, push: boolean = true) => {
    if (!isPropertySignature(member)) {
      return;
    }
    const property = {} as NodePropertyValue;

    const name = populatePropertyName(member.name);
    populatePropertyDescription(member, property);
    populatePropertyType({ member: member.type, property });

    // Doc handling for description

    if (push) {
      properties[name] = property;
      // properties.push(property);
    }

    return property;
  };

  traverseNode(ast, createPropertyObject);
  return properties;
};

export interface Tool<P, R> {
  setProperty?: (key: string) => void;
  properties?: NodeProperty[];
  toTool?: () => any;
}

export abstract class Tool<P, R> {
  private _name: string | undefined;
  private _description: string | undefined;

  constructor(name?: string, description?: string) {
    this._name = name;
    this._description = description;
  }

  set name(value: string) {
    this._name = value;
  }

  set description(value: string) {
    this._description = this.description;
  }

  get name() {
    return this._name!;
  }

  get description() {
    return this._description!;
  }

  abstract handler(params: P): R | Promise<R>;
}

export const example = (value: string) => {
  const properties = generateProperties(value);

  return function (constructor: Function) {
    constructor.prototype.properties = properties;

    constructor.prototype.toTool = function () {
      const name = this.name;
      const description = this.description;
      const parameters = {
        type: "object",
        properties: properties,
      };

      return { type: "function", function: { name, description, parameters } };
    };
  };
};
