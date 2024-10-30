const { ipcRenderer } = require('electron');
const container = F.G.id('container');
const registerBtn = F.G.id('register');
const loginBtn = F.G.id('login');

registerBtn.addEventListener('click', () => {
    console.log("click reg")
    container.classList.add("active");
});

loginBtn.addEventListener('click', () => {
    console.log("click log")
    container.classList.remove("active");
});

class login {
    constructor() {
        this.loginBtn = F.G.id("lBtn")
        this.regBtn = F.G.id("sBtn")
        F.l("click", this.loginBtn, async (e) => { e.preventDefault(); this.login() })
        F.l("click", this.regBtn, async (e) => { e.preventDefault(); this.signUp() })
    }

    async login() {
        var email = F.G.id('lEmail').value,
            password = F.G.id('lPass').value,
            result = await ipcRenderer.invoke('login', { email, password })
        F.G.id('lEmail').value = ""
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
        if (!result.success) {
            
        }
    }
}

new login