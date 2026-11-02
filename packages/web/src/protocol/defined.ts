export const withoutUndefined = <T extends object>(value: T): T => {
  const copy = { ...value };
  for (const [key, entry] of Object.entries(copy)) {
    if (entry === undefined) Reflect.deleteProperty(copy, key);
  }
  return copy;
};
