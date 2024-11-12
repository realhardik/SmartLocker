const { ipcRenderer } = require('electron');
const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';

F.getToken = async () => {
    var t = await ipcRenderer.invoke('isAuthorized')
    return t
}

ipcRenderer.on('rec-profile', (event, { email, name }) => {
    localStorage.setItem('email', email);
    localStorage.setItem('name', name);
});


class fileSharing {
    constructor() {
        // this.uploadSec = F.G.id('upload-section');
        // this.uploadBtn = F.G.id("upload-btn")
        // this.receiveBtn = F.G.id("receive-btn")
        F.BM(this, ["init", "handleUpload", "receive", "oRender", "shareFile"])
        this.dropArea = F.G.id('dropArea'),
        this.fInput = F.G.id('fileInput')
        this.lTemp = F.G.id('encLayers').content.firstElementChild.cloneNode(true)
        this.cLayers = F.G.id('cLayers')
        this.handleLayers = F.debounce(this.handleLayers.bind(this), 200);
        var events = ['dragenter', 'dragover', 'dragleave', 'drop']
        events.forEach(e => {
            F.l(e, this.dropArea, this.handleUpload)
        })
        this.file = null
        F.l('change', F.G.id('nLayers'), this.handleLayers)
        F.l('change', this.fInput, this.handleUpload)
        F.l('click', F.G.id('fileRem'), () => {
            this.fInput.value = ""
            F.G.id('fileUplName').value = ""
            F.hide(F.G.id('aUpl'))
            F.hide(F.G.id('bUpl'), !0)
            F.class([F.G.id('f-eDet'), F.G.id('sButton')], ['disable'])
        })
    }

    init() {
        var close = () => {
            console.log('ran')
            F.G.id('fileInput').value = ""
            F.hide(bUpl, !0)
            F.hide(aUpl)
            this.cLayers.children.length > 1 
            ? Array.from(this.cLayers.children).slice(1).forEach(child => child.remove())
            : true;

        }
        F.G.id('cButton').closeE = close
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

        this.file = files[0];
        if (this.file.type !== 'application/pdf') {
            console.log('Please upload a PDF file.');
            return;
        }

        var bUpl = F.G.id('bUpl'),
            aUpl = F.G.id('aUpl'),
            fName = this.file.name,
            fNameIF = F.G.id('fileUplName')
        fNameIF.innerHTML = fName
        F.hide(bUpl)
        F.hide(aUpl, !0, 'flex')
        F.class([F.G.id('f-eDet'), F.G.id('sButton')], ['disable'], !0)
    }

    handleLayers(e) {
        var t = parseInt(e.target.value, 10),
        p = this.cLayers.children.length;
        if (t === p) return;
        if (t < p) {
            while (this.cLayers.children.length > t) {
                this.cLayers.lastChild.remove();
            }
        } else if (t > p) {
            for (let i = p; i < t; i++) {
                const temp = this.lTemp.cloneNode(true);
                const span = temp.querySelector('.lNo span');
                if (span) {
                    span.innerText = `${i + 1})`;
                }
                this.cLayers.append(temp);
            }
        }
    }

    async upload(data, dBox) {
        try {
            const formData = new FormData(),
                  token = F.getToken(),
                  rLayers = JSON.parse(data.get('layers')),
                  layers = Object.values(rLayers).map(item => item.type),
                  pass = Object.values(rLayers).map(item => item.passPhrase)
            console.log
            formData.append('file', this.file)
            formData.append('data', JSON.stringify({
                layers: layers.length,
                selected_algos: layers,
                all_passphrases: pass,
                filename: this.file?.name || this.file?.originalName
            }));
            console.log(formData.get('data'))
            var response = await axios.post('http://localhost:3000/encrypt', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            console.log(response)
            
            // var token = await F.getToken(),
            //     response = await axios.post(`${BASE_URL}/upload`, formData, {
            //         headers: {
            //             'Authorization': `Bearer ${token}`
            //         }
            //     });

            // var response2 = await response.json();
            // console.log(response2)
            // if (response.ok) {
            //     alert(response2.msg);
            //     dBox.close && dBox.close()
            //     dBox.closeE && dBox.closeE()
            // } else {
            //     alert('Error: ' + response2.msg);
            // }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while uploading the file.');
        }
    }

    async shareFile(i, dBox) {
        const formData = new FormData();
        var from = localStorage.email,
            to = F.G.id('tChat')?.con?.email || "xyz@gmail.com",
            file = this.file,
            layers = {}
        for (var l = 0; l<i.nLayers.value; l++) {
            var temp = this.cLayers.children[l]
            layers[l] = {
                type: F.G.class('eType', temp)[0].value.toLowerCase().replace(" ", ""),
                passPhrase: F.G.class('passPh', temp)[0].value
            }
        }
        if (file && file.type === "application/pdf" && file.name.toLowerCase().endsWith(".pdf")) {
            formData.append('from', from);
            formData.append('to', JSON.stringify(to));
            formData.append('file', file);
            formData.append('layers', JSON.stringify(layers))
            formData.append('expiry_date', i.expiry_date.value)
            formData.append('expiry_time', i.expiry_time.value)
            formData.get
            console.log(i)
            if (i.enableMaxViews.value) {
                formData.append('limit_views', true)
                formData.append('max_views', i.max_views.value)
            } else {
                formData.append('limit_views', false)
            }
            console.log('formdaat: ', formData.get('layers'))
            this.upload(formData, dBox)
        } else {
            alert("Please upload a PDF file.");
            F.G.id("cButton").close()
            return;
        }
        // F.G.id("receivers").value.split(",").map(email => ({ email: email.trim() }))
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
        e.preventDefault()
        var dts = e.target["dataset"],
            dBoxId = dts.dbox,
            dBox = F.G.id(dBoxId)
        dts.c && this[dts.c].init && this[dts.c].init()
        dBox && F.hide(dBox, !0)
        dBox.close = () => this.closeDialog(F.G.class('c', dBox)[0]);
        F.class([F.G.id('app')], ["disable"])
    }

    closeDialog(e) {
        var element = e.target || e,
            dts = element["dataset"],
            dBoxVar = dts.dialog,
            dBox = F.G.id(dBoxVar)
        console.log("dataset closed: ", dts)
        console.log('i' in dts)
        if ('i' in dts) {
            var ifA = JSON.parse(dts.i)
            console.log(ifA)
            ifA.forEach(e => {
                F.G.id(e).value = ""
            })
        }
        console.log("closing element: ", element)
        console.log("closing element: ", element.close)
        element.closeE && element.closeE()
        F.hide(dBox)
        F.class([F.G.id('app')], ["disable"], !0)
    }

    handleInputs(e) {
        e.preventDefault()
        var aBtn = e.target,
            dts = aBtn.dataset,
            dBox = F.G.id(dts.dialog),
            dFun = dts.p.split(";"),
            dInp = JSON.parse(dts.i)
        let inputs = {}
        if (!F.Is.arr(dInp))
            return
        dInp.forEach(i => {
            var iField = F.G.id(i),
                dName = iField["dataset"]?.name || i
            inputs[dName] = {
                value: iField.type === 'checkbox' ? iField.checked : iField.value,
                field: iField
            }
        })
        inputs.clear = (a) => { a ? this.clear(a) : this.clear(inputs) }
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

    async addChat(i, dBox) {
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
            user = res.data

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
        dBox.close && dBox.close()
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
