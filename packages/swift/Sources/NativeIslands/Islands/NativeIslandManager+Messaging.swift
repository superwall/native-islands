import Foundation

extension NativeIslandManager {
  // MARK: - Commands and requests

  func perform(_ command: NativeComponentCommand) {
    guard let island = islands[command.id], let handler = island.context.commandHandler else {
      post(
        .reply(
          requestId: command.requestId,
          succeeded: false,
          value: nil,
          error: "No native component \(command.id) takes commands."
        )
      )
      return
    }
    let args = command.args?.anyValue
    Task { @MainActor [weak self] in
      let reply: NativeReply
      do {
        let result = try await handler(command.name, args)
        if let result {
          if let value = NativeValue(any: result) {
            reply = .reply(requestId: command.requestId, succeeded: true, value: value, error: nil)
          } else {
            reply = .reply(
              requestId: command.requestId,
              succeeded: false,
              value: nil,
              error: NativeComponentError.invalidValue.localizedDescription
            )
          }
        } else {
          reply = .reply(requestId: command.requestId, succeeded: true, value: nil, error: nil)
        }
      } catch {
        reply = .reply(
          requestId: command.requestId,
          succeeded: false,
          value: nil,
          error: error.localizedDescription
        )
      }
      self?.post(reply)
    }
  }

  func receive(_ response: NativeComponentResponse) {
    guard let pending = pendingRequests.removeValue(forKey: response.requestId) else { return }
    if response.succeeded {
      pending.continuation.resume(returning: response.value)
    } else {
      pending.continuation.resume(
        throwing: NativeComponentError.refused(response.error ?? "The page refused the request.")
      )
    }
  }

  func request(from id: String, name: String, payload: NativeValue?) async throws -> NativeValue? {
    guard let island = islands[id] else { throw NativeComponentError.unmounted }
    requestCount += 1
    let requestId = "ios-\(requestCount)"
    let sequence = island.context.sequence
    let timeoutNanoseconds = requestTimeoutNanoseconds
    let timeout = Task { @MainActor [weak self] in
      try await Task.sleep(nanoseconds: timeoutNanoseconds)
      guard let pending = self?.pendingRequests.removeValue(forKey: requestId) else { return }
      pending.continuation.resume(throwing: NativeComponentError.timedOut)
    }
    defer { timeout.cancel() }
    return try await withCheckedThrowingContinuation { continuation in
      pendingRequests[requestId] = PendingRequest(islandId: id, continuation: continuation)
      post(.request(id: id, requestId: requestId, name: name, payload: payload, sequence: sequence))
    }
  }

  func ready(_ id: String) {
    guard let island = islands[id], !island.context.isAcknowledged else { return }
    island.context.acknowledge()
    post(.ack(sequence: island.context.sequence, ids: [id]))
  }

  // MARK: - Outbox

  func post(_ reply: NativeReply) {
    outbox.append(reply)
    guard !applyingBatch, !flushScheduled else { return }
    flushScheduled = true
    schedule { [weak self] in
      self?.flush()
    }
  }

  func flush() {
    flushScheduled = false
    guard !outbox.isEmpty else { return }
    let replies = outbox
    outbox.removeAll()
    send(replies)
  }
}
