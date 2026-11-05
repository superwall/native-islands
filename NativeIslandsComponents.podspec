Pod::Spec.new do |s|
  s.name = 'NativeIslandsComponents'
  s.version = '0.1.0'
  s.summary = 'Ready-made native controls for pages that use native-islands/components.'
  s.description = <<~DESC
    Glass buttons, menus, toggles, segmented controls, sliders, steppers, pickers,
    date and colour pickers, text fields, symbols, gauges, Swift Charts, video,
    the photo picker, haptics, the share sheet and TipKit tips, registered with
    one call under the names the native-islands/components entry on the page
    mounts. None needs an Info.plist key.
  DESC
  s.homepage = 'https://github.com/superwall/native-islands'
  s.license = { type: 'FSL-1.1-MIT', file: 'LICENSE' }
  s.author = 'Superwall'
  s.source = { git: 'https://github.com/superwall/native-islands.git', tag: "v#{s.version}" }

  s.ios.deployment_target = '15.0'
  s.swift_versions = ['5.0']

  s.source_files = 'packages/swift/Sources/NativeIslandsComponents/**/*.swift'
  s.frameworks = 'UIKit', 'SwiftUI', 'AVKit', 'PhotosUI'
  s.weak_frameworks = 'Charts', 'TipKit'
  # Shares helpers with the other component pods through Swift's `package` access.
  s.pod_target_xcconfig = { 'OTHER_SWIFT_FLAGS' => '$(inherited) -package-name NativeIslands' }
  s.dependency 'NativeIslands', s.version.to_s
end
