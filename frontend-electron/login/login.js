const { ipcRenderer } = require('electron');

class login {
    constructor() {
        this.loginBtn = F.G.id("lBtn")
        this.regBtn = F.G.id("sBtn")
        F.l("click", this.loginBtn, async (e) => { e.preventDefault(); this.login() })
        F.l("click", this.regBtn, async (e) => { e.preventDefault(); this.signUp() })
        this.sToReg = F.G.id('register');
        this.sToLog = F.G.id('login');
        F.l("click", this.sToReg, async (e) => { e.preventDefault();
            F.G.id('container').classList.add("active")
        })
        F.l("click", this.sToLog, async (e) => { e.preventDefault();
            F.G.id('container').classList.remove("active") 
        })
        F.l("click", F.G.id('forgotPasswordLink'), async (e) => { 
            e.preventDefault();
            F.G.id('container').classList.add("active-forgot-password") 
        })
        F.l("click", F.G.id('backToSignIn'), async (e) => { 
            e.preventDefault();
            F.G.id('container').classList.remove("active-forgot-password") 
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
            console.log(result)
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