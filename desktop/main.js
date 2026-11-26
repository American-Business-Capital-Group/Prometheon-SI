'use strict';

// Prometheon SI — Electron wrapper.
// Loads the published site at https://prometheon.si. If the site cannot be
// reached, a bundled offline page is shown instead. There is NO auto-update
// machinery in this app: new versions are installed manually from GitHub
// Releases (see README.md / DESKTOP_NOTES.md).

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const SITE_URL = 'https://prometheon.si';
const TAILNET_URL = 'http://100.89.231.37:8800';

let mainWindow = null;

function isAllowedExternal(url) {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

function loadSite() {
  if (mainWindow) {
    mainWindow.loadURL(SITE_URL);
  }
}

function loadOffline() {
  if (mainWindow) {
    mainWindow.loadFile(path.join(__dirname, 'offline.html'));
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Prometheon SI',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Open external links in the system browser — https only.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternal(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isSite = url === SITE_URL || url.startsWith(SITE_URL + '/');
    const isTailnet = url === TAILNET_URL || url.startsWith(TAILNET_URL + '/');
    const isOffline = url.startsWith('file://');
    if (!isSite && !isTailnet && !isOffline) {
      event.preventDefault();
      if (isAllowedExternal(url)) {
        shell.openExternal(url);
      }
    }
  });

  // Reachability fallback: if the published site fails to load, show the
  // bundled offline page instead of a blank/error window.
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _desc, validatedURL) => {
    // -3 is ERR_ABORTED (e.g. a navigation superseded by another); ignore it.
    if (errorCode === -3) return;
    if (validatedURL && validatedURL.startsWith(SITE_URL)) {
      loadOffline();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  loadSite();
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload Prometheon SI',
          accelerator: 'CmdOrCtrl+R',
          click: () => loadSite(),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Prometheon SI (web)',
          click: () => shell.openExternal(SITE_URL),
        },
        {
          label: 'Tailnet app (the Door)',
          click: () => shell.openExternal(TAILNET_URL),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
