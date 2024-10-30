const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Function to create the main Electron window
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load the HTML file into the Electron window
  win.loadFile('index.html');
}

// // Function to create a new BrowserWindow for viewing PDFs
function openPdfViewer(pdfDataUrl) {
  const pdfWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load the PDF directly as a data URL
  pdfWindow.loadURL(pdfDataUrl);
}


// Listen for "open-pdf-viewer" event from renderer to open a PDF viewer window
ipcMain.on('open-pdf-viewer', (event, pdfDataUrl) => {
  openPdfViewer(pdfDataUrl);
});

// Electron app ready event to create the main window
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
