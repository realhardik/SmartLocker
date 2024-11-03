const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const axios = require('axios');
const keytar = require('keytar');

const INACTIVITY_LIMIT = 10 * 60 * 1e3;
let mainWindow, loginWindow, inactivityTimeout;
let apiBaseUrl = 'http://localhost:3000';

async function alert(title) {
  const response = await dialog.showMessageBox({
    type: 'info',
    buttons: ['OK'],
    title: title,
    message: title || ""
  });
  return response.response
}

function resetInactivityTimeout() {
  clearTimeout(inactivityTimeout);
  console.log('Timeout reset');
  inactivityTimeout = setTimeout(async () => {
    await logout()
    alert('User has been inactive for 10 minutes. \nLog in again.');
  }, INACTIVITY_LIMIT);
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
  resetInactivityTimeout();
  mainWindow.loadFile('app.html');
}

function createRenderPage() {
  
}

ipcMain.handle('signup', async (event, credentials) => {
  try {
    console.log("Attempting signup with credentials:", credentials);
    const response = await axios.post(`${apiBaseUrl}/signup`, credentials);
    console.log(response)
    return response.data;
    
  } catch (error) {
    console.error("Signup failed:", error.response ? error.response.data : error.message);
    return { success: false, error: 'Signup failed' };
  }
});

ipcMain.handle('login', async (event, credentials) => {
  try {
    const response = await axios.post(`${apiBaseUrl}/login`, credentials);
    const data = response.data;
    if (data.success) {
      console.log(data)
      var token = data.session.token
      await keytar.setPassword('ElectronApp', 'auth-token', token);
      await alert("Login Successfull!")
      loginWindow.close();
      createMainWindow();
      mainWindow.once('ready-to-show', () => {
        mainWindow.webContents.send('user-logged-in', data);
      });
    }
    return data
  } catch (error) {
    console.error('Login failed:', error);
    return { success: false, error: 'Login failed' };
  }
});

async function logout() {
  await keytar.deletePassword('ElectronApp', 'auth-token');
  mainWindow && mainWindow.close();
  createLoginWindow();
}

ipcMain.handle('logout', async (event) => {
  await logout();
  return { success: true };
});

ipcMain.handle('isAuthorized', async () => {
  const token = await keytar.getPassword('ElectronApp', 'auth-token');
  return token;
});

ipcMain.on('create-login-window', () => {
  if (!loginWindow) {
    createLoginWindow();
  }
  mainWindow && mainWindow.close()
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
  console.log("Received 'user-active' in main process");
  resetInactivityTimeout();
});


ipcMain.handle('render', async (e, d) => {
  var { from, to } = e,
    token = await keytar.getPassword('ElectronApp', 'auth-token')
  if (!token) {
    return { success: false, msg: "Failed to authorize. Try to sign in again."}
  }
  createRenderPage();
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
