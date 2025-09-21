import { Icon } from "solid-heroicons";

export type IconPath = Parameters<typeof Icon>[0]["path"];

export type WithCase<
  T extends { $case: string } | undefined,
  C extends NonNullable<T>["$case"],
> = Extract<NonNullable<T>, { $case: C }>;

type CaseValue<T, C extends string> = T extends { [k in C]: infer V }
  ? V
  : never;

// there is probably a better way to do this, typescript-wise
export function extractCase<
  T extends { $case: string } | undefined,
  C extends NonNullable<T>["$case"],
>(value: T, $case: C): CaseValue<T, C> | undefined {
  return (value as { [k in C]: CaseValue<T, C> } | undefined)?.[$case];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UnionOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

export function setCase<TResult>(object: UnionOmit<TResult, "$case">): TResult {
  return {
    ...object,
    $case: Object.keys(object)[0],
  } as TResult; // could probably be done without the cast with some typescript magic but idc
}
