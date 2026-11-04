// swift-tools-version:6.0
import PackageDescription

let package = Package(
  name: "NativeIslands",
  platforms: [.iOS(.v15)],
  products: [
    .library(name: "NativeIslands", targets: ["NativeIslands"]),
    .library(name: "NativeIslandsComponents", targets: ["NativeIslandsComponents"])
  ],
  targets: [
    .target(name: "NativeIslands", path: "packages/swift/Sources/NativeIslands"),
    .target(
      name: "NativeIslandsComponents",
      dependencies: ["NativeIslands"],
      path: "packages/swift/Sources/NativeIslandsComponents"
    ),
    .testTarget(
      name: "NativeIslandsTests",
      dependencies: ["NativeIslands"],
      path: "packages/swift/Tests/NativeIslandsTests"
    ),
    .testTarget(
      name: "NativeIslandsComponentsTests",
      dependencies: ["NativeIslandsComponents"],
      path: "packages/swift/Tests/NativeIslandsComponentsTests"
    )
  ],
  swiftLanguageModes: [.v5]
)
