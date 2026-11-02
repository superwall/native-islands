/** Set by the React bindings on each island's wrapper, holding the island's id. */
export const ISLAND_ID_ATTRIBUTE = "data-island-id";

/**
 * Set by the page on an element whose content is entering or leaving, such as
 * a route during a page transition. Islands inside it show their web version
 * meanwhile, unless they ride a layered scroller.
 */
export const ISLAND_PHASE_ATTRIBUTE = "data-island-phase";

/** Set on an island's wrapper while its cover test runs, so its own content can be hit-tested. */
export const ISLAND_PROBE_ATTRIBUTE = "data-island-probe";

/** Marks the layers the simulated host draws into, so their changes do not count as layout. */
export const SIMULATOR_LAYER_ATTRIBUTE = "data-island-simulator-layer";

/** Marks an outline the simulated host drew, holding the island's id. */
export const SIMULATED_ISLAND_ATTRIBUTE = "data-island-simulated";

/** Set by the React bindings on each island's wrapper, holding the component's name. */
export const ISLAND_COMPONENT_ATTRIBUTE = "data-island";

/** Set on an island's wrapper: `web`, `pending` or `native`. */
export const ISLAND_MODE_ATTRIBUTE = "data-island-mode";

/** Set on an island's wrapper while it shows its web version for a moment, holding why. */
export const ISLAND_HANDOFF_ATTRIBUTE = "data-island-handoff";

/** Set on an island's wrapper while the native view is shown, so the web children fade out. */
export const ISLAND_SHOWN_ATTRIBUTE = "data-island-shown";

/** Set on an island's wrapper once its web children have faded, hiding them from taps, focus and VoiceOver. */
export const ISLAND_CONCEALED_ATTRIBUTE = "data-island-concealed";

/** Marks the style element the React bindings add to the document. */
export const ISLAND_STYLE_ATTRIBUTE = "data-island-styles";
