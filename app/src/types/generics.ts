import {
  ProtoDataPayload,
  ProtoMethodInfo,
  ProtoTypeInfo,
  ProtoTypeInfo_Byref,
} from "../proto/il2cpp";
import { bigToString } from "../utils/misc";
import { extractCase } from "../utils/typing";
import { areProtoTypesEqual } from "./matching";

export type GenericsMap = Record<
  string,
  { generic: ProtoTypeInfo; value?: ProtoTypeInfo }
>;

export function getGenerics(type?: ProtoTypeInfo): ProtoTypeInfo[] {
  switch (type?.Info?.$case) {
    case "classInfo":
      return type.Info.classInfo.generics?.flatMap((t) => getGenerics(t)) ?? [];
    case "arrayInfo":
      return getGenerics(type.Info.arrayInfo.memberType);
    case "structInfo":
      return (
        type.Info.structInfo.clazz?.generics?.flatMap((t) => getGenerics(t)) ??
        []
      );
    case "genericInfo":
      return [{ ...type, byref: ProtoTypeInfo_Byref.NONE }];
  }
  return [];
}

export function getArgGenericsMap(method: ProtoMethodInfo): GenericsMap {
  return Object.fromEntries(
    method.args
      .flatMap(({ type }) => getGenerics(type))
      .concat(getGenerics(method.returnType))
      .map((generic) => [
        bigToString(
          extractCase(generic.Info, "genericInfo")?.genericHandle ?? BigInt(-1),
        ),
        { generic },
      ]),
  );
}

export function getInstantiation(
  type: ProtoTypeInfo,
  generics: GenericsMap,
): ProtoTypeInfo {
  const copy = ProtoTypeInfo.fromPartial(type);
  const info = copy.Info;

  const tryGetGeneric = (generic: ProtoTypeInfo) =>
    (generic.Info?.$case == "genericInfo" &&
      generics[bigToString(generic.Info.genericInfo.genericHandle)]?.value) ||
    generic;

  switch (info?.$case) {
    case "classInfo":
      info.classInfo.generics = info.classInfo.generics.map(tryGetGeneric);
      break;
    case "arrayInfo":
      info.arrayInfo.memberType = getInstantiation(
        info.arrayInfo.memberType!,
        generics,
      );
      break;
    case "structInfo":
      if (info.structInfo.clazz) {
        info.structInfo.clazz.generics =
          info.structInfo.clazz.generics.map(tryGetGeneric);
      }
      break;
    case "genericInfo":
      return {
        ...(generics[bigToString(info.genericInfo.genericHandle)]?.value ??
          copy),
        byref: copy.byref,
      };
  }
  return areProtoTypesEqual(type, copy) ? type : copy;
}

export function getNewInstantiationData(
  current: ProtoDataPayload | undefined,
  base: ProtoTypeInfo,
  generics: GenericsMap,
): [ProtoDataPayload, true] | [ProtoDataPayload | undefined, false] {
  const instantiation = getInstantiation(base, generics);
  if (!areProtoTypesEqual(current?.typeInfo, instantiation))
    return [{ typeInfo: instantiation, data: undefined }, true];
  else return [current, false];
}
