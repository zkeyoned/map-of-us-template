import Foundation

@MainActor
final class FootprintStore: ObservableObject {
    @Published private(set) var memories: [TravelMemory] = []
    @Published private(set) var wishlist: [WishlistPlace] = []

    private let memoriesKey = "mapOfUs.memories"
    private let wishlistKey = "mapOfUs.wishlist"
    private let storageFilename = "footprints.json"

    init(loadPersistedData: Bool = true) {
        if loadPersistedData {
            loadPersistedState()
        }
    }

    var visitedCityIds: Set<String> {
        Set(memories.map(\.cityId))
    }

    var visitedCities: [MapCity] {
        MapCity.all.filter { visitedCityIds.contains($0.id) }
    }

    var progress: Double {
        guard !MapCity.all.isEmpty else { return 0 }
        return Double(visitedCityIds.count) / Double(MapCity.all.count)
    }

    var photoMemoryCount: Int {
        memories.filter { $0.photoName != nil }.count
    }

    func memories(for city: MapCity) -> [TravelMemory] {
        memories
            .filter { $0.cityId == city.id }
            .sorted { $0.date > $1.date }
    }

    func latestMemory(for city: MapCity) -> TravelMemory? {
        memories(for: city).first
    }

    @discardableResult
    func addMemory(city: MapCity, text: String, date: Date = Date(), photoData: Data? = nil) -> TravelMemory {
        let photoName = photoData.flatMap { try? MemoryPhotoStore.savePhoto(data: $0) }
        let memory = TravelMemory(cityId: city.id, date: date, text: text, photoName: photoName)
        memories.insert(memory, at: 0)
        wishlist.removeAll { $0.cityId == city.id }
        persist()
        return memory
    }

    func addWishlist(city: MapCity, note: String) {
        guard visitedCityIds.contains(city.id) == false else { return }
        guard wishlist.contains(where: { $0.cityId == city.id }) == false else { return }
        wishlist.insert(WishlistPlace(cityId: city.id, note: note), at: 0)
        persist()
    }

    func removeWishlist(_ item: WishlistPlace) {
        wishlist.removeAll { $0.id == item.id }
        persist()
    }

    func removeMemory(_ memory: TravelMemory) {
        memories.removeAll { $0.id == memory.id }

        if let photoName = memory.photoName,
           memories.contains(where: { $0.photoName == photoName }) == false {
            MemoryPhotoStore.deletePhoto(filename: photoName)
        }

        persist()
    }

    func city(id: String) -> MapCity? {
        MapCity.all.first { $0.id == id }
    }

    func exportBackupData() throws -> Data {
        let payload = MapOfUsBackup(
            version: 2,
            exportedAt: Date(),
            memories: memories,
            wishlist: wishlist,
            photos: backupPhotos()
        )
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try encoder.encode(payload)
    }

    func importBackupData(_ data: Data) throws {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let payload = try decoder.decode(MapOfUsBackup.self, from: data)

        let restoredPhotoNames = try restoreBackupPhotos(payload.photos ?? [])
        let restoredMemories = payload.memories.map { memory in
            var nextMemory = memory
            if let photoName = memory.photoName {
                nextMemory.photoName = restoredPhotoNames[photoName] ?? photoName
            }
            return nextMemory
        }

        memories = restoredMemories
        wishlist = payload.wishlist
        persist()
    }

    private func persist() {
        let payload = FootprintStoragePayload(memories: memories, wishlist: wishlist)
        guard let data = try? Self.storageEncoder.encode(payload),
              let url = try? storageURL() else {
            return
        }

        try? data.write(to: url, options: [.atomic])
    }

    private func loadPersistedState() {
        if let payload = try? Self.storageDecoder.decode(FootprintStoragePayload.self, from: Data(contentsOf: storageURL())) {
            memories = payload.memories
            wishlist = payload.wishlist
            return
        }

        let legacyMemories = Self.loadLegacy([TravelMemory].self, key: memoriesKey)
        let legacyWishlist = Self.loadLegacy([WishlistPlace].self, key: wishlistKey)
        if legacyMemories != nil || legacyWishlist != nil {
            memories = legacyMemories ?? Self.seedMemories
            wishlist = legacyWishlist ?? Self.seedWishlist
            persist()
            return
        }

        memories = Self.seedMemories
        wishlist = Self.seedWishlist
        persist()
    }

    private func storageURL() throws -> URL {
        let directory = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        .appendingPathComponent("MapOfUs", isDirectory: true)

        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent(storageFilename)
    }

    private static var storageEncoder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }

    private static var storageDecoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    private static func loadLegacy<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    private func backupPhotos() -> [BackupPhoto] {
        let filenames = Set(memories.compactMap(\.photoName))
        return filenames.compactMap { filename in
            guard let data = MemoryPhotoStore.imageData(for: filename) else { return nil }
            return BackupPhoto(filename: filename, base64Data: data.base64EncodedString())
        }
    }

    private func restoreBackupPhotos(_ photos: [BackupPhoto]) throws -> [String: String] {
        var restoredNames: [String: String] = [:]

        for photo in photos {
            guard let data = Data(base64Encoded: photo.base64Data) else { continue }
            restoredNames[photo.filename] = try MemoryPhotoStore.restorePhoto(data: data, filename: photo.filename)
        }

        return restoredNames
    }
}

private struct FootprintStoragePayload: Codable {
    var memories: [TravelMemory]
    var wishlist: [WishlistPlace]
}

extension FootprintStore {
    static let seedMemories: [TravelMemory] = [
        TravelMemory(cityId: "zhengzhou", date: Calendar.current.date(from: DateComponents(year: 2024, month: 5, day: 20)) ?? Date(), text: "故事开始的地方。"),
        TravelMemory(cityId: "hangzhou", date: Calendar.current.date(from: DateComponents(year: 2025, month: 3, day: 16)) ?? Date(), text: "春天的湖边，风把时间吹慢了一点。"),
        TravelMemory(cityId: "shanghai", date: Calendar.current.date(from: DateComponents(year: 2025, month: 8, day: 2)) ?? Date(), text: "灯亮起来的时候，地图也亮了一格。"),
    ]

    static let seedWishlist: [WishlistPlace] = [
        WishlistPlace(cityId: "qingdao", note: "想一起去海边吹风。"),
        WishlistPlace(cityId: "hongkong", note: "留给下一次夜景。"),
    ]

    static var preview: FootprintStore {
        let store = FootprintStore(loadPersistedData: false)
        store.memories = seedMemories
        store.wishlist = seedWishlist
        return store
    }
}
