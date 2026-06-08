let _csrfToken = null;

async function getCsrfToken() {
  if (_csrfToken) return _csrfToken;

  try {
    const res = await fetch("/api/csrf-token", { credentials: "include" });
    const data = await res.json();
    _csrfToken = data.csrfToken || "";
  } catch {
    _csrfToken = "";
  }

  return _csrfToken;
}

async function apiFetch(url, options = {}) {
  const csrf = await getCsrfToken();

  return fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrf,
      ...(options.headers || {})
    }
  });
}

function setUserSession(user) {
  sessionStorage.setItem("nc_user", JSON.stringify(user));
}

function getUserSession() {
  try {
    return JSON.parse(sessionStorage.getItem("nc_user") || "null");
  } catch {
    return null;
  }
}

function clearUserSession() {
  sessionStorage.removeItem("nc_user");
  sessionStorage.setItem("nc_logged_out", "1");
}

function redirectToLogin() {
  window.location.replace("/login.html");
}

async function requireAuth() {
  if (sessionStorage.getItem("nc_logged_out")) {
    redirectToLogin();
    return false;
  }

  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    const data = await res.json();

    if (!res.ok || !data.success) {
      redirectToLogin();
      return false;
    }

    setUserSession(data.user);
    return data.user;
  } catch {
    redirectToLogin();
    return false;
  }
}

async function redirectIfLoggedIn() {
  if (sessionStorage.getItem("nc_logged_out")) return;

  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    const data = await res.json();

    if (res.ok && data.success) {
      setUserSession(data.user);
      window.location.replace("/dashboard.html");
    }
  } catch {
    // User is not logged in.
  }
}

function showAuthError(message) {
  const el = document.getElementById("authError");
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
}

function showAuthSuccess(message) {
  const el = document.getElementById("authSuccess");
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
}

function hideAuthMessages() {
  ["authError", "authSuccess"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = "";
      el.style.display = "none";
    }
  });
}

async function handleSignup() {
  hideAuthMessages();

  const name = document.getElementById("signupName")?.value.trim() || "";
  const email = document.getElementById("signupEmail")?.value.trim() || "";
  const password = document.getElementById("signupPassword")?.value || "";
  const confirmPassword = document.getElementById("confirmPassword")?.value || "";
  const btn = document.querySelector(".auth-btn");

  if (!name || !email || !password || !confirmPassword) {
    showAuthError("Please fill in all fields.");
    return;
  }

  if (password.length < 6) {
    showAuthError("Password must be at least 6 characters.");
    return;
  }

  if (password !== confirmPassword) {
    showAuthError("Passwords do not match.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Creating account...";
  }

  try {
    const res = await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password, confirmPassword })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showAuthError(data.message || "Signup failed.");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Create Account";
      }
      return;
    }

    sessionStorage.setItem("nc_pending_uid", data.userId);

    if (data.devOtp) {
      const box = document.getElementById("otpDemoBox");
      const display = document.getElementById("otpDisplay");
      if (box && display) {
        box.style.display = "block";
        display.textContent = data.devOtp;
      }
    }

    showAuthSuccess(data.message || "Account created. Please verify your email.");
    setTimeout(() => window.location.replace("/otp.html"), 1200);
  } catch {
    showAuthError("Network error. Please try again.");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Create Account";
    }
  }
}

async function handleLogin() {
  hideAuthMessages();
  sessionStorage.removeItem("nc_logged_out");

  const email = document.getElementById("email")?.value.trim() || "";
  const password = document.getElementById("password")?.value || "";
  const btn = document.querySelector(".auth-btn");

  if (!email || !password) {
    showAuthError("Please enter your email and password.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Signing in...";
  }

  try {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      if (data.needsVerification && data.userId) {
        sessionStorage.setItem("nc_pending_uid", data.userId);
        showAuthError((data.message || "Please verify your email.") + " Redirecting...");
        setTimeout(() => window.location.replace("/otp.html"), 1200);
      } else {
        showAuthError(data.message || "Login failed.");
      }

      if (btn) {
        btn.disabled = false;
        btn.textContent = "Login";
      }
      return;
    }

    setUserSession(data.user);
    window.location.replace("/dashboard.html");
  } catch {
    showAuthError("Network error. Please try again.");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Login";
    }
  }
}

function otpAutoFocus(current, prevId, nextId) {
  current.value = current.value.replace(/\D/g, "");

  if (current.value.length === 1 && nextId) {
    document.getElementById(nextId)?.focus();
  }

  if (current.value.length === 0 && prevId) {
    document.getElementById(prevId)?.focus();
  }
}

async function verifyOTP() {
  const otp = ["o1", "o2", "o3", "o4", "o5", "o6"]
    .map((id) => document.getElementById(id)?.value || "")
    .join("");

  const errorEl = document.getElementById("otpError");
  const btn = document.querySelector(".auth-btn");
  const userId = sessionStorage.getItem("nc_pending_uid");

  if (otp.length !== 6) {
    if (errorEl) {
      errorEl.textContent = "Please enter all 6 digits.";
      errorEl.style.display = "block";
    }
    return;
  }

  if (!userId) {
    window.location.replace("/signup.html");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Verifying...";
  }

  try {
    const res = await apiFetch("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ userId, otp })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      if (errorEl) {
        errorEl.textContent = data.message || "Invalid OTP.";
        errorEl.style.display = "block";
      }

      if (btn) {
        btn.disabled = false;
        btn.textContent = "Verify & Continue";
      }
      return;
    }

    sessionStorage.removeItem("nc_pending_uid");
    setUserSession(data.user);
    window.location.replace("/dashboard.html");
  } catch {
    if (errorEl) {
      errorEl.textContent = "Network error. Please try again.";
      errorEl.style.display = "block";
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = "Verify & Continue";
    }
  }
}

async function resendOTP() {
  const userId = sessionStorage.getItem("nc_pending_uid");
  if (!userId) {
    window.location.replace("/signup.html");
    return;
  }

  try {
    const res = await apiFetch("/api/auth/resend-otp", {
      method: "POST",
      body: JSON.stringify({ userId })
    });

    const data = await res.json();
    alert((data.message || "OTP resent.") + (data.devOtp ? " OTP: " + data.devOtp : ""));
  } catch {
    alert("Could not resend OTP. Please try again.");
  }
}

async function logout() {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Continue logout locally.
  }

  clearUserSession();
  _csrfToken = null;
  window.location.replace("/");
}

async function handleContact(event) {
  event.preventDefault();

  const form = event.target;
  const status = document.getElementById("contactStatus");
  const btn = form.querySelector('button[type="submit"]');

  const payload = {
    name: form.name?.value.trim() || "",
    email: form.email?.value.trim() || "",
    subject: form.subject?.value.trim() || "",
    message: form.message?.value.trim() || ""
  };

  if (!payload.name || !payload.email || !payload.subject || !payload.message) {
    if (status) {
      status.textContent = "Please complete every field.";
      status.className = "form-status error";
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Sending...";
  }

  if (status) {
    status.textContent = "";
    status.className = "form-status";
  }

  try {
    const res = await apiFetch("/api/contact", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (status) {
      status.textContent = data.message || (res.ok ? "Message sent." : "Could not send message.");
      status.className = "form-status " + (res.ok ? "success" : "error");
    }

    if (res.ok) form.reset();
  } catch {
    if (status) {
      status.textContent = "Could not send message. Please try again.";
      status.className = "form-status error";
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Send Message";
    }
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadPublicJobs() {
  const grid = document.getElementById("jobGrid");
  if (!grid) return;

  try {
    const res = await fetch("/api/jobs", { credentials: "include" });
    const data = await res.json();

    if (!data.success || !Array.isArray(data.jobs) || data.jobs.length === 0) {
      grid.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;">No open positions at the moment. Check back soon.</div>';
      return;
    }

    grid.innerHTML = data.jobs.map((job) => {
      const title = escapeHtml(job.title);
      const type = escapeHtml(job.type);
      const department = escapeHtml(job.department);
      const description = escapeHtml(job.description);
      const subject = encodeURIComponent(job.title || "Job Application");

      return `
        <div class="job-card">
          <span>${type}</span>
          <h3>${title}</h3>
          <p style="font-size:13px;color:#0ea5e9;margin-bottom:8px;">${department}</p>
          <p>${description}</p>
          <a href="mailto:careers@nexacore.com?subject=${subject}">Apply</a>
        </div>
      `;
    }).join("");
  } catch {
    grid.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;">Could not load jobs. Please try again later.</div>';
  }
}

window.addEventListener("scroll", () => {
  const navbar = document.getElementById("navbar");
  if (navbar) navbar.classList.toggle("scrolled", window.scrollY > 10);

  const backBtn = document.getElementById("backToTop");
  if (backBtn) backBtn.style.display = window.scrollY > 500 ? "block" : "none";

  revealSections();
});

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", function (event) {
      const target = document.querySelector(this.getAttribute("href"));
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    });
  });

  const backBtn = document.getElementById("backToTop");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  document.querySelectorAll(".faq-question").forEach((question) => {
    question.addEventListener("click", () => {
      document.querySelectorAll(".faq-item").forEach((item) => {
        if (item !== question.parentElement) item.classList.remove("active");
      });
      question.parentElement?.classList.toggle("active");
    });
  });

  document.querySelectorAll(".counter").forEach((counter) => {
    const target = Number(counter.getAttribute("data-target")) || 0;
    let current = 0;
    const increment = Math.max(1, Math.ceil(target / 100));

    const timer = setInterval(() => {
      current += increment;

      if (current >= target) {
        counter.textContent = target + "+";
        clearInterval(timer);
      } else {
        counter.textContent = current;
      }
    }, 20);
  });

  revealSections();
  loadPublicJobs();
});

function revealSections() {
  document.querySelectorAll(".reveal").forEach((section) => {
    if (section.getBoundingClientRect().top < window.innerHeight - 100) {
      section.classList.add("active");
    }
  });
}

window.addEventListener("load", () => {
  setTimeout(() => {
    const loader = document.getElementById("loader");
    if (!loader) return;

    loader.style.opacity = "0";
    setTimeout(() => {
      loader.style.display = "none";
    }, 600);
  }, 800);
});