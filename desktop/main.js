const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

process.env.BIBLIOTECA_PORT = process.env.BIBLIOTECA_PORT || '3001';
process.env.BIBLIOTECA_HOST = '127.0.0.1';
require(path.join(__dirname, '..', 'biblioteca', 'server.js'));

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1050,
    minHeight: 700,
    title: 'Biblioteca — Gestão de Acervo',
    autoHideMenuBar: true,
    backgroundColor: '#080b14',
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  win.loadURL('http://127.0.0.1:3001');
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(() => {
  setTimeout(createWindow, 350);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
