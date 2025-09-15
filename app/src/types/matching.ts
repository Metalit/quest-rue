import {
  ProtoClassDetails,
  ProtoClassInfo,
  ProtoDataSegment,
  ProtoDataSegment_ArrayData,
  ProtoDataSegment_StructData,
  ProtoTypeInfo,
} from "../proto/il2cpp";

// switch is lame: https://stackoverflow.com/questions/78957198/type-narrowing-for-two-variables
function compareBoth<I extends { $case: string }, T, C extends I["$case"]>(
  info1: I,
  info2: I,
  $case: C,
  value: (info: I & { $case: C }) => T,
  equals?: (value1: T, value2: T) => boolean,
): boolean {
  if (info1.$case != $case || info2.$case != $case) return false;
  const value1 = value(info1 as I & { $case: C });
  const value2 = value(info2 as I & { $case: C });
  return equals?.(value1, value2) || value1 == value2;
}

function areProtoClassesEqual(
  class1?: ProtoClassInfo,
  class2?: ProtoClassInfo,
) {
  if (class1 === class2) return true;
  if (typeof class1 !== typeof class2) return false;

  const namespaceMatch = class1?.namespaze === class2?.namespaze;
  const nameMatch = class1?.clazz === class2?.clazz;
  const clazzGenericsMatch = areProtoGenericsEqual(class1, class2);

  return namespaceMatch && nameMatch && clazzGenericsMatch;
}

function areProtoGenericsEqual(
  class1?: ProtoClassInfo,
  class2?: ProtoClassInfo,
) {
  return (
    !!class1 &&
    !!class2 &&
    class1.generics.length == class2.generics.length &&
    class1.generics.every((generic, i) =>
      areProtoTypesEqual(generic, class2.generics[i]),
    )
  );
}

/**
 * Checks if two types are exactly equal
 * @param type1
 * @param type2
 * @returns
 */
export function areProtoTypesEqual(
  type1?: ProtoTypeInfo,
  type2?: ProtoTypeInfo,
): boolean {
  const info1 = type1?.Info;
  const info2 = type2?.Info;
  if (!info1 || !info2) return false;
  return (
    compareBoth(info1, info2, "primitiveInfo", (info) => info.primitiveInfo) ||
    compareBoth(
      info1,
      info2,
      "enumInfo",
      (info) => info.enumInfo.clazz,
      areProtoClassesEqual,
    ) ||
    compareBoth(
      info1,
      info2,
      "arrayInfo",
      (info) => info.arrayInfo.memberType!,
      areProtoTypesEqual,
    ) ||
    compareBoth(
      info1,
      info2,
      "structInfo",
      (info) => info.structInfo.clazz,
      areProtoClassesEqual,
    ) ||
    compareBoth(
      info1,
      info2,
      "classInfo",
      (info) => info.classInfo,
      areProtoClassesEqual,
    ) ||
    compareBoth(
      info1,
      info2,
      "genericInfo",
      (info) => info.genericInfo.genericHandle,
    )
  );
}

export function areProtoClassesConvertible(
  instance: ProtoClassDetails,
  targetType: ProtoClassInfo,
): boolean {
  return (
    areProtoClassesEqual(instance.clazz, targetType) ||
    instance.interfaces.some((i) => areProtoClassesEqual(i, targetType)) ||
    (!!instance.parent &&
      areProtoClassesConvertible(instance.parent, targetType))
  );
}

function areUint8ArraysEqual(array1: Uint8Array, array2: Uint8Array) {
  return (
    array1.length == array2.length &&
    array1.every((value, idx) => value == array2[idx])
  );
}

function areProtoArraysEqual(
  { data: array1 }: ProtoDataSegment_ArrayData,
  { data: array2 }: ProtoDataSegment_ArrayData,
) {
  return (
    array1.length == array2.length &&
    array1.every((value, idx) => isProtoDataEqual(value, array2[idx]))
  );
}

function areProtoStructsEqual(
  { data: struct1 }: ProtoDataSegment_StructData,
  { data: struct2 }: ProtoDataSegment_StructData,
) {
  for (const key in struct1) {
    if (!(key in struct2)) return false;
    if (!isProtoDataEqual(struct1[key], struct2[key])) return false;
  }
  return true;
}

export function isProtoDataEqual(
  segment1?: ProtoDataSegment,
  segment2?: ProtoDataSegment,
): boolean {
  if (!segment1 || !segment2) return false;
  const data1 = segment1.Data;
  const data2 = segment2.Data;
  if (!data1 || !data2) return false;
  return (
    compareBoth(
      data1,
      data2,
      "primitiveData",
      (data) => data.primitiveData,
      areUint8ArraysEqual,
    ) ||
    compareBoth(
      data1,
      data2,
      "arrayData",
      (data) => data.arrayData,
      areProtoArraysEqual,
    ) ||
    compareBoth(
      data1,
      data2,
      "structData",
      (data) => data.structData,
      areProtoStructsEqual,
    ) ||
    compareBoth(data1, data2, "classData", (data) => data.classData)
  );
}
