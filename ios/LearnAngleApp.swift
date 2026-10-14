import SwiftUI
import WebKit

// A native container is necessary: PWA/WebKit JavaScript cannot create
// ActivityKit Live Activities by itself.
@main
struct LearnAngleApp: App {
    var body: some Scene {
        WindowGroup {
            LearnAngleWebContainer()
                .ignoresSafeArea(edges: .bottom)
        }
    }
}

struct LearnAngleWebContainer: UIViewRepresentable {
    private let site = URL(string: "https://easylearnfromtw.github.io/Learneasyly-/")!

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.userContentController.add(
            context.coordinator.bridge, name: LiveActivityBridge.messageName
        )
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        context.coordinator.webView = webView
        webView.load(URLRequest(url: site))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        let bridge = LiveActivityBridge()
        weak var webView: WKWebView?

        override init() {
            super.init()
            NotificationCenter.default.addObserver(
                self, selector: #selector(refreshTimer),
                name: UIApplication.didBecomeActiveNotification, object: nil
            )
        }

        deinit { NotificationCenter.default.removeObserver(self) }

        @objc private func refreshTimer() {
            webView?.evaluateJavaScript("window.learnAngleSyncTimer && window.learnAngleSyncTimer()")
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            refreshTimer()
        }

        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel); return
            }
            if url.scheme == "http" || url.scheme == "https" {
                if url.host != "easylearnfromtw.github.io" ||
                   !url.path.hasPrefix("/Learneasyly-") {
                    UIApplication.shared.open(url)
                    decisionHandler(.cancel)
                    return
                }
            }
            decisionHandler(.allow)
        }
    }
}
