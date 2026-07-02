import SwiftUI

@main
struct MapOfUsApp: App {
    @StateObject private var store = FootprintStore()

    var body: some Scene {
        WindowGroup {
            LockedAppView()
                .environmentObject(store)
        }
    }
}
