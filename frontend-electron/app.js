const { ipcRenderer } = require('electron');
    
const BASE_URL = 'http://localhost:3000';

class fileSharing {
    constructor(data) {
        this.uploadSec = F.G.id('upload-section');
        this.uploadBtn = F.G.id("upload-btn")
        this.receiveBtn = F.G.id("receive-btn")
        this.upload = this.upload.bind(this)
        this.receive = this.receive.bind(this)
        this.oRender = this.oRender.bind(this)
        this.user = data.session
        F.l("click", this.uploadBtn, this.upload)
        F.l("click", this.receiveBtn, this.receive)
        F.l("click", F.G.id("logout-btn"), this.logout)
    }

    async upload(e) {
        e.preventDefault()
        const formData = new FormData();
        var from = this.user.email,
            to = F.G.id("receivers").value.split(",").map(item => item.trim()),
            file = F.G.id("file-upload").files[0],
            token = this.user.token
            formData.append('from', from);
            formData.append('to', to);
            formData.append('file', file);

        try {
            const response = await fetch(`${BASE_URL}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();
            if (response.ok) {
                alert('File uploaded successfully: ' + data.msg);
            } else {
                alert('Error: ' + data.msg);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while uploading the file.');
        }
    }

    async receive(e) {
        e.preventDefault()
        var receiver = this.user.email,
            token = this.user.token
        try {
            const response = await fetch(`${BASE_URL}/receiver?receiver=${encodeURIComponent(receiver)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            var data = await response.json(),
                files = data.result,
                fileList = document.getElementById('file-list');
            fileList.innerHTML = '';
            console.log(files)
            files.forEach(file => {
                const listItem = document.createElement('li');
                listItem.textContent = file.fName;
                fileList.appendChild(listItem);
                listItem.fCon = {
                    from: file.from,
                    to: file.to,
                    fName: file.fName,
                    hash: file.fileHash
                }
                F.l('click', listItem, (e) => { this.oRender(e) })
            })
        } catch (error) {
            console.error('Error fetching files:', error);
        }
    }

    async oRender(e) {
        var f = e.target
        ipcRenderer.invoke('render', f["fCon"])
    }

    async logout(e) {
        ipcRenderer.invoke('logout');
    }
}

new class {
    constructor () {
        this.auth = this.auth.bind(this)
        this.startInTimer = this.startInTimer.bind(this)
        this.auth()
    }

    async auth() {
        const isAuthorized = await ipcRenderer.invoke('isAuthorized');
        if (!isAuthorized) {
            ipcRenderer.send('create-login-window');
        } else {
            this.startInTimer()
            ipcRenderer.on('user-logged-in', (event, data) => {
                console.log('User logged in:', data);
                new fileSharing(data)
            });
        }
    }

    startInTimer() {
        const events = ['keydown', 'click'];
            events.forEach(e => { 
                window.addEventListener(e, (x) => {
                    ipcRenderer.send('user-active'); 
            }); 
        });
    }
}
