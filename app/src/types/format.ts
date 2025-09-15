import { bigToString } from "../global/utils";
import {
  ProtoClassInfo,
  ProtoDataPayload,
  ProtoDataSegment,
  ProtoTypeInfo,
  ProtoTypeInfo_Primitive,
} from "../proto/il2cpp";
import {
  protoDataToRealValue,
  setTypeCase,
  stringToDataSegment,
} from "./serialization";

export function protoDataToString(
  data?: ProtoDataSegment,
  typeInfo?: ProtoTypeInfo,
) {
  if (!data || !typeInfo) return "";
  const ret = protoDataToRealValue(typeInfo, data);
  if (
    typeInfo?.Info?.$case == "primitiveInfo" &&
    typeInfo.Info.primitiveInfo == ProtoTypeInfo_Primitive.LONG
  )
    return ret.toString();
  // for some reason if I combine these if statements typescript complains
  if (typeInfo?.Info?.$case == "enumInfo") {
    if (typeof ret == "number" || typeof ret == "bigint") {
      const match = Object.entries(typeInfo.Info.enumInfo.values).find(
        ([, value]) => value == BigInt(ret),
      );
      if (match) return match[0];
    }
  }
  if (typeof ret == "boolean") return ret ? "True" : "False";
  if (typeof ret == "string") return ret;
  if (typeof ret == "bigint") return bigToString(ret);
  return JSON.stringify(ret, (_, value) => {
    return typeof value == "bigint" ? value.toString() : value;
  });
}

class TwoWayMap {
  map: Record<string, number>;
  reverse: Record<number, string>;
  constructor(map: Record<string, number>) {
    this.map = map;
    this.reverse = {};
    for (const key in map) {
      const value = map[key];
      this.reverse[value] = key;
    }
  }
  get(key: string): number | undefined {
    return this.map[key];
  }
  hasStr(key: string) {
    return key in this.map;
  }
  getStr(key: number): string | undefined {
    return this.reverse[key];
  }
  has(key: number) {
    return key in this.reverse;
  }
}

const primitiveStringMap = new TwoWayMap({
  bool: ProtoTypeInfo_Primitive.BOOLEAN,
  char: ProtoTypeInfo_Primitive.CHAR,
  byte: ProtoTypeInfo_Primitive.BYTE,
  short: ProtoTypeInfo_Primitive.SHORT,
  int: ProtoTypeInfo_Primitive.INT,
  long: ProtoTypeInfo_Primitive.LONG,
  float: ProtoTypeInfo_Primitive.FLOAT,
  double: ProtoTypeInfo_Primitive.DOUBLE,
  string: ProtoTypeInfo_Primitive.STRING,
  type: ProtoTypeInfo_Primitive.TYPE,
  pointer: ProtoTypeInfo_Primitive.PTR,
  void: ProtoTypeInfo_Primitive.VOID,
  unknown: ProtoTypeInfo_Primitive.UNKNOWN,
});

// will return classInfo for enum and struct types as well
export function stringToProtoType(
  input: string,
  requireValid = true,
): ProtoTypeInfo | undefined {
  input = input.trim();
  const isByref = input.toLocaleLowerCase().startsWith("ref ");
  if (isByref) input = input.slice(4).trim();

  if (primitiveStringMap.hasStr(input.toLocaleLowerCase())) {
    const primitiveInfo = primitiveStringMap.get(input.toLocaleLowerCase())!;
    return setTypeCase({ primitiveInfo }, { isByref });
  }
  if (input.endsWith("[]")) {
    const memberType = stringToProtoType(input.slice(0, -2), false);
    if (memberType)
      return setTypeCase({ arrayInfo: { memberType } }, { isByref });
  } else if (input.includes("::")) {
    let [namespaze, clazz] = input.split("::", 2);

    let generics: (ProtoTypeInfo | undefined)[] = [];
    if (clazz.includes("<") && clazz.endsWith(">")) {
      const [newClazz, genericStrings] = clazz.slice(0, -1).split("<", 2);
      clazz = newClazz;
      generics = genericStrings
        .split(",")
        .map((s) => stringToProtoType(s.trim(), false));
    }

    if (generics.every((value) => value !== undefined))
      return setTypeCase(
        {
          classInfo: {
            namespaze,
            clazz,
            generics,
          },
        },
        { isByref },
      );
  }
  if (requireValid)
    throw "Invalid type input: " + (isByref ? "ref " : "") + input;
  return undefined;
}

function protoClassToString(classInfo: ProtoClassInfo): string {
  let ret = `${classInfo.clazz}`;
  if (classInfo.generics?.length) {
    ret += "<";
    ret += classInfo.generics.map((t) => protoTypeToString(t)).join(", ");
    ret += ">";
  }
  if (classInfo.namespaze) return `${classInfo.namespaze}::${ret}`;
  return ret;
}

export function protoTypeToString(type: ProtoTypeInfo): string {
  let str: string | undefined = undefined;
  switch (type.Info?.$case) {
    case "classInfo":
      str = protoClassToString(type.Info.classInfo);
      break;
    case "arrayInfo":
      str = protoTypeToString(type.Info.arrayInfo.memberType!) + "[]";
      break;
    case "structInfo":
      str = protoClassToString(type.Info.structInfo.clazz!);
      break;
    case "genericInfo":
      str = type.Info.genericInfo.name;
      break;
    case "primitiveInfo":
      str = primitiveToString(type.Info.primitiveInfo);
      break;
    case "enumInfo":
      str = protoClassToString(type.Info.enumInfo.clazz!);
      break;
  }
  if (str && type.isByref) return "ref " + str;
  return str ?? "";
}

export function stringToPrimitive(
  str: string,
): ProtoTypeInfo_Primitive | undefined {
  return primitiveStringMap.get(str);
}

export function primitiveToString(
  primitive: ProtoTypeInfo_Primitive,
): string | undefined {
  return primitiveStringMap.getStr(primitive);
}

export function stringToProtoData(
  input: string,
  typeInfo: ProtoTypeInfo,
): ProtoDataPayload {
  return {
    typeInfo: typeInfo,
    data: stringToDataSegment(input, typeInfo),
  };
}
