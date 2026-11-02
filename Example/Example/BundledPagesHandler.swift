import UniformTypeIdentifiers
import WebKit

/// Serves `islands://pages/<path>` from the `pages` folder the build copies
/// into the app, so the pages' ES modules load as they would from a server.
final class BundledPagesHandler: NSObject, WKURLSchemeHandler {
  private let root: URL?

  init(root: URL? = Bundle.main.url(forResource: "pages", withExtension: nil)) {
    self.root = root?.standardizedFileURL
  }

  func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
    guard
      let url = task.request.url,
      let root,
      case let file = root.appendingPathComponent(url.path).standardizedFileURL,
      file.path.hasPrefix(root.path),
      let data = try? Data(contentsOf: file)
    else {
      task.didFailWithError(URLError(.fileDoesNotExist))
      return
    }
    let type = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
    let response = HTTPURLResponse(
      url: url,
      statusCode: 200,
      httpVersion: "HTTP/1.1",
      headerFields: ["Content-Type": type, "Content-Length": "\(data.count)"]
    ) ?? URLResponse(url: url, mimeType: type, expectedContentLength: data.count, textEncodingName: nil)
    task.didReceive(response)
    task.didReceive(data)
    task.didFinish()
  }

  func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}
}
