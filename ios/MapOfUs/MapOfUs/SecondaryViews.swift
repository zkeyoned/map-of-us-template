import SwiftUI
import UniformTypeIdentifiers

struct MemoryTimelineView: View {
    @EnvironmentObject private var store: FootprintStore

    var body: some View {
        List {
            ForEach(store.memories.sorted { $0.date > $1.date }) { memory in
                if let city = store.city(id: memory.cityId) {
                    VStack(alignment: .leading, spacing: 10) {
                        if memory.photoName != nil {
                            MemoryPhotoView(filename: memory.photoName, height: 160)
                        }
                        HStack {
                            Text(city.name)
                                .font(.headline)
                            Spacer()
                            Text(memory.date, style: .date)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Text(memory.text)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 6)
                }
            }
            .onDelete { indexes in
                let sortedMemories = store.memories.sorted { $0.date > $1.date }
                indexes.map { sortedMemories[$0] }.forEach(store.removeMemory)
            }
        }
        .navigationTitle("回忆")
        .toolbar {
            #if os(iOS)
            if store.memories.isEmpty == false {
                EditButton()
            }
            #endif
        }
        .overlay {
            if store.memories.isEmpty {
                ContentUnavailableView("还没有回忆", systemImage: "photo.on.rectangle")
            }
        }
    }
}

struct WishlistView: View {
    @EnvironmentObject private var store: FootprintStore

    var body: some View {
        List {
            ForEach(store.wishlist) { item in
                if let city = store.city(id: item.cityId) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(city.name)
                            .font(.headline)
                        Text(item.note)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 6)
                }
            }
            .onDelete { indexes in
                indexes.map { store.wishlist[$0] }.forEach(store.removeWishlist)
            }
        }
        .navigationTitle("心愿")
        .overlay {
            if store.wishlist.isEmpty {
                ContentUnavailableView("没有心愿城市", systemImage: "heart")
            }
        }
    }
}

struct UsView: View {
    @EnvironmentObject private var store: FootprintStore
    @State private var isExporting = false
    @State private var isImporting = false
    @State private var backupStatus: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                statCard(title: "已点亮城市", value: "\(store.visitedCityIds.count)")
                statCard(title: "留下回忆", value: "\(store.memories.count)")
                statCard(title: "照片回忆", value: "\(store.photoMemoryCount)")
                statCard(title: "想去的地方", value: "\(store.wishlist.count)")
                PasscodeSettingsCard()
                backupCard
            }
            .padding()
        }
        .background(Color.cream)
        .navigationTitle("我们")
        .fileExporter(
            isPresented: $isExporting,
            document: backupDocument,
            contentType: .json,
            defaultFilename: backupFilename
        ) { result in
            switch result {
            case .success:
                backupStatus = "备份已导出"
            case .failure:
                backupStatus = "导出失败，请稍后再试"
            }
        }
        .fileImporter(
            isPresented: $isImporting,
            allowedContentTypes: [.json],
            allowsMultipleSelection: false
        ) { result in
            importBackup(result)
        }
    }

    private func statCard(title: String, value: String) -> some View {
        HStack {
            Text(title)
                .font(.headline)
                .foregroundStyle(Color.ink)
            Spacer()
            Text(value)
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .foregroundStyle(Color.bloom)
        }
        .padding(20)
        .background(.white.opacity(0.68), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private var backupCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("本地备份")
                        .font(.headline)
                        .foregroundStyle(Color.ink)
                    Text("导出回忆和心愿数据。照片文件会保留在本机，后续可升级为完整照片包。")
                        .font(.caption)
                        .foregroundStyle(Color.ink.opacity(0.56))
                }
                Spacer()
                Image(systemName: "externaldrive")
                    .font(.title2)
                    .foregroundStyle(Color.bloom)
            }

            HStack(spacing: 10) {
                Button {
                    isExporting = true
                } label: {
                    Label("导出", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.bloom)

                Button {
                    isImporting = true
                } label: {
                    Label("导入", systemImage: "square.and.arrow.down")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(Color.sky)
            }

            if let backupStatus {
                Text(backupStatus)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.ink.opacity(0.62))
            }
        }
        .padding(20)
        .background(.white.opacity(0.68), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private var backupDocument: MapOfUsBackupDocument {
        let data = (try? store.exportBackupData()) ?? Data()
        return MapOfUsBackupDocument(data: data)
    }

    private var backupFilename: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return "map-of-us-ios-backup-\(formatter.string(from: Date())).json"
    }

    private func importBackup(_ result: Result<[URL], Error>) {
        do {
            guard let url = try result.get().first else { return }
            let accessing = url.startAccessingSecurityScopedResource()
            defer {
                if accessing {
                    url.stopAccessingSecurityScopedResource()
                }
            }
            try store.importBackupData(Data(contentsOf: url))
            backupStatus = "导入完成"
        } catch {
            backupStatus = "导入失败，请确认文件格式"
        }
    }
}
