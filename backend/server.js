require('dotenv').config();
const express = require('express')
const session = require('express-session');
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
const cors = require('cors')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const FormData = require('form-data')
const axios = require('axios')
const http = require('http')
const { Server } = require('socket.io')
const nodemailer = require('nodemailer')
const otpGen = require('otp-generator')
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express()
const server = http.createServer(app)
const io = new Server(server)
let generateId;
(async () => {
  const { customAlphabet } = await import('nanoid');
  generateId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 8);
})();

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(session({
  secret: process.env.EXPSESSION, 
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());
// app.use(express.static(path.join(__dirname, 'homepage')));
app.use(cors())
passport.serializeUser((user, done) => {
  console.log(user)
  console.log(user.id)
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await db.search('Users', {
    _id: id,
    type: 'google'
  }, 'findOne')
  done(null, user.result);
});
passport.use(new GoogleStrategy({
  clientID: process.env.GCLIENTID,
  clientSecret: process.env.GCLIENTST,
  callbackURL: `${(process.env.BASE_URL || 'http://localhost:3000')}/api/auth/google/callback`
},
async (token, tokenSecret, profile, done) => {
  console.log(profile)
  const userName = profile.displayName;
  const userEmail = profile.emails[0].value;

  var response = await db.addUser(userName, userEmail, 'google')
  if (response.success)
    return done(null, response.user);
  return
}
));

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
      user: process.env.NEXUS_USER,
      pass: process.env.NEXUS_PASS
  }
})

const h = {
  BM: (r, e) => {
    var s = e.length;
    for (let t = 0; t < s; t++)
        r[e[t]] = r[e[t]].bind(r)
  },
  sendMail: async (data) => {
    try {
      const templatePath = path.join(__dirname, "static", 'otpTemplate.html');
      let htmlContent = fs.readFileSync(templatePath, 'utf-8');
      
      htmlContent = htmlContent
      .replace(/{{content}}/g, data.content || '')
      .replace(/{{currentYear}}/g, new Date().getFullYear());

      let mailOptions = {
        from: '"Nexus noreply" <noreply@gmail.com>',
        to: data.to,
        subject: data.subject,
        text: data.text,
        html: htmlContent
      };
  
      const result = await new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error("Email sending error:", error);
            reject({ success: false, msg: "Failed to send OTP." });
          } else {
            console.log("Email sent successfully:", info);
            resolve({ success: true, msg: "Email sent.", info });
          }
        });
      });
  
      return result;
    } catch (err) {
      console.error("Error in sendMail:", err);
      return { success: false, msg: "Couldn't send email at the moment. Try again later." };
    }
  }  
}

const JWT_SECRET = process.env.JWT_SECRET;

const mongoURI = 'mongodb+srv://hail:mrg_001@cluster0.916e9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
// const mongoURI = process.env.MONGO_URI
const pythonURL = process.env.PYTHON_URL

const db = new class {
  constructor() {
    h.BM(this, ["schemas", "addUser", "search", "newSession", "addFile", "remove"])
    mongoose.connect(mongoURI).then(async () => {
      console.log('Connected to MongoDB Atlas');
      this.schemas()
      deleteExpiredFiles()
      setInterval(deleteExpiredFiles, 2 * 60 * 1000);
    }).catch(err => {
      console.error('MongoDB Atlas connection error:', err);
    });
  }

  schemas() {
    this.userSchema = new mongoose.Schema({
      created_at: { type: Date, default: Date.now },
      uniqueId: { 
        type: String, 
        unique: true, 
        default: () => generateId()
      },
      name: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      type: { type: String, enum: ["static", "google"], default: "static" }
    });
    
    this.sessionSchema = new mongoose.Schema({
      timestamp: { type: Date, default: Date.now, index: { expires: '16m' } },
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
      token: { type: String, required: true }
    });

    this.chatSchema = new mongoose.Schema({
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
      receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
      group: { type: mongoose.Schema.Types.ObjectId, ref: 'group' },
      lastMessage: {
        content: String,
        timestamp: { type: Date, default: Date.now },
        from: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
      },
      unreadCount: { type: Number, default: 0 },
      type: { type: String, enum: ["solo", "group"], default: "solo" }
    });

    this.groupSchema = new mongoose.Schema({
      name: { type: String, required: true },
      description: { type: String },
      createdAt: { type: Date, default: Date.now },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
      members: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
          role: { type: String, enum: ['admin', 'member'], default: 'member' },
          joinedAt: { type: Date, default: Date.now }
        }
      ],
      active: { type: Boolean, default: true }
    });
    
    this.chatLogs = new mongoose.Schema({
      timestamp: { type: Date, default: Date.now },
      from: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
      to: { type: mongoose.Schema.Types.ObjectId, required: true },
      type: { type: String, enum: ['file', 'text'], default: 'text' },
      content: String,
      otherData: { type: mongoose.Schema.Types.ObjectId }
    });
    
    this.fileLog = new mongoose.Schema({
      timestamp: { type: Date, default: Date.now },
      from: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
      to: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true }, 
          views: { type: Number, default: 0 },
        },
      ],
      fPath: String,
      fName: String,
      fileHash: String,
      rView: { type: Boolean, default: false },
      maxViews: { type: Number, default: 2 },
      expiry: { type: Date },
      status: { type: String, enum:['Active', 'Expired'], default: 'Active' },
      watermark: { type: Boolean, default: false },
      watermark_options: {
        text: { type: String, default: "" },
        color: { type: String, default: "#FF0000" },
        size: { type: Number, default: 40 },
        rows: { type: Number, default: 3 },
        columns: { type: Number, default: 3 },
        opacity: { type: Number, default: 50 }
      },

    });

    this.otpSchema = new mongoose.Schema({
      timestamp: { type: Date, default: Date.now },
      email: { type: String, required: true },
      otp: { type: String, required: true },
      createdAt: { type: Date, default: Date.now, index: { expires: '5m' } },
      type: { type: String, enum: ["signUp", "forgotPass"] }
    });
    
    this.Users = mongoose.model('user', this.userSchema)
    this.Files = mongoose.model('fileLogs', this.fileLog)
    this.Session = mongoose.model('session', this.sessionSchema)
    this.chatLog = mongoose.model('chatLogs', this.chatLogs)
    this.chat = mongoose.model('chat', this.chatSchema)
    this.group = mongoose.model('group', this.groupSchema);
    this.otp = mongoose.model('otpCollection', this.otpSchema)
  }

  async add(collection, reqFields) {
    var model = this[collection]
    if (!model) throw new Error("Invalid collection name");
    try {
      var newEntry = await model.create(reqFields)
      return { success: true, result: newEntry };
    } catch(err) {
      console.error("Server Error: ", err)
      return { success: false }
    }
  }
  
  async addUser(name, email, type, pass) {
    var exists = await this.search('Users', { email: email }, 'findOne'),
      newUser;
    console.log('exists', exists)
    if (exists.success) {
      if (type === 'google')
        return { success: true, message: 'Logged In', user: exists.result}
      return { success: false, message: "User Already Exists." }
    }
    try {
      if (type === 'static') {
        var hashedPassword = await bcrypt.hash(pass, 10)
        newUser = await this["Users"].create({ name, email, type, password: hashedPassword })
        return { success: true, user: newUser, message: "User created Successfully." };
      } else if (type === 'google') {
        newUser = await this["Users"].create({ name, email, type, password: "GOOGLE_NEXUS_ACCOUNT" });
        return { success: true, user: newUser, message: "User created Successfully." };
      }
    } catch (err) {
        console.error("Error adding user: ", err);
        return { success: false, message: "Failed to add user." };
    }
  }

  async addFile(fEntry) {
    try {
      var savedFileEntry = await this.Files.create(fEntry);
      if (savedFileEntry) {
        return { success: true, file: savedFileEntry, msg: "File shared successfully." }
      }
        
      return { success: false, msg: "Failed to share file." }
    } catch (err) {
        console.error("Error adding file: ", err);
        return { success: false, msg: "Cannot share file at the moment." };
    }
  }

  async newSession(email) {
    try {
      const user = await this.search('Users', { email: email }, 'findOne')
      if (!user.success || !user.result)
        return { success: false }
      var jTn = jwt.sign({ data: user.result }, JWT_SECRET, { expiresIn: '15m' }),
        session = await this["Session"].create({
                    user: user.result._id,
                    token: jTn
                  })
      return { success: true, session: { _id: session._id, user: user.result, token: session.token } };
    } catch (err) {
      console.log("Error Creating Session: ", err)
      return { success: false, message: "Error creating new session." }
    }
  }

  async search(collection, query, method, update, populate, options = {}) {
    var model = this[collection];
    method = method && typeof model[method] === "function" ? method : "find";
    let result;
    
    if (!model) throw new Error("Invalid collection name");

    try {
        if (method === "find" || method === "findOne") {
          let queryObj = model[method](query).sort({ timestamp: -1 });

          let originalResults = await queryObj.clone(); 

          if (populate) {
            for (const { field, select, modelCol } of populate) {
              if (modelCol) {
                queryObj = queryObj.populate({ path: field, select, model: modelCol });
              } else {
                queryObj = queryObj.populate(field, select);
              }
            }
          }
          result = await queryObj;
          // populate &&  (result = {
          //     original: originalResults,
          //     populated: result
          //   })

        } else if (method === "findOneAndUpdate") {
          result = await model.findOneAndUpdate(query, update, { ...options, new: true });
          if (populate) {
            for (const { field, select } of populate) {
                result = await model.populate(result, { path: field, select });
            }
          }
        } else if (method === "updateMany") {
          result = await model.updateMany(query, update, options);
        }

        if ((method === "find" && result.length === 0) || (method !== "find" && !result)) {
            console.log("No results found");
            return { success: false, result: result };
        }
        
        return { success: true, result: result };
    } catch (err) {
        console.error("Error searching: ", err);
        return { success: false };
    }
  }

  async remove(collection, query, method) {
    var model = this[collection]
        method = ["single", "multiple"].includes(method) ? method : "multiple";
    let result;
    if (!model) throw new Error("Invalid collection name");
    try {
      if (method === "single") {
          result = await model.deleteOne(query);
      } else if (method === "multiple") {
          result = await model.deleteMany(query);
      }
      return { success: true, result: result}
    } catch (err) {
        console.error("Error removing: ", err);
        return { success: false };
    }
  }
}

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);

    console.log(`Socket ${socket.id} joined room: ${roomId}`);
  });

  socket.on('addNewChat', async ({ senderId, recipientId, recipientName }) => {
    var response = await db.add('chat', {
      sender: recipientId,
      receiver: senderId
    })

    response = await db.add('chat', {
      sender: senderId,
      receiver: recipientId
    })

    if (response.success) {
      socket.emit('addedNewChat', { recipientName: recipientName, ...response.result._doc })
    } else {
      socket.emit('NoNewUser', "Error adding new user.")
    }
  })

  socket.on('addNewGroup', async ({ grpName, grpMembers, createdBy }) => {
    const members = grpMembers
          .map(u => ({ user: u, role: 'member' }))
    console.log("grp: ", grpName)
    console.log("grp: ", grpMembers)
    console.log("grp: ", createdBy)
    var response = await db.add('group', {
        name: grpName,
        createdBy: createdBy,
        members: [
          { user: createdBy, role: 'admin' },
          ...members
      ]
    })

    if (!response.success) {
      socket.emit('NoNewUser', "Error creating new group.")
    }

    var grp = response.result
    console.log("new group", grp)
    await db.add('chat', {
      sender: createdBy,
      group: grp._id,
      type: 'group'
    })
    grpMembers.forEach(async (u) => {
      await db.add('chat', {
        sender: u,
        group: grp._id,
        type: 'group'
      })
    })

    if (response.success) {
      members.forEach(m => {
        socket.to(m.user).emit('addedNewGroup', { role: 'member', ...response.result._doc })
      });
      socket.emit('addedNewGroup', {role: 'admin', ...response.result._doc })
    } else {
      socket.emit('NoNewUser', "Error creating new group.")
    }
  })

  socket.on('sendMessage', async ({ senderId, convId, mType, message, cType, senderName = null }) => {
    console.log(`Message in room ${convId} from ${senderId}: ${message}`);
    
    var anc = await db.add('chatLog', {
        from: senderId,
        to: convId,
        type:  mType || "text",
        content: message,
        cType: cType || 'solo'
    })

    if (cType === 'group') {
      var group = await db.search('group', {
        _id: convId
      }, 'findOne')

      db.search('chat', {
        group: convId
      }, 'updateMany',
      { $set: { "lastMessage.timestamp": Date.now() } })

      var oUsers = group.result.members.map(e => e.user !== senderId)
      var updCount = await db.search('chat', {
        group: convId
      }, 'updateMany',
      {
          $inc: { unreadCount: 1 }
      })
      group.result.members.forEach(async (u) => {
        if (!u.user.equals(senderId)) {
          socket.to(u.user.toString()).emit('newMessage', { ...anc.result._doc, chatType: 'group', sender: senderName })
        }
      })
      socket.emit('sentMessage', { ...anc.result._doc, chatType: 'group', sender: senderName })
    } else {
      await db.search('chat', { sender: convId, receiver: senderId }, 'findOneAndUpdate',
      { $inc: { unreadCount: 1 } })

      db.search('chat', { 
        $or: [
          { sender: senderId, receiver: convId },
          { sender: convId, receiver: senderId }
        ]
      }, 'updateMany', { $set: { "lastMessage.timestamp": Date.now() } })

      socket.emit('sentMessage', { ...anc.result._doc });
      socket.to(convId).emit('newMessage', { ...anc.result._doc, chatType: 'solo' });
    }
  });

  socket.on('markRead', async (data) => {
    // if (data.type === 'group')
    var recField = data.type === 'group' ? 'group' : "receiver"
    var res = db.search('chat', {
      sender: data.receiverId,
      [recField]: data.senderId
    }, 'findOneAndUpdate', {
      $set: { unreadCount: 0 }
    })
  });

  socket.on('deleteGroup', async (data) => {
    var group = await db.search('group', {
      _id: data.id
    }, 'findOne')

    if (!group.success) {
      socket.emit('NoNewUser', "Couldn't find the group")
      return
    }
    group = group.result
    for (const u of group.members) {
      const result = await db.remove('chat', {
        sender: u.user,
        group: group._id
      });
      
      console.log("deleting grp: ", result);
      console.log(u.user);
      console.log(group.createdBy);
      
      if (u.user.equals(group.createdBy)) {
        console.log('emitting');
        socket.emit('deletedGroup', group._id);
      } else {
        socket.to(u.user).emit('deletedGroup', group._id);
      }
    }
    console.log("deleting group now")
    group = await group.deleteOne()
    db.remove('chatLog', {
      to: data.id
    }, "multiple")
  });

  socket.on('leaveGroup', async (data) => {
    var group = await db.search('group', {
      _id: data.id
    }, 'findOne')

    if (!group.success) {
      socket.emit('NoNewUser', "Couldn't find the group")
      return
    }
    group = group.result
    console.log(data.userId)
    var result = await db.remove('chat', {
      sender: data.userId,
      group: group._id
    })
    console.log(result)
    if (result.success) {
      socket.emit('leavedGroup', group._id)
    } else {
      socket.emit('NoNewUser', "Error leaving the group.")
    }
  });

  socket.on('markAsRead', async ({ message }) => {
    await db.search('chatLog', { _id: message._id }, 'findOneAndUpdate', { read: true })
  });

  socket.on('sharedFile', async (data) => {
    console.log('file shared')
    console.log(data)
    var file = data.otherData
    file.to.forEach(u => {
        socket.to(u.user).emit('newMessage', {
          from: data.from,
          to: u.user,
          type: 'file',
          content: "",
          otherData: file
        });
    })
    socket.emit('newMessage', {
      from: data.from,
      to: file.to,
      type: 'file',
      content: "",
      otherData: file
    })
  })

  socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
  });
});

app.get('/api/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

app.get('/api/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: `${(process.env.BASE_URL || 'http://localhost:3000')}/api/auth/failure`, session: false }),
  async (req, res) => {
    const user = req.user
    console.log(user)
    if (user) {
      let newSession = await db.newSession(user.email)
      if (newSession.success) {
        newSession = newSession.session
        return res.redirect(`${(process.env.BASE_URL || 'http://localhost:3000')}/api/auth/success?id=${newSession._id}`)
      }
    }
    return res.redirect(`${(process.env.BASE_URL || 'http://localhost:3000')}/api/auth/failure`)
  }
);

app.get('/api/auth/session', async (req, res) => {
  console.log('session req')
  const sessionID = req.query.id;
  if (!sessionID) {
    return res.redirect(`${(process.env.BASE_URL || 'http://localhost:3000')}/api/auth/failure`)
  }
  const sessionData = await db.search('Session', {
    _id: sessionID
  }, 'findOne');
  console.log(sessionData)
  if (sessionData.success)
    return res.status(200).json(sessionData.result)
  return res.redirect(`${(process.env.BASE_URL || 'http://localhost:3000')}/api/auth/failure`)
})

app.get('/api/auth/success', (req, res) => {
  res.json({ success: true, message: "Redirect handled successfully" });
});

app.get('/api/signup', async (req, res) => {
  try {
    var { email } = req.query,
    prevUser = await db.search('Users', {
      email: email
    })

    if (prevUser.success && prevUser.result.length > 0) {
      res.status(401).json({ success: false, message: "User already exists."})
      return
    }

    var prevReq = await db.search('otp', {
      email: email,
      type: "signUp"
    }, 'findOne')

    if (prevReq.success) {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      if (new Date(prevReq.result.createdAt) > oneMinuteAgo) {
          res.status(401).json({ success: false, message: "OTP was created less than a minute ago."})
          return
      }
  }
    otp = otpGen.generate(6, { specialChars: false })
    var hashedOTP = await bcrypt.hash(otp, 10)
    
    var sendotp = await h.sendMail({
      to: email,
      subject: 'Email Verification - OTP',
      text: `Your OTP for verification is: ${otp}`,
      content: `<p>Use the OTP below to Sign up:</p>
      <div class="otp">${otp}</div>
      <p>This OTP is valid for the next 5 minutes. Please do not share it with anyone.</p>`
    })

    if (!sendotp.success) {
      alert(sendotp.msg || "Couldn't send otp at the moment. \nTry again later.")
      return res.status(401).json({ success: false, message: "Couldn't send email at the moment. \n Try again later" })
    }
    await db.add('otp', { email: email, otp: hashedOTP, type: "signUp" })
    return res.status(201).json({ success: true, message: "OTP sent successfully"})
  } catch (err) {
    console.log("error signing up: ", err)
    return res.status(401).json({ success: false, message: "Error signing up."})
  }
});

app.post('/api/signup', async (req, res) => {
  try {
    var { name, email, password, otp } = req.body
    if (!name || !email || !password || !otp) {
      return res.status(401).json({ success: false, message: "Some Error Occured." });
    }
    var storedOtp = await db.search('otp', {
          email: email,
          type: "signUp"
        }, 'findOne')
    var checkOTP = await bcrypt.compare(otp, storedOtp.result.otp)
    if (!checkOTP) {
      return res.status(401).json({ success: false, message: "Invalid OTP." });
    }
    await db.remove('otp', { email: email }, 'multiple')
    var response = await db.addUser(name, email, 'static', password)
    if (response.success)
      return res.status(400).json(response)
    return res.status(400).json(response);
  } catch (err) {
    console.log("error signing up: ", err)
    return res.status(400).json({ success: false, message: "Error signing up."})
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await db.search('Users', { email: email }, 'findOne')
  let pass;

  if (!user.success || !user.result || !user.result.password ) {
    return res.status(400).json({ success: false, message: 'Invalid credentials.' });
  }

  if (user.type === 'google') {
    return res.status(400).json({ success: false, message: 'Use Google Sign In to Log In with this account.'})
  }

  pass = await bcrypt.compare(password, user.result.password);
  if (!pass) {
    return res.status(400).json({ success: false, message: 'Server Error. Try again later.' });
  }

  var s = await db.newSession(email);
  
  if (s.success)
    return res.status(200).json(s);
  return res.status(400).json(s);
});

function authenticateJWT(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1]; 

  if (token) {
      jwt.verify(token, JWT_SECRET, (err, user) => {
          if (err) {
              return res.sendStatus(403); 
          }
          req.user = user; 
          next(); 
      });
  } else {
      res.sendStatus(401); 
  }
}

const uploadFolder = path.join(__dirname, 'uploads');
const encryptedPath = path.join(__dirname, 'encrypted_files')

if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder);
}
if (!fs.existsSync(encryptedPath)) {
  fs.mkdirSync(encryptedPath);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadFolder);
  },
  filename: function (req, file, cb) {
    cb(null, path.basename(file.originalname, path.extname(file.originalname)) + "_" + Date.now());
  }
});

const upload = multer({ storage: storage });

async function encrypt(file, data) {
  const formData = new FormData(),
        tempFilePath = file.path

  formData.append('original_pdf', fs.createReadStream(tempFilePath));
  formData.append('data', JSON.stringify(data));
  
  try {
    const response = await axios.post(`${pythonURL}/encrypt`, formData, {
      headers: {
        ...formData.getHeaders()
      },
      responseType: 'arraybuffer'
    });

    const encryptedFilePath = path.join(encryptedPath, `${file.filename}_encrypted.zip`)

    fs.writeFileSync(encryptedFilePath, response.data)
    console.log(`Encrypted file saved at: ${encryptedFilePath}`)
    return {
      success: true,
      message: "File encrypted successfully",
      path: encryptedFilePath
    }
  } catch (error) {
    console.error("Error encrypting PDF:", error);
    return { success: false, message: "Failed to encrypt PDF" }
  } finally {
    fs.unlinkSync(tempFilePath)
  }
}

async function decrypt(file, data) {
  console.log(file)
  console.log(data)
  console.log(typeof data)
  
}

app.post('/api/upload', authenticateJWT, upload.single('file'), async (req, res) => {
  const from = req.user.data._id,
        file = req.file,
        data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data,
        otherData = req.body,
        to = JSON.parse(req.body.to),
        sTo = to.map(e => e.user),
      eFile = await db.search("Files", { fName: otherData.fileName, from: from, to: { $elemMatch: { user: { $in: sTo } } }, active: true })

  if (eFile.success) {
    return res.status(201).json({ success: false, msg: 'Given Filename is active currently. Change it to share.' });
  }

  if (!file || !from || !to) {
    return res.status(201).json({ success: false, msg: 'File, from, and to are required' });
  }

  let savedFileData;
  try {
    savedFileData = await encrypt(file, data)
    var filehash = await generateFileHash(savedFileData.path),
        fileEntry = {
          from: from,
          to: to,
          fName: otherData.fileName,
          fPath: savedFileData.path,
          fileHash: filehash,
          expiry: otherData.expiry,
          rView: otherData.limit_views,
          maxViews: otherData.max_views || -1,
          watermark: otherData.watermark?.trim()?.toLowerCase() === 'true'
        }
    if (fileEntry.watermark) {
      fileEntry.watermark_options = JSON.parse(otherData.watermark_options)
    }
    var result = await db.addFile(fileEntry)
    to.forEach(async (o) => {
      var chatlog = await db.add('chatLog', {
        from: from,
        to: o.user,
        type: 'file',
        content: "",
        otherData: result?.file?._id
      })
      console.log(chatlog)
    })
    res.status(201).json(result);
  } catch (err) {
    console.log(err)
    savedFileData.path && fs.unlinkSync(savedFileData.path)
    res.status(500).json({ msg: 'Error while uploading the file. \nTry again later' });
  }
});

app.post('/api/check', authenticateJWT, (req, res) => {
  res.json({
      user: req.user.data,
      success: true,
      message: "authorized"
  });
});

async function generateFileHash(filePath) {
  return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const fileStream = fs.createReadStream(filePath);

      fileStream.on('data', (data) => hash.update(data));
      fileStream.on('end', () => resolve(hash.digest('hex')));
      fileStream.on('error', (err) => reject(err));
  });
}

app.post('/api/files', authenticateJWT, async (req, res) => {
  let user = req.user.data._id,
      { type, query } = req.body,
      populate = null;
  !query && (query = {})
  if (type === 'shared') {
    console.log(user)
    query.from = user
    populate = [
      { field: 'to.user', select: '_id email' }
    ]
  } else if (type === 'received') {
    query.to =  { $elemMatch: { user: user } }
    populate = [
      { field: 'from', select: '_id email' }
    ]
  } else {
    query = {
      $or: [
        { from: user },
        { to: { $elemMatch: { user: user } } },
      ],
    }
  }

  if (!user) {
    return res.status(400).json({ success: false, msg: 'Username is required' });
  }
  console.log(query)

  try {
    const filesForUser = await db.search('Files', query, 'find', null, populate);
    console.log('searched received')
    res.status(200).json({ success: true, result: filesForUser.result });
  } catch (error) {
    res.status(500).json({ success: false, msg: 'Error fetching entries', error });
  }
});

app.get('/api/chat', authenticateJWT, async (req, res) => {
  try {
    console.log('chat req')
    var user = req.user.data._id
    console.log(user)
    var iUarr = await db.search('chat', { sender: user, type: 'solo' }, 'find', null, [
      { field:'sender', select: '_id name'},
      { field:'receiver', select: '_id name'}
    ]),
    iGarr = await db.search('chat', { sender: user, type: 'group' }, 'find', null, [
      { field:'group', select: '_id name members'}
    ]),
    iChats =  [...iUarr.result, ...iGarr.result]
    if (!iUarr.success && !iUarr.hasOwnProperty('result'))
      return res.status(401).json({ success: false, msg: 'Error fetching chats. Try again later' })
    return res.status(201).json({ success: true, result: iChats })
  } catch(err) {
    res.status(401).json({ success: false, msg: "Unexpected Error occured. Please try again later." });
  }
});

app.get('/api/chatLog/:convId', authenticateJWT, async (req, res) => {
  const otherUser = req.params.convId,
        userId = req.user.data._id,
        type = req.query.type
  let history;
  if (type === 'solo') {
    history = await db.search('chatLog', {
      $or: [
        { from: userId, to: otherUser },
        { from: otherUser, to: userId }
      ]
    }, 'find', null, [
      { field: 'otherData', modelCol: 'fileLogs', select: '_id fName from expiry status' }
    ])
  } else if (type === 'group') {
    history = await db.search('chatLog', {
      to: otherUser
    }, 'find', null, [
      { field: 'from', select: '_id name' },
      { field: 'otherData', modelCol: 'fileLogs', select: '_id fName from expiry status' }
    ])
  }
  
  if (!history.success && !history.hasOwnProperty('result'))
    return res.status(401).json({ success: false, msg: 'Error fetching messages. Try again later' }) 
  return res.json({ success: true, result: history.result });
});

app.post('/api/download/:fileId', authenticateJWT, async (req, res) => {
  const { fileId } = req.params;
  const to = req.user.data._id;
  const data = req.body

  if (!fileId) {
    return res.status(400).json({ success: false, msg: 'File id required' });
  }

  try {
    let fileEntry = await db.search('Files', { _id: fileId }, 'findOne');
    console.log(fileId)
    if (!fileEntry.success || !fileEntry.result) {
      return res.json({ success: false, msg: 'File not found or access denied' });
    }
    console.log(fileEntry)
    fileEntry = fileEntry.result
    console.log(fileEntry)
    if (!data.selected_algos || !data.all_passphrases) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (fileEntry.rView) {
      const userIndex = fileEntry.to.findIndex(entry => entry.user.toString() === to.toString());
      if (userIndex == -1) {
        return res.json({ success: false, msg: "User not authorized to access this file." });
      }
    
      if (fileEntry.to[userIndex].views < fileEntry.maxViews) {
        var upd = await db.search(
          'Files', 
          { _id: fileEntry._id, "to.user": to }, 
          "findOneAndUpdate", 
          { $inc: { "to.$.views": 1 } }
        );
      } else {
        return res.json({ success: false, msg: "Max Views Reached." });
      }
    }

    const formData = new FormData();
    var dataObj = {
      "selected_algos": data.selected_algos,
      "all_passphrases": data.all_passphrases,
      "filename": "encrypted"
    },
    watermark_options = [
      ["watermark_text", "text", ""], ["watermark_color", "color", ""], ["watermark_size", "size", 40],
      ["watermark_opacity", "opacity", 0], ["watermark_row", "row", 3], ["watermark_column", "column", 3]
    ],
    watermark = fileEntry.watermark
    for (let opt of watermark_options) {
      dataObj[opt[0]] = watermark ? fileEntry.watermark_options[opt[1]] : opt[2];
    }
    if (dataObj.watermark_text.toLowerCase() === 'default')
      dataObj.watermark_text = req.user.data.email
    formData.append('encrypted_files.zip', fs.createReadStream(fileEntry.fPath));
    formData.append('data', JSON.stringify(dataObj));
    
    const response = await axios.post(`${pythonURL}/decrypt`, formData, {
      headers: {
        ...formData.getHeaders()
      },
      responseType: 'arraybuffer'
    });
    const contentType = response.headers['content-type'];
    const contentDisposition = response.headers['content-disposition'];
  
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': contentDisposition,
    });
  
    res.send(response.data);
  } catch (error) {
    console.log('Error accessing file:', error);
    res.json({ success: false, msg: 'Error accessing file' });
  }
});

app.post('/api/search', authenticateJWT, async (req, res) => {
  var { collection, query, method } = req.body,
    result = await db.search(collection, query, method)
    return res.json(result)
})

app.post('/api/updateProfile', authenticateJWT, async (req, res) => {
  let { newEmail, newName, newProfPic } = req.body
  const updateFields = {};
  console.log(req.user.data)
  if (newEmail && newEmail.trim() !== "" && newEmail !== req.user.data.email) updateFields.email = newEmail.trim();
  if (newName && newName.trim() !== "") updateFields.name = newName.trim();


  if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ msg: "No valid fields to update" });
  }

  try {
    const checkAvail = await db.search("Users", {
      email: newEmail
    }, "findOne")

    if (checkAvail.success && checkAvail.result) {
      return res.status(400).json({ msg: "Email is already linked with another account." });
    }

    console.log(updateFields)
    console.log(req.user.data)

    const response = await db.search("Users", {
        _id: req.user.data._id
    }, 'findOneAndUpdate', { $set: updateFields });
    console.log("ipdate prof", response)
    return res.json({ update: updateFields, userUpdate: response});
  } catch (error) {
      return res.status(500).json({ msg: "Database update failed" });
  }
})

app.post('/api/forgotPassword', async (req, res) => {
  const { email } = req.body,
    chkE = await db.search('Users', { email: email }, 'findOne')

  if (!chkE.success || !chkE.result)
    return res.status(401).json({ success: false, message: "Couldn't find the user." })
  
  var prevReq = await db.search('otp', {
    email: email,
    type: "forgotPass"
  }, 'findOne')

  if (prevReq.success) {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    if (new Date(prevReq.result.createdAt) > oneMinuteAgo) {
        res.status(401).json({ success: false, message: "OTP was created less than a minute ago."})
        return
    }
  }
  
  let otp = otpGen.generate(6, { specialChars: false })

  try {
    var hashedOTP = await bcrypt.hash(otp, 10)
    
    var sendotp = await h.sendMail({
      to: email,
      subject: 'Forgot Password - OTP',
      text: `Your OTP for resetting password: ${otp}`,
      content: `<p>Hi ${chkE.result.name || "User"},</p>
      <p>Use the OTP below to Reset Password:</p>
      <div class="otp">${otp}</div>
      <p>This OTP is valid for the next 5 minutes. Please do not share it with anyone.</p>`
    })
    if (!sendotp.success) {
      alert(sendotp.msg || "Couldn't send otp at the moment. \nTry again later.")
    }
    await db.add('otp', { email: email, otp: hashedOTP, type: "forgotPass" })
    res.status(200).json(sendotp);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ success: false, message: "Server error." });
  }
})

app.get('/api/forgotPassword/:otp', async (req, res) => {
  const { otp } = req.params;
  const { email, newPassword } = req.query;

  try {
    var storedOtp = await db.search('otp', { email: email, type: "forgotPass" }, 'findOne')
    
    if (!storedOtp) {
      return res.status(400).json({ success: false, msg: "OTP has expired or is invalid." });
    }

    var checkOTP = await bcrypt.compare(otp, storedOtp.result.otp)
    
    if (!checkOTP) {
      return res.status(401).json({ success: false, msg: "Invalid OTP." });
    }
    await db.remove('otp', { email: email }, 'multiple')

    var newHashedPassword = await bcrypt.hash(newPassword, 10),
      response = await db.search('Users', { email: email }, 'findOneAndUpdate', {
      password: newHashedPassword
    })
    if (response.success)
      return res.status(200).json({ success: true, msg: "Updated Password Successfully." });
    return res.status(400).json({ success: false, msg: "Server error. \nTry again later." });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ success: false, msg: "Server error." });
  }
})

const deleteExpiredFiles = async () => {
  const date = new Date(),
        today = date.toISOString(),
        expiredFiles = await db.search('Files', { expiry: { $lt: today } }, 
          'updateMany', {  status: 'Expired' }
        )
    // var user = await db.addUser('Tobey', 'tobey@gmail.com', '123')
    // console.log(user)
    // var user = await db.addUser('Brock', 'brock@gmail.com', '123')
    // console.log(user)
    // var user = await db.addUser('Ash', 'ash@gmail.com', '123')
    // console.log(user)
    // var user = await db.addUser('test', 'hail@gmail.com', '123')
    // console.log(user)
    if (Array.isArray(expiredFiles) && expiredFiles.length > 0) {
      for (const file of expiredFiles) {
        if (fs.existsSync(file.fPath)) fs.unlinkSync(file.fPath);
        console.log(`File ${file.fName} deleted due to expiration.`);
      }
    }
};

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
