/** Vite's `?raw` imports: a file's text, for tests that read the other side of the contract. */
declare module "*?raw" {
  const source: string;
  export default source;
}
