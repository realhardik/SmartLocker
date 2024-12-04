const { ipcRenderer } = require('electron');

class login {
    constructor() {
        this.loginBtn = F.G.id("lBtn")
        this.regBtn = F.G.id("sBtn")
        F.l("click", this.loginBtn, async (e) => { e.preventDefault(); this.login() })
        F.l("click", this.regBtn, async (e) => { e.preventDefault(); this.signUp() })
        this.sToReg = F.G.id('register');
        this.sToLog = F.G.id('login');
        var container = F.G.id('container')
        F.l("click", this.sToReg, (e) => { e.preventDefault();
            container.classList.add("active");
            container.classList.remove("active-forgot");
        })
        F.l("click", this.sToLog, (e) => { e.preventDefault();
            container.classList.remove("active");
            container.classList.remove("active-forgot");
        })
        F.l("click", F.G.id('forgot-password-btn'), (e) => { 
            e.preventDefault();
            container.classList.add("active");
            container.classList.add("active-forgot");
        })
        F.l("click", F.G.id('verify'), (e) => { 
            e.preventDefault();
            container.classList.remove("active");
            container.classList.add("active-forgot");
            container.classList.add("active-forgot.OTP");
        })
    }

    async login() {
        var email = F.G.id('lEmail').value,
            password = F.G.id('lPass').value,
            result = await ipcRenderer.invoke('login', { email, password })
        F.G.id('lPass').value = ""
        if (!result.success) {
            alert("Invalid Login Credentials.")
        }
    }

    async signUp() {
        var name = F.G.id("sName").value,
            email = F.G.id('sEmail').value,
            password = F.G.id('sPass').value,
            result = await ipcRenderer.invoke('signup', { name, email, password })
        F.G.id("sName").value = ""
        F.G.id('sEmail').value = ""
        F.G.id('sPass').value = ""
        alert(result.msg)
        if (result.success) {
            F.G.id('container').classList.remove("active")
        }
    }
}

new login