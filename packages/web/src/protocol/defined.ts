export const withoutUndefined = <T extends object>(value: T): T => {
  const copy = { ...value };
  for (const [key, entry] of Object.entries(copy)) {
    if (entry === undefined) Reflect.deleteProperty(copy, key);
  }
  return copy;
};

/** Whether two JSON values are equal, without serializing either. */
export const sameJson = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) {
    return false;
  }
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every(
    (key) =>
      Object.hasOwn(right, key) &&
      sameJson((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
  );
};
