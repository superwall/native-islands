export const withoutUndefined = <T extends object>(value: T): T => {
  const copy = { ...value };
  for (const [key, entry] of Object.entries(copy)) {
    if (entry === undefined) Reflect.deleteProperty(copy, key);
  }
  return copy;
};

const definedEntries = (value: object) =>
  Object.entries(value).filter(([, entry]) => entry !== undefined);

/**
 * Whether two JSON values are equal, without serializing either. Keys whose
 * value is undefined are left out, as `JSON.stringify` leaves them out.
 */
export const sameJson = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) {
    return false;
  }
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const ours = definedEntries(left);
  const theirs = new Map(definedEntries(right));
  if (ours.length !== theirs.size) return false;
  return ours.every(([key, entry]) => theirs.has(key) && sameJson(entry, theirs.get(key)));
};
