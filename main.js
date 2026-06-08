// Electron main process: start the Express backend on localhost, then open a
// native window pointing at it. Electron bundles its own Chromium, so startup
// is fast and consistent (no WebView2 cold-start).
const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { createApp } = require("./server");

let mainWindow = null;
let server = null;

function start() {
  const dataDir = app.getPath("userData");
  const expressApp = createApp(dataDir);

  server = expressApp.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}`;

    mainWindow = new BrowserWindow({
      width: 1280, height: 850, minWidth: 1040, minHeight: 680,
      backgroundColor: "#0e1014",
      title: "WOLF Attendance",
      autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadURL(url);

    // Open external links in the system browser, not inside the app.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
    });

    mainWindow.on("closed", () => { mainWindow = null; });
  });
}

app.whenReady().then(start);

app.on("window-all-closed", () => {
  if (server) try { server.close(); } catch (e) {}
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) start();
});
