// Check if already logged in
fetch('/api/admin/me', { credentials: 'include' })
  .then(function(r) { return r.json(); })
  .then(function(d) { if (d.success) window.location.replace('/admin.html'); })
  .catch(function() {});

async function adminLogin() {
  var email    = document.getElementById('adminEmail').value.trim();
  var password = document.getElementById('adminPassword').value;
  var errorEl  = document.getElementById('errorMsg');
  var btn      = document.getElementById('loginBtn');

  errorEl.style.display = 'none';

  if (!email || !password) {
    errorEl.textContent = 'Please enter email and password.';
    errorEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    var res = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    });
    var data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.message || 'Invalid credentials.';
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Sign In';
      return;
    }
    window.location.replace('/admin.html');
  } catch (e) {
    errorEl.textContent = 'Network error. Try again.';
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

document.getElementById('loginBtn').addEventListener('click', adminLogin);
document.addEventListener('keydown', function(e) { if (e.key === 'Enter') adminLogin(); });