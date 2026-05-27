const express = require('express');
const router = express.Router();
const Hit = require('../models/Hit');
const Coupon = require('../models/Coupon');
const { verifyToken } = require('../middleware/auth');

router.post('/track', async (req, res) => {
  const { type, couponId, page } = req.body;
  if (!type) return res.status(400).json({ error: 'Type is required' });
  await Hit.create({
    type,
    couponId: couponId || null,
    page: page || '',
    ip: req.ip,
    userAgent: req.headers['user-agent'] || '',
    referrer: req.headers['referer'] || ''
  });
  res.status(201).json({ message: 'Tracked' });
});

router.get('/stats', verifyToken, async (req, res) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [totalViews, totalClicks, totalSubmissions, todayViews, topCoupons] = await Promise.all([
    Hit.countDocuments({ type: 'pageview' }),
    Hit.countDocuments({ type: 'click' }),
    Hit.countDocuments({ type: 'submission' }),
    Hit.countDocuments({ type: 'pageview', createdAt: { $gte: today } }),
    Coupon.find().sort({ clicks: -1 }).limit(10).select('store discount clicks views')
  ]);

  res.json({
    totalViews,
    totalClicks,
    totalSubmissions,
    todayViews,
    topCoupons
  });
});

router.get('/daily', verifyToken, async (req, res) => {
  const days = Number(req.query.days) || 7;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const hits = await Hit.aggregate([
    { $match: { createdAt: { $gte: since }, type: 'pageview' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.json(hits);
});

module.exports = router;
