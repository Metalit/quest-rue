import { ProtoTypeInfo } from "../proto/il2cpp";

export function getGenerics(type?: ProtoTypeInfo): ProtoTypeInfo[] {
  if (type == undefined) return [];

  switch (type.Info?.$case) {
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

export function getInstantiation(
  type: ProtoTypeInfo,
  generics: Map<bigint, ProtoTypeInfo>,
): ProtoTypeInfo {
  const copy = ProtoTypeInfo.fromJSON(ProtoTypeInfo.toJSON(type));
  const info = copy.Info;

  switch (info?.$case) {
    case "classInfo":
      info.classInfo.generics = info.classInfo.generics.map((t) => {
        if (t.Info?.$case == "genericInfo")
          return generics.get(t.Info.genericInfo.genericHandle) ?? t;
        return t;
      });
      break;
    case "arrayInfo":
      info.arrayInfo.memberType = getInstantiation(
        info.arrayInfo.memberType!,
        generics,
      );
      break;
    case "structInfo":
      if (info.structInfo.clazz) {
        info.structInfo.clazz.generics = info.structInfo.clazz.generics.map(
          (g) =>
            generics.get(
              g.Info?.$case == "genericInfo"
                ? g.Info?.genericInfo?.genericHandle
                : BigInt(-1),
            ) ?? g,
        );
      }
      break;
    case "genericInfo":
      return {
        ...(generics.get(info.genericInfo.genericHandle) ?? copy),
        isByref: copy.isByref,
      };
  }
  return copy;
}
