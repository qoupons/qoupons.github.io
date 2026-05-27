const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const { generateToken, verifyToken } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const verifyTurnstile = require('../middleware/verifyTurnstile');
const path = require('path');

router.post('/login', loginLimiter, verifyTurnstile, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const admin = await Admin.findOne({ email: email.toLowerCase() });
  if (!admin) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (admin.isLocked()) {
    return res.status(429).json({ error: 'Account locked. Try again later.' });
  }

  const match = await admin.comparePassword(password);
  if (!match) {
    admin.loginAttempts += 1;
    if (admin.loginAttempts >= 10) {
      admin.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      admin.loginAttempts = 0;
    }
    await admin.save();
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  admin.loginAttempts = 0;
  admin.lockUntil = null;
  await admin.save();

  const token = generateToken(admin._id);
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  });

  res.json({ message: 'Login successful' });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

router.get('/me', verifyToken, async (req, res) => {
  const admin = await Admin.findById(req.admin.id).select('-password');
  res.json(admin);
});

router.get('/setup', async (req, res) => {
  const count = await Admin.countDocuments();
  if (count > 0) {
    return res.status(403).json({ error: 'Admin already exists' });
  }
  await Admin.create({
    email: process.env.ADMIN_EMAIL || 'admin@coupons.com',
    password: process.env.ADMIN_PASSWORD || 'admin123'
  });
  res.json({ message: 'Admin created. Change credentials immediately.' });
});

router.post('/create', verifyToken, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const existing = await Admin.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: 'Admin with this email already exists' });
  }
  await Admin.create({ email, password });
  res.status(201).json({ message: 'Admin created' });
});

router.get('/list', verifyToken, async (req, res) => {
  const admins = await Admin.find().select('email createdAt');
  res.json(admins);
});

router.post('/unlock', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const admin = await Admin.findOne({ email: email.toLowerCase() });
  if (!admin) return res.status(404).json({ error: 'Admin not found' });
  admin.loginAttempts = 0;
  admin.lockUntil = null;
  await admin.save();
  res.json({ message: 'Account unlocked' });
});

module.exports = router;
