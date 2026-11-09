// swift-tools-version:6.0
import PackageDescription

let package = Package(
  name: "NativeIslands",
  platforms: [.iOS(.v15)],
  products: [
    .library(name: "NativeIslands", targets: ["NativeIslands"]),
    .library(name: "NativeIslandsComponents", targets: ["NativeIslandsComponents"]),
    .library(name: "NativeIslandsMaps", targets: ["NativeIslandsMaps"]),
    .library(name: "NativeIslandsCharts", targets: ["NativeIslandsCharts"])
  ],
  targets: [
    .target(name: "NativeIslands", path: "packages/swift/Sources/NativeIslands"),
    .target(
      name: "NativeIslandsComponents",
      dependencies: ["NativeIslands"],
      path: "packages/swift/Sources/NativeIslandsComponents"
    ),
    .target(
      name: "NativeIslandsMaps",
      dependencies: ["NativeIslands", "NativeIslandsComponents"],
      path: "packages/swift/Sources/NativeIslandsMaps"
    ),
    .target(
      name: "NativeIslandsCharts",
      dependencies: ["NativeIslands", "NativeIslandsComponents"],
      path: "packages/swift/Sources/NativeIslandsCharts"
    ),
    .testTarget(
      name: "NativeIslandsTests",
      dependencies: ["NativeIslands"],
      path: "packages/swift/Tests/NativeIslandsTests"
    ),
    .testTarget(
      name: "NativeIslandsComponentsTests",
      dependencies: [
        "NativeIslandsComponents", "NativeIslandsMaps", "NativeIslandsCharts"
      ],
      path: "packages/swift/Tests/NativeIslandsComponentsTests"
    )
  ],
  swiftLanguageModes: [.v5]
)
