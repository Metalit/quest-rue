import { JSX, splitProps } from "solid-js";

export function MaxColsGrid(
  props: JSX.HTMLAttributes<HTMLDivElement> & {
    colGap?: number;
    maxCols?: number;
    minWidth?: number;
  },
) {
  const [modified, normal] = splitProps(props, [
    "class",
    "colGap",
    "maxCols",
    "minWidth",
  ]);

  return (
    <div
      {...normal}
      class={`max-cols-grid ${modified.class ?? ""}`}
      style={{
        "--grid-column-gap": `${modified.colGap ?? 20}px`,
        "--grid-column-count": modified.maxCols ?? 2,
        "--grid-item-min-width": `${modified.minWidth ?? 450}px`,
      }}
    />
  );
}
