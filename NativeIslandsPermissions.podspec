Pod::Spec.new do |s|
  s.name = 'NativeIslandsPermissions'
  s.version = '0.1.0'
  s.summary = 'The permission prompt island for pages that use native-islands/components.'
  s.description = 'The permission button island. Needs the usage description of each kind the pages ask for.'
  s.homepage = 'https://github.com/superwall/native-islands'
  s.license = { type: 'FSL-1.1-MIT', file: 'LICENSE' }
  s.author = 'Superwall'
  s.source = { git: 'https://github.com/superwall/native-islands.git', tag: "v#{s.version}" }

  s.ios.deployment_target = '15.0'
  s.swift_versions = ['5.0']

  s.source_files = 'packages/swift/Sources/NativeIslandsPermissions/**/*.swift'
  s.frameworks = 'UIKit', 'SwiftUI', 'AVFoundation', 'CoreLocation', 'Photos', 'UserNotifications'
  s.pod_target_xcconfig = { 'OTHER_SWIFT_FLAGS' => '$(inherited) -package-name NativeIslands' }
  s.dependency 'NativeIslands', s.version.to_s
  s.dependency 'NativeIslandsComponents', s.version.to_s
end
