require('dotenv').config();
const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const axios = require('axios');
const keytar = require('keytar');

app.setAsDefaultProtocolClient('nexus');

const INACTIVITY_LIMIT = 10 * 60 * 1e3;
let mainWindow, loginWindow, renderWindow, authWindow, inactivityTimeout;
let apiBaseUrl = process.env.NODE_PROCESS === 'DEV' ? process.env.API_URL : 'http://localhost:3000/api';
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
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  loginWindow.loadFile('./login/login.html');
}

function createGAUTHwindow() {
  authWindow = new BrowserWindow({
    width: 500,
    height: 650,
    webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
    }
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1340,
    height: 850,
    minWidth: 770,
    minHeight: 660,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });
  resetInactivityTimeout();
  mainWindow.loadFile('./main/app.html');
}

function createRenderWindow() {
  renderWindow = new BrowserWindow({
    width: 900,
    height: 850,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });
  renderWindow.loadFile('./render/render.html')
}

ipcMain.handle('sendOtp', async (e, event, email) => {
  try {
    console.log("Attempting signup with credentials:", email);
    let response;
    if (event === "signUp") {
      response = await axios.get(`${apiBaseUrl}/signup`, {
        params: {
          email: email
        }
      });
    } else if (event === 'forgotPass') {
      response = await axios.post(`${apiBaseUrl}/forgotPassword`, {
        email: email
      });
    }
    console.log("response: ", response)
    if (response.data.success)
      return { success: true, result: response.data };
    return { success: false, message: response.data.message }

  } catch (error) {
    console.error("Signup failed:", error.response ? error.response?.data?.message : "Server not working at the moment.");
    return { success: false, message: (error?.response?.data?.message || "Server not working at the moment.") };
  }
});

ipcMain.handle('forgotPassword', async (e, data) => {
  try {
    let response;
      response = await axios.get(`${apiBaseUrl}/forgotPassword/${data.otp}`, {
        params: {
          email: data.email,
          newPassword: data.newPass
        }
      });
      console.log("response: ", response)
    if (response.data.success)
      return { success: true, result: response.data };
    return { success: false, msg: response.data.msg }
  } catch (error) {
    console.error("Signup failed:", error.response ? error.response.data.msg : "Server not working at the moment.");
    return { success: false, msg: (error.response.data.msg || "Server not working at the moment.") };
  }
});

ipcMain.handle('signup', async (event, credentials) => {
  try {
    const response = await axios.post(`${apiBaseUrl}/signup`, credentials);
    if (response.data.success)
      return { success: true, result: response.data, message: "User Created successfully." };
    return { success: false, message: response.data.message }
  } catch (error) {
    console.error('Signup failed:', error.message || error);
    return { success: false, message: error.response?.data?.message || error.message || "An unexpected error occurred" };
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
      await alert("Login Successfull!");
      loginWindow.close();
      createMainWindow();
      return { success: true, result: data }
    } else {
      return { success: false, message: data?.message || "Error with the server. Please try again later." }
    }
  } catch (error) {
    console.error('Login failed:', error.message || error);
    return { success: false, message: error.response?.data?.message || error.message || "An unexpected error occurred" };
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
  try {
    const token = await keytar.getPassword('ElectronApp', 'auth-token');
    
    const response = await axios.post(`${apiBaseUrl}/check`, {},
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (response.status === 200) {
      console.log("Token is authorized");
      return { token: token, user: response.data.user };
    }
    console.log("Session Expired. Please login again.");
    mainWindow && mainWindow.close();
  } catch (error) {
    console.log("Session Expired. Please login again.");
    mainWindow && mainWindow.close();
  }
    
});

ipcMain.on('create-login-window', () => {
  if (!loginWindow) {
    createLoginWindow();
  }
  mainWindow && mainWindow.close()
});

ipcMain.handle('close-auth-window', (e, tab) => {
  authWindow.close();
  authWindow = null;
  if (tab) {
      loginWindow.close();
      createMainWindow();
  };
});

ipcMain.handle('googleSignIn', async () => {
  if (!authWindow) createGAUTHwindow();
  authWindow.loadURL(`${apiBaseUrl}/auth/google`);

  let fResponse = {};

  const waitForRedirect = new Promise((resolve, reject) => {
    authWindow.on('closed', () => {
      authWindow = null;
    });

    authWindow.webContents.on('will-redirect', async (event, url) => {
      if (url.startsWith(apiBaseUrl)) {
        console.log('enter');
        var sRes = url.split('?');
        console.log(sRes);

        var response = sRes[0].endsWith('success') ? 's' : sRes[0].endsWith('failure') ? 'f' : null;
        console.log(response);

        if (response) {
          event.preventDefault();
          try {
            if (response === 's') {
              console.log('success');
              const urlParams = new URLSearchParams(sRes[1]);
              const sessionID = urlParams.get('id');
              console.log(sessionID);
              if (sessionID) {
                let axiosResponse = await axios.get(`${apiBaseUrl}/auth/session`, {
                  params: { id: sessionID }
                });
                axiosResponse = axiosResponse.data;
                if (axiosResponse.token) {
                  console.log('in token', axiosResponse.token);
                  await keytar.setPassword('ElectronApp', 'auth-token', axiosResponse.token);
                  fResponse = { success: true, message: "Login Successful!" };
                } else {
                  fResponse = { success: false, message: "Authentication Failed." };
                }
              }
            } else if (response === 'f') {
              fResponse = { success: false, message: "Authentication Failed." };
            }
            resolve(fResponse);
          } catch (err) {
            console.error('Error:', err);
            fResponse = { success: false, message: "Authentication Failed." };
            resolve(fResponse);
          }
        }
      }
    });
  });
  return waitForRedirect;
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  console.log(`Custom protocol called with URL: ${url}`);
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
  createRenderWindow();
  renderWindow.once('ready-to-show', () => {
    renderWindow.webContents.send('render-file', d);
  });
});

ipcMain.handle('close-render', async (e) => {
  renderWindow && renderWindow.close()
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
