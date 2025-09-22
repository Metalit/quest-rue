import {
  ProtoDataPayload,
  ProtoDataSegment,
  ProtoTypeInfo,
  ProtoTypeInfo_Byref,
  ProtoTypeInfo_Primitive,
} from "../proto/il2cpp";
import { stringToBig } from "../utils/misc";
import { UnionOmit, setCase } from "../utils/typing";
import { protoTypeToString, stringToProtoType } from "./format";

type DataTypes = UnionOmit<NonNullable<ProtoDataSegment["Data"]>, "$case">;
type TypeTypes = UnionOmit<NonNullable<ProtoTypeInfo["Info"]>, "$case">;

export function setDataCase(data: DataTypes): ProtoDataSegment {
  return { Data: setCase<ProtoDataSegment["Data"]>(data) };
}

export function setTypeCase(
  data: TypeTypes,
  info: { byref?: ProtoTypeInfo_Byref; size?: number } = {},
): ProtoTypeInfo {
  const Info = setCase<ProtoTypeInfo["Info"]>(data);
  return {
    Info,
    byref: info.byref ?? ProtoTypeInfo_Byref.NONE,
    size: info.size ?? typeInfoSize(Info),
  };
}

export function typeForClass(
  namespaze: string,
  clazz: string,
  generics: ProtoTypeInfo[] = [],
) {
  return setTypeCase({ classInfo: { namespaze, clazz, generics } });
}

// converts an object to a json string, but without extra quotes if the object is a string
function stringifyQuotesless(obj: unknown) {
  if (typeof obj == "string") return obj;
  return JSON.stringify(obj, (_, value) =>
    typeof value == "bigint" ? value.toString() : value,
  );
}

// parses only the top level of a json object, leaving all values as strings
function parseShallow(
  jsonStr: string,
): Record<string, string> | string[] | string {
  const parsed = JSON.parse(jsonStr);
  if (typeof parsed == "string") return parsed;
  if (Array.isArray(parsed))
    return parsed.map((elem) => stringifyQuotesless(elem));
  Object.keys(parsed).forEach(
    (key) => (parsed[key] = stringifyQuotesless(parsed[key])),
  );
  return parsed;
}

function primitiveSize(primitive: ProtoTypeInfo_Primitive) {
  switch (primitive) {
    case ProtoTypeInfo_Primitive.BOOLEAN:
    case ProtoTypeInfo_Primitive.BYTE:
      return 1;
    case ProtoTypeInfo_Primitive.CHAR:
    case ProtoTypeInfo_Primitive.SHORT:
      return 2;
    case ProtoTypeInfo_Primitive.INT:
    case ProtoTypeInfo_Primitive.FLOAT:
      return 4;
    case ProtoTypeInfo_Primitive.LONG:
    case ProtoTypeInfo_Primitive.DOUBLE:
    case ProtoTypeInfo_Primitive.TYPE:
    case ProtoTypeInfo_Primitive.PTR:
      return 8;
  }
  // void, unknown, unrecognized
  return 0;
}

function typeInfoSize(info: ProtoTypeInfo["Info"]): number {
  switch (info?.$case) {
    case "classInfo":
    case "arrayInfo":
    case "genericInfo": // idk, shouldn't matter
      return 8;
    case "structInfo": {
      const lastOffset = Math.max(
        ...(Object.keys(info.structInfo.fieldOffsets) as unknown as number[]),
      );
      return (
        lastOffset +
        typeInfoSize(info.structInfo.fieldOffsets[lastOffset].type!.Info)
      );
    }
    case "primitiveInfo":
      return primitiveSize(info.primitiveInfo);
    case "enumInfo":
      return primitiveSize(info.enumInfo.valueType);
  }
  return 0;
}

function primitiveToDataSegment(
  input: string,
  primitive: ProtoTypeInfo_Primitive,
) {
  let data: Uint8Array | undefined;
  const getBuffer = (bytes: number) => {
    if (!data) data = new Uint8Array(bytes);
    return data.buffer;
  };
  switch (primitive) {
    case ProtoTypeInfo_Primitive.BOOLEAN:
      new DataView(getBuffer(1)).setUint8(0, Number(!!input.match(/^true$/i)));
      break;
    case ProtoTypeInfo_Primitive.CHAR:
      new Uint16Array(getBuffer(2))[0] = input.charCodeAt(0);
      break;
    case ProtoTypeInfo_Primitive.BYTE:
      new DataView(getBuffer(1)).setInt8(0, Number(input));
      break;
    case ProtoTypeInfo_Primitive.SHORT:
      new DataView(getBuffer(2)).setInt16(0, Number(input), true);
      break;
    case ProtoTypeInfo_Primitive.INT:
      new DataView(getBuffer(4)).setInt32(0, Number(input), true);
      break;
    case ProtoTypeInfo_Primitive.LONG:
      new DataView(getBuffer(8)).setBigInt64(0, BigInt(input), true);
      break;
    case ProtoTypeInfo_Primitive.FLOAT:
      new DataView(getBuffer(4)).setFloat32(0, Number(input), true);
      break;
    case ProtoTypeInfo_Primitive.DOUBLE:
      new DataView(getBuffer(8)).setFloat64(0, Number(input), true);
      break;
    case ProtoTypeInfo_Primitive.STRING: {
      // +1 to add null char
      const utf16Arr = new Uint16Array(getBuffer((input.length + 1) * 2));
      for (let i = 0; i < input.length; i++) utf16Arr[i] = input.charCodeAt(i);
      break;
    }
    case ProtoTypeInfo_Primitive.TYPE:
      data = ProtoTypeInfo.encode(stringToProtoType(input, true)!).finish();
      break;
    case ProtoTypeInfo_Primitive.PTR:
      new DataView(getBuffer(8)).setBigInt64(0, BigInt(input), true);
      break;
    case ProtoTypeInfo_Primitive.UNKNOWN:
    case ProtoTypeInfo_Primitive.VOID:
      break;
  }
  return setDataCase({
    primitiveData: data ?? new Uint8Array(0),
  });
}

export function stringToDataSegment(
  input: string,
  typeInfo: ProtoTypeInfo,
): ProtoDataSegment {
  switch (typeInfo.Info?.$case) {
    case "classInfo":
      return setDataCase({ classData: stringToBig(input) });
    case "structInfo": {
      // get keys and values, keeping the values as strings so they can be passed recursively
      const struct = parseShallow(input) as Record<string, string>;
      // convert the fields in the typeInfo to an object with the correct value for each field
      const data = Object.fromEntries(
        Object.entries(typeInfo.Info.structInfo.fieldOffsets!).map(
          ([offset, { name, type }]) => [
            Number(offset),
            stringToDataSegment(struct[name], type!),
          ],
        ),
      );
      return setDataCase({ structData: { data } });
    }
    case "arrayInfo": {
      const arr = parseShallow(input) as string[];
      const memberType = typeInfo.Info.arrayInfo.memberType!;
      const data = arr.map((elem) => stringToDataSegment(elem, memberType));
      return setDataCase({ arrayData: { data } });
    }
    case "primitiveInfo":
      return primitiveToDataSegment(input, typeInfo.Info.primitiveInfo);
    case "enumInfo":
      if (input in typeInfo.Info.enumInfo.values)
        input = typeInfo.Info.enumInfo.values[input].toString();
      return primitiveToDataSegment(input, typeInfo.Info.enumInfo.valueType);
  }
  return {};
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

function defaultPrimitiveSegment(
  primitive: ProtoTypeInfo_Primitive,
): ProtoDataSegment {
  switch (primitive) {
    case ProtoTypeInfo_Primitive.BOOLEAN:
    case ProtoTypeInfo_Primitive.BYTE:
    case ProtoTypeInfo_Primitive.SHORT:
    case ProtoTypeInfo_Primitive.INT:
    case ProtoTypeInfo_Primitive.LONG:
    case ProtoTypeInfo_Primitive.FLOAT:
    case ProtoTypeInfo_Primitive.DOUBLE:
    case ProtoTypeInfo_Primitive.PTR:
      return primitiveToDataSegment("0", primitive);
    case ProtoTypeInfo_Primitive.TYPE:
      return primitiveToDataSegment("System::Object", primitive);
    case ProtoTypeInfo_Primitive.CHAR:
      return primitiveToDataSegment("\0", primitive);
    case ProtoTypeInfo_Primitive.STRING:
    case ProtoTypeInfo_Primitive.UNKNOWN:
    case ProtoTypeInfo_Primitive.VOID:
      return primitiveToDataSegment("", primitive);
  }
  return {};
}

export function defaultDataSegment(typeInfo: ProtoTypeInfo): ProtoDataSegment {
  switch (typeInfo.Info?.$case) {
    case "classInfo":
      return setDataCase({ classData: BigInt(0) });
    case "structInfo": {
      const data = Object.fromEntries(
        Object.entries(typeInfo.Info.structInfo.fieldOffsets!).map(
          ([offset, { type }]) => [Number(offset), defaultDataSegment(type!)],
        ),
      );
      return setDataCase({ structData: { data } });
    }
    case "arrayInfo":
      return setDataCase({ arrayData: { data: [] } });
    case "primitiveInfo":
      return defaultPrimitiveSegment(typeInfo.Info.primitiveInfo);
    case "enumInfo":
      return defaultPrimitiveSegment(typeInfo.Info.enumInfo.valueType);
  }
  return {};
}

function validPrimitiveString(
  input: string,
  primitive: ProtoTypeInfo_Primitive,
): boolean {
  const checkBytes = (bytes: number) =>
    !!input.match(/^[0-9]+$/) &&
    BigInt(input) < BigInt(2) ** BigInt(bytes * 8 - 1) &&
    BigInt(input) >= -(BigInt(2) ** BigInt(bytes * 8 - 1));
  switch (primitive) {
    case ProtoTypeInfo_Primitive.BOOLEAN:
      return !!input.match(/^(?:true|false)$/i);
    case ProtoTypeInfo_Primitive.CHAR:
      return input.length == 1;
    case ProtoTypeInfo_Primitive.BYTE:
      return checkBytes(1);
    case ProtoTypeInfo_Primitive.SHORT:
      return checkBytes(2);
    case ProtoTypeInfo_Primitive.INT:
      return checkBytes(4);
    case ProtoTypeInfo_Primitive.LONG:
      return checkBytes(8);
    case ProtoTypeInfo_Primitive.FLOAT:
    case ProtoTypeInfo_Primitive.DOUBLE:
      return !!input.match(/^[0-9]*(?:(?:\.[0-9]+)|[0-9])$/);
    case ProtoTypeInfo_Primitive.STRING:
      return true;
    case ProtoTypeInfo_Primitive.TYPE:
      return !!stringToProtoType(input);
    case ProtoTypeInfo_Primitive.PTR:
      return checkBytes(8);
    case ProtoTypeInfo_Primitive.VOID:
      return input.length == 0;
    case ProtoTypeInfo_Primitive.UNKNOWN:
      return true;
  }
  return false;
}

export function validString(input: string, typeInfo: ProtoTypeInfo): boolean {
  switch (typeInfo.Info?.$case) {
    case "classInfo":
      return !!input.match(/^0x[0-9a-f]+$/i);
    case "structInfo": {
      try {
        const struct = parseShallow(input) as Record<string, string>;
        return Object.values(typeInfo.Info.structInfo.fieldOffsets!).every(
          ({ name, type }) =>
            name in struct && validString(struct[name], type!),
        );
      } catch {
        // invalid json
        return false;
      }
    }
    case "arrayInfo": {
      try {
        const arr = parseShallow(input) as string[];
        const memberType = typeInfo.Info.arrayInfo.memberType!;
        return arr.every((elem) => validString(elem, memberType));
      } catch {
        // invalid json
        return false;
      }
    }
    case "primitiveInfo":
      return validPrimitiveString(input, typeInfo.Info.primitiveInfo);
    case "genericInfo":
      return !!stringToProtoType(input);
    case "enumInfo":
      return input in typeInfo.Info.enumInfo.values;
  }
  return false;
}

function primitiveDataToRealValue(
  primitive: ProtoTypeInfo_Primitive,
  data: Uint8Array,
) {
  const bytes = new DataView(data.buffer, data.byteOffset, data.byteLength);
  switch (primitive) {
    case ProtoTypeInfo_Primitive.BOOLEAN:
      return bytes.getUint8(0) != 0;
    case ProtoTypeInfo_Primitive.CHAR: {
      const byte = bytes.buffer.slice(0, 2);
      return new TextDecoder("utf-16").decode(byte);
    }
    case ProtoTypeInfo_Primitive.BYTE:
      return bytes.getInt8(0);
    case ProtoTypeInfo_Primitive.SHORT:
      return bytes.getInt16(0, true);
    case ProtoTypeInfo_Primitive.INT:
      return bytes.getInt32(0, true);
    case ProtoTypeInfo_Primitive.LONG:
      return bytes.getBigInt64(0, true);
    case ProtoTypeInfo_Primitive.FLOAT:
      return bytes.getFloat32(0, true);
    case ProtoTypeInfo_Primitive.DOUBLE:
      return bytes.getFloat64(0, true);
    case ProtoTypeInfo_Primitive.STRING: {
      const slice = bytes.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength,
      );
      return new TextDecoder("utf-16").decode(slice);
    }
    case ProtoTypeInfo_Primitive.TYPE:
      return protoTypeToString(ProtoTypeInfo.decode(data));
    case ProtoTypeInfo_Primitive.PTR:
      return bytes.getBigInt64(0, true);
    case ProtoTypeInfo_Primitive.UNKNOWN:
      return "unknown";
    case ProtoTypeInfo_Primitive.VOID:
      console.error("void data to real value");
  }
  return "";
}

export function protoDataToRealValue(
  typeInfo: ProtoTypeInfo,
  data?: ProtoDataSegment,
) {
  switch (typeInfo.Info?.$case) {
    case "classInfo":
      if (data?.Data?.$case != "classData") return BigInt(0);
      return data?.Data.classData;
    case "structInfo": {
      if (data?.Data?.$case != "structData") return "null";
      const struct: Record<string, unknown> = {};
      const fields = typeInfo.Info.structInfo.fieldOffsets!;
      for (const offset in fields) {
        const field = fields[offset];
        struct[field.name!] = protoDataToRealValue(
          field.type!,
          data.Data.structData.data[offset],
        );
      }
      return struct;
    }
    case "arrayInfo": {
      if (data?.Data?.$case != "arrayData") return BigInt(0);
      const arr: unknown[] = [];
      const memberType = typeInfo.Info.arrayInfo.memberType!;
      for (let i = 0; i < data.Data.arrayData.data.length; i++)
        arr.push(protoDataToRealValue(memberType, data.Data.arrayData.data[i]));
      return arr;
    }
    case "genericInfo":
      return typeInfo.Info.genericInfo.name;
    case "primitiveInfo": {
      if (data?.Data?.$case != "primitiveData") return "null";
      return primitiveDataToRealValue(
        typeInfo.Info.primitiveInfo,
        data.Data.primitiveData,
      );
    }
    case "enumInfo":
      if (data?.Data?.$case != "primitiveData") return "null";
      return primitiveDataToRealValue(
        typeInfo.Info.enumInfo.valueType,
        data.Data.primitiveData,
      );
  }
  return "";
}
