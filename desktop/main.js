const { app, BrowserWindow, shell, Menu, screen } = require("electron");
const path = require("path");
const fs = require("fs");

// NestLeads signs in with httpOnly cookies on its own origin, so the desktop app loads the
// live site instead of bundled files. Updates ship with the website, no reinstall needed.
const isDev = process.argv.includes("--dev");
const SITE_URL = "https://leads.pixelatenest.com";
const DEV_URL = "http://localhost:8080";
const START_URL = isDev ? DEV_URL : SITE_URL;
const APP_ORIGIN = new URL(START_URL).origin;
const stateFile = () => path.join(app.getPath("userData"), "window-state.json");

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), "utf8"));
  } catch {
    return {};
  }
}

function saveState(win) {
  if (win.isDestroyed()) return;
  const maximized = win.isMaximized();
  const bounds = maximized ? loadState().bounds : win.getBounds();
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({ bounds, maximized }));
  } catch {}
}

// Restore saved bounds only if they are still on a connected display.
function validBounds(b) {
  if (!b) return null;
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y;
  })
    ? b
    : null;
}

const isInternal = (url) => {
  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
};

function createWindow() {
  const state = loadState();
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const saved = validBounds(state.bounds);

  const win = new BrowserWindow({
    width: saved?.width ?? Math.min(1440, width),
    height: saved?.height ?? Math.min(900, height),
    x: saved?.x,
    y: saved?.y,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#f1f6fd",
    show: false,
    autoHideMenuBar: process.platform === "win32",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (state.maximized) win.maximize();
  win.once("ready-to-show", () => win.show());
  ["resize", "move", "close"].forEach((e) => win.on(e, () => saveState(win)));

  // Open external links in the user's browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) return { action: "allow" };
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith("file://") || isInternal(url)) return;
    e.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });

  // Offline or server unreachable: show a friendly page with a retry button.
  win.webContents.on("did-fail-load", (_e, code, _d, url, isMain) => {
    if (!isMain || code === -3 || win.isDestroyed()) return; // -3 = aborted navigation
    if (isDev) return void setTimeout(() => !win.isDestroyed() && win.loadURL(DEV_URL), 1000);
    win.loadFile(path.join(__dirname, "offline.html"), { query: { retry: START_URL } });
  });

  // Only the permissions the site needs.
  win.webContents.session.setPermissionRequestHandler((_wc, permission, cb) =>
    cb(["media", "notifications", "fullscreen", "clipboard-sanitized-write"].includes(permission)),
  );

  win.loadURL(START_URL);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    if (process.platform === "darwin") {
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          { role: "appMenu" },
          { role: "editMenu" },
          { role: "viewMenu" },
          { role: "windowMenu" },
        ]),
      );
    }
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
