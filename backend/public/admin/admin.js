const API = '/api';
let chart = null;

// ─── Auth check ───
async function checkAuth() {
  try {
    const res = await fetch(`${API}/admin/me`, { credentials: 'include' });
    if (res.ok) {
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appScreen').style.display = 'flex';
      initApp();
    }
  } catch {}
}

// ─── Login ───
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';
  try {
    const res = await fetch(`${API}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPassword').value,
        turnstileToken: turnstile.getResponse()
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'flex';
    initApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});

// ─── Logout ───
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch(`${API}/admin/logout`, { method: 'POST', credentials: 'include' });
  location.reload();
});

// ─── Navigation ───
document.querySelectorAll('.sidebar-nav a[data-page]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    a.classList.add('active');
    document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${a.dataset.page}`).classList.add('active');
    if (a.dataset.page === 'dashboard') loadDashboard();
    if (a.dataset.page === 'coupons') loadCoupons();
    if (a.dataset.page === 'submissions') loadSubmissions();
    if (a.dataset.page === 'analytics') loadAnalytics();
    if (a.dataset.page === 'admins') loadAdmins();
  });
});

// ─── Init ───
function initApp() {
  loadDashboard();
}

// ─── Dashboard ───
async function loadDashboard() {
  try {
    const res = await fetch(`${API}/analytics/stats`, { credentials: 'include' });
    const data = await res.json();
    document.getElementById('statViews').textContent = data.totalViews || 0;
    document.getElementById('statClicks').textContent = data.totalClicks || 0;
    document.getElementById('statToday').textContent = data.todayViews || 0;
    document.getElementById('statSubmissions').textContent = data.totalSubmissions || 0;

    const tbody = document.getElementById('topCouponsTable');
    tbody.innerHTML = (data.topCoupons || []).map(c =>
      `<tr><td>${c.store}</td><td>${c.discount}</td><td>${c.clicks}</td><td>${c.views}</td></tr>`
    ).join('');
  } catch {}
}

// ─── Coupons CRUD ───
async function loadCoupons() {
  try {
    const res = await fetch(`${API}/coupons?status=`, { credentials: 'include' });
    const data = await res.json();
    const tbody = document.getElementById('couponsTable');
    tbody.innerHTML = (data.coupons || []).map(c =>
      `<tr>
        <td>${c.store}</td>
        <td><code>${c.code}</code></td>
        <td>${c.discount}</td>
        <td>${c.category}</td>
        <td><span class="badge badge-${c.status}">${c.status}</span></td>
        <td>${c.clicks}</td>
        <td class="actions">
          <button class="btn btn-outline btn-sm" onclick='editCoupon(${JSON.stringify(c).replace(/'/g, "&#39;")})'>Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteCoupon('${c._id}')">Delete</button>
        </td>
      </tr>`
    ).join('');
  } catch {}
}

function showCouponForm() {
  document.getElementById('couponFormTitle').textContent = 'Add Coupon';
  document.getElementById('editId').value = '';
  document.getElementById('couponForm').reset();
  document.getElementById('couponFormModal').style.display = 'flex';
}

function hideCouponForm() {
  document.getElementById('couponFormModal').style.display = 'none';
}

function editCoupon(c) {
  document.getElementById('couponFormTitle').textContent = 'Edit Coupon';
  document.getElementById('editId').value = c._id;
  document.getElementById('cf_store').value = c.store || '';
  document.getElementById('cf_code').value = c.code || '';
  document.getElementById('cf_discount').value = c.discount || '';
  document.getElementById('cf_category').value = c.category || '';
  document.getElementById('cf_url').value = c.url || '';
  document.getElementById('cf_expiry').value = c.expiryDate ? c.expiryDate.slice(0,10) : '';
  document.getElementById('cf_desc').value = c.description || '';
  document.getElementById('cf_status').value = c.status || 'active';
  document.getElementById('couponFormModal').style.display = 'flex';
}

document.getElementById('couponForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  const body = {
    store: document.getElementById('cf_store').value,
    code: document.getElementById('cf_code').value,
    discount: document.getElementById('cf_discount').value,
    category: document.getElementById('cf_category').value || undefined,
    url: document.getElementById('cf_url').value || undefined,
    expiryDate: document.getElementById('cf_expiry').value || undefined,
    description: document.getElementById('cf_desc').value || undefined,
    status: document.getElementById('cf_status').value
  };
  try {
    const url = id ? `${API}/coupons/${id}` : `${API}/coupons`;
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error((await res.json()).error);
    hideCouponForm();
    loadCoupons();
  } catch (err) { alert(err.message); }
});

async function deleteCoupon(id) {
  if (!confirm('Delete this coupon?')) return;
  try {
    await fetch(`${API}/coupons/${id}`, { method: 'DELETE', credentials: 'include' });
    loadCoupons();
  } catch (err) { alert(err.message); }
}

// ─── Submissions ───
async function loadSubmissions() {
  try {
    const res = await fetch(`${API}/submissions`, { credentials: 'include' });
    const data = await res.json();
    const tbody = document.getElementById('submissionsTable');
    tbody.innerHTML = (data || []).map(c =>
      `<tr>
        <td>${c.store}</td>
        <td><code>${c.code}</code></td>
        <td>${c.discount}</td>
        <td>${c.category}</td>
        <td>${new Date(c.createdAt).toLocaleDateString()}</td>
        <td class="actions">
          <button class="btn btn-primary btn-sm" onclick="approveSubmission('${c._id}')">Approve</button>
          <button class="btn btn-danger btn-sm" onclick="rejectSubmission('${c._id}')">Reject</button>
        </td>
      </tr>`
    ).join('');
  } catch {}
}

async function approveSubmission(id) {
  try {
    await fetch(`${API}/submissions/${id}/approve`, { method: 'PUT', credentials: 'include' });
    loadSubmissions();
  } catch (err) { alert(err.message); }
}

async function rejectSubmission(id) {
  if (!confirm('Reject and delete this submission?')) return;
  try {
    await fetch(`${API}/submissions/${id}/reject`, { method: 'PUT', credentials: 'include' });
    loadSubmissions();
  } catch (err) { alert(err.message); }
}

// ─── Analytics Chart ───
async function loadAnalytics() {
  const days = document.getElementById('analyticsDays').value;
  try {
    const res = await fetch(`${API}/analytics/daily?days=${days}`, { credentials: 'include' });
    const data = await res.json();
    const labels = data.map(d => d._id);
    const counts = data.map(d => d.count);

    if (chart) chart.destroy();
    const ctx = document.getElementById('analyticsChart').getContext('2d');
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Daily Page Views',
          data: counts,
          borderColor: '#0a7c7a',
          backgroundColor: 'rgba(10,124,122,0.1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  } catch {}
}

// ─── Admin management ───
async function loadAdmins() {
  try {
    const res = await fetch(`${API}/admin/list`, { credentials: 'include' });
    const data = await res.json();
    const tbody = document.getElementById('adminsTable');
    tbody.innerHTML = (data || []).map(a =>
      `<tr><td>${a.email}</td><td>${new Date(a.createdAt).toLocaleDateString()}</td></tr>`
    ).join('');
  } catch {}
}

function showAdminForm() {
  document.getElementById('adminForm').reset();
  document.getElementById('adminError').style.display = 'none';
  document.getElementById('adminSuccess').style.display = 'none';
  document.getElementById('adminFormModal').style.display = 'flex';
}

function hideAdminForm() {
  document.getElementById('adminFormModal').style.display = 'none';
}

document.getElementById('adminForm').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('adminError');
  const sucEl = document.getElementById('adminSuccess');
  errEl.style.display = 'none';
  sucEl.style.display = 'none';
  try {
    const res = await fetch(`${API}/admin/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: document.getElementById('af_email').value,
        password: document.getElementById('af_password').value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    hideAdminForm();
    loadAdmins();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});

// ─── Init ───
checkAuth();
