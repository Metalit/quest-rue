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
    "GetComponent",
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
  "UnityEngine::RectTransform": [
    "anchoredPosition",
    "sizeDelta",
    "anchorMin",
    "anchorMax",
    "pivot",
  ],
  "UnityEngine::Component": ["gameObject", "GetComponents", "GetComponent"],
  "UnityEngine::Object": ["name", "Destroy UnityEngine::Object"],
  "TMPro::TMP_Text": [
    "text",
    "color",
    "fontSize",
    "fontStyle",
    "alignment",
    "enableWordWrapping",
    "overflowMode",
    "richText",
    "margin",
  ],
} as MemberPins;

export const [memberPins, setMemberPins] = createPersistentStore<MemberPins>(
  "memberPins",
  defaultMemberPins,
);
