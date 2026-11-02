const VARIABLE = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/;

const MAX_VARIABLE_DEPTH = 16;

export const resolveCssVariables = (value: string, element: Element): string => {
  const style = getComputedStyle(element);
  let resolved = value;
  for (let depth = 0; depth < MAX_VARIABLE_DEPTH; depth += 1) {
    const match = VARIABLE.exec(resolved);
    if (!match) return resolved;
    const [whole, name, fallback] = match;
    const current = style.getPropertyValue(name as string).trim();
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

const resolveValue = (value: unknown, element: Element): unknown => {
  if (typeof value === "string") return resolveCssVariables(value, element);
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, element));
  if (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveValue(item, element)]),
    );
  }
  return value;
};

export const resolveNativeProps = (
  props: Readonly<Record<string, unknown>>,
  element: Element,
  colorProps: readonly string[] = [],
): Record<string, unknown> => {
  const resolved = resolveValue(props, element) as Record<string, unknown>;
  for (const key of colorProps) {
    const value = resolved[key];
    if (typeof value === "string") resolved[key] = resolveCssColor(value, element);
  }
  return resolved;
};
