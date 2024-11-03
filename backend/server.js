const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const moment = require('moment');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cors());

const h = {
  BM: (r, e) => {
    var s = e.length;
    for (let t = 0; t < s; t++)
        r[e[t]] = r[e[t]].bind(r)
  }
}

const JWT_SECRET = 'your_jwt_secret_key';

const mongoURI = 'mongodb+srv://harshchan02:rlFWyv0f22LD5rHJ@cluster0.irubh1u.mongodb.net/smart_locker?retryWrites=true&w=majority&appName=Cluster0';

const db = new class {
  constructor() {
    mongoose.connect(mongoURI).then(() => {
      console.log('Connected to MongoDB Atlas');
    }).catch(err => {
      console.error('MongoDB Atlas connection error:', err);
    });
    h.BM(this, ["schemas", "addUser", "search", "newSession"])
    this.schemas()
  }

  schemas() {
    this.userSchema = new mongoose.Schema({
      created_at: { type: Date, default: Date.now },
      name: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true }
    });
    
    this.sessionSchema = new mongoose.Schema({
      login_time: { type: Date, default: Date.now },
      email: { type: String, required: true },
      token: { type: String, required: true }
    });
    
    this.chatHistory = new mongoose.Schema({
      timestamp: { type: Date, default: Date.now },
      from: String,
      to: String,
      type: { type: String, enum: ["file", "text"], default: "text"},
      content: String
    })
    
    this.fileLog = new mongoose.Schema({
      timestamp: { type: Date, default: Date.now },
      from: String,
      to: String,
      fPath: String,
      fName: String,
      fileHash: String,
      rView: { type: Boolean, default: false },
      cViews: { type: Number, default: -1 },
      maxViews: { type: Number, default: -1 },
      expiry_date: String,
      expiry_time: String,
      active: { type: Boolean, default: true }
    })

    this.Users = mongoose.model('user', this.userSchema)
    this.Files = mongoose.model('fileLogs', this.fileLog)
    this.Session = mongoose.model('session', this.sessionSchema)
    this.chat = mongoose.model('chatHistory', this.chatHistory)
  }
  
  async addUser(name, email, pass) {
    var exists = await this.search('Users', { email: email }, 'findOne')
    if (exists.success)
      return { success: false, msg: "User Already Exists." }
    try {
        var hashedPassword = await bcrypt.hash(pass, 10),
            newUser = await this["Users"].create({ name, email, password: hashedPassword })
        return { success: true, user: newUser, msg: "User created Successfully." };
    } catch (err) {
        console.error("Error adding user: ", err);
        return { success: false, msg: "Failed to add user." };
    }
  }

  async addFile(fPath, fBuff, fEntry) {
    try {
      var savedFileEntry = await this.Files.create(fEntry);
      if (savedFileEntry)
        return { success: true, file: savedFileEntry, msg: "File saved successfully." }
      return { success: false, msg: "Failed to save file." }
    } catch (err) {
        console.error("Error adding file: ", err);
        return { success: false, msg: "Cannot save file at the moment." };
    }
  }

  async newSession(email) {
    try {
      var jTn = jwt.sign({ email }, JWT_SECRET, { expiresIn: '15m' }),
        session = await this["Session"].create({
                    email: email,
                    token: jTn
                  })
      return { success: true, session: session };
    } catch (err) {
      console.log("Error Creating Session: ", err)
      return { success: false }
    }
  }

  async search(collection, query, method) {
    var model = this[collection]
        method = method ? ["find", "findOne"].includes(method) ? method : "find" : "find"
    console.log(this.Users)
    let result;
    if (!model) throw new Error("Invalid collection name");
    try {
      if (method === "find") {
          result = await model
                    .find(query)
                    .sort({ timestamp: -1 });
      } else if (method === "findOne") {
          result = await model
                    .findOne(query).sort({ timestamp: -1 })
              // .find(query).sort({ timestamp: -1 }).limit(1);
      }
      if ((method === "find" && result.length === 0) || (method === "findOne" && !result)) {
        console.log("No results found")  
        return { success: false };
      }
      return { success: true, result: result}
    } catch (err) {
        console.error("Error searching: ", err);
        return { success: false };
    }
  }
}

app.post('/signup', async (req, res) => {
  try {
    var { name, email, password } = req.body,
        user = await db.addUser(name, email, password)
      console.log(user)
    return res.json(user)
  } catch (err) {
    console.log("error signing up: ", err)
    return res.json({ success: false, msg: "Error signing up."})
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await db.search('Users', { email: email }, 'findOne')
  console.log(user)
  let pass;

  if (user.success) {
    pass = await bcrypt.compare(password, user.result.password)
  }

  if (!user.success || !pass) {
    return res.json({ success: false,msg: 'Invalid credentials.' });
  }

  var s = await db.newSession(email);
  console.log(s)
  if (s.success)
    return res.status(200).json(s);
  return res.json(s)
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
const upload = multer();

app.post('/upload', authenticateJWT, upload.single('file'), async (req, res) => {
  var { from, to } = req.body,
      file = req.file,
      eFile = await db.search("Files", { fName: file.originalname })
    
  if (eFile.success) {
    for (var f = 0; f<eFile.result.length; f++) {
      if (eFile.result[f].active) {
        return res.status(400).json({ msg: 'Given Filename is active currently. Change it to share.' });
      }
    }
  }

  if (!file || !from || !to) {
    return res.status(400).json({ msg: 'File, from, and to are required' });
  }

  var filePath = path.join(uploadFolder, file.originalname)
  try {
    await fs.promises.writeFile(filePath, file.buffer);
    var filehash = await generateFileHash(filePath),
        fileEntry = {
          from: from,
          to: to,
          fName: file.originalname,
          fPath: filePath,
          fileHash: filehash,
          expiry_date: moment().format('DD-MM-YYYY'),
          expiry_time: moment().format('HH:mm'),
        },
        result = await db.addFile(fileEntry)
    res.status(201).json(result);
  } catch (err) {
    console.log(err)
    res.status(500).json({ msg: 'Error saving file entry to database' });
  } 
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

app.get('/receiver', authenticateJWT, async (req, res) => {
  const { receiver } = req.query; 

  if (!receiver) {
    return res.status(400).json({ msg: 'Username is required' });
  }

  try {
    const filesForUser = await db.search('Files', { to: { $in: [receiver] } });
    res.status(200).json(filesForUser);
  } catch (error) {
    res.status(500).json({ msg: 'Error fetching entries', error });
  }
});

app.get('/download/:filename', authenticateJWT, async (req, res) => {
  const { filename } = req.params;
  const { from, to } = req.body;

  if (!from || !to) {
    return res.status(400).json({ msg: 'Both "from" and "to" fields are required' });
  }

  if (!fileEntry.success || !fileEntry.result) {
    return res.status(404).json({ msg: 'File not found or access denied' });
  }

  try {
    const fileEntry = await db.search('Files', { fName: filename, from: from, to: { $in: [to] } }, 'findOne');

    if (!fileEntry.success || !fileEntry.result) {
      return res.status(404).json({ msg: 'File not found or access denied' });
    }

    const filePath = fileEntry.result.fPath;
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        res.status(500).json({ msg: 'Error downloading file', error: err });
      }
    });
  } catch (error) {
    console.error('Error accessing file:', error);
    res.status(500).json({ msg: 'Error accessing file', error });
  }
});


// Download File
// app.get('/download/:filename', authenticateJWT, async (req, res) => {
//   const { filename } = req.params;
//   const receiver = req.user.email;
//   const file = await File.findOne({ filename });

//   if (!file) return res.status(404).json({ msg: 'File not found or expired' });
//   if (!file.pending_receivers.includes(receiver)) {
//     return res.status(403).json({ msg: 'You do not have permission to download this file' });
// }

//   // Mark receiver as having downloaded the file
//   await File.updateOne({ filename }, {
//     $addToSet: { satisfied_receivers: receiver },
//     $pull: { pending_receivers: receiver }
//   });

//   // Delete the file if all receivers have downloaded
//   // const updatedFile = await File.findOne({ filename });
//   // if (updatedFile.pending_receivers.length === 0) {
//   //   fs.unlinkSync(file.file_path);
//   //   await File.deleteOne({ filename });
//   // }
//   console.log(`User ${receiver} downloaded the file ${filename}.`);

//   res.download(file.file_path); 
// });

// const deleteExpiredFiles = async () => {
//   const now = new Date();
//   const expiredFiles = await File.find({ expiry_date: { $lt: now } });

//   for (const file of expiredFiles) {
//     if (fs.existsSync(file.file_path)) fs.unlinkSync(file.file_path);
//     await File.deleteOne({ _id: file._id });
//     console.log(`File ${file.filename} deleted due to expiration.`);
//   }
// };

// setInterval(deleteExpiredFiles, 60 * 60 * 1000);  // Check every 1 hour

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
