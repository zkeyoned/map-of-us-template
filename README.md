<p align="center">
  <img src="marketing/ads/poster-hero.png" alt="Map of Us 海报" width="420" />
</p>

# Map of Us

Map of Us 是一个本地优先的个人情侣记忆地图应用。它使用 Next.js 16 App Router、React 19、Tailwind 4 和 Electron，可以在浏览器里开发，也可以打包成桌面应用。

当前版本的目标是：数据全部保存在用户自己的电脑上，不依赖 Supabase，不需要联网认证。

## iOS 原生原型

仓库里已经新增一个 SwiftUI iOS 原型工程：

```text
ios/MapOfUs/MapOfUs.xcodeproj
```

这个原型不是 WebView 包壳，入口就是“地图记录”：打开后直接进入可拖拽、可缩放的足迹地图，点城市后用底部 sheet 添加回忆，保存后城市被点亮并更新进度。iOS 城市目录由现有 Web 数据生成，目前包含 391 个城市节点。更多说明见 `ios/MapOfUs/README.md`。

## 功能

- 密码入口页，输入站点密码后进入地图。
- 中国地图、省份详情、城市回忆、照片、多图封面、编辑和删除。
- 设置页可管理管理员模式、纪念日、沿途天气城市、右下角情侣 logo、登录页照片和文案。
- 设置页支持完整备份导出、导入恢复、清空数据。
- Electron 桌面版使用 Next.js standalone 生产服务，不运行 `next dev`。
- 桌面版数据写入 Electron `userData` 目录，安装包资源目录保持只读。

## 桌面版密码

**首次安装后的初始密码：**

```text
进入密码：1234
管理员密码：admin1234
```

第一次打开请用上面的初始密码登录。进入后请尽快改成自己的：

- 进入 **设置 → 密码设置**（需先用管理员密码开启管理员模式）。
- **进入密码**建议填你们在一起的日期（月日，例如 12 月 23 日就填 `1223`），它就是打开 app 时输入的数字密码。
- **管理员密码**自己设置。
- 修改后立即生效，关机重开也用新密码。

技术说明：桌面版不依赖 `.env.local`。首次启动时 Electron 会在用户数据目录创建本地认证配置 `auth.local.json`，保存这两个密码；`AUTH_COOKIE_SECRET` 会随机生成并存在同一文件里。在设置页改密码会直接写回这个文件。若启动环境显式设置了 `SITE_PASSWORD`、`ADMIN_PASSWORD` 或 `AUTH_COOKIE_SECRET`，则优先使用环境变量。

## 安装与首次打开（给使用者）

本应用是个人/开源分发，**没有做苹果付费签名和公证**，所以从网上下载后第一次打开会被系统拦一下。这是正常现象，按下面操作放行即可，**只需要做一次**，之后正常双击打开。

### macOS

1. 双击 `Map of Us-0.1.3-arm64.dmg`，把里面的 **Map of Us** 拖进「应用程序」。
2. 在「应用程序」里 **右键点 Map of Us → 打开**，弹窗里再点一次 **打开**。
3. 若新版 macOS 没有「打开」选项：打开 **系统设置 → 隐私与安全性**，往下找到关于 Map of Us 的提示，点 **仍要打开**。
4. 若提示 **「已损坏，应移到废纸篓」**：打开「终端」运行下面这句去掉隔离标记，然后再打开：

   ```bash
   xattr -cr "/Applications/Map of Us.app"
   ```

### Windows

1. 运行 `Map of Us-0.1.3-x64-Setup.exe` 安装。
2. 若出现蓝色 **SmartScreen** 提示：点 **更多信息 → 仍要运行**。





## 桌面打包

生成 Next.js standalone 生产产物：

```bash
npm run desktop:prepare
```

生成未压缩的 macOS app，用于快速验证：

```bash
npm run dist:dir
```

生成 macOS 安装包：

```bash
npm run dist:mac
```

产物示例：

```text
dist/mac-arm64/Map of Us.app
dist/Map of Us-0.1.3-arm64.dmg
```

生成 Windows x64 安装包：

```bash
npm run dist:win
```

产物示例：

```text
dist/win-unpacked/Map of Us.exe
dist/Map of Us-0.1.3-x64-Setup.exe
```

在 macOS 上可以生成 Windows 安装包，但不能完整验证 Windows 运行效果；最终发布前建议在 Windows 真机或 CI 上再安装运行一次。

当前打包未配置正式应用图标、Apple 开发者签名和公证。macOS 产物使用 ad-hoc signing，公开分发前需要配置证书、公证和图标。


## 数据保存位置

浏览器开发模式默认写入项目目录：

```text
data/localMemories.private.json
data/cityAssets.private.json
data/loginPhotos.private.json
```

桌面打包版写入 Electron `userData/data`。常见位置：

```text
macOS: ~/Library/Application Support/Map of Us/data
Windows: %APPDATA%/Map of Us/data
```

可用环境变量覆盖桌面数据目录：

```text
MAP_OF_US_DATA_DIR=/path/to/data
```

打包版会强制启用本地文件存储：

```text
MAP_OF_US_STORAGE_MODE=local
MAP_OF_US_DESKTOP=1
```

因此即使 `NODE_ENV=production`，新增、编辑、删除和导入回忆也不会要求 Supabase。

## 可自定义内容

在设置页开启管理员模式后，可以自定义：

- 纪念日名称和开始日期。
- 首页“沿途天气”的城市。
- 右下角情侣 logo。
- 登录页九宫格照片。
- 登录页每张照片的城市名和标签文案。
- 城市地标图。

这些设置会随完整备份一起导出。登录页照片、城市地标和回忆照片以本地数据形式保存。

## 备份和迁移

在设置页使用“导出备份”保存完整备份文件。文件名会包含日期。

换电脑或重装后：

1. 安装并打开桌面应用。
2. 输入站点密码进入地图。
3. 进入设置页，用管理员密码开启管理员模式。
4. 导入备份文件。

导入会恢复回忆、城市地标、登录照片、纪念日、天气城市、logo，以及地点收藏、纪念日页面、时光宝盒等辅助数据。

## 检查更新

桌面版每次打开会自动向 GitHub Releases 查询是否有新版本。发现新版时会弹出提示，点「去下载」即打开最新 release 页面手动下载安装。因为应用未做 Apple 付费签名，macOS 上无法静默自动安装更新，所以采用「检测并提示下载」的方式，Windows 和 macOS 表现一致。检查逻辑在 `electron/update-checker.js`，仓库地址写死在文件顶部，fork 后请自行修改 `repoOwner` / `repoName`。

## 目录速览

```text
app/                     App Router 页面和 API
components/              地图、入口页、回忆页和设置页组件
data/                    省份、城市、进度和浏览器侧数据工具
electron/                Electron 主进程入口
lib/                     地理数据、隐私模式和服务端存储工具
scripts/                 standalone 准备脚本
public/logo/             logo 占位图
public/photos/           默认照片素材
public/sprites/          城市地标、图标和像素素材
dist/                    本地打包产物
```
