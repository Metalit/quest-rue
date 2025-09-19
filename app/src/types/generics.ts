import { bigToString, extractCase } from "../global/utils";
import { ProtoMethodInfo, ProtoTypeInfo } from "../proto/il2cpp";
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
      return [{ ...type, isByref: false }];
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
          extractCase(generic.Info, "genericInfo")?.genericHandle ?? -1n,
        ),
        { generic },
      ]),
  );
}

export function getInstantiation(
  type: ProtoTypeInfo,
  generics: GenericsMap,
): ProtoTypeInfo {
  const copy = ProtoTypeInfo.fromJSON(ProtoTypeInfo.toJSON(type));
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
        isByref: copy.isByref,
      };
  }
  return areProtoTypesEqual(type, copy) ? type : copy;
}
