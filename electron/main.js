const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("node:child_process");
const { checkForUpdates } = require("./update-checker");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const preferredPort = 3002;
const host = "127.0.0.1";

app.setName("Map of Us");

const isPackaged = app.isPackaged;
const appRoot = isPackaged ? app.getAppPath() : path.join(__dirname, "..");
const userDataDir = app.getPath("userData");
const dataDir = process.env.MAP_OF_US_DATA_DIR || path.join(userDataDir, "data");
const authConfigPath = path.join(userDataDir, "auth.local.json");

let serverProcess = null;
let mainWindow = null;
let appUrl = "";

function readOrCreateAuthConfig() {
  try {
    const raw = fs.readFileSync(authConfigPath, "utf8");
    const parsed = JSON.parse(raw);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.sitePassword === "string" &&
      typeof parsed.adminPassword === "string" &&
      typeof parsed.cookieSecret === "string"
    ) {
      return parsed;
    }
  } catch {
    // First desktop launch creates the local auth file below.
  }

  const config = {
    sitePassword: process.env.SITE_PASSWORD || "1234",
    adminPassword: process.env.ADMIN_PASSWORD || "admin1234",
    cookieSecret: process.env.AUTH_COOKIE_SECRET || crypto.randomBytes(32).toString("base64url"),
  };

  fs.mkdirSync(path.dirname(authConfigPath), { recursive: true });
  fs.writeFileSync(authConfigPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  return config;
}

function getDesktopEnv(port) {
  const authConfig = readOrCreateAuthConfig();

  return {
    ...process.env,
    NODE_ENV: isPackaged ? "production" : process.env.NODE_ENV,
    PORT: String(port),
    HOSTNAME: host,
    MAP_OF_US_DESKTOP: "1",
    MAP_OF_US_STORAGE_MODE: "local",
    MAP_OF_US_DATA_DIR: dataDir,
    MAP_OF_US_BUNDLED_DATA_DIR: path.join(appRoot, isPackaged ? ".next/standalone/data" : "data"),
    MAP_OF_US_AUTH_CONFIG: authConfigPath,
    SITE_PASSWORD: process.env.SITE_PASSWORD || authConfig.sitePassword,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || authConfig.adminPassword,
    AUTH_COOKIE_SECRET: process.env.AUTH_COOKIE_SECRET || authConfig.cookieSecret,
  };
}

function getFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.unref();
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(getFreePort(startPort + 1));
        return;
      }
      reject(error);
    });
    server.listen(startPort, host, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : startPort;
      server.close(() => resolve(port));
    });
  });
}

function startNextServer(port) {
  fs.mkdirSync(dataDir, { recursive: true });

  if (isPackaged) {
    // Run the Next standalone server inside this Electron process (not a child
    // process), so macOS shows only one Dock icon instead of a second "exec".
    const serverDir = path.join(appRoot, ".next", "standalone");
    const env = getDesktopEnv(port);

    for (const [key, value] of Object.entries(env)) {
      if (value !== undefined) process.env[key] = String(value);
    }

    process.chdir(serverDir);

    try {
      require(path.join(serverDir, "server.js"));
    } catch (error) {
      console.error("[electron] failed to start in-process Next.js server:", error);
      app.quit();
    }

    return;
  }

  const nextBin = path.join(appRoot, "node_modules", ".bin", "next");

  serverProcess = spawn(nextBin, ["dev", "-p", String(port), "-H", host], {
    cwd: appRoot,
    env: getDesktopEnv(port),
    stdio: "inherit",
  });

  serverProcess.on("error", (error) => {
    console.error("[electron] failed to start Next.js server:", error);
  });

  serverProcess.on("exit", (code, signal) => {
    if (mainWindow) {
      console.error(`[electron] Next.js server exited (code=${code}, signal=${signal})`);
    }
  });
}

function waitForServer(retries, callback) {
  const request = http.get(appUrl, (response) => {
    response.resume();
    callback();
  });

  request.on("error", () => {
    if (retries > 0) {
      setTimeout(() => waitForServer(retries - 1, callback), 500);
    } else {
      callback(new Error("Next.js server did not become ready in time"));
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    title: "Map of Us",
    backgroundColor: "#fdfaf3",
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(appUrl);

  // Open external links (e.g. the GitHub repo) in the system browser instead of
  // a blank Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const isAppUrl = appUrl && url.startsWith(appUrl);
      if (!isAppUrl) shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Check GitHub Releases for a newer version shortly after the window is up,
  // so the check never delays the app becoming interactive.
  setTimeout(() => checkForUpdates(mainWindow), 4000);
}

app.whenReady().then(async () => {
  const port = await getFreePort(preferredPort);
  appUrl = `http://${host}:${port}`;
  console.log(`[electron] app url: ${appUrl}`);
  console.log(`[electron] data dir: ${dataDir}`);

  startNextServer(port);
  waitForServer(90, (error) => {
    if (error) {
      console.error("[electron]", error.message);
      app.quit();
      return;
    }
    createWindow();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && appUrl) createWindow();
  });
});

function shutdown() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

app.on("window-all-closed", () => {
  shutdown();
  app.quit();
});

app.on("before-quit", shutdown);
