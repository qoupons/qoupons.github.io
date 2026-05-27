const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');
const { verifyToken } = require('../middleware/auth');
const sanitizeBody = require('../middleware/sanitize');

router.get('/', async (req, res) => {
  const { category, status, search, page = 1, limit = 20 } = req.query;
  const filter = { status: status || 'active' };
  if (category) filter.category = category;
  if (search) {
    filter.$or = [
      { store: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  const coupons = await Coupon.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * Number(limit))
    .limit(Number(limit))
    .select('-__v');
  const total = await Coupon.countDocuments(filter);
  res.json({ coupons, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

router.get('/categories', async (req, res) => {
  const categories = await Coupon.distinct('category', { status: 'active' });
  res.json(categories);
});

router.get('/:id', async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(
    req.params.id,
    { $inc: { views: 1 } },
    { new: true }
  );
  if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
  res.json(coupon);
});

router.post('/', verifyToken, sanitizeBody, async (req, res) => {
  const coupon = await Coupon.create(req.body);
  res.status(201).json(coupon);
});

router.put('/:id', verifyToken, sanitizeBody, async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
  res.json(coupon);
});

router.delete('/:id', verifyToken, async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
  res.json({ message: 'Coupon deleted' });
});

router.post('/:id/click', async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(
    req.params.id,
    { $inc: { clicks: 1 } },
    { new: true }
  );
  if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
  res.json({ clicks: coupon.clicks });
});

module.exports = router;
