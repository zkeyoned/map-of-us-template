import SwiftUI
import PhotosUI

#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

struct CityRecordSheet: View {
    @EnvironmentObject private var store: FootprintStore
    @Environment(\.dismiss) private var dismiss
    let city: MapCity
    var onMemorySaved: (MapCity, TravelMemory) -> Void = { _, _ in }

    @State private var memoryText = ""
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var selectedPhotoData: Data?
    @State private var isReadingPhoto = false
    @State private var photoError: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    cityHero
                    quickRecord
                    history
                }
                .padding(20)
            }
            .background(Color.cream.ignoresSafeArea())
            .navigationTitle(city.name)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                }
            }
            .onChange(of: selectedPhoto) { _, _ in
                Task { await loadSelectedPhoto() }
            }
        }
    }

    private var cityHero: some View {
        let visited = store.visitedCityIds.contains(city.id)
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(city.province) · \(city.nameEn)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.ink.opacity(0.52))
                    Text(visited ? "这座城市已经被点亮" : "写下第一条回忆来点亮它")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Color.ink)
                }
                Spacer()
                Image(systemName: visited ? "heart.fill" : "heart")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(visited ? Color.bloom : Color.dim)
            }

            Label(city.landmark, systemImage: "mappin.and.ellipse")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Color.ink.opacity(0.64))
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .background(Color.mist.opacity(0.42), in: Capsule())

            if let latest = store.latestMemory(for: city) {
                Text(latest.text)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Color.ink.opacity(0.76))
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.sakura.opacity(0.5), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
        .padding(18)
        .background(Color.cream, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(Color.dim.opacity(0.72), lineWidth: 1)
        }
    }

    private var quickRecord: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("快速记录")
                .font(.headline)
                .foregroundStyle(Color.ink)

            TextField("这一站发生了什么？", text: $memoryText, axis: .vertical)
                .lineLimit(3, reservesSpace: true)
                .padding(14)
                .background(Color.cream, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Color.dim.opacity(0.74), lineWidth: 1)
                }

            PhotosPicker(selection: $selectedPhoto, matching: .images) {
                HStack(spacing: 12) {
                    photoPreview
                    VStack(alignment: .leading, spacing: 4) {
                        Text(selectedPhotoData == nil ? "选择一张照片" : "照片已选择")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color.ink)
                        Text(isReadingPhoto ? "正在读取照片" : "会保存在本机，不上传云端")
                            .font(.caption)
                            .foregroundStyle(Color.ink.opacity(0.52))
                    }
                    Spacer()
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(Color.bloom)
                }
                .padding(12)
                .background(Color.cream, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Color.dim.opacity(0.74), lineWidth: 1)
                }
            }
            .disabled(isReadingPhoto)

            if let photoError {
                Text(photoError)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.bloom)
            }

            Button {
                let memory = store.addMemory(
                    city: city,
                    text: memoryText.trimmingCharacters(in: .whitespacesAndNewlines),
                    photoData: selectedPhotoData
                )
                onMemorySaved(city, memory)
                memoryText = ""
                selectedPhoto = nil
                selectedPhotoData = nil
            } label: {
                Label("保存并点亮 \(city.name)", systemImage: "sparkles")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.bloom)
            .disabled(memoryText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isReadingPhoto)

            Button {
                store.addWishlist(city: city, note: "想和你一起去 \(city.name)")
            } label: {
                Label("加入想去清单", systemImage: "heart")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(Color.sky)
        }
        .padding(18)
        .background(Color.mist.opacity(0.34), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private var history: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("城市回忆")
                .font(.headline)
                .foregroundStyle(Color.ink)

            let memories = store.memories(for: city)
            if memories.isEmpty {
                ContentUnavailableView("还没有记录", systemImage: "map", description: Text("第一条记录会把这里点亮。"))
            } else {
                ForEach(memories) { memory in
                    VStack(alignment: .leading, spacing: 6) {
                        if memory.photoName != nil {
                            MemoryPhotoView(filename: memory.photoName, height: 170)
                                .padding(.bottom, 6)
                        }
                        Text(memory.date, style: .date)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.bloom)
                        Text(memory.text)
                            .font(.body)
                            .foregroundStyle(Color.ink.opacity(0.74))
                        Button(role: .destructive) {
                            store.removeMemory(memory)
                        } label: {
                            Label("删除这条回忆", systemImage: "trash")
                                .font(.caption.weight(.semibold))
                        }
                        .buttonStyle(.borderless)
                        .padding(.top, 4)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.cream, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
            }
        }
    }

    @ViewBuilder
    private var photoPreview: some View {
        if let selectedPhotoData {
            MemoryPhotoPreview(data: selectedPhotoData)
                .frame(width: 58, height: 58)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.mist.opacity(0.58))
                Image(systemName: "photo")
                    .foregroundStyle(Color.ink.opacity(0.42))
            }
            .frame(width: 58, height: 58)
        }
    }

    private func loadSelectedPhoto() async {
        guard let selectedPhoto else {
            selectedPhotoData = nil
            photoError = nil
            return
        }

        isReadingPhoto = true
        photoError = nil
        defer { isReadingPhoto = false }

        do {
            selectedPhotoData = try await selectedPhoto.loadTransferable(type: Data.self)
            if selectedPhotoData == nil {
                photoError = "照片读取失败，请换一张试试"
            }
        } catch {
            selectedPhotoData = nil
            photoError = "照片读取失败，请换一张试试"
        }
    }
}

private struct MemoryPhotoPreview: View {
    let data: Data

    var body: some View {
        platformImage
            .resizable()
            .scaledToFill()
    }

    private var platformImage: Image {
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
