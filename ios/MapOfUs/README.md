# Map of Us iOS

This is the native SwiftUI iOS prototype for Map of Us.

The first iOS pass keeps the product hook front and center: the app opens on a tappable footprint map. Users can tap a city, add a short memory, and immediately light that city on the map.

## Current prototype

- Native SwiftUI app, not a WebView wrapper.
- Main tab is `地图`, with a pinch-and-drag map surface.
- Native app icon assets are generated from the existing Map of Us product icon and wired as `AppIcon`.
- App opens with a lightweight local passcode gate; the prototype default is `1234` and it can be changed in `我们`.
- The iOS city catalog is generated from the existing web data and currently includes 391 city nodes.
- City points support a bottom sheet for recording memories.
- Visited cities are connected on the map in first-visit order, so the map reads as a relationship journey instead of only a pin board.
- The map home screen shows a recent-footprints strip that jumps straight back into each city's record sheet.
- Wishlist cities also appear as a next-stops strip on the map home screen, keeping future plans attached to the map.
- Saving a memory for a wishlist city automatically clears it from the wishlist, turning a future plan into a visited footprint.
- The map progress card includes a native share action for sending a compact journey summary.
- The app registers the `mapofus` URL scheme; `mapofus://city/<cityId>` opens the map and presents that city.
- On iOS 18 and newer, App Intents expose shortcuts for opening the map and opening a selected city through the same deep-link path.
- Memories can include a photo chosen with the native photo picker and saved locally in the app documents directory.
- Selected memory photos are resized and saved as compressed JPEGs before persistence so local storage and JSON backups stay manageable.
- Memories can be deleted from the city sheet or timeline; orphaned local photo files are removed with their deleted memory.
- The generated iOS Info.plist includes a photo-library usage description for attaching selected photos to local travel memories.
- The target includes `PrivacyInfo.xcprivacy` with no tracking or collected-data declarations and a required-reason declaration for app-local `UserDefaults`.
- Saving a city memory lights the city, pulses the city point, shows a short celebration card, and updates progress.
- `回忆`, `心愿`, and `我们` tabs reuse the same local `FootprintStore`.
- Memories and wishlist entries are stored locally as JSON in the app's Application Support directory, with migration from the earlier `UserDefaults` prototype keys.
- The `我们` tab can export/import a JSON backup for memories, wishlist entries, and attached memory photos.

## Project

Open this project in Xcode:

```text
ios/MapOfUs/MapOfUs.xcodeproj
```

Suggested scheme:

```text
MapOfUs
```

Bundle id:

```text
com.mapofus.ios
```

## Local verification

This prototype has been built and launched on an iPhone 16 simulator with Xcode 26.5 and the iOS 26.5 simulator runtime.

The Swift source can be checked quickly with:

```bash
swiftc -typecheck ios/MapOfUs/MapOfUs/*.swift
```

A sample backup payload lives at:

```text
ios/MapOfUs/README.backup-example.json
```

Regenerate the native city catalog after editing `data/cities.ts` or `data/provinces.ts`:

```bash
node scripts/generate-ios-city-catalog.mjs
```

If full Xcode is selected globally, run:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -project ios/MapOfUs/MapOfUs.xcodeproj -scheme MapOfUs -destination 'platform=iOS Simulator,name=iPhone 16' build
```

If Command Line Tools are still selected globally, keep the system setting unchanged and run through `DEVELOPER_DIR`:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -project ios/MapOfUs/MapOfUs.xcodeproj -scheme MapOfUs -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 16' build CODE_SIGNING_ALLOWED=NO
```

## Next product steps

- Replace the stylized prototype map with real China province/city geometry.
- Import the existing `data/cities.ts` and memory backup format into native models.
- Replace base64 JSON photo backups with a zip/package format if backup files become large.
- Add iCloud/private sync after the local model stabilizes.
