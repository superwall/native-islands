import * as React from "react";
import { postToHost } from "./host";

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
  native: boolean;
};

type PreferencesValue = Preferences & {
  set: (change: Partial<Preferences>) => void;
};

const DEFAULTS: Preferences = {
  appearance: "system",
  accent: ACCENTS[0] ?? { name: "Blue", light: "#007aff", dark: "#0a84ff" },
  native: true,
};

const PreferencesContext = React.createContext<PreferencesValue>({ ...DEFAULTS, set: () => {} });

export const usePreferences = (): PreferencesValue => React.useContext(PreferencesContext);

/** Whether islands draw natively; Settings can switch them all to their web versions. */
export const useNativeEnabled = (): boolean => React.useContext(PreferencesContext).native;

/**
 * Holds the app's settings for the session and applies them to the document:
 * the colour scheme as `data-appearance` on `<html>` (the host follows it, so
 * native views do too) and the accent as `--accent-light`/`--accent-dark`.
 */
export const PreferencesProvider = ({ children }: React.PropsWithChildren) => {
  const [preferences, setPreferences] = React.useState(DEFAULTS);

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.appearance = preferences.appearance;
    root.style.setProperty("--accent-light", preferences.accent.light);
    root.style.setProperty("--accent-dark", preferences.accent.dark);
  }, [preferences.appearance, preferences.accent]);

  React.useEffect(() => {
    postToHost({ type: "appearance", value: preferences.appearance });
  }, [preferences.appearance]);

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
