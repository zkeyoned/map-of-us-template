import SwiftUI

final class LockSettings: ObservableObject {
    private let passcodeKey = "mapOfUs.passcode"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if defaults.string(forKey: passcodeKey) == nil {
            defaults.set("1234", forKey: passcodeKey)
        }
    }

    var passcode: String {
        defaults.string(forKey: passcodeKey) ?? "1234"
    }

    func validate(_ candidate: String) -> Bool {
        candidate == passcode
    }

    func updatePasscode(_ passcode: String) {
        defaults.set(passcode, forKey: passcodeKey)
    }
}

struct LockedAppView: View {
    @EnvironmentObject private var store: FootprintStore
    @StateObject private var lockSettings = LockSettings()
    @State private var isUnlocked = false

    var body: some View {
        Group {
            if isUnlocked {
                AppRootView()
                    .environmentObject(store)
                    .environmentObject(lockSettings)
            } else {
                AppLockView {
                    isUnlocked = true
                }
                .environmentObject(lockSettings)
            }
        }
        .animation(.spring(response: 0.42, dampingFraction: 0.86), value: isUnlocked)
    }
}

struct AppLockView: View {
    @EnvironmentObject private var lockSettings: LockSettings
    @State private var code = ""
    @State private var errorText: String?
    @FocusState private var isFocused: Bool

    let onUnlock: () -> Void

    var body: some View {
        ZStack {
            lockBackground

            VStack(spacing: 24) {
                Spacer()
                titleBlock
                passcodePanel
                Spacer()
            }
        }
        .onAppear {
            isFocused = true
        }
        .sensoryFeedback(.error, trigger: errorText)
    }

    private var lockBackground: some View {
        ZStack {
            LinearGradient(
                colors: [Color.cream, Color.mist.opacity(0.55), Color.cream],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            ChinaInspiredShape()
                .fill(Color.dim.opacity(0.22))
                .overlay {
                    ChinaInspiredShape()
                        .stroke(Color.bloom.opacity(0.26), lineWidth: 2)
                }
                .scaleEffect(1.08)
                .offset(y: -26)
                .padding(32)
        }
    }

    private var titleBlock: some View {
        VStack(spacing: 10) {
            Text("Map of Us")
                .font(.system(size: 38, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.ink)
            Text("解锁我们的地图")
                .font(.headline.weight(.medium))
                .foregroundStyle(Color.ink.opacity(0.58))
        }
    }

    private var passcodePanel: some View {
        VStack(spacing: 14) {
            SecureField("四位密码", text: $code)
                .multilineTextAlignment(.center)
                .font(.system(size: 26, weight: .semibold, design: .rounded))
                .focused($isFocused)
                .onChange(of: code) { _, newValue in
                    code = normalizedPasscode(newValue)
                    errorText = nil
                    if code.count == 4 {
                        unlock()
                    }
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 16)
                .background(Color.cream.opacity(0.86), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(errorText == nil ? Color.dim.opacity(0.8) : Color.bloom, lineWidth: 1)
                }

            statusLine
        }
        .padding(20)
        .background(.white.opacity(0.54), in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .padding(.horizontal, 30)
    }

    @ViewBuilder
    private var statusLine: some View {
        if let errorText {
            Text(errorText)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.bloom)
        } else {
            Text("原型默认密码 1234，可在「我们」里修改。")
                .font(.caption.weight(.medium))
                .foregroundStyle(Color.ink.opacity(0.5))
        }
    }

    private func unlock() {
        if lockSettings.validate(code) {
            onUnlock()
        } else {
            errorText = "密码不对，再试一次"
            code = ""
        }
    }

    private func normalizedPasscode(_ value: String) -> String {
        String(value.filter { $0.isNumber }.prefix(4))
    }
}

struct PasscodeSettingsCard: View {
    @EnvironmentObject private var lockSettings: LockSettings
    @State private var newPasscode = ""
    @State private var statusText: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("进入密码")
                        .font(.headline)
                        .foregroundStyle(Color.ink)
                    Text("保护本机里的旅行回忆。")
                        .font(.caption)
                        .foregroundStyle(Color.ink.opacity(0.56))
                }
                Spacer()
                Image(systemName: "lock")
                    .font(.title2)
                    .foregroundStyle(Color.bloom)
            }

            HStack(spacing: 10) {
                SecureField("新的四位密码", text: $newPasscode)
                    .onChange(of: newPasscode) { _, newValue in
                        newPasscode = normalizedPasscode(newValue)
                        statusText = nil
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(Color.cream.opacity(0.7), in: RoundedRectangle(cornerRadius: 14, style: .continuous))

                Button("保存") {
                    savePasscode()
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.bloom)
                .disabled(newPasscode.count != 4)
            }

            if let statusText {
                Text(statusText)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.ink.opacity(0.62))
            }
        }
        .padding(20)
        .background(.white.opacity(0.68), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private func savePasscode() {
        guard newPasscode.count == 4 else { return }
        lockSettings.updatePasscode(newPasscode)
        newPasscode = ""
        statusText = "密码已更新"
    }

    private func normalizedPasscode(_ value: String) -> String {
        String(value.filter { $0.isNumber }.prefix(4))
    }
}
