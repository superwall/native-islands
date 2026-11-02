const VARIABLE = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/;

const MAX_VARIABLE_DEPTH = 16;

export const resolveCssVariables = (value: string, element: Element): string => {
  const style = getComputedStyle(element);
  let resolved = value;
  for (let depth = 0; depth < MAX_VARIABLE_DEPTH; depth += 1) {
    const [whole, name, fallback] = VARIABLE.exec(resolved) ?? [];
    if (whole === undefined || name === undefined) return resolved;
    const current = style.getPropertyValue(name).trim();
    const replacement = current === "" ? (fallback ?? "").trim() : current;
    resolved = resolved.replace(whole, replacement);
  }
  return resolved;
};

export const resolveCssColor = (value: string, element: Element): string => {
  const probe = element.ownerDocument.createElement("span");
  probe.style.display = "none";
  probe.style.color = value;
  if (probe.style.color === "") return value;
  (element.parentElement ?? element.ownerDocument.body).appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color === "" ? value : color;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;

const resolveRecord = (
  record: Readonly<Record<string, unknown>>,
  element: Element,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, resolveValue(item, element)]),
  );

const resolveValue = (value: unknown, element: Element): unknown => {
  if (typeof value === "string") return resolveCssVariables(value, element);
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, element));
  return isRecord(value) ? resolveRecord(value, element) : value;
};

export const resolveNativeProps = (
  props: Readonly<Record<string, unknown>>,
  element: Element,
  colorProps: readonly string[] = [],
): Record<string, unknown> => {
  const resolved = resolveRecord(props, element);
  for (const key of colorProps) {
    const value = resolved[key];
    if (typeof value === "string") resolved[key] = resolveCssColor(value, element);
  }
  return resolved;
};
