# Contributing to Native Islands

Thanks for taking a look. Native Islands is experimental: the contract between
page and host still changes, and so do the APIs on both sides. Bug reports with
a page that reproduces them are the most useful thing you can send.

## Reporting a bug

Open an issue with:

- the iOS version and device (or simulator) it happens on;
- the smallest page that shows it, ideally a new page in `tests/pages`;
- what you expected and what you saw, with a screenshot or recording when the
  problem is visual.

Layout bugs are easiest to fix with the alignment log. Start the scenario
pages with `bun run --cwd tests/pages dev`, then run a Debug build of the
TestHost app (`tests/ios`) with the launch arguments
`-pagesURL http://<your-mac>:5173/ -NativeIslandsAlignmentLog YES`. The first
loads your pages from the dev server; the second logs each native frame beside
its DOM rect in the Xcode console. Add `-route <name>` to open one page.

## Setting up

You need macOS with Xcode 26 or later, [Bun](https://bun.sh) 1.4.4 or later,
[XcodeGen](https://github.com/yonaskolb/XcodeGen) and
[SwiftLint](https://github.com/realm/SwiftLint).

```bash
bun install
bun run --cwd examples/showcase dev   # the example app in a browser, with ?native=simulate
```

`?native=simulate` installs the JS reference host, so most page-side work needs
no simulator.

## The contract

Page and host speak one contract, written down twice: the zod schemas in
`packages/web/src/protocol/` and the Swift models in
`packages/swift/Sources/NativeIslands/Protocol/`. `tests/fixtures/messages.json`
holds one example of every message, and the tests of both packages decode it,
so a change that one side cannot read fails a test.

Change the contract additively: add optional fields and new messages, and
never rename or repurpose one. Add each new message to the fixture.

## Checks

Run what your change touches. CI runs everything on the pull request.

| What                      | Command                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| JS tests (one file)       | `bun run --cwd packages/web test:run test/<file>`                                            |
| JS types                  | `bun run --cwd packages/web typecheck`                                                       |
| JS lint                   | `bunx oxlint --deny-warnings packages/web tests/pages examples/showcase performance`         |
| Formatting                | `bunx oxfmt --check packages/web tests examples performance`                                 |
| Swift tests               | `xcodebuild test -scheme NativeIslands -destination 'platform=iOS Simulator,name=iPhone 17'` |
| SwiftLint                 | `swiftlint lint --quiet --strict packages/swift tests/ios examples/ios`                      |
| UI and screenshot tests   | `scripts/ui-tests.sh`                                                                        |
| Every installed iOS       | `scripts/compat-matrix.sh`                                                                   |
| Performance against today | `performance/run.sh`                                                                         |
| Web package               | `bun run --cwd packages/web build && bunx publint packages/web --strict`                     |
| Packed in fresh apps      | `scripts/pack-smoke.sh`                                                                      |

`packages/web/src` stays at 100% test coverage. Record new screenshot
baselines (`scripts/ui-tests.sh --record`) only after a deliberate visual
change, and say so in the pull request.

## Style

- JS is strict TypeScript: no `any`, no non-null assertions, and no `as` casts
  outside tests. Narrow with a type guard or a schema.
- Swift uses 2-space indentation, Swift Testing, and passes
  `swiftlint --strict`.
- Comment only what the code cannot say: a non-obvious requirement on a public
  API, or why code works around platform behaviour.
- When the page cannot tell whether an island can be shown, it shows the web
  version. Never read "couldn't check" as "nothing there".

[AGENTS.md](./AGENTS.md) has the full layout of the repository and the rules
coding agents follow here; they apply to people too.

## Releasing

A tag releases everything at once. Swift Package Manager and CocoaPods read the
tag from this repository; the workflow publishes the `native-islands` npm
package and creates the GitHub release. The pods are not pushed to the
CocoaPods trunk, which is going read-only: Podfiles name this repository and the
tag instead.

1. Bump `version` in `packages/web/package.json` and `s.version` in the four
   podspecs, then run `scripts/release-check.sh v<version>` and
   `scripts/pack-smoke.sh`. Check what npm will ship with
   `cd packages/web && npm pack --dry-run`: only `dist`, `README.md`, `LICENSE`
   and `package.json`.
2. Merge that to `main`, then tag the merge commit and push the tag:

   ```bash
   git fetch origin
   git tag v0.1.0 origin/main
   git push origin v0.1.0
   ```

`.github/workflows/release.yml` then checks that every version matches the tag,
publishes to npm (a version with a `-` goes to the `next` dist-tag) and creates
the release with generated notes. Each step skips what is already published, so
a failed run can be re-run on the same tag.

npm publishes through [trusted publishing](https://docs.npmjs.com/trusted-publishers):
there is no token secret. On npmjs.com, the `native-islands` package's
Settings → Trusted Publisher names GitHub Actions, the `superwall` organization,
the `native-islands` repository and the `release.yml` workflow. npm only adds
provenance while the repository is public.

## Licence

Native Islands is released under the [Functional Source License 1.1, MIT
Future License](./LICENSE). By sending a pull request you agree that your
contribution is released under the same licence.
