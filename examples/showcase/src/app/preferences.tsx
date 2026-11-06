import * as React from "react";
import { postToHost } from "./host";
import { drawsNatively, type ViewMode } from "./viewMode";

export type Appearance = "system" | "light" | "dark";

export const APPEARANCES: readonly { value: Appearance; title: string }[] = [
  { value: "system", title: "System" },
  { value: "light", title: "Light" },
  { value: "dark", title: "Dark" },
];

export type Accent = { name: string; light: string; dark: string };

/** The system colours iOS offers as accents, in their light and dark variants. */
export const ACCENTS: readonly Accent[] = [
  { name: "Blue", light: "#007aff", dark: "#0a84ff" },
  { name: "Indigo", light: "#5856d6", dark: "#5e5ce6" },
  { name: "Purple", light: "#af52de", dark: "#bf5af2" },
  { name: "Pink", light: "#ff2d55", dark: "#ff375f" },
  { name: "Red", light: "#ff3b30", dark: "#ff453a" },
  { name: "Orange", light: "#ff9500", dark: "#ff9f0a" },
  { name: "Green", light: "#34c759", dark: "#30d158" },
  { name: "Teal", light: "#30b0c7", dark: "#40c8e0" },
];

export type Preferences = {
  appearance: Appearance;
  accent: Accent;
  mode: ViewMode;
};

type PreferencesValue = Preferences & {
  set: (change: Partial<Preferences>) => void;
};

const DEFAULTS: Preferences = {
  appearance: "system",
  accent: ACCENTS[0] ?? { name: "Blue", light: "#007aff", dark: "#0a84ff" },
  mode: "native",
};

const PreferencesContext = React.createContext<PreferencesValue>({ ...DEFAULTS, set: () => {} });

export const usePreferences = (): PreferencesValue => React.useContext(PreferencesContext);

/**
 * Whether islands draw natively: in Native and in Outlines, which draws the
 * outlines over the native views. Web switches them all to their web versions.
 */
export const useNativeEnabled = (): boolean =>
  drawsNatively(React.useContext(PreferencesContext).mode);

/**
 * Holds the app's settings for the session and applies them to the document:
 * the colour scheme as `data-appearance` on `<html>` (the host follows it, so
 * native views do too) and the accent as `--accent-light`/`--accent-dark`.
 */
const isAppearance = (value: string | null): value is Appearance =>
  APPEARANCES.some((option) => option.value === value);

const isViewMode = (value: string | null): value is ViewMode =>
  value === "native" || value === "web" || value === "outlines";

/**
 * The settings a presented page starts with: the presenting page hands its
 * own over in the URL, so a sheet looks like the app that opened it.
 */
const initialPreferences = (): Preferences => {
  const query = new URLSearchParams(window.location.search);
  const appearance = query.get("appearance");
  const mode = query.get("mode");
  const accent = ACCENTS.find((option) => option.name === query.get("accent"));
  return {
    appearance: isAppearance(appearance) ? appearance : DEFAULTS.appearance,
    accent: accent ?? DEFAULTS.accent,
    mode: isViewMode(mode) ? mode : DEFAULTS.mode,
  };
};

let applied: Preferences = DEFAULTS;

/** The settings as a query, for the URL of a page this one presents. */
export const preferencesQuery = (): string =>
  new URLSearchParams({
    appearance: applied.appearance,
    accent: applied.accent.name,
    mode: applied.mode,
  }).toString();

/** Presented pages follow the app; only the app itself tells the host what to do. */
const isPresentedPage = () => new URLSearchParams(window.location.search).has("page");

export const PreferencesProvider = ({ children }: React.PropsWithChildren) => {
  const [preferences, setPreferences] = React.useState(initialPreferences);
  applied = preferences;

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.appearance = preferences.appearance;
    root.dataset.viewMode = preferences.mode;
    root.style.setProperty("--accent-light", preferences.accent.light);
    root.style.setProperty("--accent-dark", preferences.accent.dark);
  }, [preferences.appearance, preferences.accent, preferences.mode]);

  React.useEffect(() => {
    if (!isPresentedPage()) postToHost({ type: "appearance", value: preferences.appearance });
  }, [preferences.appearance]);

  React.useEffect(() => {
    if (!isPresentedPage())
      postToHost({ type: "outlines", value: preferences.mode === "outlines" });
  }, [preferences.mode]);

  const value = React.useMemo<PreferencesValue>(
    () => ({
      ...preferences,
      set: (change) => setPreferences((current) => ({ ...current, ...change })),
    }),
    [preferences],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

const darkQuery = () =>
  typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : undefined;

/** Whether the page is drawn dark: the chosen scheme, or the system's. */
export const useIsDark = (): boolean => {
  const { appearance } = usePreferences();
  const system = React.useSyncExternalStore(
    (notify) => {
      const query = darkQuery();
      query?.addEventListener("change", notify);
      return () => query?.removeEventListener("change", notify);
    },
    () => darkQuery()?.matches ?? false,
  );
  return appearance === "system" ? system : appearance === "dark";
};

/**
 * The accent as a colour value for native props. Islands resolve a
 * `var(--accent)` prop once, so a prop that must follow the setting passes
 * the colour itself.
 */
export const useAccent = (): string => {
  const { accent } = usePreferences();
  return useIsDark() ? accent.dark : accent.light;
};
