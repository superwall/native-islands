# NativeIslands

Native views inside `WKWebView` pages. Write the page in React, mark the few
elements that should be native, and the app draws them as real UIKit or SwiftUI
views (Liquid Glass buttons, switches, your own components) right where the web
element sits. Everywhere else, and on any host without NativeIslands, the web
version shows.

Private while it takes shape.

## Packages

| Side | Package | Where |
| --- | --- | --- |
| Host (iOS) | `NativeIslands` (Swift Package Manager) | `Sources/NativeIslands` |
| Page | `@superwall/native-islands` | `js/` |

Both sides speak the contract in `contract/contract.json`.

## Develop

```bash
bun install
bun run --cwd js test:run
bun run --cwd js typecheck
xcodebuild test -scheme NativeIslands -destination 'platform=iOS Simulator,name=iPhone 17'
```
