import os

/// Where the host logs what it ignored or could not do.
enum NativeIslandsLog {
  static let main = Logger(subsystem: "com.superwall.native-islands", category: "host")
}
