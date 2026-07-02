import AppIntents
import SwiftUI

struct MapCityEntity: AppEntity {
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Map of Us City")
    static var defaultQuery = MapCityQuery()

    let id: String
    let name: String
    let province: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(name)",
            subtitle: "\(province)"
        )
    }

    init(city: MapCity) {
        self.id = city.id
        self.name = city.name
        self.province = city.province
    }
}

struct MapCityQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [MapCityEntity] {
        MapCity.all
            .filter { identifiers.contains($0.id) }
            .map(MapCityEntity.init)
    }

    func suggestedEntities() async throws -> [MapCityEntity] {
        MapCity.featured.prefix(12).map(MapCityEntity.init)
    }

    func defaultResult() async -> MapCityEntity? {
        MapCity.featured.first.map(MapCityEntity.init)
    }
}

@available(iOS 18.0, *)
struct OpenMapOfUsIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Map of Us"
    static var description = IntentDescription("Open the Map of Us footprint map.")
    static var openAppWhenRun = true

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(URL(string: "mapofus://open")!))
    }
}

@available(iOS 18.0, *)
struct OpenMapCityIntent: AppIntent {
    static var title: LocalizedStringResource = "Open City in Map of Us"
    static var description = IntentDescription("Open a city record in Map of Us.")
    static var openAppWhenRun = true

    @Parameter(title: "City")
    var city: MapCityEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Open \(\.$city) in Map of Us")
    }

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(URL(string: "mapofus://city/\(city.id)")!))
    }
}

@available(iOS 18.0, *)
struct MapOfUsShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenMapOfUsIntent(),
            phrases: [
                "Open \(.applicationName)",
                "Show my map in \(.applicationName)"
            ],
            shortTitle: "Open Map",
            systemImageName: "map"
        )

        AppShortcut(
            intent: OpenMapCityIntent(),
            phrases: [
                "Open a city in \(.applicationName)",
                "Show a city in \(.applicationName)"
            ],
            shortTitle: "Open City",
            systemImageName: "mappin.and.ellipse"
        )
    }
}
