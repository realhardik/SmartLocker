const { ipcRenderer } = require('electron');
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

class fileSharing {
    constructor(data) {
        // this.uploadSec = F.G.id('upload-section');
        // this.uploadBtn = F.G.id("upload-btn")
        // this.receiveBtn = F.G.id("receive-btn")
        F.BM(this, ["upload", "receive", "oRender", "getToken"])
        // this.user = data.session
        // F.l("click", this.uploadBtn, this.upload)
        // F.l("click", this.receiveBtn, this.receive)
        // F.l("click", F.G.id("logout-btn"), this.logout)
    }

    async upload(e) {
        e.preventDefault()
        const formData = new FormData();
        var from = this.user.email,
            to = F.G.id("receivers").value.split(",").map(email => ({ email: email.trim() })),
            file = F.G.id("file-upload").files[0],
            token = this.user.token
        if (file && file.type === "application/pdf" && file.name.toLowerCase().endsWith(".pdf")) {
            formData.append('from', from);
            formData.append('to', JSON.stringify(to));
            formData.append('file', file);
        } else {
            alert("Please upload a PDF file.");
            F.G.id("file-upload").value = ""
            return;
        }
        
        try {
            const response = await fetch(`${BASE_URL}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();
            console.log(data)
            if (response.ok) {
                alert(data.msg);
                F.G.id("receivers").value = ""
                F.G.id("file-upload").value = ""
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
                fileList = F.G.id('file-list');
            fileList.innerHTML = '';
            console.log(files)
            files.forEach(file => {
                const listItem = document.createElement('li');
                listItem.textContent = file.fName;
                fileList.appendChild(listItem);
                listItem.fCon = {
                    from: file.from,
                    to: receiver,
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
        F.G.id('file-list').innerHTML = ""
        F.G.id("receivers").value = ""
        F.G.id("file-upload").value = ""
        ipcRenderer.invoke('logout');
    }

    async getToken() {
        var t = await ipcRenderer.invoke('isAuthorized')
        return t
    }
}

class chat {
    constructor(d) {
        this.profS = F.G.id("profS"),
        this.aProfChat = F.G.id("sChat"),
        this.profTemp = F.G.id("profile").content.firstElementChild.cloneNode(true),
        this.msgTemp = F.G.id("message").content.firstElementChild.cloneNode(true)
        this.fSys = new fileSharing
        this.user = d.session
        F.BM(this, ["handleInputs", "handleOpts", "addChat", "closeDialog", "openDialog"])
        F.l('click', F.G.id("oOpt"), this.handleOpts)
        F.G.class('i').forEach(e => {
            F.l('click', e, this.handleInputs)
        })
        F.G.class('d').forEach(e => {
            F.l('click', e, this.openDialog)
        })
        F.G.class('c').forEach(e => {
            F.l('click', e, this.closeDialog)
        })
        console.log("new chat")
    }

    openDialog(e) {
        console.log("open dialog", e)
        e.preventDefault()
        var dBoxId = e.target["dataset"].dbox,
            dBox = F.G.id(dBoxId)
        console.log(dBoxId)
        dBox && F.hide(dBox, !0)
    }

    handleInputs(e) {
        e.preventDefault()
        console.log("handle input", e)
        var aBtn = e.target,
            dts = aBtn.dataset,
            dBox = dts.dialog,
            dFun = dts.p,
            dInp = JSON.parse(dts.i)
        let inputs = {}
        if (!F.Is.arr(dInp))
            return
        dInp.forEach(i => {
            var iField = F.G.id(i),
                dName = iField["dataset"].name
            inputs[dName] = iField.value
        })
        this[dFun](inputs, dBox)
    }

    async addChat(i, d) {
        var uEmail = i.userEmail,
            token = await this.fSys.getToken(),
            res = await axios.post(`${BASE_URL}/search`, {
                collection: 'Users',
                query: { email: uEmail },
                method: 'findOne'
              }, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
            }),
            user = res.data,
            dBox = F.G.id(d)
        console.log(user)
        if (!user.success) {
            console.log('not found')
            alert("User not found.")
            F.hide(dBox)
            return
        }
        
        user = user.result
        var temp = this.profTemp.cloneNode(true),
            nSpan = F.Cr('span')
            console.log(temp)
        var nCon = F.G.class('profName', temp)[0]
        
        nSpan.innerHTML = user.name
        nCon.appendChild(nSpan)
        F.G.id('profS').appendChild(temp)
        F.hide(dBox)
    }

    closeDialog(e) {
        e.preventDefault()
        var element = e.target,
            dBoxVar = element["dataset"].dialog,
            dBox = F.G.id(dBoxVar)
        F.hide(dBox)
    }

    handleOpts(e) {

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
                new chat(data)
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
