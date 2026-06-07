// ===================================================
// NEXACORE SCRIPT.JS  — API-backed, JWT/cookie auth
// ===================================================

// ── CSRF helper ────────────────────────────────────────────────────────────
let _csrfToken = null;
async function getCsrfToken() {
  if (_csrfToken) return _csrfToken;
  try {
    const r = await fetch('/api/csrf-token', { credentials: 'include' });
    const d = await r.json();
    _csrfToken = d.csrfToken;
  } catch (e) { _csrfToken = ''; }
  return _csrfToken;
}

// ── Fetch wrapper (always sends CSRF + cookies) ────────────────────────────
async function apiFetch(url, options = {}) {
  const csrf = await getCsrfToken();
  return fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrf,
      ...(options.headers || {})
    },
    ...options
  });
}

// ── Auth state ─────────────────────────────────────────────────────────────
// Stored in sessionStorage only (cleared when tab/browser closes).
// Source of truth is the HttpOnly JWT cookie validated by /api/auth/me.

function setUserSession(user) {
  sessionStorage.setItem('nc_user', JSON.stringify(user));
}
function getUserSession() {
  try { return JSON.parse(sessionStorage.getItem('nc_user') || 'null'); } catch (e) { return null; }
}
function clearUserSession() {
  sessionStorage.removeItem('nc_user');
  sessionStorage.setItem('nc_logged_out', '1');
}

// ── requireAuth — call on every protected page ─────────────────────────────
// Validates session server-side; redirects to login if invalid.
async function requireAuth() {
  // Immediate check: was user explicitly logged out in this tab?
  if (sessionStorage.getItem('nc_logged_out')) {
    redirectToLogin();
    return false;
  }

  try {
    const res  = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();

    if (!res.ok || !data.success) {
      redirectToLogin();
      return false;
    }

    setUserSession(data.user);

    // Prevent back button after logout
    history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', async function () {
      const check = await fetch('/api/auth/me', { credentials: 'include' });
      if (!check.ok) {
        redirectToLogin();
      } else {
        history.pushState(null, '', window.location.href);
      }
    });

    return data.user;
  } catch (e) {
    redirectToLogin();
    return false;
  }
}

function redirectToLogin() {
  history.replaceState(null, '', '/login.html');
  window.location.replace('/login.html');
}

// ── redirectIfLoggedIn — call on auth pages ────────────────────────────────
async function redirectIfLoggedIn() {
  if (sessionStorage.getItem('nc_logged_out')) return; // just logged out, stay on login
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        window.location.replace('/dashboard.html');
      }
    }
  } catch (e) { /* not logged in */ }
}

// ── showAuthError / showAuthSuccess ───────────────────────────────────────
function showAuthError(msg) {
  const el = document.getElementById('authError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
  else console.error(msg);
}
function showAuthSuccess(msg) {
  const el = document.getElementById('authSuccess');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function hideAuthMessages() {
  ['authError','authSuccess'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

// ── SIGNUP ─────────────────────────────────────────────────────────────────
async function handleSignup() {
  hideAuthMessages();
  const name    = (document.getElementById('signupName')?.value || '').trim();
  const email   = (document.getElementById('signupEmail')?.value || '').trim();
  const pass    = document.getElementById('signupPassword')?.value || '';
  const confirm = document.getElementById('confirmPassword')?.value || '';

  if (!name || !email || !pass || !confirm) { showAuthError('Please fill in all fields.'); return; }
  if (pass.length < 6)  { showAuthError('Password must be at least 6 characters.'); return; }
  if (pass !== confirm) { showAuthError('Passwords do not match.'); return; }

  const btn = document.querySelector('.auth-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating account…'; }

  try {
    const res  = await apiFetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password: pass, confirmPassword: confirm })
    });
    const data = await res.json();

    if (!res.ok) {
      showAuthError(data.message || 'Signup failed.');
      if (btn) { btn.disabled = false; btn.textContent = 'Create Account'; }
      return;
    }

    // Store userId for OTP page
    sessionStorage.setItem('nc_pending_uid', data.userId);

    // Dev mode — show OTP on page
    if (data.devOtp) {
      const devBox = document.getElementById('otpDemoBox');
      const devOtpEl = document.getElementById('otpDisplay');
      if (devBox && devOtpEl) { devBox.style.display = 'block'; devOtpEl.textContent = data.devOtp; }
    }

    showAuthSuccess(data.message);
    setTimeout(() => { window.location.href = '/otp.html'; }, 1800);
  } catch (e) {
    showAuthError('Network error. Please try again.');
    if (btn) { btn.disabled = false; btn.textContent = 'Create Account'; }
  }
}

// ── LOGIN (no OTP required) ────────────────────────────────────────────────
async function handleLogin() {
  hideAuthMessages();
  sessionStorage.removeItem('nc_logged_out');

  const email = (document.getElementById('email')?.value || '').trim();
  const pass  = document.getElementById('password')?.value || '';

  if (!email || !pass) { showAuthError('Please enter your email and password.'); return; }

  const btn = document.querySelector('.auth-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }

  try {
    const res  = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();

    if (!res.ok) {
      if (data.needsVerification) {
        // Account exists but not yet verified — send back to OTP
        sessionStorage.setItem('nc_pending_uid', data.userId);
        showAuthError(data.message + ' Redirecting to verification…');
        setTimeout(() => { window.location.href = '/otp.html'; }, 1800);
      } else {
        showAuthError(data.message || 'Login failed.');
      }
      if (btn) { btn.disabled = false; btn.textContent = 'Login'; }
      return;
    }

    setUserSession(data.user);
    window.location.replace('/dashboard.html');
  } catch (e) {
    showAuthError('Network error. Please try again.');
    if (btn) { btn.disabled = false; btn.textContent = 'Login'; }
  }
}

// ── OTP VERIFICATION (registration only) ──────────────────────────────────
function otpAutoFocus(current, prevId, nextId) {
  current.value = current.value.replace(/[^0-9]/g, '');
  if (current.value.length === 1 && nextId) document.getElementById(nextId)?.focus();
  if (current.value.length === 0 && prevId)  document.getElementById(prevId)?.focus();
}

async function verifyOTP() {
  const otp = ['o1','o2','o3','o4','o5','o6']
    .map(id => document.getElementById(id)?.value || '').join('');

  const errorEl = document.getElementById('otpError');
  if (otp.length < 6) {
    if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = 'Please enter all 6 digits.'; }
    return;
  }

  const userId = sessionStorage.getItem('nc_pending_uid');
  if (!userId) { window.location.replace('/signup.html'); return; }

  const btn = document.querySelector('.auth-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Verifying…'; }

  try {
    const res  = await apiFetch('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ userId, otp })
    });
    const data = await res.json();

    if (!res.ok) {
      if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = data.message || 'Invalid OTP.'; }
      if (btn) { btn.disabled = false; btn.textContent = 'Verify OTP'; }
      return;
    }

    sessionStorage.removeItem('nc_pending_uid');
    setUserSession(data.user);
    window.location.replace('/dashboard.html');
  } catch (e) {
    if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = 'Network error. Please try again.'; }
    if (btn) { btn.disabled = false; btn.textContent = 'Verify OTP'; }
  }
}

async function resendOTP() {
  const userId = sessionStorage.getItem('nc_pending_uid');
  if (!userId) return;
  try {
    const res  = await apiFetch('/api/auth/resend-otp', { method: 'POST', body: JSON.stringify({ userId }) });
    const data = await res.json();
    alert(data.message + (data.devOtp ? ' OTP: ' + data.devOtp : ''));
  } catch (e) { alert('Could not resend OTP.'); }
}

// ── LOGOUT ─────────────────────────────────────────────────────────────────
async function logout() {
  try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
  clearUserSession();
  _csrfToken = null;
  history.replaceState(null, '', '/login.html');
  window.location.replace('/login.html');
}

// ── CONTACT FORM ───────────────────────────────────────────────────────────
async function handleContact(e) {
  e.preventDefault();
  const form   = e.target;
  const status = document.getElementById('contactStatus');
  const btn    = form.querySelector('button[type="submit"]');

  const payload = {
    name:    form.name.value.trim(),
    email:   form.email.value.trim(),
    subject: form.subject.value.trim(),
    message: form.message.value.trim()
  };

  if (!payload.name || !payload.email || !payload.subject || !payload.message) {
    if (status) { status.textContent = 'Please complete every field.'; status.className = 'form-status error'; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  if (status) { status.textContent = ''; status.className = 'form-status'; }

  try {
    const res  = await apiFetch('/api/contact', { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json();
    if (status) {
      status.textContent = data.message || 'Message sent!';
      status.className   = 'form-status ' + (res.ok ? 'success' : 'error');
    }
    if (res.ok) form.reset();
  } catch (err) {
    if (status) { status.textContent = 'Could not send message. Please try again.'; status.className = 'form-status error'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Send Message'; }
  }
}

// ── NAVBAR SCROLL ─────────────────────────────────────────────────────────
window.addEventListener('scroll', function () {
  const navbar = document.getElementById('navbar');
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 10);

  const backBtn = document.getElementById('backToTop');
  if (backBtn) backBtn.style.display = window.scrollY > 500 ? 'block' : 'none';

  revealSections();
});

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
  });
});

const backBtn = document.getElementById('backToTop');
if (backBtn) backBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

function revealSections() {
  document.querySelectorAll('.reveal').forEach(section => {
    if (section.getBoundingClientRect().top < window.innerHeight - 100) section.classList.add('active');
  });
}
revealSections();

// ── COUNTERS ───────────────────────────────────────────────────────────────
document.querySelectorAll('.counter').forEach(counter => {
  const target    = parseInt(counter.getAttribute('data-target'));
  let current     = 0;
  const increment = Math.ceil(target / 100);
  const timer     = setInterval(() => {
    current += increment;
    if (current >= target) { counter.innerText = target + '+'; clearInterval(timer); }
    else counter.innerText = current;
  }, 20);
});

// ── FAQ ────────────────────────────────────────────────────────────────────
document.querySelectorAll('.faq-question').forEach(question => {
  question.addEventListener('click', function () {
    document.querySelectorAll('.faq-item').forEach(item => {
      if (item !== question.parentElement) item.classList.remove('active');
    });
    question.parentElement.classList.toggle('active');
  });
});

// ── PAGE LOADER ────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => { loader.style.display = 'none'; }, 600);
    }
  }, 1200);
});
