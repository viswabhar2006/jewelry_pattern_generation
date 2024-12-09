const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const passport = require('passport');
const session = require('express-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(session({ secret: 'your_secret_key', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
// JWT Secret Key
const SECRET_KEY = 'your_secret_key';

// Connect to MongoDB Atlas
const mongoURI = 'mongodb+srv://root:root@cluster0.6oopo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Connect to MongoDB
mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 20000, // Increase timeout to 20 seconds
}).then(() => {
    console.log('MongoDB connected successfully');
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit the process with failure
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access denied' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// User schema and model
const userSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true },
        phone: { type: String, required: true },
        username: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        images: [
            {
                filename: { type: String },
                contentType: { type: String },
                data: { type: String }, // Base64-encoded image data
            },
        ],
    },
    { timestamps: true }
);

const User = mongoose.model('User', userSchema);

// Passport serialization
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Multer storage setup for local uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir); // Save files to uploads directory
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`); // Rename file with timestamp
    }
});

const upload = multer({ storage });

// Google OAuth configuration
passport.use(
    new GoogleStrategy(
        {
            clientID: '967401921999-fj7rkao4ug77akp2po8ggfo948d6eeaa.apps.googleusercontent.com',
            clientSecret: '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',
            callbackURL: 'http://localhost:3001/auth/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({ email: profile.emails[0].value });
                if (!user) {
                    user = await User.create({
                        // fullName: profile.displayName || 'Unnamed',
                        email: profile.emails[0]?.value || 'noemail@google.com',
                        username: profile.id,
                    });
                }
                return done(null, user);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

// GitHub OAuth configuration
passport.use(
    new GitHubStrategy(
        {
            clientID: 'Ov23liaFsoMahmTV8nfY',
            clientSecret: 'd0cc782dddef5eb24f50787fc4628280e423f0db',
            callbackURL: 'http://localhost:3001/auth/github/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({ username: profile.username });
                if (!user) {
                    user = await User.create({
                        // fullName: profile.displayName || profile.username,
                        email: `${profile.username}@github.com`, // GitHub may not provide an email
                        username: profile.username,
                    });
                }
                return done(null, user);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

// linkedin OAuth configuration
passport.use(
    new LinkedInStrategy(
      {
        clientID: '77hz5g9euo83j0',
        clientSecret: 'WPL_AP1.rrnlYvDMOgBXTNII.toayqQ==',
        callbackURL: 'http://localhost:3001/auth/linkedin/callback',
        scope: ['r_liteprofile', 'r_emailaddress', 'openid', 'profile', 'email']
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ email: profile.emails[0].value });
          if (!user) {
            user = await User.create({
            //   fullName: profile.displayName,
              email: profile.emails[0].value,
              username: profile.id,
            });
          }
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );

// OAuth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get(
    '/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        const token = jwt.sign({ id: req.user.id }, SECRET_KEY, { expiresIn: '1h' });
        res.redirect(`http://localhost:3000?token=${token}`);
    }
);

app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
app.get(
    '/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/login' }),
    (req, res) => {
        const token = jwt.sign({ id: req.user.id }, SECRET_KEY, { expiresIn: '1h' });
        res.redirect(`http://localhost:3000?token=${token}`);
    }
);

app.get('/auth/linkedin', passport.authenticate('linkedin', { scope: ['r_liteprofile', 'r_emailaddress', 'openid', 'profile', 'email'] }));
app.get(
    '/auth/linkedin/callback',
    passport.authenticate('linkedin', { failureRedirect: '/login' }),
    (req, res) => {
        const token = jwt.sign({ id: req.user.id }, SECRET_KEY, { expiresIn: '1h' });
        res.redirect(`http://localhost:3000?token=${token}`);
    }
);

// Routes
app.post('/create', async (req, res) => {
    try {
        const { email, phone, username, password } = req.body;
        if ( !email || !phone  || !username || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({  email, phone, username, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'Account created successfully' });
    } catch (error) {
        console.error('Error in /create route:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user._id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
        res.status(200).json({ message: 'Login successful', token, user: { username: user.username} });
    } catch (error) {
        console.error('Error in /login route:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        console.error('Error in /profile route:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Upload image to local filesystem
app.post('/upload', authenticateToken, upload.array('imageInput', 5), async (req, res) => {
    try {
        console.log('Files received:', req.files);

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        const imageArray = req.files.map((file) => ({
            filename: file.originalname,
            contentType: file.mimetype,
            data: fs.readFileSync(file.path, { encoding: 'base64' }),
        }));
        console.log('Image array:', imageArray);

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('User before update:', user);
        user.images.push(...imageArray);
        await user.save();
        console.log('User after update:', user);

        req.files.forEach((file) => fs.unlinkSync(file.path)); // Clean up local files

        res.status(201).json({ message: 'Images uploaded and stored successfully', images: user.images });
    } catch (error) {
        console.error('Error in /upload route:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
});


// Fetch uploaded image
app.get('/image/:filename', async (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);
    
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) return res.status(404).json({ message: 'Image not found' });

        res.sendFile(filePath);
    });
});

// Process image using Flask server
app.post('/process-image', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image uploaded' });
        }

        const flaskResponse = await axios.post(
            'http://localhost:5000/process-image',
            req.file.buffer,
            {
                headers: { 'Content-Type': 'image/png' },
                responseType: 'arraybuffer',
            }
        );

        res.set('Content-Type', 'image/png');
        res.send(flaskResponse.data);

    } catch (error) {
        console.error('Error processing image:', error.message);
        res.status(500).json({ message: 'Error processing image' });
    }
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
