const axios = require('axios');
const { ipcRenderer } = require('electron');
    
const BASE_URL = 'http://localhost:3000';

// Select DOM elements
const uploadSection = document.getElementById('upload-section');
const receiveSection = document.getElementById('receive-section');
const uploadBtn = document.getElementById('upload-btn');
const receiveBtn = document.getElementById('receive-btn')
const fileUpload = document.getElementById('file-upload');
const fileList = document.getElementById('file-list');

class fileSharing {
    constructor() {
        this.uploadSec = F.G.id('upload-section');
        this.uploadBtn = F.G.id("upload-btn")
        this.receiveBtn = F.G.id("receive-btn")
        ipcRenderer.on('user-logged-in', (event, userData) => {
            console.log('User logged in:', userData);
            console.log(userData.email)
            this.user = userData.email
        });
        console.log(this.user)
        this.upload = this.upload.bind(this)
        this.receive = this.receive.bind(this)
        F.l("click", this.uploadBtn, this.upload)
        F.l("click", this.receiveBtn, this.receive)
        F.l("click", F.G.id("logout-btn"), this.logout)
    }

    async upload(e) {
        e.preventDefault()
        const formData = new FormData();
        var from = this.user,
            to = F.G.id("receivers").value.split(",").map(item => item.trim()),
            file = F.G.id("file-upload").files[0]
            formData.append('from', from);
            formData.append('to', to);
            formData.append('file', file);
        console.log(formData)

        try {
            const response = await fetch(`${BASE_URL}/upload`, {
                method: 'POST',
                body: formData,
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
        const receiver = this.user; 
        console.log(receiver)
        try {
            const response = await fetch(`${BASE_URL}/receiver?receiver=${encodeURIComponent(receiver)}`, {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            const fileList = document.getElementById('file-list');
            fileList.innerHTML = ''; 
            data.forEach(file => {
                const listItem = document.createElement('li');
                listItem.textContent = file.fName;
                fileList.appendChild(listItem);
            })
        } catch (error) {
            console.error('Error fetching files:', error);
        }
    }

    async fDownload() {

    }

    async logout(e) {
        ipcRenderer.invoke('logout');
    }
}

new fileSharing

// ['keydown', 'click'].forEach(e => { 
//     window.addEventListener(e, () => { 
//         console.log('Activity detected:', e);
//         ipcRenderer.send('user-active'); 
//     }); 
// });