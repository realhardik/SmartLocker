const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const moment = require('moment');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// JWT secret key
const JWT_SECRET = 'your_jwt_secret_key';

// // MongoDB connection
// mongoose.connect('mongodb://localhost:27017/user_db', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
// }).then(() => console.log('Connected to MongoDB'))
//   .catch(err => console.error('MongoDB connection error:', err));


// Connect to MongoDB Atlas
// const mongoURI = 'mongodb+srv://<username>:<password>@cluster0.mongodb.net/user_db?retryWrites=true&w=majority';
const mongoURI = 'mongodb+srv://harshchan02:rlFWyv0f22LD5rHJ@cluster0.irubh1u.mongodb.net/smart_locker?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB Atlas');
}).catch(err => {
  console.error('MongoDB Atlas connection error:', err);
});


// MongoDB Schemas and Models
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
});

const sessionSchema = new mongoose.Schema({
  email: String,
  last_keepalive: Date,
  login_time: Date,
  is_online: Boolean,
});

const chatHistory = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  from: String,
  to: String,
  content: String
})

const fileLog = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  from: String,
  to: String,
  fPath: String,
  fName: String,
  expiry_date: Date
})

const User = mongoose.model('User', userSchema);
const File = mongoose.model('fileLogs', fileLog);
const Session = mongoose.model('Session', sessionSchema);
const chat = mongoose.model('chatHistory', chatHistory);

// User Signup
app.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email: email });
    console.log(existingUser)
    if (existingUser) return res.status(409).json({ success: false, msg: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ success: true, msg: 'User created successfully' });
  } catch (err) {
    console.log("error signing up: ", err)
  }
});

// User Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email });
  var pass = await bcrypt.compare(password, user.password)
  if (!user || !pass) {
    return res.status(401).json({ msg: 'Invalid credentials' });
  }

  const accessToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '15m' });
  await new Session({
    email,
    last_keepalive: new Date(),
    login_time: new Date(),
    is_online: true
  }).save();

  res.status(200).json({ accessToken });
});

const uploadFolder = path.join(__dirname, 'uploads');
const upload = multer();

app.post('/upload', upload.single('file'), async (req, res) => {
  var { from, to } = req.body; 
  var file = req.file
  if (!file || !from || !to) {
    return res.status(400).json({ msg: 'File, from, and to are required' });
  }

  const filePath = path.join(uploadFolder, file.originalname);
  const fileEntry = {
    fName: file.originalname,
    fPath: filePath,
    from: from,
    to: to,
    expiry_date: moment().add(24, 'hours').toDate(),
  };
  console.log(fileEntry)
  try {
    fs.writeFileSync(filePath, file.buffer);
    const savedFileEntry = await File.create(fileEntry);
    res.status(201).json({ msg: 'File uploaded successfully' });
  } catch (error) {
    console.log(error)
    res.status(500).json({ msg: 'Error saving file entry to database' });
  }
});

app.get('/receiver', async (req, res) => {
  const { receiver } = req.query; 

  if (!receiver) {
    return res.status(400).json({ msg: 'Username is required' });
  }

  try {
    const filesForUser = await File.find({ to: receiver });
    console.log(receiver)
    console.log(await File.find({ }))
    res.status(200).json(filesForUser);
  } catch (error) {
    res.status(500).json({ msg: 'Error fetching entries', error });
  }
});

app.get('/download/:filename', async (req, res) => {
  const { filename } = req.params;
  const { from, to } = req.body;

  if (!from || !to) {
    return res.status(400).json({ msg: 'Both "from" and "to" fields are required' });
  }

  try {
    const fileEntry = await File.findOne({ filename, sender: from, to: { $in: [to] } });
    
    if (!fileEntry) {
      return res.status(404).json({ msg: 'File not found or access denied' });
    }

    const filePath = path.join(uploadFolder, filename);

    res.download(filePath, filename, (err) => {
      if (err) {
        res.status(500).json({ msg: 'Error downloading file', error: err });
      }
    });
  } catch (error) {
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
// Logout
app.post('/logout', async (req, res) => {
  const email = req.user.email;
  await Session.updateOne({ email }, { is_online: false });
  res.status(200).json({ msg: 'Logout successful' });
});

// Periodic Cleanup Tasks
const checkKeepalive = async () => {
  const now = new Date();
  const expiredSessions = await Session.find({
    is_online: true,
    last_keepalive: { $lt: new Date(now - 3 * 60 * 1000) }
  });

  for (const session of expiredSessions) {
    await Session.updateOne({ email: session.email }, { is_online: false });
    console.log(`User ${session.email} logged out due to inactivity.`);
  }
};

const deleteExpiredFiles = async () => {
  const now = new Date();
  const expiredFiles = await File.find({ expiry_date: { $lt: now } });

  for (const file of expiredFiles) {
    if (fs.existsSync(file.file_path)) fs.unlinkSync(file.file_path);
    await File.deleteOne({ _id: file._id });
    console.log(`File ${file.filename} deleted due to expiration.`);
  }
};

// Start periodic tasks
// setInterval(checkKeepalive, 60 * 1000);  // Check every 1 minute
setInterval(deleteExpiredFiles, 60 * 60 * 1000);  // Check every 1 hour

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
