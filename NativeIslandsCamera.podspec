Pod::Spec.new do |s|
  s.name = 'NativeIslandsCamera'
  s.version = '0.1.0'
  s.summary = 'The live camera island for pages that use native-islands/components.'
  s.description = 'The live camera island, drawn by AVFoundation inside the page, with a capture command that hands a photo back to it. Needs NSCameraUsageDescription.'
  s.homepage = 'https://github.com/superwall/native-islands'
  s.license = { type: 'FSL-1.1-MIT', file: 'LICENSE' }
  s.author = 'Superwall'
  s.source = { git: 'https://github.com/superwall/native-islands.git', tag: "v#{s.version}" }

  s.ios.deployment_target = '15.0'
  s.swift_versions = ['5.0']

  s.source_files = 'packages/swift/Sources/NativeIslandsCamera/**/*.swift'
  s.frameworks = 'UIKit', 'SwiftUI', 'AVFoundation'
  s.pod_target_xcconfig = { 'OTHER_SWIFT_FLAGS' => '$(inherited) -package-name NativeIslands' }
  s.dependency 'NativeIslands', s.version.to_s
  s.dependency 'NativeIslandsComponents', s.version.to_s
end
