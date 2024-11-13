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
const FormData = require('form-data');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

const pythonURL = 'http://127.0.0.1:5000'

const db = new class {
  constructor() {
    h.BM(this, ["schemas", "addUser", "search", "newSession", "addFile", "remove"])
    mongoose.connect(mongoURI).then(() => {
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
      to: [{ 
        email: String, 
        views: { type: Number, default: 0 }
      }],
      fPath: String,
      fName: String,
      fileHash: String,
      rView: { type: Boolean, default: true },
      maxViews: { type: Number, default: 2 },
      expiry_date: String,
      expiry_time: String,
      active: { type: Boolean, default: true }
    })

    // to: [{ 
    //   email: String, 
    //   views: { type: Number, default: 0 }
    // }],

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

  async addFile(fEntry) {
    try {
      var savedFileEntry = await this.Files.create(fEntry);
      if (savedFileEntry) {
        console.log("saved entry: ", savedFileEntry)
        return { success: true, file: savedFileEntry, msg: "File shared successfully." }
      }
        
      return { success: false, msg: "Failed to share file." }
    } catch (err) {
        console.error("Error adding file: ", err);
        return { success: false, msg: "Cannot share file at the moment." };
    }
  }

  async newSession(email, name) {
    try {
      var jTn = jwt.sign({ email }, JWT_SECRET, { expiresIn: '15m' }),
        session = await this["Session"].create({
                    email: email,
                    token: jTn
                  })
      return { success: true, session: { name: name, email: session.email, token: session.token } };
    } catch (err) {
      console.log("Error Creating Session: ", err)
      return { success: false }
    }
  }

  async search(collection, query, method, update = null, options = {}) {
    var model = this[collection];
    method = method ? ["find", "findOne", "findOneAndUpdate", "updateMany"].includes(method) ? method : "find" : "find";
    let result;
    
    if (!model) throw new Error("Invalid collection name");
    console.log("searching from: ", query);

    try {
        if (method === "find") {
            result = await model.find(query).sort({ timestamp: -1 });
        } else if (method === "findOne") {
            result = await model.findOne(query).sort({ timestamp: -1 });
        } else if (method === "findOneAndUpdate") {
            result = await model.findOneAndUpdate(query, update, { ...options, new: true });
            console.log("updated: ", result);
        } else if (method === "updateMany") {
            result = await model.updateMany(query, update, options);
            console.log("updated many: ", result);
        }

        if ((method === "find" && result.length === 0) || (method !== "find" && !result)) {
            console.log("No results found");
            return { success: false };
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
    console.log("removing from: ", query)
    try {
      if (method === "single") {
          result = await model.deleteOne(query);
      } else if (method === "multiple") {
          result = await model.deleteMany(query);
      }

      if ((method === "multiple" && result.deletedCount === 0) || (method !== "multiple" && result.deletedCount !== 1)) {
          console.log("No results found");
          return { success: false };
      }
      return { success: true, result: result}
    } catch (err) {
        console.error("Error removing: ", err);
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
  let pass;

  if (!user.success || !user.result || !user.result.password ) {
    return res.json({ success: false, msg: 'Invalid credentials.' });
  }

  pass = await bcrypt.compare(password, user.result.password);
  if (!pass) {
    return res.json({ success: false, msg: 'Invalid credentials.' });
  }

  var s = await db.newSession(email, user.result.name);
  
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

app.post('/encrypt', authenticateJWT, upload.single('file'), async (req, res) => {
  const file = req.file,
        data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data,
        tempFilePath = file.path,
        formData = new FormData()
// {
  //   "layers": 1,
  //   "selected_algos": ["aes128","aes256"],
  //   "all_passphrases": ["ASDFGHJKL:","QWERTYUIOP"],
  //   "filename":"0101"
  // }
  if (!file || !data.selected_algos || !data.all_passphrases || !data.filename) {
    return res.status(201).json({ success:false, msg: "Missing required fields." });
  }

  formData.append('original_pdf', fs.createReadStream(tempFilePath));
  formData.append('data', JSON.stringify(data));
  
  try {
    const response = await axios.post('http://127.0.0.1:5000/encrypt', formData, {
      headers: {
        ...formData.getHeaders()
      },
      responseType: 'arraybuffer'
    });

    const encryptedFilePath = path.join(encryptedPath, `${file.filename}_encrypted.zip`)

    fs.writeFileSync(encryptedFilePath, response.data)

    console.log(`Encrypted file saved at: ${encryptedFilePath}`)

    res.status(201).json({
      success: true,
      message: "File encrypted successfully",
      encryptedFilePath: encryptedFilePath
    });
  } catch (error) {
    console.error("Error encrypting PDF:", error);
    res.status(500).json({ success: false, message: "Failed to encrypt PDF" });
  } finally {
    fs.unlinkSync(tempFilePath)
  }
})

app.post('/upload', authenticateJWT, async (req, res) => {
  const { from, fileName, to } = req.body,
      sTo = to.map(user => user.email),
      eFile = await db.search("Files", { fName: fileName, from: from, to: { $elemMatch: { email: { $in: sTo } } }, active: true }),
      otherData = req.body

  for (let u of to) {
    const userCheck = await db.search('Users', { email: u.email });
    if (!userCheck.success) {
      return res.status(201).json({ success: false, msg: `Given user ${u.email} does not exist.` });
    }
  }

  // const userCheck = await db.search('Users', { email: { $in: userEmails } });

  // if (userCheck.success && userCheck.result.length !== userEmails.length) {
  //   const missingEmails = userEmails.filter(email => !userCheck.result.some(u => u.email === email));
  //   return res.status(400).json({ success: false, msg: `Given user(s) ${missingEmails.join(', ')} do not exist.` });
  // }
  
  if (eFile.success) {
    return res.status(201).json({ success: false, msg: 'Given Filename is active currently. Change it to share.' });
  }
  
  if (!fileName || !from || !to) {
    return res.status(201).json({ success: false, msg: 'File, from, and to are required' });
  }

  try {
    var filehash = await generateFileHash(otherData.filePath),
        fileEntry = {
          from: from,
          to: to,
          fName: fileName,
          fPath: otherData.filePath,
          fileHash: filehash,
          expiry_date: otherData.expiry_date,
          expiry_time: otherData.expiry_time,
        },
        result = await db.addFile(fileEntry)
    console.log(fileEntry)
    res.status(201).json(result);
  } catch (err) {
    console.log(err)
    res.status(500).json({ msg: 'Error saving file entry to database' });
  }
});

app.post('/check', authenticateJWT, (req, res) => {
  res.json({
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

app.post('/receiver', authenticateJWT, async (req, res) => {
  const { receiver } = req.query; 

  if (!receiver) {
    return res.status(400).json({ success: false, msg: 'Username is required' });
  }

  try {
    const filesForUser = await db.search('Files', { to: { $elemMatch: { email: receiver } } });
    res.status(200).json(filesForUser);
  } catch (error) {
    res.status(500).json({ success: false, msg: 'Error fetching entries', error });
  }
});

app.get('/decrypt', authenticateJWT, upload.single('encrypted_zip'), async (req, res) => {
  var otherData = req.body.data
  if (!req.file || !otherData.selected_algos || !otherData.all_passphrases || !otherData.filename) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const formData = new FormData();
  formData.append('encrypted_files.zip', fs.createReadStream(req.file.path));
  formData.append('data', JSON.stringify({
    selected_algos: JSON.parse(selected_algos),
    all_passphrases: JSON.parse(all_passphrases),
    filename: filename
  }));

  try {
    const response = await axios.post('http://127.0.0.1:5000/decrypt', formData, {
      headers: {
        ...formData.getHeaders()
      },
      responseType: 'arraybuffer'
    });

    fs.unlinkSync(req.file.path);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}_decrypted_file.pdf`);
    res.send(response.data);

  } catch (error) {
    console.error("Error decrypting PDF:", error);
    res.status(500).json({ error: "Failed to decrypt PDF" });
  }
})

app.post('/download/:filename', authenticateJWT, async (req, res) => {
  const { filename } = req.params;
  const { from, to } = req.body;

  if (!from || !to) {
    return res.status(400).json({ success: false, msg: 'Both "from" and "to" fields are required' });
  }

  try {
    let fileEntry = await db.search('Files', { fName: filename, from: from, to: { $elemMatch: { email: to } } }, 'findOne');

    if (!fileEntry.success || !fileEntry.result) {
      return res.json({ success: false, msg: 'File not found or access denied' });
    }
    fileEntry = fileEntry.result

    if (fileEntry.rView) {
      const userIndex = fileEntry.to.findIndex(entry => entry.email === to);
      if (userIndex === -1) {
        return res.json({ success: false, msg: "User not authorized to access this file." });
      }
    
      if (fileEntry.to[userIndex].views < fileEntry.maxViews) {
        var upd = await db.search(
          'Files', 
          { _id: fileEntry._id, "to.email": to }, 
          "findOneAndUpdate", 
          { $inc: { "to.$.views": 1 } }
        );
      } else {
        return res.json({ success: false, msg: "Max Views Reached." });
      }
    }

    const filePath = fileEntry.fPath;
    res.download(filePath, filename, (err) => {
      if (err) {
        console.log('Error downloading file:', err);
        res.status(500).json({ success: false, msg: 'Error downloading file' });
      }
    });
  } catch (error) {
    console.log('Error accessing file:', error);
    res.json({ success: false, msg: 'Error accessing file' });
  }
});

app.post('/search', authenticateJWT, async (req, res) => {
  var { collection, query, method } = req.body,
    result = await db.search(collection, query, method)
    return res.json(result)
})

const deleteExpiredFiles = async () => {
  const date = moment().format('DD-MM-YYYY'),
        time = moment().format('HH:mm'),
        expiredFiles = await db.search('Files', {
            $or: [
              { expiry_date: { $lt: date } },
              { 
                expiry_date: date,
                expiry_time: { $lt: time }
              }
            ]
          }, 'updateMany', {  active: false }
        )
  console.log("Expired files update result:", expiredFiles);
  // for (const file of expiredFiles) {
    // if (fs.existsSync(file.fPath)) fs.unlinkSync(file.fPath);
    // console.log(`File ${file.fName} deleted due to expiration.`);
  // }
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

