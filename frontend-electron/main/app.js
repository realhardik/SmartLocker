const { ipcRenderer } = require('electron');
const axios = require('axios');
const io = require("socket.io-client");
const socket = io("http://localhost:3000");
const reader = new FileReader();
const BASE_URL = 'http://localhost:3000';

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        reader.onload = (event) => {
            resolve(event.target.result);
        };

        reader.onerror = (error) => {
            reject(error);
        };
        reader.readAsText(file);
    });
}

F.getToken = async () => {
    var t = await ipcRenderer.invoke('isAuthorized')
    console.log("got token", t)
    return t
}

F.getLocalTime = (d, c) => {
    var utcDate = new Date(d);
    var ret = c === "date" ? utcDate.toLocaleDateString() :
            c === 'time' ? utcDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
            utcDate.toLocaleString()
    return ret
}

socket.on('connect', () => {
    console.log('Connected to the server with ID:', socket.id);
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

ipcRenderer.on('rec-profile', (event, { email, name }) => {
    localStorage.setItem('email', email);
    localStorage.setItem('name', name);
});

class fileSharing {
    constructor() {
        F.BM(this, ["init", "handleUpload", "fetchFiles", "oRender", "shareFile", "renderFile"])
        this.dropArea = F.G.id('dropArea'),
        this.fInput = F.G.id('fileInput')
        this.lTemp = F.G.id('encLayers').content.firstElementChild.cloneNode(true)
        this.cLayers = F.G.id('cLayers')
        this.rLayers = F.G.id('rLayers')
        this.handleLayers = F.debounce(this.handleLayers.bind(this), 200);
        var events = ['dragenter', 'dragover', 'dragleave', 'drop']
        events.forEach(e => {
            F.l(e, this.dropArea, this.handleUpload)
        })
        this.file = null
        F.l('change', F.G.id('nLayers'), (e) => {  this.handleLayers(e, "cLayers") })
        F.l('change', F.G.id('decryptLayerNumber'), (e) => {  this.handleLayers(e, "rLayers") })
        F.l('change', this.fInput, this.handleUpload)
        F.l('click', F.G.id('aFileHist'), this.fetchFiles)
        F.l('click', F.G.id('fileRem'), () => {
            this.fInput.value = ""
            F.G.id('fileUplName').value = ""
            F.hide(F.G.id('aUpl'))
            F.hide(F.G.id('bUpl'), !0)
            F.class([F.G.id('f-eDet'), F.G.id('sButton'), F.G.id('watermark_options')], ['disable'])
        })
        let fileInput = F.G.id('recipientListFile'),
            textInput = F.G.id('recipientListEmails'),
            span = F.G.query('span', F.G.id('recipientsList')),
            cButton = F.G.id('removeRecipientFile'),
            fName = F.G.id('recipientFileName'),
            dBox = F.G.id('fileSharing')
        F.l('input', textInput, F.debounce((e) => {
            if (e.target.value == 0) {
                F.hide(fileInput.parentNode, !0)
                F.hide(span, !0)
                dBox.received = !1
            } else {
                F.hide(fileInput.parentNode)
                F.hide(span)
                dBox.received = e.target
            }
        }, 400))
        F.l('change', fileInput, F.debounce((e) => {
            var files = e.target.files
            if (files.length == 0) {
                fName.innerText = ""
                F.hide(F.G.id('afUpl'))
                F.hide(fileInput.parentNode, !0)
                F.hide(textInput, !0)
                F.hide(span, !0)
                dBox.received = !1
            } else if (files.length == 1 && files[0].type === 'text/plain') {
                F.hide(fileInput.parentNode)
                F.hide(textInput)
                F.hide(span)
                var fileName = files[0].name
                fName.innerText = fileName
                dBox.received = e.target
                F.hide(F.G.id('afUpl'), !0, 'flex')
            } else if (files.length > 1 || !files[0].type === 'text/plain') {
                dBox.received = !1
                alert('Please upload A single (.txt) file.')
            }
        }, 400))
        F.l('click', cButton, () => {
            fileInput.value = ""
            fName.innerText = ""
            dBox.received = !1
            F.hide(F.G.id('afUpl'))
            F.hide(fileInput.parentNode, !0)
            F.hide(textInput, !0)
            F.hide(span, !0)
        })
    }

    init(e, t) {
        let close;
        if (e === 'fileSharing') {
            var tSharing = 'gFSharing' === t.id  ? 'groupShare' : 'singleShare'
            F.G.id(e).classList.add(tSharing)
            var today = new Date(),
                year = today.getFullYear(),
                month = String(today.getMonth() + 1).padStart(2, '0'),
                day = String(today.getDate()).padStart(2, '0'),
                date = `${year}-${month}-${day}`

            F.G.id('expiry_date').setAttribute('min', date);
            close = () => {
                F.G.id('fileInput').value = ""
                F.G.id('fileSharing').className = ''
                F.class([F.G.id('app'), F.G.id('fileSharing')], ["disable"], !0)
                F.class([F.G.id('f-eDet'), F.G.id('sButton'), F.G.id('watermark_options')], ['disable'])
                F.hide(F.G.id('bUpl'), !0)
                F.hide(F.G.id('aUpl'))
                this.cLayers.children.length > 1
                ? Array.from(this.cLayers.children).slice(1).forEach(child => child.remove())
                : true;
            }

            F.G.id('cButton').closeE = close
        } else if (e === 'receivedFiles') {
            console.log(t)
            console.log(this.rLayers)
            this.rLayers.children.length > 1
                ? Array.from(this.rLayers.children).slice(1).forEach(child => child.remove())
                : true;
            F.class([F.G.id('app')], ["disable"])
            F.G.id('receiveFiles').closeE = () => {
                F.class([F.G.id('receivedFiles'), F.G.id('receiveFiles')], ['disable'], !0)
                t && F.hide(F.G.id('receivedFiles'), !0)
                F.class([F.G.id('app')], ["disable"], !0)
                F.G.class('passPh', this.rLayers.children[0])[0].value = ""
            }
        }
        F.G.id(e).closeE = close
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
        F.class([F.G.id('f-eDet'), F.G.id('sButton'), F.G.id('watermark_options')], ['disable'], !0)
    }

    handleLayers(e, t) {
        console.log(e)
        var n = F.Clamp(parseInt(e.target.value, 10), 1, 7),
        p = this[t].children.length;
        if (n === p) return;
        if (n < p) {
            while (this[t].children.length > n) {
                this[t].lastChild.remove();
            }
        } else if (n > p) {
            for (let i = p; i < n; i++) {
                const temp = this.lTemp.cloneNode(true);
                const span = temp.querySelector('.lNo span');
                if (span) {
                    span.innerText = `${i + 1})`;
                }
                this[t].append(temp);
            }
        }
    }

    async upload(data, dBox) {
        try {
            const tokenReq = await F.getToken(),
                  token = tokenReq.token

            var response = await axios.post(`${BASE_URL}/upload`, data, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            response = response.data
            if (!response.success) {
                alert('Error: ' + (response?.msg || "Try again later"));
                F.class([F.G.id('app')], ["disable"], !0)
                return
            } else {
                console.log('emiting')
                console.log({
                    from: tokenReq.user._id,
                    type: "file",
                    otherData: response.file
                })
                socket.emit('sharedFile', {
                    from: tokenReq.user._id,
                    type: "file",
                    otherData: response.file
                })
                alert(response.msg);
            }
            F.class([F.G.id('app')], ["disable"], !0)
        } catch (error) {
            if (error.response) {
                console.error('Error:', error.response.data);
                alert('Error: ' + (error.response.data?.msg || "Try again later"));
            } else {
                console.error('Error:', error);
                alert('An error occurred while uploading the file.');
            }
        } finally {
            dBox.close && dBox.close()
            dBox.closeE && dBox.closeE()
        }
    }

    async shareFile(i, dBox) {
        const formData = new FormData(),
            file = this.file,
            layers = {},
            tokenReq = await F.getToken()
        let rTo, eTo, to, type;
        if (dBox.classList.contains('groupShare')) {
            var isFile = dBox.received.type == 'file',
            fileContent
            rTo =  isFile ? dBox.received.files[0] : dBox.received.value
            fileContent = isFile ? await readFileAsText(rTo) : false
            console.log('file content: ', fileContent)
            var src = isFile ? fileContent : rTo
            type = "grpShare"
            eTo = src.split(',').map(e => e.trim())
        } else {
            var context = F.G.id('tChat')?.con
            type = context.type
            rTo = context.convId
            eTo = rTo.split(',').map(e => e.trim())
        }
        
        for (var l = 0; l<i.nLayers.value; l++) {
            var temp = this.cLayers.children[l]
            layers[l] = {
                type: F.G.class('eType', temp)[0].value.toLowerCase().replace(" ", ""),
                passPhrase: F.G.class('passPh', temp)[0].value
            }
        }
        console.log(eTo)

        try {
            if (type === 'group') {
                const userCheck = await axios.post(`${BASE_URL}/search`, {
                    collection: "group",
                    query: { _id: rTo },
                    method: "findOne"
                }, { headers: { 'Authorization': `Bearer ${tokenReq.token}` } });
                console.log(userCheck)
                if (!userCheck.data.success) {
                    dBox.closeE && dBox.closeE()
                    return (alert("Server error."), false)
                }

                var members = userCheck.data.result.members;

                to = members
                .filter(m => m.user !== tokenReq.user._id)
                .map(m => ({ user: m.user }));
            }
            if (type === 'solo' || type === 'grpShare') {
                var field = 'solo' === type ? '_id' : 'email'
                const userCheck = await axios.post(`${BASE_URL}/search`, {
                    collection: "Users",
                    query: { [field]: { $in: eTo } },
                    method: "find"
                }, { headers: { 'Authorization': `Bearer ${tokenReq.token}` } });

                if (!userCheck.data.success) {
                    dBox.closeE && dBox.closeE()
                    return (alert("Server error."), false)
                }
                    
                if (userCheck.data.success && userCheck.data.result.length !== eTo.length) {
                    dBox.closeE && dBox.closeE()
                    const missingEmails = eTo.filter(email => !userCheck.result.some(u => u.email === email));
                    alert(`Given user(s) ${missingEmails.join(', ')} do not exist.`)
                    return
                }

                to = userCheck.data.result.map(user => ({user: user._id}));
            }
        } catch (err) {
            dBox.close && dBox.close()
            dBox.closeE && dBox.closeE()
            alert("Unexpected error occured. Try again later")
            return
        }

        if (file && file.type === "application/pdf" && file.name.toLowerCase().endsWith(".pdf")) {
            var layerTypes = Object.values(layers).map(item => item.type),
            pass = Object.values(layers).map(item => item.passPhrase)

            formData.append('to', JSON.stringify(to))
            formData.append('fileName', file.name)
            formData.append('layers', JSON.stringify(layers))
            formData.append('file', file)
            formData.append('data', JSON.stringify({
                selected_algos: layerTypes,
                all_passphrases: pass,
                filename: file?.name || file?.originalName
            }));

            if (i.add_watermark.value) {
                formData.append('watermark', true)
                var wCustom = F.G.id('custom_watermark'),
                    wColor = F.G.id('watermark_color'),
                    wSize = F.G.id('watermark_size'),
                    wRows = F.G.id('watermark_rows'),
                    wCol = F.G.id('watermark_columns'),
                    wOpacity = F.G.id('watermark_opacity'),
                    wVal = {}
                wVal.text = wCustom.value.length > 0 ? wCustom.value : 'Default'
                wVal.color = wColor.value
                wVal.rows = wRows.value
                wVal.columns = wCol.value
                wVal.size = wSize.value
                wVal.opacity = wOpacity.value
                console.log('waterma: ', wVal)
                formData.append('watermark_options', JSON.stringify(wVal))
            } else {
                formData.append('watermark', false)
            }
            
            const userInputDateTime = `${i.expiry_date.value}T${i.expiry_time.value}:00`;
            const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const dateInUserTimeZone = new Date(
                new Date(userInputDateTime).toLocaleString("en-US", { timeZone: userTimeZone })
              );
            const dateInUTC = new Date(dateInUserTimeZone.toISOString());
            
            formData.append('expiry', dateInUTC.toISOString())
            if (i.enableMaxViews.value) {
                formData.append('limit_views', true)
                formData.append('max_views', i.max_views.value)
            } else {
                formData.append('limit_views', false)
            }
            this.upload(formData, dBox)
        } else {
            alert("Please upload a PDF file.");
            F.class([F.G.id('app'), dBox], ["disable"], !0)
            dBox.closeE && dBox.closeE()
            return;
        }
        // F.G.id("receivers").value.split(",").map(email => ({ email: email.trim() }))
    }

    async renderFile(i, dBox) {
        let nLayers = i.decryptLayerNumber.value,
            data = {},
            layers = [],
            passPhrases = [];
        
        for (var l = 0; l<nLayers; l++) {
            var temp = this.rLayers.children[l]
            layers[l] = F.G.class('eType', temp)[0].value.toLowerCase().replace(" ", "");
            passPhrases[l] = F.G.class('passPh', temp)[0].value
        }

        var file = F.G.id('receiveFiles')?.fileContext

        data.no_layers = nLayers
        data.layers = layers
        data.passwords = passPhrases
        data.fId = file._id
        console.log('dbox ', dBox)
        console.log('dbox ', dBox.closeE)
        F.hide(dBox)
        F.class([F.G.id('receivedFiles'), F.G.id('receiveFiles')], ['disable'], !0)
        dBox.closeE && dBox.closeE()
        ipcRenderer.invoke('render', data)
    }

    async fetchFiles() {
        F.G.id('receivedFiles').classList.remove('disable')
        F.hide(F.G.id('receivedFiles'), !0)
        this.init('receivedFiles')
        var tokenReq = await F.getToken(),
            sender = F.G.id('tChat').con.convId || "",
            token = tokenReq.token
        try {
            const response = await axios.post(`${BASE_URL}/files`, {
                type: "received",
                query: {
                    from: sender
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (!response.data.success) {
                throw new Error('Network response was not ok');
            }

            var files = response.data.result,
                fileList = F.G.query('tbody', F.G.id('receivedFiles'));
            fileList.innerHTML = '';
            files.forEach(file => {
                var listItem = F.Cr('tr'),
                    recieved_at = file.timestamp,
                    expiry = file.expiry
                var fName = F.Cr('td'),
                    rec_at = F.Cr('td'),
                    exp = F.Cr('td'),
                    status = F.Cr('td')
                fName.innerText = file.fName
                rec_at.innerText = recieved_at
                status.innerText = file.status
                exp.innerText = expiry
                listItem.appendChild(fName)
                listItem.appendChild(rec_at)
                listItem.appendChild(exp)
                listItem.appendChild(status)
                fileList.appendChild(listItem);
                listItem.fCon = {
                    fId: file._id,
                    from: file.from,
                    fName: file.fName,
                    hash: file.fileHash,
                    status: file.status
                }
                F.l('click', listItem, this.oRender)
            })
        } catch (error) {
            console.error('Error fetching files:', error);
        }
    }

    async oRender(e) {
        var t = e.target,
            f = !1,
            tokenReq = await F.getToken()
        console.log(t)
        for (; t;) {
            if ("TR" === t.tagName || t.classList.contains('mHeader')) {
                f = !0;
                break
            }
            if ('TABLE' === t.tagName)
                break
            t = t.parentNode
        }
        if (f && t) {
            var fileContext = t.fCon
            try {
                const chkFile = await axios.post(`${BASE_URL}/files`, {
                    type: "received",
                    query: { _id: fileContext.fId }
                }, { headers: { 'Authorization': `Bearer ${tokenReq.token}` } });
                var res = chkFile.data
                if (res.success && res.result) {
                    var file = res.result[0]
                    if (file.status === 'Expired')
                        return
                    var uFile = file.to.find(entry => entry.user === tokenReq.user._id)
                    if (!uFile) {
                        console.log('Cant find file')
                    }
                    if (file.rView && (uFile.views >= file.maxViews)) {
                        alert('maximum view exceeded')
                        console.log('Max views exceeded.')
                        return
                    }
                    F.G.id('receiveFiles').fileContext = file
                    F.hide(F.G.id('receivedFiles'))
                    F.hide(F.G.id('receiveFiles'), !0)
                    return
                }
            } catch (error) {
                console.error('Error during file check:', error);
            }
        }
    }
}

class gen {
    constructor(data) {
        F.BM(this, ["closeDialog", "openDialog", "handleInputs", "handleNav", "logout"])
        this.fileSharing = new fileSharing
        this.chat = new chat(this.fileSharing)
        this.profileView = F.G.id('viewProfile')
        F.G.class('d').forEach(e => {
            F.l('click', e, this.openDialog)
        })
        F.G.class('c').forEach(e => {
            F.l('click', e, this.closeDialog)
        })
        F.G.class('i').forEach(e => {
            F.l('click', e, this.handleInputs)
        })
        F.l('click', F.G.id('toEditProfile'), (e) => {
            e.preventDefault()
            this.profileView.classList.add('editProfile')
        })
        F.l('click', F.G.id('backView'), (e) => {
            e.preventDefault()
            this.profileView.classList.remove('editProfile')
        })
        F.l('click', F.G.id('updateProfile'), (e) => {
            e.preventDefault()
            this.editProfile()
        })
        F.l('click', F.G.id('nav'), this.handleNav)
        this.setupProfile(data)
    }
    
    async handleNav(e) {
        e.stopPropagation()
        var target = e.target,
            { tab, search, logout } = target.dataset
        if (tab) {
            var s = tab === 'dashboard' ? 'chatSection' : 'dashboard',
                tabButtons = Array.from(F.G.query('[data-tab]', document, "all"))
            // F.G.id(s)["style"].opacity = '0'
            // F.G.id(s)["style"].pointerEvents = 'none'
            F.hide(F.G.id(s))
            F.hide(F.G.id(tab), !0, 'flex')
            // F.G.id(tab).style.opacity = '1'
            // F.G.id(tab).style.pointerEvents = "all"
            target.classList.add('active')
            tabButtons.forEach(e => e !== target && e.classList.remove('active'));
        } else if (logout) {
            this.logout()
        }
    }
    
    setupProfile(user) {
        var name = user.name,
            email = user.email,
            date = new Date(user.created_at),
            uniqueId = user.uniqueId,
            joinedAt = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        var profSection = [{
            value: name,
            fields: F.G.class('pName')
        }, {
            value: email,
            fields: F.G.class('pEmail')
        }, {
            value: joinedAt,
            fields: F.G.class('pJoined')
        }, {
            value: uniqueId,
            fields: F.G.class('pUniqueId')
        }]
        
        for (var i = 0; i<profSection.length; i++) {
            var f = profSection[i].fields,
            value = profSection[i].value || ""
            for (var j = 0; j<f.length; j++) {
                var tag = f[j].tagName,
                    span = 'DIV' === tag ? F.Cr('span') : f[j]
                console.log(span)
                tag === 'INPUT' && (f[j].value = "", span.setAttribute('placeholder', value))
                tag === 'SPAN' && (span.innerText = value)
                tag === 'DIV' && (f[j].innerHTML = "", span.innerText = value, f[j].appendChild(span))
            }
        }
    }

    async openDialog(e) {
        e.preventDefault()
        var dts = e.target["dataset"],
            dBoxId = dts.dialog,
            dBox = F.G.id(dBoxId)
        console.log(e.target)
        dts.c && this[dts.c].init && this[dts.c].init(dBoxId, e.target)
        dBox.classList.remove('disable')
        dBox && F.hide(dBox, !0)
        dBox.close = () => this.closeDialog(F.G.class('c', dBox)[0]);
        F.class([F.G.id('app')], ["disable"])
    }

    closeDialog(e) {
        var element = e.target || e,
            dts = element["dataset"],
            dBoxVar = dts.dialog,
            dBox = F.G.id(dBoxVar),
            ifA = F.G.query('input', dBox, "a")
        Array.from(ifA).forEach(e => {
            e.value = e?.defaultValue || ""
        })
        element.closeE && element.closeE()
        dBox.closeE && dBox.closeE()
        F.hide(dBox)
        F.class([F.G.id('app'), dBox], ["disable"], !0)
    }

    handleInputs(e) {
        e.preventDefault()
        var aBtn = e.target,
            dts = aBtn.dataset,
            dBox = F.G.id(dts.dialog),
            dFun = dts.p.split(";"),
            dInp = JSON.parse(dts.i),
            vBox = dBox.tag === "FORM" ? dBox : (F.G.query('form', dBox) || dBox),
            validity = vBox.checkValidity()

        if (!validity) {
            vBox.reportValidity()
            return
        }
        
        var v2 = this.checkValidity(vBox)
        if (!v2) {
            return
        }

        F.class([dBox], ["disable"])
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

    async editProfile() {
        var tokenReq = await F.getToken(),
            newEmail = F.G.id('newEmail').value.toLowerCase(),
            newName = F.G.id('newName').value
        try {
            var updateRes = await axios.post(`${BASE_URL}/updateProfile`, {
                newName: newName,
                newEmail: newEmail
            }, { headers: { 'Authorization': `Bearer ${tokenReq.token}` } })
            console.log('update', updateRes)
            if (updateRes.data.userUpdate.success) {
                alert('Saved Changes Successfully.')
                if (updateRes.data.update.hasOwnProperty('email')) {
                    alert('Since you changed email, you need to login again.')
                    ipcRenderer.invoke('logout')
                    return
                }
                console.log(updateRes.data.userUpdate.result)
                this.setupProfile(updateRes.data.userUpdate.result)
                return
            }
            alert(updateRes.data.msg)
        } catch (err) {
            console.log('err', err)
            alert(err.msg)
        }
    }

    checkValidity(f) {
        let inFields = Array.from(F.G.query('input', f, "all")),
            today = new Date(),
            year = today.getFullYear(),
            month = String(today.getMonth() + 1).padStart(2, '0'),
            day = String(today.getDate()).padStart(2, '0'),
            date = `${year}-${month}-${day}`,
            sDate = (F.G.query('input[type="date"]', f)?.value || !1);

        for (var i = 0; i<inFields.length; i++) {
            var type = inFields[i].type
            if (type === "date") {
                if (inFields[i].value < date) {
                    alert('Please enter a future date.')
                    return false
                }
            } else if (type === "time" && sDate === date) {
                var hours = String(today.getHours() + 1).padStart(2, '0'),
                    minutes = String(today.getMinutes()).padStart(2, '0'),
                    minTime = `${hours}:${minutes}`
                if (inFields[i].value < minTime) {
                    alert("Access duration must be at least 1 hour.")
                    return false
                }
            }
        }
        return true
    }

    async logout() {
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
    constructor(file) {
        this.profS = F.G.id("profS"),
        this.aProfChat = F.G.id("sChat"),
        this.profTemp = F.G.id("profile").content.firstElementChild.cloneNode(true),
        this.pmsgTemp = F.G.id("pUser").content.firstElementChild.cloneNode(true),
        this.smsgTemp = F.G.id("sUser").content.firstElementChild.cloneNode(true),
        this.grpTemp = F.G.id("grpMemListProf").content.firstElementChild.cloneNode(true)
        this.load = F.G.id('loadChat')
        this.chatS = F.G.id('chat')
        this.grpList = F.G.id('grpMemList')
        this.activeProfile = F.G.id('tChat')
        this.chatUsers = new Map()
        this.fileSharingIns = file
        F.BM(this, ["addChat", "openChat", "addNewUser", "addNewGroup", "sendMessage", "createChat", "fetchMessages"])
        F.BM(this, ['init', 'leaveGroup', 'newMessageLog'])
        this.profS = F.G.id('profS')
        F.l('click', this.profS, this.openChat)
        F.l('click', F.G.id('sText'), this.sendMessage)
        F.l('click', F.G.id('deleteGroup'), this.leaveGroup)
        F.l('click', F.G.id('leaveGroup'), this.leaveGroup)
        socket.on('newMessage', async (rMessage) => {
            this.newMessageLog(rMessage, 'newMessage')
        });
        socket.on('sentMessage', async (rMessage) => {
            console.log('sent message')
            this.newMessageLog(rMessage)
        });
        socket.on('addedNewChat', (user) => {
            this.createChat({
                name: user.recipientName,
                id: user.receiver,
                type: 'solo'
            })
        })
        socket.on('addedNewGroup', (group) => {
            this.createChat({
                name: group.name,
                id: group._id,
                role: group.role,
                type: 'group'
            })
        })
        socket.on('deletedGroup', (group) => {
            var users = Array.from(this.profS.children)
            for (var u = 0; u<users.length; u++) {
                console.log(users[u])
                console.log(users[u].con)
                if(users[u]?.con?.convId === group) {
                    users[u].remove()
                    F.G.id('sChat').innerHTML = ""
                    F.G.id('textMessage').value = ""
                    F.hide(F.G.id('chat'))
                    break
                }
            }
        })
        socket.on('leavedGroup', (group) => {
            var users = Array.from(this.profS.children)
            for (var u = 0; u<users.length; u++) {
                console.log(users[u])
                console.log(users[u].con)
                if(users[u]?.con?.convId === group) {
                    users[u].remove()
                    F.G.id('sChat').innerHTML = ""
                    F.G.id('textMessage').value = ""
                    F.hide(F.G.id('chat'))
                    break
                }
            }
        })
        socket.on('NoNewUser', (msg) => {
            alert(msg)
        })
        
        this.addChat()
    }
    
    init(v) {
        if ("addGroup" === v) {
            this.grpList.innerHTML = ""
            var iList = [...this.chatUsers.values()].filter(value => value.type === "solo")
            iList.forEach(u => {
                var grpLTemp = this.grpTemp.cloneNode(true),
                    tCheckBox = F.G.query('input', grpLTemp),
                    tSpan = F.Cr('span')
                tSpan.innerText = u.name
                tCheckBox.setAttribute('value', u.convId)
                grpLTemp.insertBefore(tSpan, tCheckBox)
                this.grpList.append(grpLTemp)
            })
        }
    }

    leaveGroup(e) {
        e.stopPropagation()
        var op = e.target.id,
            context = F.G.id('tChat')?.con
        socket.emit(op, {
            name: context.userName,
            id: context.convId,
            userId: this.userData.user._id,
            role: context.userRole,
            type: context.type
        })
    }
    
    async addChat() {
        this.userData = await F.getToken()
        this.token = this.userData.token
        try {
            var uReq = await axios.get(`${BASE_URL}/chat`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            })
            console.log("user req raw: ", uReq)
        var uList = this.getInteractedUsersArray(uReq.data.result, this.userData.user._id)
            if (uList.length === 0)
                return (console.log("no chats found"), false)

            uList.forEach(user => {
                this.createChat(user)
            })
        } catch (err) {
            console.error("error fetching chats: ", err)
            alert("Couldn't fetch chats at the moment.")
            return
        }
    }

    createChat(data) {
        var temp = this.profTemp.cloneNode(true),
            nSpan = F.Cr('span'),
            n2Span = F.Cr('span'),
            nCon = F.G.class('profName', temp)[0],
            unCon = F.G.class('unreadCount', temp)[0],
            profPic = F.G.query('img', temp),
            type = data.type
            nSpan.innerHTML = data.name
            n2Span.innerHTML = data.unreadCount
        nCon.appendChild(nSpan)
        unCon.appendChild(n2Span)
        console.log(profPic)
        data.unreadCount > 0 ? temp.classList.add('unreadMsg') : false
        F.G.id('profS').appendChild(temp)
        "solo" === type && (temp.con = {
            userName: data.name,
            convId: data.id,
            type: 'solo'
        }, profPic.src = '../static/profiles/profile1.jpg')
        "group" === type && (temp.con = {
            userName: data.name,
            convId: data.id,
            userRole: data.role,
            type: 'group'
        }, profPic.src = '../static/profiles/profile2.jpg')
        this.chatUsers.set(data.id, {
            convId: data.id,
            name: data.name,
            type: data.type,
            el: temp
        })
    }

    async addNewGroup(i, dBox) {
        var grpName = i["groupName"].value,
            grpMembers = F.G.query('input[type="checkbox"]:checked', this.grpList, "a")
        grpMembers = Array.from(grpMembers).map(checkbox => checkbox.value);
        console.log("grp: ", grpName)
        console.log("grp: ", grpMembers)
        socket.emit('addNewGroup', {
            grpName: grpName,
            grpMembers: grpMembers,
            createdBy: this.userData.user._id
        })
        dBox && dBox.close()
    }

    async addNewUser(i, dBox) {
        const userId = i.userId.value,
            res = await axios.post(`${BASE_URL}/search`, {
                collection: 'Users',
                query: { uniqueId: userId },
                method: 'findOne'
              }, {
                headers: {
                  'Authorization': `Bearer ${this.token}`,
                  'Content-Type': 'application/json'
                }
            }),
            user = res.data
            
        if (!user.success) {
            alert("User not found.")
            dBox.close && dBox.close()
            return false
        }
        if(user.result._id === this.userData.user._id) {
            dBox.close && dBox.close()
            return (alert('You cannot add yourself.'), false)
        }
        if (this.chatUsers.has(user.result._id)) {
            dBox.close && dBox.close()
            return (alert('User already exists in chat.'), false)
        }
            
        socket.emit('addNewChat', {
            senderId: this.userData.user._id,
            recipientId: user.result._id,
            recipientName: user.result.name
        });

        dBox.close && dBox.close()
    }
    
    openChat(e) {
        e.stopPropagation()
        var c = e.target,
            t = 'DIV' === c.tagName;
        this.activeProfile.open = !0
        if (!t || !c.classList.contains('profile'))
            return
        F.hide(this.chatS)
        F.hide(this.load, !0, 'flex')
        c.classList.contains('unreadMsg') && socket.emit('markRead', ({
            senderId: c.con.convId,
            receiverId: this.userData.user._id
        }))
        c.classList.remove('unreadMsg')
        !this.activeProfile.previous && F.hide(F.G.id('loadPoster'))
        this.activeProfile.previous && this.activeProfile.previous.classList.remove('active')
        c.classList.add('active')
        this.activeProfile.previous = c
        F.hide(F.G.id('deleteGroup'))
        F.hide(F.G.id('leaveGroup'))
        var profPic = F.G.class('profPic', c)[0],
            profName = F.G.class('profName', c)[0]
        if (!profPic || !profName) return;
        var { userName } = c.con,
            tPic = F.G.query('img', F.G.id('aProfPic')),
            tName = F.G.query('span', F.G.id('aProfName'))
        this.activeProfile.con = c.con
        tName.innerText = userName
        if (c.con.type === "group") {
            var role = c.con.userRole
            if (role === "admin") {
                F.hide(F.G.id('deleteGroup'), !0)
            } else {
                F.hide(F.G.id('leaveGroup'), !0)
            }
        }
        this.fetchMessages(this.activeProfile.con)
    }

    async fetchMessages(data) {
        var tokenReq = await F.getToken(),
            history = await axios.get(`${BASE_URL}/chatLog/${data.convId}`, {
                params: {
                    type: data.type
                },
                headers: {
                    'Authorization': `Bearer ${tokenReq.token}`
                }
            })
        if (!history.data.success) {
            alert("Couldn't fech chats at the moment. Try again Later.")
            return
        }
        console.log(history.data.result)
        var response = history.data.result,
            chats = response.map(e => {
                var from = data.type === 'group' ? e.from._id : e.from
                if (from !== tokenReq.user._id) { data = {context: "received", type: e.type, content: e.content, name: e.from?.name || "solo"} }
                if (from === tokenReq.user._id) { data = {context: "sent", type: e.type, content: e.content} }
                if (e.type === 'file') { data.file = e?.otherData }
                return data
            })
        F.G.id('sChat').innerHTML = ""
        this.renderMessages({ type: data.type, chats: chats, new: !0 })
    }

    renderMessages(data) {
        let cSection = F.G.id('sChat'),
            lastM = !1,
            type = data.type,
            chats = data.chats
            console.log(chats)
            chats.forEach(c => {
                var tempName = c.context === 'sent' ? "pmsgTemp" : "smsgTemp",
                    template = this[tempName].cloneNode(true),
                    message = F.G.class('mContent', template)[0],
                    time = F.G.class('cTime', template)[0],
                    mHeader = F.G.class('mHeader', template)[0]
                if (type === "group") {
                    var tField = F.G.class('cContent', template)[0]
                    tField.classList.add('g')
                    if (c.context === 'received')
                        F.G.class('grpName', template)[0].textContent = c.name
                }
                if (c.type.toLowerCase() === 'file') {
                    var tField = F.G.class('cContent', template)[0]
                    tField.classList.add('file')
                    var tSpan = F.Cr('span')
                    tSpan.classList.add('filename')
                    tSpan.textContent = c.file.fName || "Couldn't load file."
                    mHeader.appendChild(tSpan)
                    mHeader.fCon = {
                        fId: c.file._id,
                        from: c.file.from,
                        fName: c.file.fName,
                        expriy: F.getLocalTime(c.file.expiry),
                        status: c.file.status
                    }
                }
                message.textContent = c.content || ""
                time.textContent = c?.time || "12:24"
                !lastM && cSection.appendChild(template)
                lastM && cSection.insertBefore(template, lastM)
                c?.type === 'file' && c.context === 'received' && F.l('click', template, (e) => {this.fileSharingIns.init('receivedFiles'); this.fileSharingIns.oRender(e) })
                lastM = template
            })
        if (data?.new) {
            F.hide(F.G.id('chat'), !0, "flex")
            F.hide(this.load)
        }
    }
    
    newMessageLog(newChat, type) {
        let refChat;
        let cInput = F.G.id('textMessage');
        let count;
        console.log('new message', newChat)
        newChat.from === this.userData.user._id && (refChat = { context: "sent", type: newChat.type, content: newChat.content }) && (cInput.value = "")
        newChat.to === this.userData.user._id && (refChat = { context: "received", type: newChat.type, content: newChat.content })
        newChat.type === 'file' && (refChat.file = newChat.otherData)
        if (type === "newMessage" && this.chatUsers.has(newChat.from)) {
            var context = this.chatUsers.get(newChat.from),
            element = context.el
            console.log('open: ', context.el)
            console.log("open: ", this.activeProfile.previous)
            if (this.activeProfile.previous == context.el) {
                this.renderMessages({
                    type: newChat.type,
                    chats: [refChat]
                })
                socket.emit('markRead', {
                    senderId: context.convId,
                    receiverId: this.userData.user._id
                })
            } else {
                element.classList.contains('unreadMsg') ? (
                    count = parseInt(F.G.query('span', F.G.class('unreadCount', element)[0])?.innerText) || 1
                ) : (count = 0)                
                count++
                F.G.query('span', F.G.class('unreadCount', element)[0]).innerText = count
                element.classList.add('unreadMsg')
            }
        } else {
            this.renderMessages({
                type: newChat.type,
                chats: [refChat]
            })
        }
    }

    sendMessage(e) {
        var message = F.G.id('textMessage').value
        var activeProfile = this.activeProfile?.con
        if (!activeProfile)
            return (alert("Unexpected error occured while connecting to the server.\nPlease log in again."))
        socket.emit('sendMessage', {
            senderId: this.userData.user._id,
            convId: activeProfile.convId,
            message: message,
            cType: activeProfile.type
        });
    }

    getInteractedUsersArray(result) {
        let user;
        let modifiedChats = result
            .map(item => {
                if ('group' === item.type) {
                    user = item.group.members.find(member => member.user === item.sender)
                    return { id: item.group._id, 
                        name: item.group.name, 
                        role: user.role, 
                        lastMessage: item.lastMessage.timestamp, 
                        type: item.type,
                        unreadCount: item.unreadCount
                    }
                }
                return { id: item.receiver._id, 
                    name: item.receiver.name, 
                    lastMessage: item.lastMessage.timestamp, 
                    type: 'solo',
                    unreadCount: item.unreadCount
                };
            })
            .filter(name => name);
        modifiedChats.sort((a, b) => new Date(b.lastMessage) - new Date(a.lastMessage));
        return modifiedChats
    }
}

class dashboard {
    constructor() {
        F.BM(this, ['fetchFiles', 'renderFiles', 'switchTabs', 'handleLoadMore'])
        this.fileSR = F.G.query('span', F.G.id('filesSR'), !0)[1]
        this.fileRR = F.G.query('span', F.G.id('filesRR'), !0)[1]
        this.fileES = F.G.query('span', F.G.id('filesES'), !0)[1]
        this.table = F.G.query('table', F.G.id('tFileL'))
        this.tablebody = F.G.query('tbody', F.G.id('tFileL'))
        this.varCol = F.G.query('th:nth-child(2)', F.G.id('tFileL'))
        this.prevTab = F.G.query('div:first-child', F.G.id('tSwitch'))
        this.prevTab.con = 'shared';
        this.loadMore = F.G.id('loadMoreFiles')
        this.observer = new IntersectionObserver(this.handleLoadMore, {
            root: null, 
            threshold: 0.5
        });
        F.G.query('div:last-child', F.G.id('tSwitch')).con = 'received'
        this.currentRequestSource = null;
        this.currentTab = 'shared'
        F.l('click', F.G.id('tSwitch'), this.switchTabs)
        this.fetchFiles()
    }

    switchTabs(e) {
        var target = e.target
        if (target.tagName !== 'DIV' || !target?.con)
            return
        this.prevTab && this.prevTab.classList.remove('switch')
        target.classList.add('switch')
        this.prevTab = target
        this.varCol.innerText = target.con === 'received' ? 'From' : ' Receivers'
        this.currentTab = target.con
        this.fetchFiles(target.con)
    }

    async fetchFiles(e) {
        F.hide(F.G.id('loadFiles'), !0)
        F.hide(this.table)
        var tokenReq = await F.getToken()
        this.token = tokenReq.token
        this.user = tokenReq.user
        let result;

        if (this.currentRequestSource) {
            this.currentRequestSource.cancel('Operation canceled due to a new request.');
        }
        this.currentRequestSource = axios.CancelToken.source();
    
        try {
            if (e) {
                var filesReq = await axios.post(`${BASE_URL}/files`, {
                    type: e
                }, { headers: { 'Authorization': `Bearer ${tokenReq.token}` } })
                result = filesReq.data?.result
            } else {
                var filesReq = await axios.post(`${BASE_URL}/files`, {
                    type: "received"
                }, { headers: { 'Authorization': `Bearer ${tokenReq.token}` } }),
                    allReceivedFiles = filesReq.data?.result,
                    filesReq2 = await axios.post(`${BASE_URL}/files`, {
                        type: "shared"
                    }, { headers: { 'Authorization': `Bearer ${tokenReq.token}` } })
                result = filesReq2.data?.result
                this.getNumbers(filesReq2.data?.result, filesReq.data?.result)
            }
            this.tablebody.innerHTML = ""
            this.data = result
            console.log(result)
            this.renderFiles(e || 'shared')
        } catch (err) {
            if (axios.isCancel(err)) {
                console.log('Request canceled:', err.message);
            } else {
                console.error('Error:', err);
            }
        }
    }

    async getNumbers(shared, received) {
        var sRecCnt = this.fileSR.count || 0,
            RRecCnt = this.fileRR.count || 0,
            EXsnCnt = this.fileES.count || 0,
            today = new Date(),
            sevenDaysAgo = new Date(),
            fiveDaysFromNow = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
        console.log(received)
        const filteredShared = shared.filter(doc => {
            var docDate = new Date(doc.timestamp);
            return docDate >= sevenDaysAgo;
        });
        const filteredReceived = received.filter(doc => {
            var docDate = new Date(doc.timestamp);
            return docDate >= sevenDaysAgo;
        });
        const expiringSoon = received.filter(doc => {
            if (doc.status !== 'Expired') {
                const expiryDate = new Date(doc.expiry);
                return expiryDate >= today && expiryDate <= fiveDaysFromNow;
            }
        });
        
        this.fileSR.count = filteredShared.length
        this.fileRR.count = filteredReceived.length
        this.fileES.count = expiringSoon.length

        this.animateNumber(this.fileSR, sRecCnt, this.fileSR.count, 200)
        this.animateNumber(this.fileRR, RRecCnt, this.fileRR.count, 200)
        this.animateNumber(this.fileES, EXsnCnt, this.fileES.count, 200)
    }

    animateNumber(element, start, end, delay) {
        let currentNumber = start;
        const increment = start < end ? 1 : -1;
        const interval = setInterval(() => {
          element.textContent = currentNumber;
          if (currentNumber === end) {
            clearInterval(interval);
          } else {
            currentNumber += increment;
          }
        }, delay);
    }

    renderFiles(e, num) {
        var start = this.tablebody.children.length || 0,
            rest =  Math.min(num || start + 15, this.data.length);
        let rows = '';
        for (var f = start; f<rest; f++) {
            var file = this.data[f]
            if (!file) break;
            var varColT = e === 'received' ? file.from.email : (file.to.map(u => u.user.email).join(',<br>'))
            rows += `
                <tr>
                <td>${f + 1}</td>
                <td>${varColT}</td>
                <td>${file.fName}</td>
                <td>${F.getLocalTime(file.timestamp, 'date')}</td>
                <td>${F.getLocalTime(file.expiry, 'date')}, ${F.getLocalTime(file.expiry, 'time')}</td>
                <td>--</td>
                </tr>
            `;
        }
        if (this.currentTab === e) {
            this.tablebody.innerHTML += rows
            if (this.data.length > rest) {
                F.hide(this.loadMore, !0, 'flex')
                this.observer.observe(this.loadMore)
            } else {
                F.hide(this.loadMore)
                this.observer.unobserve(this.loadMore)
            }
            F.hide(F.G.id('loadFiles'))
            F.hide(this.table, !0, 'table')
        }
    }

    handleLoadMore(entries, observer) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                this.renderFiles(this.currentTab)
            }
        });
    };
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
            socket.emit('joinRoom', isAuthorized.user._id);
            new gen(isAuthorized.user)
            new dashboard
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
