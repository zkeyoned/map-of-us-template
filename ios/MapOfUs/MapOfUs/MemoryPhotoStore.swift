import Foundation
import SwiftUI

#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

enum MemoryPhotoStore {
    private static let folderName = "MemoryPhotos"
    private static let maxSavedPhotoDimension: CGFloat = 1600
    private static let savedPhotoQuality: CGFloat = 0.82

    static func savePhoto(data: Data) throws -> String {
        let directory = try photoDirectory()
        let filename = "\(UUID().uuidString).jpg"
        let url = directory.appendingPathComponent(filename)
        let outputData = compressedImageData(from: data) ?? data
        try outputData.write(to: url, options: [.atomic])
        return filename
    }

    static func restorePhoto(data: Data, filename: String) throws -> String {
        let directory = try photoDirectory()
        let safeFilename = sanitizedFilename(filename)
        let url = directory.appendingPathComponent(safeFilename)
        try data.write(to: url, options: [.atomic])
        return safeFilename
    }

    static func url(for filename: String) -> URL? {
        try? photoDirectory().appendingPathComponent(filename)
    }

    static func imageData(for filename: String) -> Data? {
        guard let url = url(for: filename) else { return nil }
        return try? Data(contentsOf: url)
    }

    static func deletePhoto(filename: String) {
        guard let url = url(for: filename) else { return }
        try? FileManager.default.removeItem(at: url)
    }

    private static func photoDirectory() throws -> URL {
        let documents = try FileManager.default.url(
            for: .documentDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let directory = documents.appendingPathComponent(folderName, isDirectory: true)
        if FileManager.default.fileExists(atPath: directory.path) == false {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        }
        return directory
    }

    private static func sanitizedFilename(_ filename: String) -> String {
        let fallback = "\(UUID().uuidString).jpg"
        let lastPathComponent = URL(fileURLWithPath: filename).lastPathComponent
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.")
        let sanitized = String(lastPathComponent.unicodeScalars.map { allowed.contains($0) ? Character($0) : "-" })
        return sanitized.isEmpty ? fallback : sanitized
    }

    private static func compressedImageData(from data: Data) -> Data? {
        #if os(iOS)
        guard let image = UIImage(data: data) else { return nil }
        let targetSize = scaledSize(for: image.size)
        let renderer = UIGraphicsImageRenderer(size: targetSize)
        let resizedImage = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }
        return resizedImage.jpegData(compressionQuality: savedPhotoQuality)
        #elseif os(macOS)
        guard let image = NSImage(data: data),
              let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            return nil
        }
        let targetSize = scaledSize(for: CGSize(width: cgImage.width, height: cgImage.height))
        let bitmap = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: Int(targetSize.width),
            pixelsHigh: Int(targetSize.height),
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        )
        guard let bitmap else { return nil }
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
        image.draw(in: CGRect(origin: .zero, size: targetSize))
        NSGraphicsContext.restoreGraphicsState()
        return bitmap.representation(using: .jpeg, properties: [.compressionFactor: savedPhotoQuality])
        #else
        return nil
        #endif
    }

    private static func scaledSize(for size: CGSize) -> CGSize {
        let largestDimension = max(size.width, size.height)
        guard largestDimension > maxSavedPhotoDimension else { return size }

        let scale = maxSavedPhotoDimension / largestDimension
        return CGSize(width: size.width * scale, height: size.height * scale)
    }
}

struct MemoryPhotoView: View {
    let filename: String?
    var height: CGFloat = 180

    var body: some View {
        Group {
            if let filename, let data = MemoryPhotoStore.imageData(for: filename) {
                platformImage(data: data)
                    .resizable()
                    .scaledToFill()
            } else {
                ZStack {
                    LinearGradient(
                        colors: [Color.sakura.opacity(0.72), Color.mist.opacity(0.74)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    Image(systemName: "photo")
                        .font(.system(size: 28, weight: .semibold))
                        .foregroundStyle(Color.ink.opacity(0.34))
                }
            }
        }
        .frame(height: height)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func platformImage(data: Data) -> Image {
        #if os(iOS)
        if let image = UIImage(data: data) {
            return Image(uiImage: image)
        }
        #elseif os(macOS)
        if let image = NSImage(data: data) {
            return Image(nsImage: image)
        }
        #endif
        return Image(systemName: "photo")
    }
}
