// ─── Ad placeholders (swap in real ad network code) ───
const AD_NETWORK = {
  leaderboard: `<div class="ad-block ad-leaderboard">Ad — Leaderboard 728×90</div>`,
  sidebar: `<div class="ad-block ad-sidebar">Ad — Skyscraper 300×600</div>`,
  native: `<div class="ad-block ad-native">Ad — In-Feed Native</div>`,
  sticky: `<div class="ad-block ad-sticky">Ad — Sticky Footer</div>`,
  interstitial: `<div class="ad-block" style="width:300px;height:250px;margin:16px auto;">Ad — Interstitial 300×250</div>`
};

// ─── Toast ───
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ─── Copy coupon ───
function copyCode(code, btn) {
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  });
}

// ─── Interstitial ───
let interstitialShown = false;
function showInterstitial() {
  if (interstitialShown) return;
  interstitialShown = true;
  const overlay = document.getElementById('interstitial');
  if (overlay) overlay.classList.add('show');
}
function closeInterstitial() {
  const overlay = document.getElementById('interstitial');
  if (overlay) overlay.classList.remove('show');
}

// ─── Track page view ───
AnalyticsAPI.track({ type: 'pageview', page: window.location.pathname }).catch(() => {});

// ─── Render coupon card ───
function renderCouponCard(c) {
  const expired = c.status === 'expired' || (c.expiryDate && new Date(c.expiryDate) < new Date());
  return `
    <div class="coupon-card ${expired ? 'coupon-expired' : ''}">
      <div class="coupon-store">${c.store}</div>
      <div class="coupon-discount">${c.discount}</div>
      <div class="coupon-desc">${c.description || 'No description'}</div>
      <div class="coupon-meta">
        <span>${c.category}</span>
        ${c.expiryDate ? `<span>Expires ${new Date(c.expiryDate).toLocaleDateString()}</span>` : ''}
        <span>${c.clicks || 0} uses</span>
      </div>
      <div class="coupon-code-wrap" onclick="copyCode('${c.code}', this.querySelector('.copy-btn'))" data-coupon-id="${c._id}">
        <span class="coupon-code">${c.code}</span>
        <button class="copy-btn">Copy</button>
      </div>
    </div>
  `;
}

// ─── Load coupons into grid ───
async function loadCoupons(gridId = 'couponGrid', params = {}) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '<div class="loading"><div class="spinner"></div>Loading coupons...</div>';

  try {
    const data = await CouponAPI.list(params);
    if (data.coupons.length === 0) {
      grid.innerHTML = '<p style="text-align:center;color:var(--gray-400);padding:40px;">No coupons found.</p>';
      return data;
    }
    grid.innerHTML = data.coupons.map(renderCouponCard).join('');

    data.coupons.forEach(c => {
      const wrap = grid.querySelector(`[data-coupon-id="${c._id}"]`);
      if (wrap) {
        wrap.addEventListener('click', () => {
          CouponAPI.click(c._id).catch(() => {});
          AnalyticsAPI.track({ type: 'click', couponId: c._id }).catch(() => {});
        });
      }
    });

    return data;
  } catch (err) {
    grid.innerHTML = `<p style="text-align:center;color:#dc2626;padding:40px;">Error: ${err.message}</p>`;
  }
}

// ─── Load categories ───
async function loadCategories(containerId = 'categoryFilter', onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const cats = await CouponAPI.categories();
    container.innerHTML = '<button class="active" data-cat="">All</button> ' +
      cats.map(c => `<button data-cat="${c}">${c}</button>`).join('');
    container.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (onSelect) onSelect(btn.dataset.cat);
      });
    });
  } catch {}
}

// ─── Interstitial on page transition ───
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href');
    if (href && !href.startsWith('#') && !href.startsWith('http') && !href.startsWith('/admin')) {
      a.addEventListener('click', e => {
        if (interstitialShown) return;
        e.preventDefault();
        showInterstitial();
        setTimeout(() => { window.location.href = href; }, 800);
      });
    }
  });
});
