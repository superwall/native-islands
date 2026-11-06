import type { SymbolRenderer } from "native-islands/components";
import { WebSymbol } from "./icons";

/** Draws SF Symbols in the package's web versions with the showcase's own drawings. */
export const webSymbol: SymbolRenderer = (name) => <WebSymbol name={name} />;
