const { ipcRenderer } = require('electron');
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

F.getToken = async () => {
    var t = await ipcRenderer.invoke('isAuthorized')
    return t
}

ipcRenderer.on('rec-profile', (event, { email, name }) => {
    localStorage.setItem('email', email);
    localStorage.setItem('name', name);
    console.log('saved')
});


class fileSharing {
    constructor() {
        // this.uploadSec = F.G.id('upload-section');
        // this.uploadBtn = F.G.id("upload-btn")
        // this.receiveBtn = F.G.id("receive-btn")
        F.BM(this, ["upload", "receive", "oRender", "handleUpload", "shareFile"])
        this.dropArea = F.G.id('dropArea'),
        this.fInput = F.G.id('fileInput')
        // F.l("click", this.uploadBtn, this.upload)
        // F.l("click", this.receiveBtn, this.receive)
        // F.l("click", F.G.id("logout-btn"), this.logout)
        var events = ['dragenter', 'dragover', 'dragleave', 'drop']
        events.forEach(e => {
            F.l(e, this.dropArea, this.handleUpload)
        })
        F.l('change', this.fInput, this.handleUpload)
    }

    handleUpload(e) {
        e.preventDefault()
        e.stopPropagation()
        if (e.type !== 'drop' && e.type !== 'change')
            return
        const files = e.type === 'drop' ? e.dataTransfer.files : e.target.files;

        if (files.length > 1) {
            console.log('Upload a single file.');
            return;
        }

        const file = files[0];
        if (file.type !== 'application/pdf') {
            console.log('Please upload a PDF file.');
            return;
        }

        var bUpl = F.G.id('bUpl'),
            aUpl = F.G.id('aUpl'),
            fName = file.name,
            fNameIF = F.G.id('fileUplName')
        fNameIF.innerHTML = fName
        F.hide(bUpl)

    }

    async upload() {
        try {
            var token = await F.getToken(),
                response = await axios.post(`${BASE_URL}/upload`, formData, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
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

    async shareFile(e) {
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
}

class gen {
    constructor(data) {
        F.BM(this, ["closeDialog", "openDialog", "handleInputs", "logout"])
        this.chat = new chat
        this.fileSharing = new fileSharing
        F.G.class('d').forEach(e => {
            F.l('click', e, this.openDialog)
        })
        F.G.class('c').forEach(e => {
            F.l('click', e, this.closeDialog)
        })
        F.G.class('i').forEach(e => {
            F.l('click', e, this.handleInputs)
        })
    }

    async openDialog(e) {
        console.log("open dialog", e)
        e.preventDefault()
        var dBoxId = e.target["dataset"].dbox,
            dBox = F.G.id(dBoxId)
        dBox && F.hide(dBox, !0)
    }

    closeDialog(e) {
        e.preventDefault()
        var element = e.target,
            dBoxVar = element["dataset"].dialog,
            dBox = F.G.id(dBoxVar)
        F.hide(dBox)
    }

    handleInputs(e) {
        e.preventDefault()
        var aBtn = e.target,
            dts = aBtn.dataset,
            dBox = dts.dialog,
            dFun = dts.p.split(";"),
            dInp = JSON.parse(dts.i)
        let inputs = {}
        if (!F.Is.arr(dInp))
            return
        dInp.forEach(i => {
            var iField = F.G.id(i),
                dName = iField["dataset"].name
            inputs[dName] = {
                value: iField.value,
                field: iField
            }
        })
        inputs.clear = () => this.clear(inputs)
        this[dFun[1]][dFun[0]](inputs, dBox)
    }

    async logout(e) {
        F.G.id('file-list').innerHTML = ""
        F.G.id("receivers").value = ""
        F.G.id("file-upload").value = ""
        ipcRenderer.invoke('logout');
    }

    clear(i) {
        var entries = Object.entries(i)
                        .filter(([key, value]) => F.Is.obj(value) &&  typeof value !== 'function')
                        .map(([key, value]) => value);
        for (var k=0; k<entries.length; k++) {
            entries[k].field.value = ""
        }
    }
}

class chat {
    constructor() {
        this.profS = F.G.id("profS"),
        this.aProfChat = F.G.id("sChat"),
        this.profTemp = F.G.id("profile").content.firstElementChild.cloneNode(true),
        this.msgTemp = F.G.id("message").content.firstElementChild.cloneNode(true)
        F.BM(this, ["addChat", "openChat", "fetchMessages"])
        F.l('click', F.G.id("oOpt"), this.handleOpts)
        this.profS = F.G.id('profS')
        F.l('click', this.profS, this.openChat)
    }

    async addChat(i, d) {
        var uEmail = i.userEmail.value,
            token = await F.getToken(),
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

        if (!user.success) {
            console.log('not found')
            alert("User not found.")
            return
        }
        
        user = user.result
        var temp = this.profTemp.cloneNode(true),
            nSpan = F.Cr('span')
            console.log(temp)
        var nCon = F.G.class('profName', temp)[0]
        
        nSpan.innerHTML = user.name
        nCon.appendChild(nSpan)
        i.clear()
        F.G.id('profS').appendChild(temp)
        temp.con = {
            userName: user.name,
            userEmail: user.email
        }
        F.hide(dBox)
    }

    openChat(e) {
        e.stopPropagation()
        var c = e.target,
            t = 'DIV' === c.tagName;
        if (!t)
            return
        var profPic = F.G.class('profPic', c)[0],
            profName = F.G.class('profName', c)[0]
        if (!profPic || !profName) return;
        var { userName } = c.con,
            tProf = F.G.id('tChat'),
            tPic = F.G.query('img', F.G.id('aProfPic')),
            tName = F.G.query('span', F.G.id('aProfName'))
        F.hide(F.G.id('sChat'))
        tProf.con = c.con
        tName.innerText = userName
        this.fetchMessages(tProf.con)
    }

    fetchMessages(c) {
        F.hide(F.G.id('sChat'), !0, 'flex')
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
            ipcRenderer.send('profile');
            new gen
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
