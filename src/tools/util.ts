import { randomUUID } from "node:crypto";
import {
  Node,
  isPropertySignature,
  getJSDocCommentsAndTags,
  isTypeLiteralNode,
  SyntaxKind,
  ScriptTarget,
  ScriptKind,
  createSourceFile,
  createProgram,
  createCompilerHost,
  TypeNode,
  ArrayTypeNode,
} from "typescript";
import {
  ArrayType,
  NodeProperty,
  NodePropertyValue,
  ObjectType,
} from "../type";

/**
 * @description Return the sub-type of an array element-type
 * @param nodeKind
 * @returns
 */
export const getArrayType = (nodeKind: SyntaxKind) => {
  switch (nodeKind) {
    case SyntaxKind.StringKeyword:
      return "string";
    case SyntaxKind.NumberKeyword:
      return "number";
    case SyntaxKind.BooleanKeyword:
      return "string";
  }
};

/**
 * @description Generates AST from string
 * @param code Interface in string
 * @returns
 */
export const generateAST = (code: string) => {
  const source = createSourceFile(
    randomUUID(),
    code,
    ScriptTarget.ES5,
    false,
    ScriptKind.TS
  );

  const program = createProgram({
    rootNames: [source.fileName],
    options: {},
    host: {
      ...createCompilerHost({}),
      fileExists: () => true,
      getSourceFile: () => source,
    },
  });
  const checker = program.getTypeChecker();

  return { source, checker };
};

/**
 * @description Populate the `key` property for the `NodeProperty`
 * @param node
 * @returns {String}
 */
export const populatePropertyName = (node: Node) => {
  return node.getText();
};

/**
 * @description Populate the `description` property for the `NodeProperty` from the JSDoc
 * @param node
 * @param property
 */
export const populatePropertyDescription = (
  node: Node,
  property: NodePropertyValue
) => {
  const doc = getJSDocCommentsAndTags(node);
  const comment = doc.at(0);

  if (comment) {
    property.description = (comment.comment as string) || "";
  }
};

/**
 * @description Populate the sub-type for the array i.e Array of object population
 * @param node
 * @returns
 */
const populateArrayLiteral = (node: Node): NodeProperty => {
  if (!isTypeLiteralNode(node)) {
    return {};
  }
  const firstMember = node.members.at(0);
  if (!firstMember || !isPropertySignature(firstMember)) {
    return {};
  }

  const property = {} as NodePropertyValue;

  const name = populatePropertyName(firstMember.name);
  populatePropertyDescription(firstMember, property);
  populatePropertyType({ member: firstMember.type, property });

  return { [name]: property };
};

/**
 * @description Populate the `type` property for `NodeProperty`, if the type is complex populates the nested types as well.
 * @param param0
 * @returns
 */
export const populatePropertyType = ({
  member,
  property,
}: {
  property: NodePropertyValue;
  member?: TypeNode;
}) => {
  if (!member) {
    return;
  }
  switch (member.kind) {
    case SyntaxKind.StringKeyword: {
      property.type = "string";
      break;
    }
    case SyntaxKind.BooleanKeyword: {
      property.type = "boolean";
      break;
    }
    case SyntaxKind.NumberKeyword:
    case SyntaxKind.BigIntKeyword: {
      property.type = "number";
      break;
    }
    case SyntaxKind.ArrayType: {
      property.type = "array";
      const arrayElement = (member as ArrayTypeNode).elementType;
      if (!isTypeLiteralNode(arrayElement)) {
        const _type = getArrayType(arrayElement.kind);
        (property as ArrayType).items = { type: _type ?? "" } as any;
        break;
      } else {
        (property as ArrayType).items = {
          type: "object",
          properties: populateArrayLiteral(arrayElement),
        } as ObjectType;
      }
      break;
    }
    case SyntaxKind.TypeLiteral: {
      property.type = "object";
      const properties = {} as NodeProperty;
      member.forEachChild((member) => {
        if (!isPropertySignature(member)) {
          return;
        }
        const property = {} as NodePropertyValue;

        const name = populatePropertyName(member.name);
        populatePropertyDescription(member, property);
        populatePropertyType({ member: member.type, property });

        properties[name] = property;
      });
      (property as ObjectType).properties = properties;
      break;
    }
    default: {
      console.log(`${member.kind} is not supported`);
    }
  }
};
