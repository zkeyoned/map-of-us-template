const { app, dialog, shell } = require("electron");
const https = require("node:https");

// Lightweight, dependency-free update check.
//
// The desktop app is distributed without a paid Apple Developer ID signature,
// so electron-updater's silent auto-install cannot run on macOS. Instead we
// just ask the GitHub Releases API whether a newer version exists and, if so,
// offer to open the download page. This behaves identically on macOS and
// Windows and needs no code signing or release metadata files.

const repoOwner = "zkeyoned";
const repoName = "map-of-us-template";
const releasesApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`;
const releasesPageUrl = `https://github.com/${repoOwner}/${repoName}/releases/latest`;

// Parse a version string like "v0.1.2" or "0.1.2" into numeric parts.
function parseVersion(value) {
  const cleaned = String(value).trim().replace(/^v/i, "");
  const parts = cleaned.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => Number.isNaN(part))) return null;
  return parts;
}

// Returns true when `remote` is a strictly newer version than `current`.
function isNewer(remote, current) {
  const a = parseVersion(remote);
  const b = parseVersion(current);
  if (!a || !b) return false;

  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left > right) return true;
    if (left < right) return false;
  }
  return false;
}

function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const request = https.get(
      releasesApiUrl,
      {
        headers: {
          "User-Agent": "Map-of-Us-Desktop",
          Accept: "application/vnd.github+json",
        },
        timeout: 8000,
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`GitHub API responded with ${response.statusCode}`));
          return;
        }

        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.on("timeout", () => request.destroy(new Error("GitHub API request timed out")));
    request.on("error", reject);
  });
}

async function promptForUpdate(parentWindow, latestVersion) {
  const { response } = await dialog.showMessageBox(parentWindow ?? undefined, {
    type: "info",
    buttons: ["去下载", "以后再说"],
    defaultId: 0,
    cancelId: 1,
    title: "有新版本",
    message: `Map of Us ${latestVersion} 可用`,
    detail: `当前版本 ${app.getVersion()}。新版本需要手动下载安装，你的回忆和设置不会丢失。`,
  });

  if (response === 0) {
    await shell.openExternal(releasesPageUrl);
  }
}

// Check for a newer release and, if found, prompt the user. Any failure
// (offline, rate-limited, malformed response) is swallowed so the check never
// disrupts a normal launch.
async function checkForUpdates(parentWindow) {
  if (!app.isPackaged) return;

  try {
    const release = await fetchLatestRelease();
    if (release?.draft || release?.prerelease) return;

    const latestVersion = release?.tag_name;
    if (latestVersion && isNewer(latestVersion, app.getVersion())) {
      await promptForUpdate(parentWindow, latestVersion.replace(/^v/i, ""));
    }
  } catch (error) {
    console.log("[electron] update check skipped:", error.message);
  }
}

module.exports = { checkForUpdates };
