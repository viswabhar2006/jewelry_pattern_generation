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
        fullName: { type: String, required: true },
        email: { 
            type: String, 
            required: true, 
            unique: true,
            lowercase: true,
            trim: true
        },
        phone: { type: String, required: false },
        username: { 
            type: String, 
            required: true, 
            unique: true,
            lowercase: true,
            trim: true
        },
        password: { type: String, required: false },
        // New OAuth-specific fields
        oauthProviders: [{
            provider: {
                type: String,
                enum: ['google', 'github', 'linkedin']
            },
            providerId: String,
            accessToken: String
        }],
        profilePicture: { 
            type: String, 
            default: null 
        },
        lastLogin: { 
            type: Date, 
            default: Date.now 
        },
        isVerified: {
            type: Boolean,
            default: false
        }
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

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploaded');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true }); // recursive ensures parent directories are created if needed
}

// Multer storage setup for local uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir); // Save files to 'uploaded' directory
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`); // Rename file with timestamp
    }
});

const upload = multer({ storage });

// Google OAuth Strategy
passport.use(
    new GoogleStrategy(
        {
            clientID: '967401921999-fj7rkao4ug77akp2po8ggfo948d6eeaa.apps.googleusercontent.com',
            clientSecret: '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',
            callbackURL: 'http://localhost:3001/auth/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // More comprehensive user creation/update
                let user = await User.findOne({ 
                    $or: [
                        { email: profile.emails[0].value },
                        { 'oauthProviders.providerId': profile.id }
                    ]
                });

                const userDetails = {
                    fullName: profile.displayName || 'Unnamed',
                    email: profile.emails[0]?.value || 'noemail@google.com',
                    username: profile.id, // Consider making this more unique
                    isVerified: profile.emails[0]?.verified || false
                };

                if (!user) {
                    // Create new user
                    user = new User({
                        ...userDetails,
                        oauthProviders: [{
                            provider: 'google',
                            providerId: profile.id,
                            accessToken
                        }]
                    });
                } else {
                    // Update existing user
                    user.lastLogin = new Date();
                    
                    // Check if Google provider already exists
                    const googleProviderIndex = user.oauthProviders.findIndex(
                        p => p.provider === 'google'
                    );

                    if (googleProviderIndex !== -1) {
                        // Update existing provider
                        user.oauthProviders[googleProviderIndex].accessToken = accessToken;
                    } else {
                        // Add new OAuth provider
                        user.oauthProviders.push({
                            provider: 'google',
                            providerId: profile.id,
                            accessToken
                        });
                    }

                    // Update other user details
                    Object.assign(user, userDetails);
                }

                await user.save();
                return done(null, user);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

// GitHub OAuth Strategy
passport.use(
    new GitHubStrategy(
        {
            clientID: 'Ov23liaFsoMahmTV8nfY',
            clientSecret: 'd0cc782dddef5eb24f50787fc4628280e423f0db',
            callbackURL: 'http://localhost:3001/auth/github/callback',
            scope: ['user:email'], // Request user email
            passReqToCallback: true
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                // Find existing user
                let user = await User.findOne({ 
                    $or: [
                        { email: profile.emails?.[0]?.value },
                        { 'oauthProviders.providerId': profile.id }
                    ]
                });

                const userDetails = {
                    fullName: profile.displayName || profile.username || 'Unnamed GitHub User',
                    email: profile.emails?.[0]?.value || `${profile.username}@github.com`,
                    username: profile.username, // GitHub username
                    profilePicture: profile.photos?.[0]?.value || null,
                    isVerified: !!profile.emails?.[0]?.value
                };

                if (!user) {
                    // Create new user
                    user = new User({
                        ...userDetails,
                        oauthProviders: [{
                            provider: 'github',
                            providerId: profile.id,
                            accessToken
                        }]
                    });
                } else {
                    // Update existing user
                    user.lastLogin = new Date();
                    
                    // Check if GitHub provider already exists
                    const githubProviderIndex = user.oauthProviders.findIndex(
                        p => p.provider === 'github'
                    );
                    if (githubProviderIndex !== -1) {
                        // Update existing provider
                        user.oauthProviders[githubProviderIndex].accessToken = accessToken;
                    } else {
                        // Add new OAuth provider
                        user.oauthProviders.push({
                            provider: 'github',
                            providerId: profile.id,
                            accessToken
                        });
                    }
                    
                    // Update other user details
                    Object.assign(user, userDetails);
                }

                await user.save();
                return done(null, user);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

// LinkedIn OAuth Strategy
passport.use(
    new LinkedInStrategy(
        {
            clientID: '77hz5g9euo83j0',
            clientSecret: 'WPL_AP1.rrnlYvDMOgBXTNII.toayqQ==',
            callbackURL: 'http://localhost:3001/auth/linkedin/callback',
            scope: ['r_emailaddress', 'r_liteprofile'], // Request email and basic profile
            passReqToCallback: true
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                // Find existing user
                let user = await User.findOne({ 
                    $or: [
                        { email: profile.emails[0]?.value },
                        { 'oauthProviders.providerId': profile.id }
                    ]
                });

                const userDetails = {
                    fullName: profile.displayName || 'Unnamed LinkedIn User',
                    email: profile.emails[0]?.value || 'noemail@linkedin.com',
                    username: profile.id, // Consider making this more unique
                    isVerified: !!profile.emails[0]?.value
                };

                if (!user) {
                    // Create new user
                    user = new User({
                        ...userDetails,
                        oauthProviders: [{
                            provider: 'linkedin',
                            providerId: profile.id,
                            accessToken
                        }]
                    });
                } else {
                    // Update existing user
                    user.lastLogin = new Date();
                    
                    // Check if LinkedIn provider already exists
                    const linkedinProviderIndex = user.oauthProviders.findIndex(
                        p => p.provider === 'linkedin'
                    );
                    if (linkedinProviderIndex !== -1) {
                        // Update existing provider
                        user.oauthProviders[linkedinProviderIndex].accessToken = accessToken;
                    } else {
                        // Add new OAuth provider
                        user.oauthProviders.push({
                            provider: 'linkedin',
                            providerId: profile.id,
                            accessToken
                        });
                    }
                    
                    // Update other user details
                    Object.assign(user, userDetails);
                }

                await user.save();
                return done(null, user);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

app.get('/auth/google', passport.authenticate('google', { 
    scope: ['profile', 'email', 'openid'] 
}));
app.get(
    '/auth/google/callback',
    passport.authenticate('google', { 
        failureRedirect: '/login',
        failureFlash: true 
    }),
    (req, res) => {
        try {
            const token = jwt.sign({ id: req.user.id }, SECRET_KEY, { expiresIn: '1h' });
            res.redirect(`http://localhost:3000?token=${token}`);
        } catch (error) {
            console.error('Token generation error:', error);
            res.redirect('/login?error=token_generation_failed');
        }
    }
);

// OAuth routes
app.get('/auth/github', passport.authenticate('github', { 
    scope: ['user:email', 'read:user', 'profile'] 
}));
app.get(
    '/auth/github/callback',
    passport.authenticate('github', { 
        failureRedirect: '/login',
        failureFlash: true 
    }),
    (req, res) => {
        try {
            const token = jwt.sign({ id: req.user.id }, SECRET_KEY, { expiresIn: '1h' });
            res.redirect(`http://localhost:3000?token=${token}`);
        } catch (error) {
            console.error('Token generation error:', error);
            res.redirect('/login?error=token_generation_failed');
        }
    }
);

app.get('/auth/linkedin', passport.authenticate('linkedin', { 
    scope: ['r_liteprofile', 'r_emailaddress', 'openid', 'profile', 'email'] 
}));
app.get(
    '/auth/linkedin/callback',
    passport.authenticate('linkedin', { 
        failureRedirect: '/login',
        failureFlash: true 
    }),
    (req, res) => {
        try {
            const token = jwt.sign({ id: req.user.id }, SECRET_KEY, { expiresIn: '1h' });
            res.redirect(`http://localhost:3000?token=${token}`);
        } catch (error) {
            console.error('Token generation error:', error);
            res.redirect('/login?error=token_generation_failed');
        }
    }
);

// Routes
app.post('/create', async (req, res) => {
    try {
        const { fullName, email, phone, username, password } = req.body;
        if (!fullName || !email || !phone || !username || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ fullName, email, phone, username, password: hashedPassword });
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
        res.status(200).json({ message: 'Login successful', token, user: { username: user.username, fullName: user.fullName } });
    } catch (error) {
        console.error('Error in /login route:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('-password -oauthProviders.accessToken'); // Exclude sensitive info

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            username: user.username,
            phone: user.phone || null,
            profilePicture: user.profilePicture,
            isVerified: user.isVerified,
            lastLogin: user.lastLogin,
            oauthProviders: user.oauthProviders.map(provider => ({
                provider: provider.provider
            }))
        });
    } catch (error) {
        console.error('Error in /profile route:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update the image upload route
app.post('/upload', authenticateToken, upload.single('imageInput'), (req, res) => {
    console.log('Uploaded file:', req.file); // More detailed logging
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    res.status(201).json({ 
        filePath: req.file.filename, // Use filename instead of full path
        message: 'Image uploaded successfully' 
    });
});

// Update the image fetch route
app.get('/image/:filename', async (req, res) => {
    const filePath = path.join(__dirname, 'uploaded', req.params.filename);
    
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