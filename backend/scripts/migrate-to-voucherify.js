require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');
const vf = require('../config/voucherify');

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/coupons');

  const coupons = await Coupon.find({ status: { $in: ['active', 'expired'] } }).lean();
  console.log(`Found ${coupons.length} coupons to migrate`);

  let created = 0, skipped = 0, errors = 0;

  for (const c of coupons) {
    const discVal = parseFloat(c.discount);
    const discountBody = Number.isFinite(discVal)
      ? (c.discount.includes('%')
        ? { type: 'PERCENT', percent_off: discVal }
        : { type: 'AMOUNT', amount_off: Math.round(discVal * 100) })
      : { type: 'PERCENT', percent_off: 10 };

    try {
      await vf.vouchers.createVoucher(c.code, {
        code: c.code,
        category: c.category || 'General',
        discount: discountBody,
        campaign: c.store,
        metadata: {
          store: c.store,
          description: c.description || '',
          store_url: c.url || '',
          image: c.image || '',
          clicks: c.clicks || 0,
          views: c.views || 0,
        },
        expiration_date: c.expiryDate || undefined,
        active: c.status === 'active',
      });
      console.log(`  OK: ${c.code} (${c.store})`);
      created++;
    } catch (err) {
      if (err.message?.includes('already exists')) {
        console.log(`  SKIP: ${c.code} already exists`);
        skipped++;
      } else {
        console.error(`  ERR: ${c.code} - ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped, ${errors} errors`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
