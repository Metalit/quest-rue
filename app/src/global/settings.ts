import { createPersistentSignal } from "./utils";

export const [rawInput, setRawInput] = createPersistentSignal(
  "rawInput",
  () => false,
  (val) => val === "true",
);

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
