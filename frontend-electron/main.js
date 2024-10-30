const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const axios = require('axios');
const keytar = require('keytar');

const INACTIVITY_LIMIT = 1 * 60 * 1e3;
let mainWindow, loginWindow, inactivityTimeout;
let apiBaseUrl = 'http://localhost:3000';

function resetInactivityTimeout() {
  clearTimeout(inactivityTimeout);
  inactivityTimeout = setTimeout(() => {
      mainWindow.webContents.send('user-inactive');
  }, INACTIVITY_LIMIT);
}

async function alert(title) {
  const response = await dialog.showMessageBox({
    type: 'info',
    buttons: ['OK'],
    title: title,
    message: title || ""
  });
  return response.response
}

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  loginWindow.loadFile('login.html');
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });
  mainWindow.webContents.on('before-input-event', resetInactivityTimeout);
  resetInactivityTimeout();
  mainWindow.loadFile('app.html');
}


ipcMain.handle('signup', async (event, credentials) => {
  try {
    console.log("Attempting signup with credentials:", credentials);
    const response = await axios.post(`${apiBaseUrl}/signup`, credentials);
    console.log(response.data)
    await alert(response.data.msg)
    if (response.success) {
      return { success: true };
    } else {
      return { success: false }
    }
    
  } catch (error) {
    console.error("Signup failed:", error.response ? error.response.data : error.message);
    return { success: false, error: 'Signup failed' };
  }
});

ipcMain.handle('login', async (event, credentials) => {
  try {
    console.log(credentials)
    const response = await axios.post(`${apiBaseUrl}/login`, credentials);
    
    const token = response.data.accessToken;
    console.log(response.data)
    await keytar.setPassword('ElectronApp', 'auth-token', token);
    await alert("Login Successfull!")
    loginWindow.close();
    createMainWindow();
    return { success: true };
  } catch (error) {
    console.error('Login failed:', error);
    return { success: false, error: 'Login failed' };
  }
});

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

ipcMain.handle('logout', async (event) => {
  await keytar.deletePassword('ElectronApp', 'auth-token');
  mainWindow && mainWindow.close();
  createLoginWindow();
  return { success: true };
});

ipcMain.handle('isAuthorized', async () => {
  const token = await keytar.getPassword('ElectronApp', 'auth-token');
  if (token) {
    if (loginWindow) loginWindow.close();
    createMainWindow();
  }
  return !!token;
});

app.whenReady().then(() => {
  createLoginWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLoginWindow();
    }
  });
});

ipcMain.on('user-active', () => {
  resetInactivityTimeout();
});

// app.on('web-contents-created', (event, contents) => {
//   contents.on('devtools-opened', () => {
//     if (app.isPackaged) {
//       contents.closeDevTools();
//     }
//   });
// });

// // Quit when all windows are closed, except on macOS
// app.on('window-all-closed', () => {
//   if (process.platform !== 'darwin') {
//     app.quit();
//   }
// });
