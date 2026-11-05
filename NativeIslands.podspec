Pod::Spec.new do |s|
  s.name = 'NativeIslands'
  s.version = '0.1.0'
  s.summary = 'Native views drawn inside a WKWebView page that uses the native-islands npm package.'
  s.description = <<~DESC
    NativeIslands draws native SwiftUI views in WebKit's own scroll views, so they
    scroll, slide and are covered exactly like the web content around them. The page
    keeps control of layout and shows web versions of anything the host cannot draw.
  DESC
  s.homepage = 'https://github.com/superwall/native-islands'
  s.license = { type: 'FSL-1.1-MIT', file: 'LICENSE' }
  s.author = 'Superwall'
  s.source = { git: 'https://github.com/superwall/native-islands.git', tag: "v#{s.version}" }

  s.ios.deployment_target = '15.0'
  s.swift_versions = ['5.0']

  s.source_files = 'packages/swift/Sources/NativeIslands/**/*.swift'
  s.frameworks = 'UIKit', 'WebKit', 'SwiftUI', 'QuartzCore', 'CoreGraphics'
end
