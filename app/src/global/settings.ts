import { createPersistentSignal, createPersistentStore } from "../utils/solid";

export const [darkMode, setDarkMode] = createPersistentSignal(
  "darkMode",
  () => true,
  (val) => val === "true",
);

export const [monoFont, setMonoFont] = createPersistentSignal(
  "monoFont",
  () => "",
);

export const [columnCount, setColumnCount] = createPersistentSignal(
  "columnCount",
  () => 2,
  Number.parseInt,
);

export type MemberPins = Record<string, string[]>;

export const defaultMemberPins = {
  "UnityEngine::GameObject": [
    "active",
    "transform",
    "GetComponents",
    "AddComponent",
  ],
  "UnityEngine::Transform": [
    "parent",
    "childCount",
    "position",
    "localPosition",
    "eulerAngles",
    "localEulerAngles",
    "lossyScale",
    "localScale",
  ],
  "UnityEngine::Component": ["gameObject", "GetComponents"],
  "UnityEngine::Object": ["name", "Destroy UnityEngine::Object"],
} as MemberPins;

export const [memberPins, setMemberPins] = createPersistentStore<MemberPins>(
  "memberPins",
  defaultMemberPins,
);
