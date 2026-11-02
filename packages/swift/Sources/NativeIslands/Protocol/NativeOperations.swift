import Foundation

struct NativeMount: Equatable, Sendable {
  let id: String
  let component: String
  let version: Int
  let props: [String: NativeValue]
  let frame: NativeFrame
  let anchor: NativeAnchor
  let visible: Bool
  let order: Int
  let sizing: NativeSizing
  let accessibility: NativeAccessibility?
  var stateRevision: Int?
  var sticky: NativeSticky?
  var clip: NativeFrame?
  var holes: [NativeFrame]?
  var shades: [NativeShade]?
  var transform: NativeTransform?
  var opacity: Double?
}

struct NativeUpdate: Equatable, Sendable {
  let id: String
  var props: [String: NativeValue]?
  var frame: NativeFrame?
  var anchor: NativeAnchor?
  var visible: Bool?
  var order: Int?
  var accessibility: NativeAccessibility?
  var stateRevision: Int?
  var sticky: NativeSticky?
  var clip: NativeFrame?
  var holes: [NativeFrame]?
  var shades: [NativeShade]?
  var transform: NativeTransform?
  var opacity: Double?
}

enum NativeOperation: Decodable, Equatable, Sendable {
  case mount(NativeMount)
  case update(NativeUpdate)
  case unmount(id: String)
  case invalid(id: String?)

  private enum Kind: String, Decodable {
    case mount
    case update
    case unmount
  }

  private enum CodingKeys: String, CodingKey {
    case kind = "op"
    case id
    case component
    case version
    case props
    case frame
    case anchor
    case visible
    case order
    case sizing
    case accessibility
    case stateRevision
    case sticky
    case clip
    case holes
    case shades
    case transform
    case opacity
  }

  var id: String? {
    switch self {
    case .mount(let mount): return mount.id
    case .update(let update): return update.id
    case .unmount(let id): return id
    case .invalid(let id): return id
    }
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    let id = try? container.decode(String.self, forKey: .id)
    do {
      self = try Self.decode(container, id: id)
    } catch {
      self = .invalid(id: id.flatMap(Self.validId))
    }
  }

  private static func validId(_ id: String) -> String? {
    id.isEmpty || id.count > NativeComponentLimits.maxIdLength ? nil : id
  }

  private static func decode(
    _ container: KeyedDecodingContainer<CodingKeys>,
    id rawId: String?
  ) throws -> NativeOperation {
    let kind = try container.decode(Kind.self, forKey: .kind)
    guard let id = rawId.flatMap(validId) else {
      throw DecodingError.dataCorruptedError(forKey: .id, in: container, debugDescription: "id")
    }
    switch kind {
    case .unmount:
      return .unmount(id: id)
    case .mount:
      let component = try container.decode(String.self, forKey: .component)
      let version = try container.decode(Int.self, forKey: .version)
      let frame = try container.decode(NativeFrame.self, forKey: .frame)
      let order = try container.decode(Int.self, forKey: .order)
      guard
        !component.isEmpty,
        component.count <= NativeComponentLimits.maxComponentNameLength,
        version > 0,
        order >= 0,
        frame.isValid
      else {
        throw DecodingError.dataCorruptedError(forKey: .frame, in: container, debugDescription: "mount")
      }
      return .mount(
        NativeMount(
          id: id,
          component: component,
          version: version,
          props: try container.decode([String: NativeValue].self, forKey: .props),
          frame: frame,
          anchor: try container.decode(NativeAnchor.self, forKey: .anchor),
          visible: try container.decode(Bool.self, forKey: .visible),
          order: order,
          sizing: try container.decode(NativeSizing.self, forKey: .sizing),
          accessibility: try container.decodeIfPresent(NativeAccessibility.self, forKey: .accessibility),
          stateRevision: try revision(in: container),
          sticky: try geometry(in: container).sticky,
          clip: try geometry(in: container).clip,
          holes: try geometry(in: container).holes,
          shades: try geometry(in: container).shades,
          transform: try geometry(in: container).transform,
          opacity: try geometry(in: container).opacity
        )
      )
    case .update:
      return try decodeUpdate(container, id: id)
    }
  }

  private static func decodeUpdate(
    _ container: KeyedDecodingContainer<CodingKeys>,
    id: String
  ) throws -> NativeOperation {
    let frame = try container.decodeIfPresent(NativeFrame.self, forKey: .frame)
    let order = try container.decodeIfPresent(Int.self, forKey: .order)
    if let frame, !frame.isValid {
      throw DecodingError.dataCorruptedError(forKey: .frame, in: container, debugDescription: "frame")
    }
    if let order, order < 0 {
      throw DecodingError.dataCorruptedError(forKey: .order, in: container, debugDescription: "order")
    }
    return .update(
      NativeUpdate(
        id: id,
        props: try container.decodeIfPresent([String: NativeValue].self, forKey: .props),
        frame: frame,
        anchor: try container.decodeIfPresent(NativeAnchor.self, forKey: .anchor),
        visible: try container.decodeIfPresent(Bool.self, forKey: .visible),
        order: order,
        accessibility: try container.decodeIfPresent(NativeAccessibility.self, forKey: .accessibility),
        stateRevision: try revision(in: container),
        sticky: try geometry(in: container).sticky,
        clip: try geometry(in: container).clip,
        holes: try geometry(in: container).holes,
        shades: try geometry(in: container).shades,
        transform: try geometry(in: container).transform,
        opacity: try geometry(in: container).opacity
      )
    )
  }

  struct NativeGeometry {
    let sticky: NativeSticky?
    let clip: NativeFrame?
    let holes: [NativeFrame]?
    let shades: [NativeShade]?
    let transform: NativeTransform?
    let opacity: Double?
  }

  static let maxHoles = 8

  private static func geometry(
    in container: KeyedDecodingContainer<CodingKeys>
  ) throws -> NativeGeometry {
    let sticky = try container.decodeIfPresent(NativeSticky.self, forKey: .sticky)
    let clip = try container.decodeIfPresent(NativeFrame.self, forKey: .clip)
    if let sticky, !sticky.isValid {
      throw DecodingError.dataCorruptedError(forKey: .sticky, in: container, debugDescription: "sticky")
    }
    if let clip, !clip.isValid {
      throw DecodingError.dataCorruptedError(forKey: .clip, in: container, debugDescription: "clip")
    }
    let holes = try container.decodeIfPresent([NativeFrame].self, forKey: .holes)
    if let holes, holes.count > maxHoles || holes.contains(where: { !$0.isValid }) {
      throw DecodingError.dataCorruptedError(forKey: .holes, in: container, debugDescription: "holes")
    }
    let shades = try container.decodeIfPresent([NativeShade].self, forKey: .shades)
    if let shades, shades.count > maxHoles || shades.contains(where: { !$0.isValid }) {
      throw DecodingError.dataCorruptedError(forKey: .shades, in: container, debugDescription: "shades")
    }
    let transform = try container.decodeIfPresent(NativeTransform.self, forKey: .transform)
    if let transform, !transform.isValid {
      throw DecodingError.dataCorruptedError(forKey: .transform, in: container, debugDescription: "transform")
    }
    let opacity = try container.decodeIfPresent(Double.self, forKey: .opacity)
    if let opacity, !(0...1).contains(opacity) {
      throw DecodingError.dataCorruptedError(forKey: .opacity, in: container, debugDescription: "opacity")
    }
    return NativeGeometry(
      sticky: sticky,
      clip: clip,
      holes: holes,
      shades: shades,
      transform: transform,
      opacity: opacity
    )
  }

  private static func revision(in container: KeyedDecodingContainer<CodingKeys>) throws -> Int? {
    let revision = try container.decodeIfPresent(Int.self, forKey: .stateRevision)
    if let revision, revision < 0 {
      throw DecodingError.dataCorruptedError(
        forKey: .stateRevision,
        in: container,
        debugDescription: "state_revision"
      )
    }
    return revision
  }
}

struct NativeComponentCommand: Decodable, Equatable, Sendable {
  let id: String
  let requestId: String
  let name: String
  let args: NativeValue?

  init(id: String, requestId: String, name: String, args: NativeValue? = nil) {
    self.id = id
    self.requestId = requestId
    self.name = name
    self.args = args
  }
}

struct NativeComponentResponse: Decodable, Equatable, Sendable {
  let id: String
  let requestId: String
  let succeeded: Bool
  let value: NativeValue?
  let error: String?

  private enum CodingKeys: String, CodingKey {
    case id
    case requestId
    case succeeded = "ok"
    case value
    case error
  }

  init(
    id: String,
    requestId: String,
    succeeded: Bool,
    value: NativeValue? = nil,
    error: String? = nil
  ) {
    self.id = id
    self.requestId = requestId
    self.succeeded = succeeded
    self.value = value
    self.error = error
  }
}

struct NativeComponentBatch: Decodable, Equatable, Sendable {
  let sequence: Int
  let operations: [NativeOperation]

  private enum CodingKeys: String, CodingKey {
    case `protocol`
    case sequence
    case operations
  }

  init(sequence: Int, operations: [NativeOperation]) {
    self.sequence = sequence
    self.operations = operations
  }

  static func isCurrentProtocol(_ decoder: Decoder) -> Bool {
    guard let container = try? decoder.container(keyedBy: CodingKeys.self) else { return false }
    return (try? container.decode(Int.self, forKey: .protocol)) == NativeComponentLimits.protocolVersion
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    let version = try container.decode(Int.self, forKey: .protocol)
    let sequence = try container.decode(Int.self, forKey: .sequence)
    let operations = try container.decode([NativeOperation].self, forKey: .operations)
    guard
      version == NativeComponentLimits.protocolVersion,
      sequence > 0,
      !operations.isEmpty,
      operations.count <= NativeComponentLimits.maxOperationsPerBatch
    else {
      throw DecodingError.dataCorruptedError(
        forKey: .operations,
        in: container,
        debugDescription: "Not a native component batch this host understands."
      )
    }
    self.sequence = sequence
    self.operations = operations
  }
}
