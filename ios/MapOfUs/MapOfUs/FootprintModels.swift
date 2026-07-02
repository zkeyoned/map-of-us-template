import Foundation
import SwiftUI

struct TravelMemory: Identifiable, Codable, Hashable {
    let id: UUID
    var cityId: String
    var date: Date
    var text: String
    var photoName: String?

    init(id: UUID = UUID(), cityId: String, date: Date, text: String, photoName: String? = nil) {
        self.id = id
        self.cityId = cityId
        self.date = date
        self.text = text
        self.photoName = photoName
    }
}

struct MapCity: Identifiable, Hashable {
    let id: String
    let name: String
    let nameEn: String
    let provinceId: String
    let province: String
    let landmark: String
    let lng: Double
    let lat: Double
    let x: Double
    let y: Double
    let isFeatured: Bool
    let accent: Color
}

extension MapCity {
    static var featured: [MapCity] {
        all.filter(\.isFeatured)
    }
}

struct WishlistPlace: Identifiable, Codable, Hashable {
    let id: UUID
    var cityId: String
    var note: String

    init(id: UUID = UUID(), cityId: String, note: String) {
        self.id = id
        self.cityId = cityId
        self.note = note
    }
}

struct MapOfUsBackup: Codable {
    var version: Int
    var exportedAt: Date
    var memories: [TravelMemory]
    var wishlist: [WishlistPlace]
    var photos: [BackupPhoto]?
}

struct BackupPhoto: Codable, Hashable {
    var filename: String
    var base64Data: String
}

extension Color {
    static let cream = Color(red: 0.98, green: 0.98, blue: 0.97)
    static let ink = Color(red: 0.35, green: 0.40, blue: 0.44)
    static let dim = Color(red: 0.85, green: 0.87, blue: 0.85)
    static let mist = Color(red: 0.84, green: 0.91, blue: 0.94)
    static let sky = Color(red: 0.66, green: 0.78, blue: 0.86)
    static let softMint = Color(red: 0.83, green: 0.91, blue: 0.82)
    static let sakura = Color(red: 0.96, green: 0.86, blue: 0.88)
    static let bloom = Color(red: 0.91, green: 0.72, blue: 0.76)
}
