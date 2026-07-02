import SwiftUI

enum AppTab: Hashable {
    case map
    case memories
    case wishlist
    case us
}

struct AppRootView: View {
    @State private var selectedTab: AppTab = .map
    @State private var deepLinkedCity: MapCity?

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                MapHomeView(deepLinkedCity: $deepLinkedCity)
            }
            .tabItem { Label("地图", systemImage: "map") }
            .tag(AppTab.map)

            NavigationStack {
                MemoryTimelineView()
            }
            .tabItem { Label("回忆", systemImage: "photo.on.rectangle") }
            .tag(AppTab.memories)

            NavigationStack {
                WishlistView()
            }
            .tabItem { Label("心愿", systemImage: "heart") }
            .tag(AppTab.wishlist)

            NavigationStack {
                UsView()
            }
            .tabItem { Label("我们", systemImage: "sparkles") }
            .tag(AppTab.us)
        }
        .tint(Color.bloom)
        .onOpenURL { url in
            openDeepLink(url)
        }
    }

    private func openDeepLink(_ url: URL) {
        guard url.scheme == "mapofus" else { return }

        let cityId = cityId(from: url)
        guard let cityId, let city = MapCity.all.first(where: { $0.id == cityId }) else { return }

        selectedTab = .map
        deepLinkedCity = city
    }

    private func cityId(from url: URL) -> String? {
        if url.host == "city" {
            return url.pathComponents.dropFirst().first
        }

        if url.host == "open",
           let components = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            return components.queryItems?.first(where: { $0.name == "city" })?.value
        }

        return nil
    }
}
