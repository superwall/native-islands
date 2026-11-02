// swift-tools-version:6.0
import PackageDescription

let package = Package(
  name: "NativeIslands",
  platforms: [.iOS(.v15)],
  products: [
    .library(name: "NativeIslands", targets: ["NativeIslands"])
  ],
  targets: [
    .target(name: "NativeIslands", path: "packages/swift/Sources/NativeIslands"),
    .testTarget(
      name: "NativeIslandsTests",
      dependencies: ["NativeIslands"],
      path: "packages/swift/Tests/NativeIslandsTests"
    )
  ],
  swiftLanguageModes: [.v5]
)
