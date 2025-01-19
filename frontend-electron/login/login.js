const { default: axios } = require('axios');
const { ipcRenderer } = require('electron');

class login {
    constructor() {
        this.loginBtn = F.G.id("lBtn")
        this.regBtn = F.G.id("sBtn")
        F.l("click", this.loginBtn, async (e) => { e.preventDefault(); this.login() })
        F.l("click", this.regBtn, async (e) => { e.preventDefault(); this.signUp() })
        this.sToReg = F.G.id('registerSwitch');
        this.sToLog = F.G.id('loginSwitch');
        var container = F.G.id('container')
        F.l('click', F.G.class('toggle-container')[0], this.switchTabs)
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
        F.G.id('resendSignupOTP').addEventListener('click', (event) => {
            event.preventDefault();
            this.sendOtp('resendSignup')
        });
        F.G.id('setNewPassword').addEventListener('click', (event) => {
            event.preventDefault();
            this.forgotPassword('verify')
        });
        F.l("click", F.G.id('signUp'), (e) => { 
            e.preventDefault();
            this.sendOtp("signUp")
        })
        F.G.class('googleSignInButton').forEach(el => {
            F.l('click', el, async (e) => {
                e.preventDefault();
                await ipcRenderer.invoke('googleSignIn')
            })
        });
    }

    switchTabs(e) {
        var targ = e.target
        if (targ.tagName !== 'BUTTON')
            return
        e.preventDefault()
        var container = F.G.id('container'),
            classList = targ.classList
        
        if (classList.contains('back')) {
            var cAdd = ['active'],
            cRem = Array.from(container.classList).filter(e => e !== 'container');
            if (container.classList.contains('active-otp-reset'))
                cAdd.push('active-forgot')
            F.class([container], cAdd)
            F.class([container], cRem, !0)
        } else {
            var actClass = targ.id === 'loginSwitch' ? 'remove' : 'add'
            container.classList[actClass]('active')
            container.classList['remove']('active-forgot')
        }
    }

    async login() {
        this.load(!0)
        var email = F.G.id('lEmail').value,
            password = F.G.id('lPass').value,
            result = await ipcRenderer.invoke('login', { email, password })
        F.G.id('lPass').value = ""
        this.load()
        if (!result.success) {
            alert("Invalid Login Credentials.")
        }
    }

    async forgotPassword(e) {
        if (e === 'verify') {
            this.load(!0)
            var rEmail = F.G.id('resetEmail').value,
            otp = F.G.id('resetOTP').value,
            newPass = F.G.id('newPassword').value,
            response = await ipcRenderer.invoke('forgotPassword', { email: rEmail, otp: otp, newPass: newPass })
            this.load()
            if (response.success) {
                F.G.id('container').classList.remove('active-otp-reset')
                alert('Updated Password Successfully.')
                return
            }
            alert(response.msg)
            return
        }
        this.load()
    }

    async sendOtp(e) {
        const container = F.G.id('container')
        this.load(!0)
        if (e === 'signUp') {
            var email = F.G.id('sEmail').value,
                result = await ipcRenderer.invoke('sendOtp', e, email)
            this.load()
            if (result?.success) {
                alert(result?.message || "OTP sent successfully.")
                container.classList.remove("active");
                container.classList.remove("active-forgot");
                container.classList.add("active-otp-register");
            } else {
                alert(result?.message || "Couldn't send otp at the moment.")
                if (result?.message?.includes('invalid')) {
                    F.G.id('signupOtp').value = ""
                } else {
                    F.G.id("sName").value = ""
                    F.G.id('sEmail').value = ""
                    F.G.id('sPass').value = ""
                    F.G.id('signupOtp').value = ""
                }
            }
        } else if (e === 'forgotPass') {
            var email = F.G.id('resetEmail').value,
                result = await ipcRenderer.invoke('sendOtp', e, email)
            this.load()
            if (result?.success) {
                alert(result?.message || "OTP sent successfully.")
                container.classList.remove("active");
                container.classList.remove("active-forgot");
                container.classList.add("active-otp-reset");
            } else {
                alert(result?.message || "Couldn't send otp at the moment.")
                F.G.id('resetOTP').value = ""
                F.G.id('resetEmail').value = ""
            }
        } else if (e === "resendForgot") {
            var email = F.G.id('resetEmail').value,
                result = await ipcRenderer.invoke('sendOtp', 'forgotPass', email)
            this.load()
            if (result?.success) {
                alert('OTP resent successfully.')
            } else {
                alert(result?.message || "Couldn't send otp at the moment.")
                F.G.id('resetEmail').value = ""
            }
        } else if (e === 'resendSignup') {
            var email = F.G.id('sEmail').value,
                result = await ipcRenderer.invoke('sendOtp', 'signUp', email)
            this.load()
            if (result?.success) {
                alert('OTP resent successfully.')
            } else {
                alert(result?.message || "Couldn't send otp at the moment.")
            }
        }
        this.load()
    }

    async signUp() {
        this.load(!0)
        var name = F.G.id("sName").value,
            email = F.G.id('sEmail').value,
            password = F.G.id('sPass').value,
            otp = F.G.id('signupOtp').value,
            result = await ipcRenderer.invoke('signup', { name, email, password, otp }),
            container = F.G.id('container')
        this.load()
        alert(result.message)
        
        if (result.success) {
            F.G.id("sName").value = ""
            F.G.id('sEmail').value = ""
            F.G.id('sPass').value = ""
            F.G.id('signupOtp').value = ""
            container.classList.remove("active");
            container.classList.remove("active-otp-register");
        } else {
            F.G.id('signupOtp').value = ""
        }
    }

    load(s) {
        F.hide(F.G.id('load'), (s || !1), 'flex')
    }
}

new login