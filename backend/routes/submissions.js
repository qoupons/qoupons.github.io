const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');
const sanitizeBody = require('../middleware/sanitize');
const { verifyToken } = require('../middleware/auth');
const verifyTurnstile = require('../middleware/verifyTurnstile');

router.post('/', verifyTurnstile, sanitizeBody, async (req, res) => {
  const { store, code, discount, description, category, url, expiryDate } = req.body;
  if (!store || !code || !discount) {
    return res.status(400).json({ error: 'Store, code, and discount are required' });
  }
  const coupon = await Coupon.create({
    store, code, discount, description, category, url, expiryDate,
    status: 'pending',
    submittedBy: 'user'
  });
  res.status(201).json({ message: 'Coupon submitted for review', coupon });
});

router.get('/', verifyToken, async (req, res) => {
  const coupons = await Coupon.find({ status: 'pending' }).sort({ createdAt: -1 });
  res.json(coupons);
});

router.put('/:id/approve', verifyToken, async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(
    req.params.id,
    { status: 'active' },
    { new: true }
  );
  if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
  res.json(coupon);
});

router.put('/:id/reject', verifyToken, async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
  res.json({ message: 'Submission rejected and deleted' });
});

module.exports = router;
