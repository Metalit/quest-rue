import { bigToString } from "../global/utils";
import {
  ProtoClassInfo,
  ProtoDataPayload,
  ProtoDataSegment,
  ProtoTypeInfo,
  ProtoTypeInfo_Byref,
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

function getByref(input: string): [ProtoTypeInfo_Byref, string] {
  const lower = input.toLocaleLowerCase();
  if (lower.startsWith("ref "))
    return [ProtoTypeInfo_Byref.REF, input.slice(4).trimStart()];
  if (lower.startsWith("in "))
    return [ProtoTypeInfo_Byref.IN, input.slice(3).trimStart()];
  if (lower.startsWith("out "))
    return [ProtoTypeInfo_Byref.OUT, input.slice(4).trimStart()];
  return [ProtoTypeInfo_Byref.NONE, input];
}

// will return classInfo for enum and struct types as well
export function stringToProtoType(
  input: string,
  requireValid = false,
): ProtoTypeInfo | undefined {
  input = input.trim();
  const [byref, trimmed] = getByref(input);
  const lower = trimmed.toLocaleLowerCase();

  if (primitiveStringMap.hasStr(lower)) {
    const primitiveInfo = primitiveStringMap.get(lower)!;
    return setTypeCase({ primitiveInfo }, { byref });
  }
  if (trimmed.endsWith("[]")) {
    const memberType = stringToProtoType(trimmed.slice(0, -2));
    if (memberType)
      return setTypeCase({ arrayInfo: { memberType } }, { byref });
  } else if (trimmed.includes("::")) {
    let [namespaze, clazz] = trimmed.split("::", 2);

    let generics: (ProtoTypeInfo | undefined)[] = [];
    if (clazz.includes("<") && clazz.endsWith(">")) {
      const [newClazz, genericStrings] = clazz.slice(0, -1).split("<", 2);
      clazz = newClazz;
      generics = genericStrings
        .split(",")
        .map((s) => stringToProtoType(s.trim()));
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
        { byref },
      );
  }
  if (requireValid) throw "Invalid type input: " + input;
  return undefined;
}

export function protoClassToString(classInfo: ProtoClassInfo): string {
  let ret = `${classInfo.clazz}`;
  if (classInfo.generics?.length) {
    ret += "<";
    ret += classInfo.generics.map((t) => protoTypeToString(t)).join(", ");
    ret += ">";
  }
  return `${classInfo.namespaze}::${ret}`;
}

export function protoTypeToString(type?: ProtoTypeInfo): string {
  if (!type) return "";
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
  str = str ?? "";
  switch (type.byref) {
    case ProtoTypeInfo_Byref.REF:
      return "ref " + str;
    case ProtoTypeInfo_Byref.IN:
      return "in " + str;
    case ProtoTypeInfo_Byref.OUT:
      return "out " + str;
  }
  return str;
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
