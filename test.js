import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { body, validationResult } from 'express-validator';


const router = express.Router();

// Validation Functions
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhoneNumber = (phone) => /^[7-9]\d{9}$/.test(phone);

// User Registration 
router.post('/register', [
    body('name').isLength({ min: 3 }).withMessage('Name should be at least 3 letters long').matches(/^[a-zA-Z\s]+$/).withMessage('Name should contain only letters'),
    body('username').matches(/^[a-zA-Z0-9]+$/).withMessage('Username should contain only letters and numbers'),
    body('phone').custom(value => validatePhoneNumber(value)).withMessage('Phone number should be in Indian format'),
    body('email').custom(value => validateEmail(value)).withMessage('Invalid email format'),
    body('password').isLength({ min: 6 }).withMessage('Password should be at least 6 characters long')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, username, phone, email, password, role } = req.body;

    try {
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            username,
            phone,
            email,
            password: hashedPassword,
            userType: role
        });

        await newUser.save();

        res.status(200).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// User Login
router.post('/login', [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid email or password' });

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(400).json({ message: 'Invalid email or password' });

        const loginTimestamp = new Date().toISOString();
        user.timestamps.push({ login: loginTimestamp });
        await user.save();

        const token = jwt.sign({ userId: user._id, role: user.userType }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ token, loginTimestamp });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// User Logout
router.post('/logout', [
    body('email').isEmail().withMessage('Please provide a valid email')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

     const { email } = req.body;
    

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid email' });

        const lastLoginIndex = user.timestamps.length - 1;
        if (lastLoginIndex >= 0 && !user.timestamps[lastLoginIndex].logout) {
            user.timestamps[lastLoginIndex].logout = new Date().toISOString();
            await user.save();
        }


        res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Middleware to Verify Token
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Unauthorized' });
    }
};

// Protected Route Example
router.get('/protected-route', verifyToken, (req, res) => {
    res.status(200).json({ message: 'This is a protected route', user: req.user });
});

// Get All Users
router.get('/users', async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;