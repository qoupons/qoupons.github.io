const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');
const sanitizeBody = require('../middleware/sanitize');
const { verifyToken } = require('../middleware/auth');
const verifyTurnstile = require('../middleware/verifyTurnstile');
const vf = require('../config/voucherify');

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
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return res.status(404).json({ error: 'Coupon not found' });

  const discVal = parseFloat(coupon.discount);
  const discountBody = Number.isFinite(discVal)
    ? (coupon.discount.includes('%') ? { type: 'PERCENT', percent_off: discVal } : { type: 'AMOUNT', amount_off: Math.round(discVal * 100) })
    : { type: 'PERCENT', percent_off: 10 };

  try {
    await vf.vouchers.createVoucher(coupon.code, {
      code: coupon.code,
      category: coupon.category || 'General',
      discount: discountBody,
      campaign: coupon.store,
      metadata: {
        store: coupon.store,
        description: coupon.description || '',
        store_url: coupon.url || '',
        clicks: 0,
        views: 0,
      },
      expiration_date: coupon.expiryDate || undefined,
      active: true,
    });
  } catch (err) {
    if (err.message?.includes('already exists')) {
      return res.status(409).json({ error: 'A coupon with this code already exists on Voucherify' });
    }
    console.error('Voucherify create error:', err.message);
    return res.status(500).json({ error: 'Failed to publish coupon to Voucherify' });
  }

  coupon.status = 'active';
  await coupon.save();
  res.json(coupon);
});

router.put('/:id/reject', verifyToken, async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
  res.json({ message: 'Submission rejected and deleted' });
});

module.exports = router;
