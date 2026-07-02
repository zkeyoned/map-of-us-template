import SwiftUI

struct MapHomeView: View {
    @EnvironmentObject private var store: FootprintStore
    @Binding private var deepLinkedCity: MapCity?
    @State private var selectedCity: MapCity?
    @State private var mapScale: CGFloat = 1
    @State private var lastMapScale: CGFloat = 1
    @State private var mapOffset: CGSize = .zero
    @State private var lastMapOffset: CGSize = .zero
    @State private var searchText = ""
    @State private var litCelebration: LitCelebration?
    @State private var pulsingCityId: String?
    @State private var focusedCityId: String?

    private let minMapScale: CGFloat = 1
    private let maxMapScale: CGFloat = 2.35

    init(deepLinkedCity: Binding<MapCity?> = .constant(nil)) {
        self._deepLinkedCity = deepLinkedCity
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.cream, Color.mist.opacity(0.48), Color.cream],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 16) {
                header
                searchPanel
                mapCanvas
                progressStrip
            }
            .padding(.horizontal, 18)
            .padding(.top, 12)

            if let litCelebration {
                celebrationCard(litCelebration)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .zIndex(10)
            }
        }
            .sheet(item: $selectedCity) { city in
                CityRecordSheet(city: city) { savedCity, memory in
                    handleMemorySaved(city: savedCity, memory: memory)
                }
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            }
            .sensoryFeedback(.selection, trigger: selectedCity)
            .sensoryFeedback(.success, trigger: litCelebration?.id)
            .onAppear {
                openDeepLinkedCityIfNeeded()
            }
            .onChange(of: deepLinkedCity) { _, _ in
                openDeepLinkedCityIfNeeded()
            }
    }

    private func openDeepLinkedCityIfNeeded() {
        guard let city = deepLinkedCity else { return }
        focusedCityId = city.id
        selectedCity = city
        deepLinkedCity = nil
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Map of Us")
                    .font(.system(size: 32, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.ink)
                Text("把走过的地方，点亮成我们的地图。")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.ink.opacity(0.62))
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text("\(store.visitedCityIds.count)")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.bloom)
                Text("已点亮")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.ink.opacity(0.52))
            }
        }
    }

    private var mapCanvas: some View {
        GeometryReader { proxy in
            ZStack {
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(Color.cream.opacity(0.76))
                    .shadow(color: Color.sky.opacity(0.14), radius: 24, y: 16)

                ChinaInspiredShape()
                    .fill(Color.dim.opacity(0.34))
                    .overlay {
                        ChinaInspiredShape()
                            .stroke(Color.ink.opacity(0.16), lineWidth: 1)
                    }
                    .padding(20)

                JourneyRouteView(cities: journeyCities, size: proxy.size)

                ForEach(MapCity.all) { city in
                    cityButton(city, in: proxy.size)
                }

                VStack {
                    HStack {
                        Spacer()
                        Button {
                            resetMapCamera()
                        } label: {
                            Image(systemName: "arrow.counterclockwise")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundStyle(Color.ink.opacity(0.7))
                                .frame(width: 42, height: 42)
                                .background(Color.cream.opacity(0.86), in: Circle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("重置地图位置")
                    }
                    .padding(14)

                    Spacer()

                    HStack {
                        Label("双指缩放，拖动地图，轻点城市记录", systemImage: "hand.draw")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.ink.opacity(0.54))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 9)
                            .background(Color.cream.opacity(0.82), in: Capsule())
                        Spacer()
                    }
                    .padding(14)
                }
            }
            .scaleEffect(mapScale)
            .offset(mapOffset)
            .gesture(mapGestures(in: proxy.size))
            .animation(.spring(response: 0.36, dampingFraction: 0.82), value: mapScale)
            .animation(.spring(response: 0.36, dampingFraction: 0.82), value: mapOffset)
        }
        .frame(maxHeight: .infinity)
        .frame(minHeight: 460)
    }

    private var searchPanel: some View {
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(Color.ink.opacity(0.42))
                TextField("搜索城市、省份或地标", text: $searchText)
                if searchText.isEmpty == false {
                    Button {
                        searchText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(Color.ink.opacity(0.38))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.cream.opacity(0.88), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.dim.opacity(0.62), lineWidth: 1)
            }

            if searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false {
                VStack(spacing: 0) {
                    ForEach(searchResults) { city in
                        Button {
                            selectedCity = city
                            searchText = ""
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(city.name)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(Color.ink)
                                    Text("\(city.province) · \(city.landmark)")
                                        .font(.caption)
                                        .foregroundStyle(Color.ink.opacity(0.52))
                                        .lineLimit(1)
                                }
                                Spacer()
                                if store.visitedCityIds.contains(city.id) {
                                    Image(systemName: "heart.fill")
                                        .foregroundStyle(Color.bloom)
                                }
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                        }
                        .buttonStyle(.plain)

                        if city.id != searchResults.last?.id {
                            Divider().padding(.leading, 14)
                        }
                    }
                }
                .background(Color.cream.opacity(0.94), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
    }

    private var searchResults: [MapCity] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard query.isEmpty == false else { return [] }

        return MapCity.all
            .filter { city in
                city.name.lowercased().contains(query) ||
                city.nameEn.lowercased().contains(query) ||
                city.province.lowercased().contains(query) ||
                city.landmark.lowercased().contains(query)
            }
            .prefix(8)
            .map { $0 }
    }

    private func cityButton(_ city: MapCity, in size: CGSize) -> some View {
        let visited = store.visitedCityIds.contains(city.id)
        let prominent = visited || city.isFeatured
        let isPulsing = pulsingCityId == city.id
        let isFocused = focusedCityId == city.id
        let dotSize: CGFloat = visited ? 34 : (city.isFeatured ? 24 : 10)
        let hitSize: CGFloat = visited ? 64 : (city.isFeatured ? 58 : 46)

        return Button {
            focusedCityId = city.id
            selectedCity = city
        } label: {
            VStack(spacing: prominent ? 5 : 0) {
                ZStack {
                    Circle()
                        .fill(city.accent.opacity(isFocused ? 0.24 : 0.001))
                        .frame(width: hitSize, height: hitSize)
                    if isPulsing {
                        PulseRing(color: city.accent)
                    }
                    Circle()
                        .fill(visited ? city.accent : Color.cream)
                        .frame(width: dotSize, height: dotSize)
                        .shadow(color: visited ? city.accent.opacity(0.42) : .clear, radius: 12)
                    Circle()
                        .stroke(Color.cream, lineWidth: 3)
                        .frame(width: dotSize, height: dotSize)
                    if visited {
                        Image(systemName: "heart.fill")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.cream)
                    }
                }

                if prominent {
                    Text(city.name)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(visited ? Color.bloom : Color.ink.opacity(0.54))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .background(Color.cream.opacity(0.9), in: Capsule())
                }
            }
            .frame(minWidth: hitSize, minHeight: prominent ? hitSize + 20 : hitSize)
            .contentShape(Circle())
            .scaleEffect(isFocused || isPulsing ? 1.08 : 1)
        }
        .buttonStyle(.plain)
        .position(x: size.width * city.x, y: size.height * city.y)
        .zIndex(visited ? 3 : (city.isFeatured ? 2 : 1))
        .accessibilityLabel("\(visited ? "查看" : "点亮")\(city.name)")
        .accessibilityHint("打开城市记录")
    }

    private func celebrationCard(_ celebration: LitCelebration) -> some View {
        VStack {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(celebration.city.accent.opacity(0.24))
                        .frame(width: 44, height: 44)
                    Image(systemName: "sparkles")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Color.bloom)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text("\(celebration.city.name) 已点亮")
                        .font(.headline)
                        .foregroundStyle(Color.ink)
                    Text("我们的第 \(store.visitedCityIds.count) 座城市")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Color.ink.opacity(0.56))
                }
                Spacer()
            }
            .padding(14)
            .background(Color.cream.opacity(0.95), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(Color.sakura.opacity(0.88), lineWidth: 1)
            }
            .shadow(color: Color.bloom.opacity(0.18), radius: 24, y: 12)
            .padding(.horizontal, 18)
            .padding(.top, 8)
            Spacer()
        }
    }

    private var progressStrip: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("我们的足迹进度")
                    .font(.headline)
                    .foregroundStyle(Color.ink)
                Spacer()
                ShareLink(item: journeyShareText) {
                    Label("分享", systemImage: "square.and.arrow.up")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Color.ink.opacity(0.62))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .background(.white.opacity(0.56), in: Capsule())
                }
                Text("\(Int(store.progress * 100))%")
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(Color.bloom)
            }

            ProgressView(value: store.progress)
                .tint(Color.bloom)

            HStack {
                Text("已点亮 \(store.visitedCityIds.count) / \(MapCity.all.count) 城")
                Spacer()
                Text(journeySummaryText)
            }
            .font(.caption.weight(.medium))
            .foregroundStyle(Color.ink.opacity(0.52))

            if latestJourneyMemories.isEmpty == false {
                Divider()
                    .overlay(Color.dim.opacity(0.58))

                VStack(alignment: .leading, spacing: 8) {
                    Text("最近足迹")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Color.ink.opacity(0.56))

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(latestJourneyMemories) { memory in
                                if let city = store.city(id: memory.cityId) {
                                    recentMemoryButton(memory: memory, city: city)
                                }
                            }
                        }
                    }
                }
            }

            if nextWishlistStops.isEmpty == false {
                Divider()
                    .overlay(Color.dim.opacity(0.58))

                VStack(alignment: .leading, spacing: 8) {
                    Text("下一站")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Color.ink.opacity(0.56))

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(nextWishlistStops) { item in
                                if let city = store.city(id: item.cityId) {
                                    wishlistStopButton(item: item, city: city)
                                }
                            }
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(Color.cream.opacity(0.82), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private var latestJourneyMemories: [TravelMemory] {
        Array(store.memories.sorted { $0.date > $1.date }.prefix(3))
    }

    private func recentMemoryButton(memory: TravelMemory, city: MapCity) -> some View {
        Button {
            focusedCityId = city.id
            selectedCity = city
        } label: {
            HStack(spacing: 9) {
                ZStack {
                    Circle()
                        .fill(city.accent.opacity(0.22))
                    Image(systemName: memory.photoName == nil ? "mappin" : "photo.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.bloom)
                }
                .frame(width: 30, height: 30)

                VStack(alignment: .leading, spacing: 2) {
                    Text(city.name)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Color.ink)
                    Text(memory.text)
                        .font(.caption2)
                        .foregroundStyle(Color.ink.opacity(0.55))
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 9)
            .frame(width: 172, alignment: .leading)
            .background(.white.opacity(0.58), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("查看\(city.name)的最近足迹")
    }

    private var nextWishlistStops: [WishlistPlace] {
        Array(store.wishlist.prefix(3))
    }

    private func wishlistStopButton(item: WishlistPlace, city: MapCity) -> some View {
        Button {
            focusedCityId = city.id
            selectedCity = city
        } label: {
            HStack(spacing: 9) {
                ZStack {
                    Circle()
                        .fill(Color.mist.opacity(0.62))
                    Image(systemName: "heart")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.sky)
                }
                .frame(width: 30, height: 30)

                VStack(alignment: .leading, spacing: 2) {
                    Text(city.name)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Color.ink)
                    Text(item.note)
                        .font(.caption2)
                        .foregroundStyle(Color.ink.opacity(0.55))
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 9)
            .frame(width: 172, alignment: .leading)
            .background(Color.mist.opacity(0.36), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("打开下一站\(city.name)")
    }

    private var journeyCities: [MapCity] {
        var seenCityIds = Set<String>()

        return store.memories
            .sorted { $0.date < $1.date }
            .compactMap { memory -> MapCity? in
                guard seenCityIds.contains(memory.cityId) == false,
                      let city = store.city(id: memory.cityId) else {
                    return nil
                }
                seenCityIds.insert(memory.cityId)
                return city
            }
    }

    private var journeySummaryText: String {
        guard journeyCities.count > 1 else {
            return latestLitCityText
        }

        let names = journeyCities.suffix(3).map(\.name).joined(separator: " → ")
        return "路线 \(names)"
    }

    private var latestLitCityText: String {
        if let cityId = store.memories.sorted(by: { $0.date > $1.date }).first?.cityId,
           let city = store.city(id: cityId) {
            return "最近点亮 \(city.name)"
        }

        return "下一站从心愿里选"
    }

    private var journeyShareText: String {
        var lines = [
            "Map of Us",
            "我们已经点亮 \(store.visitedCityIds.count) / \(MapCity.all.count) 座城市。"
        ]

        if journeyCities.count > 1 {
            lines.append("足迹路线：\(journeyCities.map(\.name).joined(separator: " → "))")
        } else if let firstCity = journeyCities.first {
            lines.append("第一站：\(firstCity.name)")
        } else {
            lines.append("我们的地图还在等待第一站。")
        }

        if let latestMemory = latestJourneyMemories.first,
           let city = store.city(id: latestMemory.cityId) {
            lines.append("最近足迹：\(city.name)｜\(latestMemory.text)")
        }

        if let nextStop = nextWishlistStops.first,
           let city = store.city(id: nextStop.cityId) {
            lines.append("下一站想去：\(city.name)｜\(nextStop.note)")
        }

        return lines.joined(separator: "\n")
    }

    private func mapGestures(in size: CGSize) -> some Gesture {
        SimultaneousGesture(
            MagnificationGesture()
                .onChanged { value in
                    let nextScale = clampedMapScale(lastMapScale * value)
                    mapScale = nextScale
                    mapOffset = clampedMapOffset(mapOffset, scale: nextScale, in: size)
                }
                .onEnded { _ in
                    lastMapScale = mapScale
                    mapOffset = clampedMapOffset(mapOffset, scale: mapScale, in: size)
                    lastMapOffset = mapOffset
                },
            DragGesture(minimumDistance: 8)
                .onChanged { value in
                    let proposedOffset = CGSize(
                        width: lastMapOffset.width + value.translation.width,
                        height: lastMapOffset.height + value.translation.height
                    )
                    mapOffset = clampedMapOffset(proposedOffset, scale: mapScale, in: size)
                }
                .onEnded { _ in
                    mapOffset = clampedMapOffset(mapOffset, scale: mapScale, in: size)
                    lastMapOffset = mapOffset
                }
        )
    }

    private func clampedMapScale(_ scale: CGFloat) -> CGFloat {
        min(max(scale, minMapScale), maxMapScale)
    }

    private func clampedMapOffset(_ offset: CGSize, scale: CGFloat, in size: CGSize) -> CGSize {
        guard scale > minMapScale else { return .zero }

        let maxX = size.width * (scale - 1) * 0.38
        let maxY = size.height * (scale - 1) * 0.38

        return CGSize(
            width: min(max(offset.width, -maxX), maxX),
            height: min(max(offset.height, -maxY), maxY)
        )
    }

    private func resetMapCamera() {
        mapScale = minMapScale
        lastMapScale = minMapScale
        mapOffset = .zero
        lastMapOffset = .zero
    }

    private func handleMemorySaved(city: MapCity, memory: TravelMemory) {
        withAnimation(.spring(response: 0.45, dampingFraction: 0.82)) {
            litCelebration = LitCelebration(city: city, memory: memory)
            pulsingCityId = city.id
        }

        Task {
            try? await Task.sleep(for: .seconds(2.4))
            await MainActor.run {
                withAnimation(.easeOut(duration: 0.28)) {
                    litCelebration = nil
                }
            }
        }

        Task {
            try? await Task.sleep(for: .seconds(1.7))
            await MainActor.run {
                pulsingCityId = nil
            }
        }
    }
}

private struct LitCelebration: Identifiable {
    let id = UUID()
    let city: MapCity
    let memory: TravelMemory
}

private struct PulseRing: View {
    let color: Color
    @State private var animate = false

    var body: some View {
        Circle()
            .stroke(color.opacity(animate ? 0 : 0.62), lineWidth: 2)
            .frame(width: 56, height: 56)
            .scaleEffect(animate ? 1.55 : 0.68)
            .onAppear {
                animate = false
                withAnimation(.easeOut(duration: 1.1).repeatCount(2, autoreverses: false)) {
                    animate = true
                }
            }
    }
}

private struct JourneyRouteView: View {
    let cities: [MapCity]
    let size: CGSize

    var body: some View {
        ZStack {
            if cities.count > 1 {
                routePath
                    .stroke(Color.bloom.opacity(0.2), style: StrokeStyle(lineWidth: 9, lineCap: .round, lineJoin: .round))
                routePath
                    .stroke(Color.cream.opacity(0.82), style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
                routePath
                    .stroke(Color.bloom.opacity(0.7), style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round, dash: [5, 7]))
            }

            ForEach(Array(cities.enumerated()), id: \.element.id) { index, city in
                JourneyStepBadge(index: index + 1, color: city.accent)
                    .position(point(for: city))
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private var routePath: Path {
        Path { path in
            guard let firstCity = cities.first else { return }

            path.move(to: point(for: firstCity))
            for city in cities.dropFirst() {
                path.addLine(to: point(for: city))
            }
        }
    }

    private func point(for city: MapCity) -> CGPoint {
        CGPoint(x: size.width * city.x, y: size.height * city.y)
    }
}

private struct JourneyStepBadge: View {
    let index: Int
    let color: Color

    var body: some View {
        Text("\(index)")
            .font(.system(size: 9, weight: .bold, design: .rounded))
            .foregroundStyle(Color.ink.opacity(0.68))
            .frame(width: 22, height: 22)
            .background(Color.cream.opacity(0.94), in: Circle())
            .overlay {
                Circle()
                    .stroke(color.opacity(0.76), lineWidth: 1.4)
            }
            .shadow(color: color.opacity(0.2), radius: 8, y: 4)
    }
}

struct ChinaInspiredShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX + rect.width * 0.28, y: rect.minY + rect.height * 0.18))
        path.addCurve(to: CGPoint(x: rect.minX + rect.width * 0.70, y: rect.minY + rect.height * 0.18), control1: CGPoint(x: rect.minX + rect.width * 0.42, y: rect.minY + rect.height * 0.08), control2: CGPoint(x: rect.minX + rect.width * 0.62, y: rect.minY + rect.height * 0.10))
        path.addCurve(to: CGPoint(x: rect.minX + rect.width * 0.83, y: rect.minY + rect.height * 0.48), control1: CGPoint(x: rect.minX + rect.width * 0.82, y: rect.minY + rect.height * 0.26), control2: CGPoint(x: rect.minX + rect.width * 0.84, y: rect.minY + rect.height * 0.38))
        path.addCurve(to: CGPoint(x: rect.minX + rect.width * 0.67, y: rect.minY + rect.height * 0.70), control1: CGPoint(x: rect.minX + rect.width * 0.80, y: rect.minY + rect.height * 0.60), control2: CGPoint(x: rect.minX + rect.width * 0.75, y: rect.minY + rect.height * 0.66))
        path.addCurve(to: CGPoint(x: rect.minX + rect.width * 0.58, y: rect.minY + rect.height * 0.91), control1: CGPoint(x: rect.minX + rect.width * 0.66, y: rect.minY + rect.height * 0.80), control2: CGPoint(x: rect.minX + rect.width * 0.62, y: rect.minY + rect.height * 0.87))
        path.addCurve(to: CGPoint(x: rect.minX + rect.width * 0.42, y: rect.minY + rect.height * 0.74), control1: CGPoint(x: rect.minX + rect.width * 0.48, y: rect.minY + rect.height * 0.88), control2: CGPoint(x: rect.minX + rect.width * 0.43, y: rect.minY + rect.height * 0.80))
        path.addCurve(to: CGPoint(x: rect.minX + rect.width * 0.17, y: rect.minY + rect.height * 0.62), control1: CGPoint(x: rect.minX + rect.width * 0.33, y: rect.minY + rect.height * 0.75), control2: CGPoint(x: rect.minX + rect.width * 0.22, y: rect.minY + rect.height * 0.71))
        path.addCurve(to: CGPoint(x: rect.minX + rect.width * 0.21, y: rect.minY + rect.height * 0.36), control1: CGPoint(x: rect.minX + rect.width * 0.10, y: rect.minY + rect.height * 0.50), control2: CGPoint(x: rect.minX + rect.width * 0.12, y: rect.minY + rect.height * 0.41))
        path.closeSubpath()
        return path
    }
}
