import { ProtoClassDetails, ProtoClassInfo } from "../proto/il2cpp";
import { GetClassDetailsResult } from "../proto/qrue";
import { protoClassToString } from "../types/format";
import { sendPacketResult } from "./packets";

const classDetailsCache: {
  [classString: string]: ProtoClassDetails | undefined;
} = {};

export async function getClassDetails(classInfo: ProtoClassInfo) {
  const key = protoClassToString(classInfo);
  if (key in classDetailsCache) return classDetailsCache[key];

  const result = await sendPacketResult<GetClassDetailsResult>({
    getClassDetails: { classInfo },
  })[0];

  let parent = result.classDetails;
  while (parent) {
    classDetailsCache[protoClassToString(parent.clazz!)] = parent;
    parent = parent.parent;
  }

  return result.classDetails;
}

export function tryGetCachedClassDetails(classInfo: ProtoClassInfo) {
  const key = protoClassToString(classInfo);
  return classDetailsCache[key];
}

export function clearDetailsCache() {
  for (const key in classDetailsCache) delete classDetailsCache[key];
}
