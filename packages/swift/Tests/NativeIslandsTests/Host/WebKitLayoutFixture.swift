import CoreGraphics

/// One page with every layout the host relies on WebKit to build a view for.
/// Each element the probe looks at has `data-probe`; `window.probe()` measures
/// them the way `packages/web/src/layout/measure.ts` does.
enum WebKitLayoutFixture {
  static let viewport = CGSize(width: 390, height: 844)

  /// Scrolling areas the matcher must find, by `data-probe` id.
  static let scrollers = [
    "list", "list-scrolled", "nested-outer", "nested-inner", "horizontal", "sticky",
    "fixed", "transformed", "isolated", "contents", "route", "parked", "parked-twin"
  ]

  /// Composited boxes whose place in the view tree the host relies on.
  static let layers = ["cover", "animated-child"]

  static let html = """
    <!doctype html>
    <html>
    <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; height: 3000px; font: 14px -apple-system; position: relative; }
      .scroller { position: absolute; overflow: auto; background: #eef; }
      .tall { height: 1200px; background: linear-gradient(#fff, #99f); }
      .wide { width: 1400px; height: 100%; background: linear-gradient(90deg, #fff, #f99); }
      .route { position: absolute; top: 0; width: 390px; height: 844px; }
      @keyframes slide { from { transform: translateX(100%); } to { transform: translateX(0); } }
    </style>
    </head>
    <body>
      <div class="scroller" data-probe="list" style="left: 10px; top: 20px; width: 180px; height: 160px">
        <div class="tall"></div>
      </div>
      <div class="scroller" data-probe="list-scrolled" style="left: 200px; top: 20px; width: 180px; height: 160px; border: 3px solid #333">
        <div class="tall"></div>
      </div>
      <div class="scroller" data-probe="nested-outer" style="left: 10px; top: 200px; width: 370px; height: 200px">
        <div style="height: 900px; padding-top: 40px">
          <div class="scroller" data-probe="nested-inner" style="position: relative; margin-left: 20px; width: 300px; height: 100px">
            <div class="wide"></div>
          </div>
        </div>
      </div>
      <div class="scroller" data-probe="horizontal" style="left: 10px; top: 420px; width: 370px; height: 80px">
        <div class="wide"></div>
      </div>
      <div class="scroller" data-probe="sticky" style="left: 10px; top: 520px; width: 370px; height: 160px">
        <div style="position: sticky; top: 0; height: 40px; background: #333"></div>
        <div class="tall"></div>
      </div>
      <div class="scroller" data-probe="fixed" style="position: fixed; left: 20px; bottom: 20px; width: 160px; height: 100px">
        <div class="tall"></div>
      </div>
      <div class="scroller" data-probe="transformed" style="left: 10px; top: 700px; width: 180px; height: 120px; transform: translate(12px, 8px)">
        <div class="tall"></div>
      </div>
      <div class="scroller" data-probe="isolated" style="left: 200px; top: 700px; width: 180px; height: 120px; isolation: isolate">
        <div class="tall">
          <div data-probe="animated-child" style="margin: 20px; width: 60px; height: 40px; background: #f80; will-change: transform; transform: translateZ(0)"></div>
        </div>
      </div>
      <span style="display: contents">
        <div class="scroller" data-probe="contents" style="left: 10px; top: 860px; width: 370px; height: 120px">
          <div class="tall"></div>
        </div>
      </span>
      <div data-probe="cover" style="position: absolute; left: 0; top: 140px; width: 390px; height: 60px; background: rgba(0, 0, 0, 0.5); will-change: transform"></div>
      <div style="position: absolute; left: 0; top: 1000px; width: 390px; height: 844px; overflow: hidden">
        <div class="route" style="left: 0; animation: slide 0.3s ease-out both">
          <div class="scroller" data-probe="route" style="left: 0; top: 0; width: 390px; height: 400px">
            <div class="tall"></div>
          </div>
        </div>
      </div>
      <div style="position: absolute; left: 0; top: 1900px; width: 390px; height: 844px; overflow: hidden; isolation: isolate">
        <div class="route" style="left: 0">
          <div class="scroller" data-probe="parked-twin" style="left: 0; top: 0; width: 390px; height: 400px">
            <div class="tall"></div>
          </div>
        </div>
        <div class="route" style="left: 100%">
          <div class="scroller" data-probe="parked" style="left: 0; top: 0; width: 390px; height: 400px">
            <div class="tall"></div>
          </div>
        </div>
      </div>
      <script>
        document.querySelector('[data-probe="list-scrolled"]').scrollTop = 150;
        document.querySelector('[data-probe="nested-outer"]').scrollTop = 30;
        document.querySelector('[data-probe="nested-inner"]').scrollLeft = 200;
        document.querySelector('[data-probe="horizontal"]').scrollLeft = 300;
        document.querySelector('[data-probe="sticky"]').scrollTop = 200;
        const rectOf = (element) => {
          const rect = element.getBoundingClientRect();
          return [rect.left, rect.top, rect.width, rect.height];
        };
        window.probe = () => {
          const out = {};
          for (const element of document.querySelectorAll("[data-probe]")) {
            const rect = element.getBoundingClientRect();
            const scaleX = element.offsetWidth > 0 && rect.width > 0 ? rect.width / element.offsetWidth : 1;
            const scaleY = element.offsetHeight > 0 && rect.height > 0 ? rect.height / element.offsetHeight : 1;
            out[element.dataset.probe] = {
              rect: [rect.left, rect.top, rect.width, rect.height],
              box: [
                rect.left + element.clientLeft * scaleX,
                rect.top + element.clientTop * scaleY,
                element.clientWidth * scaleX,
                element.clientHeight * scaleY
              ],
              content: [element.scrollWidth, element.scrollHeight],
              offset: [element.scrollLeft, element.scrollTop],
              child: element.firstElementChild ? rectOf(element.firstElementChild) : null
            };
          }
          return JSON.stringify({
            elements: out,
            page: {
              content: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
              offset: [window.scrollX, window.scrollY]
            },
            userAgent: navigator.userAgent
          });
        };
      </script>
    </body>
    </html>
    """
}
