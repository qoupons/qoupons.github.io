const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const sanitizeBody = require('../middleware/sanitize');
const Hit = require('../models/Hit');
const vf = require('../config/voucherify');

function mapVoucher(v) {
  const disc = v.discount || {};
  let discountStr = 'Discount';
  if (disc.percent_off) discountStr = `${disc.percent_off}% OFF`;
  else if (disc.amount_off) discountStr = `$${(disc.amount_off / 100).toFixed(2)} off`;
  else if (disc.unit_off) discountStr = `${disc.unit_off} free`;

  return {
    _id: v.code,
    code: v.code,
    store: v.metadata?.store || v.campaign || 'Unknown Store',
    discount: discountStr,
    description: v.metadata?.description || '',
    category: v.category || 'General',
    url: v.metadata?.store_url || '',
    image: v.metadata?.image || '',
    expiryDate: v.expiration_date || null,
    status: v.active === false ? 'expired' : (v.expiration_date && new Date(v.expiration_date) < new Date() ? 'expired' : 'active'),
    clicks: v.metadata?.clicks || 0,
    views: v.metadata?.views || 0,
  };
}

router.get('/', async (req, res) => {
  const { category, status, search, page = 1, limit = 20 } = req.query;

  const opts = {
    limit: Number(limit),
    page: Math.max(1, Number(page)),
  };

  if (category) opts.category = category;
  if (search) opts.code = search;
  if (status === 'expired') opts.filters = { junction: 'and', active: { conditions: { $is: false } } };

  try {
    const result = await vf.vouchers.listVouchers(opts);
    const vouchers = (result.vouchers || []).map(mapVoucher);

    let filtered = vouchers;
    if (status === 'active') filtered = vouchers.filter(v => v.status === 'active');
    if (search && !result.vouchers?.length) {
      const all = await vf.vouchers.listVouchers({ limit: 100 });
      const term = search.toLowerCase();
      const matched = (all.vouchers || []).filter(v =>
        (v.metadata?.store || '').toLowerCase().includes(term) ||
        (v.code || '').toLowerCase().includes(term)
      );
      filtered = matched.map(mapVoucher).slice(0, Number(limit));
      return res.json({ coupons: filtered, total: filtered.length, page: 1, pages: 1 });
    }

    res.json({
      coupons: filtered,
      total: result.total || filtered.length,
      page: Number(page),
      pages: Math.ceil((result.total || filtered.length) / Number(limit)),
    });
  } catch (err) {
    console.error('Voucherify list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

router.post('/validate', async (req, res) => {
  const { code, amount } = req.body;
  if (!code) return res.status(400).json({ error: 'Coupon code is required' });

  try {
    const result = await vf.validations.validateStackedDiscounts({
      redeemables: [{ object: 'voucher', id: code }],
      order: amount ? { amount: Math.round(amount * 100) } : undefined,
    });

    if (!result.valid) {
      const error = result.redeemables?.[0]?.result?.error;
      return res.json({ valid: false, error: error?.message || 'Invalid or expired coupon' });
    }

    const discount = result.redeemables?.[0]?.result?.discount;

    res.json({
      valid: true,
      discount,
      code,
      order: result.order,
    });
  } catch (err) {
    console.error('Voucherify validation error:', err.message);
    res.status(500).json({ error: 'Validation failed' });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const result = await vf.categoriesApi.listCategories();
    const cats = (result.data || []).map(c => c.name).filter(Boolean);
    res.json(cats.length ? cats : ['General', 'Fashion', 'Electronics', 'Food', 'Travel', 'Health']);
  } catch {
    res.json(['General', 'Fashion', 'Electronics', 'Food', 'Travel', 'Health']);
  }
});

router.get('/:code', async (req, res) => {
  try {
    const v = await vf.vouchers.getVoucher(req.params.code);
    const mapped = mapVoucher(v);
    await vf.vouchers.updateVoucher(req.params.code, {
      metadata: { ...v.metadata, views: (v.metadata?.views || 0) + 1 },
    });
    mapped.views = (v.metadata?.views || 0) + 1;
    res.json(mapped);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: 'Coupon not found' });
    console.error('Voucherify get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch coupon' });
  }
});

router.post('/', verifyToken, sanitizeBody, async (req, res) => {
  const { store, code, discount, description, category, url, image, expiryDate } = req.body;
  if (!store || !code || !discount) {
    return res.status(400).json({ error: 'Store, code, and discount are required' });
  }

  const discVal = parseFloat(discount);
  const discountBody = Number.isFinite(discVal)
    ? (discount.includes('%') ? { type: 'PERCENT', percent_off: discVal } : { type: 'AMOUNT', amount_off: Math.round(discVal * 100) })
    : { type: 'PERCENT', percent_off: 10 };

  try {
    const v = await vf.vouchers.createVoucher(code, {
      code,
      category: category || 'General',
      discount: discountBody,
      campaign: store,
      metadata: { store, description: description || '', store_url: url || '', image: image || '', clicks: 0, views: 0 },
      expiration_date: expiryDate || undefined,
      active: true,
    });
    res.status(201).json(mapVoucher(v));
  } catch (err) {
    console.error('Voucherify create error:', err.message);
    if (err.message?.includes('already exists')) return res.status(409).json({ error: 'A coupon with this code already exists' });
    res.status(500).json({ error: 'Failed to create coupon' });
  }
});

router.put('/:code', verifyToken, sanitizeBody, async (req, res) => {
  const { store, discount, description, category, url, image, expiryDate, status } = req.body;

  try {
    const existing = await vf.vouchers.getVoucher(req.params.code);
    const metadata = { ...existing.metadata, store: store || existing.metadata?.store };
    if (description !== undefined) metadata.description = description;
    if (url !== undefined) metadata.store_url = url;
    if (image !== undefined) metadata.image = image;

    const updateBody = {
      category: category || existing.category,
      campaign: store || existing.campaign,
      metadata,
      expiration_date: expiryDate || existing.expiration_date,
    };

    if (status === 'active') updateBody.active = true;
    else if (status === 'expired') updateBody.active = false;

    const v = await vf.vouchers.updateVoucher(req.params.code, updateBody);
    res.json(mapVoucher(v));
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: 'Coupon not found' });
    console.error('Voucherify update error:', err.message);
    res.status(500).json({ error: 'Failed to update coupon' });
  }
});

router.delete('/:code', verifyToken, async (req, res) => {
  try {
    await vf.vouchers.deleteVoucher(req.params.code, { force: true });
    res.json({ message: 'Coupon deleted' });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: 'Coupon not found' });
    console.error('Voucherify delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
});

router.post('/:code/click', async (req, res) => {
  try {
    const v = await vf.vouchers.getVoucher(req.params.code);
    const clicks = (v.metadata?.clicks || 0) + 1;
    await vf.vouchers.updateVoucher(req.params.code, {
      metadata: { ...v.metadata, clicks },
    });
    await Hit.create({
      type: 'click',
      couponId: req.params.code,
      page: req.body.page || '',
      ip: req.ip,
      userAgent: req.headers['user-agent'] || '',
      referrer: req.headers['referer'] || '',
    });
    res.json({ clicks });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: 'Coupon not found' });
    console.error('Click track error:', err.message);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

module.exports = router;
