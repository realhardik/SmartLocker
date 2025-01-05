const { default: axios } = require('axios');
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
        F.G.id('sendOTP').addEventListener('click', (event) => {
            event.preventDefault();
            this.sendOtp('forgotPass')
        });
        F.G.id('resendForgotOTP').addEventListener('click', (event) => {
            event.preventDefault();
            this.sendOtp('resendForgot')
        });
        F.G.id('setNewPassword').addEventListener('click', (event) => {
            event.preventDefault();
            this.forgotPassword('verify')
        });

        F.l("click", F.G.id('signUp'), (e) => { 
            e.preventDefault();
            container.classList.remove("active");
            container.classList.add("active-otp-register");
            this.sendOtp("signUp")
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

    async forgotPassword(e) {
        if (e === 'verify') {
            var rEmail = F.G.id('resetEmail').value,
            otp = F.G.id('resetOTP').value,
            newPass = F.G.id('newPassword').value,
            response = await ipcRenderer.invoke('forgotPassword', { email: rEmail, otp: otp, newPass: newPass })
            if (response.success) {
                F.G.id('container').classList.remove('active-otp-reset')
                alert('Updated Password Successfully.')
                return
            }
            alert(response.msg)
            return
        }
    }

    async sendOtp(e) {
        const container = F.G.id('container')
        if (e === 'signUp') {
            var email = F.G.id('sEmail').value,
                result = await ipcRenderer.invoke('sendOtp', e, email)
            console.log(result)
            if (result?.success) {
                container.classList.remove("active");
                container.classList.remove("active-forgot");
            } else {
                alert(result.msg || "Couldn't send otp at the moment.")
                F.G.id("sName").value = ""
                F.G.id('sEmail').value = ""
            }
        } else if (e === 'forgotPass') {
            var email = F.G.id('resetEmail').value,
                result = await ipcRenderer.invoke('sendOtp', e, email)
            console.log(result)
            if (result?.success) {
                container.classList.remove("active");
                container.classList.remove("active-forgot");
                container.classList.add("active-otp-reset");
            } else {
                alert(result.msg || "Couldn't send otp at the moment.")
                F.G.id('resetOTP').value = ""
                F.G.id('resetEmail').value = ""
            }
        } else if (e === "resendForgot") {
            var email = F.G.id('resetEmail').value,
                result = await ipcRenderer.invoke('sendOtp', 'forgotPass', email)
            if (result?.success) {
                alert('OTP resent successfully.')
            } else {
                alert(result.msg || "Couldn't send otp at the moment.")
                F.G.id('resetEmail').value = ""
            }
        }
    }

    async signUp() {
        var name = F.G.id("sName").value,
            email = F.G.id('sEmail').value,
            password = F.G.id('sPass').value,
            otp = F.G.id('otp').value,
            result = await ipcRenderer.invoke('signup', { name, email, password, otp }),
            container = F.G.id('container')
        F.G.id("sName").value = ""
        F.G.id('sEmail').value = ""
        F.G.id('sPass').value = ""
        F.G.id('otp').value = ""
        alert(result.msg)
        if (result.success) {
            container.classList.remove("active");
            container.classList.add("active-otp-register");
        }
    }
}

new login