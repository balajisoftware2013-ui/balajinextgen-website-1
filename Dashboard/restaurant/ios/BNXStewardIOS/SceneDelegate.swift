import UIKit
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let ws = scene as? UIWindowScene else { return }
        let vc = StewardViewController()
        let w = UIWindow(windowScene: ws); w.rootViewController = vc; window = w; w.makeKeyAndVisible()
    }
}
