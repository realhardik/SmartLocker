const { ipcRenderer } = require('electron');
const axios = require('axios');
const io = require("socket.io-client");
const socket = io("http://localhost:3000");

const BASE_URL = 'http://localhost:3000';

F.getToken = async () => {
    var t = await ipcRenderer.invoke('isAuthorized')
    console.log("got token", t)
    return t
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
        var today = new Date(),
            year = today.getFullYear(),
            month = String(today.getMonth() + 1).padStart(2, '0'),
            day = String(today.getDate()).padStart(2, '0'),
            date = `${year}-${month}-${day}`

        F.G.id('expiry_date').setAttribute('min', date);
        var close = () => {
            F.G.id('fileInput').value = ""
            F.class([F.G.id('app'), F.G.id('fileSharing')], ["disable"], !0)
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
                  tokenReq = await F.getToken(),
                  token = tokenReq.token,
                  rLayers = data.layers,
                  layers = Object.values(rLayers).map(item => item.type),
                  pass = Object.values(rLayers).map(item => item.passPhrase)

            formData.append('file', this.file)
            formData.append('data', JSON.stringify({
                layers: layers.length,
                selected_algos: layers,
                all_passphrases: pass,
                filename: this.file?.name || this.file?.originalName
            }));

            var response = await axios.post(`${BASE_URL}/encrypt`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (!response.data.success) {
                alert("Error: ", response.data.message)
                F.class([F.G.id('app')], ["disable"], !0)
                return
            }

            data['filePath'] =  response.data.encryptedFilePath
            var response2 = await axios.post(`${BASE_URL}/upload`, data, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

            data = response2.data
            if (!data.success) {
                alert('Error: ' + (data?.msg || "Try again later"));
                F.class([F.G.id('app')], ["disable"], !0)
                return
            } else {
                alert(data.msg);
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
        const formData = {},
            rTo = F.G.id('tChat')?.con?.convId || "xyz@gmail.com",
            eTo = rTo.split(',').map(e => e.trim()),
            file = this.file,
            layers = {},
            tokenReq = await F.getToken()
        let to;
        
        for (var l = 0; l<i.nLayers.value; l++) {
            var temp = this.cLayers.children[l]
            layers[l] = {
                type: F.G.class('eType', temp)[0].value.toLowerCase().replace(" ", ""),
                passPhrase: F.G.class('passPh', temp)[0].value
            }
        }

        try {
            const userCheck = await axios.post(`${BASE_URL}/search`, {
                collection: "Users",
                query: { _id: { $in: eTo } },
                method: "find"
            }, { headers: { 'Authorization': `Bearer ${tokenReq.token}` } });

            if (!userCheck.data.success) {
                dBox.closeE && dBox.closeE()
                return (alert("Given user does not exist."), false)
            }
                
            if (userCheck.data.success && userCheck.data.result.length !== eTo.length) {
              dBox.closeE && dBox.closeE()
              const missingEmails = eTo.filter(email => !userCheck.result.some(u => u.email === email));
              alert(`Given user(s) ${missingEmails.join(', ')} do not exist.`)
              return
            }

            to = userCheck.data.result.map(user => ({user: user._id}));
        } catch (err) {
            dBox.close && dBox.close()
            dBox.closeE && dBox.closeE()
            alert("Unexpected error occured. Try again later")
            return
        }
        if (file && file.type === "application/pdf" && file.name.toLowerCase().endsWith(".pdf")) {
            formData['to'] = to
            formData['fileName'] = file.name
            formData['layers'] = layers
            const userInputDateTime = `${i.expiry_date.value}T${i.expiry_time.value}:00`;
            const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const dateInUserTimeZone = new Date(
                new Date(userInputDateTime).toLocaleString("en-US", { timeZone: userTimeZone })
              );
            const dateInUTC = new Date(dateInUserTimeZone.toISOString());
            
            formData['expiry'] = dateInUTC.toISOString()
            if (i.enableMaxViews.value) {
                formData['limit_views'] = true
                formData['max_views'] = i.max_views.value
            } else {
                formData['limit_views'] = false
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

    async receive(e) {
        e.preventDefault()
        var tokenReq = await F.getToken(),
            receiver = tokenReq.user._id,
            token = tokenReq.token
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
        F.BM(this, ["closeDialog", "openDialog", "handleInputs", "handleNav", "logout"])
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
        F.l('click', F.G.id('nav'), this.handleNav)
        this.setupProfile(data)
    }

    async handleNav(e) {
        e.stopPropagation()
        var target = e.target,
            { tab, search, profile, logout } = target.dataset
        if (tab) {
            var s = tab === 'dashboard' ? 'chatSection' : 'dashboard',
                tabButtons = Array.from(F.G.query('[data-tab]', document, "all"))
            F.G.id(s)["style"].opacity = '0'
            F.G.id(s)["style"].pointerEvents = 'none'
            F.G.id(tab).style.opacity = '1'
            F.G.id(tab).style.pointerEvents = "all"
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
                tag === 'INPUT' && (span.setAttribute('placeholder', value))
                tag === 'SPAN' && (span.innerText = value)
                tag === 'DIV' && (span.innerText = value, f[j].appendChild(span))
            }
        }
    }

    async openDialog(e) {
        e.preventDefault()
        var dts = e.target["dataset"],
            dBoxId = dts.dbox,
            dBox = F.G.id(dBoxId)
        dts.c && this[dts.c].init && this[dts.c].init(dBoxId)
        dBox && F.hide(dBox, !0)
        dBox.close = () => this.closeDialog(F.G.class('c', dBox)[0]);
        F.class([F.G.id('app')], ["disable"])
    }

    closeDialog(e) {
        var element = e.target || e,
            dts = element["dataset"],
            dBoxVar = dts.dialog,
            dBox = F.G.id(dBoxVar)
        if ('i' in dts) {
            var ifA = JSON.parse(dts.i)
            console.log(ifA)
            ifA.forEach(e => {
                F.G.id(e).value = ""
            })
        }
        element.closeE && element.closeE()
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
    constructor() {
        this.profS = F.G.id("profS"),
        this.aProfChat = F.G.id("sChat"),
        this.profTemp = F.G.id("profile").content.firstElementChild.cloneNode(true),
        this.msgTemp = F.G.id("message").content.firstElementChild.cloneNode(true),
        this.grpTemp = F.G.id("grpMemListProf").content.firstElementChild.cloneNode(true)
        this.load = F.G.id('loadChat')
        this.chatS = F.G.id('chat')
        this.grpList = F.G.id('grpMemList')
        this.activeProfile = F.G.id('tChat')
        this.chatUsers = new Map()

        F.BM(this, ["addChat", "openChat", "addNewUser", "addNewGroup", "sendMessage", "createChat", "fetchMessages"])
        F.BM(this, ['init', 'leaveGroup', 'newMessageLog'])
        F.l('click', F.G.id("oOpt"), this.handleOpts)
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
        console.log(user)
        if (!user.success) {
            alert("User not found.")
            dBox.close && dBox.close()
            return false
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
        var response = history.data.result,
            chats = response.map(e => {
                var from = data.type === 'group' ? e.from._id : e.from
                if (from !== tokenReq.user._id) return { context: "received", type: e.type, content: e.content, name: e.from?.name || "solo" }
                if (from === tokenReq.user._id) return { context: "sent", type: e.type, content: e.content }
                return null
            })
        F.G.id('sChat').innerHTML = ""
        this.renderMessages({ type: data.type, chats: chats, new: !0 })
    }

    renderMessages(data) {
        let cSection = F.G.id('sChat'),
            lastM = !1,
            type = data.type,
            chats = data.chats
        chats.forEach(c => {
            var tempDiv = F.Cr('div'),
                tempSpan = F.Cr('span'),
                sCon;
            if (c.context === "sent") {
                tempDiv.classList.add('pUser')
            } else if ('received' === c.context) {
                tempDiv.classList.add('sUser')
            }

            if (type === "group" && c.context === "received") {
                tempDiv.appendChild(tempSpan)
                sCon = F.G.query('span', tempDiv)
                tempSpan = F.Cr('span')
                tempSpan.classList.add('gUserName')
                tempSpan.innerText = c.name
                tempDiv.classList.add('g')
                sCon.appendChild(tempSpan)
                tempSpan = F.Cr('span')
                tempSpan.innerText = c.content
                sCon.appendChild(tempSpan)
            } else {
                tempSpan.innerText = c.content
                tempDiv.appendChild(tempSpan)
            }
            !lastM && cSection.appendChild(tempDiv)
            lastM && cSection.insertBefore(tempDiv, lastM)
            lastM = tempDiv
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
        newChat.from === this.userData.user._id && (refChat = { context: "sent", type: newChat.type, content: newChat.content }) && (cInput.value = "")
        newChat.to === this.userData.user._id && (refChat = { context: "received", type: newChat.type, content: newChat.content })
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
