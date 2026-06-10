/* NexaCore — Main Script */

/* ── Loader ── */
window.addEventListener('load', () => {
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) { loader.classList.add('hide'); setTimeout(() => loader.remove(), 800); }
  }, 500);
});

/* ── Nav ── */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 24);
  const btt = document.getElementById('backToTop');
  if (btt) btt.classList.toggle('visible', window.scrollY > 700);
}, { passive: true });

const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => {
    const open = hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    hamburger.classList.remove('open');
    mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
  }));
}

/* ── Back to top ── */
const btt = document.getElementById('backToTop');
if (btt) btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ── DOMContentLoaded init ── */
document.addEventListener('DOMContentLoaded', () => {
  initSmoothScroll();
  initReveal();
  initHeroAnimations();
  initCounters();
  initParallax();
  initActiveNav();
  loadPublicJobs();
});

/* ── Smooth scroll for anchor links ── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const id = link.getAttribute('href');
      if (id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h') || '72');
      const top = target.getBoundingClientRect().top + window.scrollY - offset - 8;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

/* ── Scroll reveal ── */
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.07, rootMargin: '0px 0px -36px 0px' });
  els.forEach(el => io.observe(el));
}

/* ── Hero entrance ── */
function initHeroAnimations() {
  const items = document.querySelectorAll('.hero-animate');
  items.forEach((el, i) => {
    el.style.cssText += `opacity:0;transform:translateY(20px);transition:opacity .75s cubic-bezier(.0,.0,.2,1) ${.18 + i * .1}s,transform .75s cubic-bezier(.0,.0,.2,1) ${.18 + i * .1}s`;
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'none'; }));
  });
}

/* ── Animated counters ── */
function initCounters() {
  const els = document.querySelectorAll('[data-count]');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const el = e.target;
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const prefix = el.dataset.prefix || '';
      const decimals = el.dataset.decimals ? parseInt(el.dataset.decimals) : 0;
      const duration = 1600;
      const start = performance.now();
      const update = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const val = target * eased;
        el.textContent = prefix + (decimals ? val.toFixed(decimals) : Math.floor(val)) + suffix;
        if (progress < 1) requestAnimationFrame(update);
      };
      requestAnimationFrame(update);
    });
  }, { threshold: 0.5 });
  els.forEach(el => io.observe(el));
}

/* ── Orb parallax ── */
function initParallax() {
  const orbs = document.querySelectorAll('.hero-orb');
  if (!orbs.length) return;
  let rx = 0, ry = 0, cx = 0, cy = 0;
  window.addEventListener('mousemove', e => {
    rx = (e.clientX / window.innerWidth - .5) * 28;
    ry = (e.clientY / window.innerHeight - .5) * 18;
  }, { passive: true });
  const animate = () => {
    cx += (rx - cx) * .06;
    cy += (ry - cy) * .06;
    orbs.forEach((orb, i) => {
      const f = i === 0 ? 1 : i === 1 ? -.55 : .3;
      orb.style.transform = `translate(${cx * f}px, ${cy * f}px)`;
    });
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

/* ── Active nav link ── */
function initActiveNav() {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .nav-mobile-menu a').forEach(a => {
    const href = a.getAttribute('href');
    if (href && (href === path || href.startsWith(path.replace('.html','')))) a.classList.add('active');
  });
}

/* ── Contact form ── */
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('contactStatus');
    const btn = contactForm.querySelector('button[type="submit"]');
    const data = {
      name:    contactForm.querySelector('[name="name"]')?.value.trim(),
      email:   contactForm.querySelector('[name="email"]')?.value.trim(),
      company: contactForm.querySelector('[name="company"]')?.value.trim(),
      subject: contactForm.querySelector('[name="service"]')?.value || 'General Inquiry',
      service: contactForm.querySelector('[name="service"]')?.value,
      message: contactForm.querySelector('[name="message"]')?.value.trim(),
    };
    if (!data.name || !data.email || !data.message) { showStatus(status, 'Please fill in all required fields.', 'error'); return; }
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const json = await res.json();
      showStatus(status, json.message || (res.ok ? "Message sent. We'll respond within one business day." : 'Something went wrong. Please try again.'), res.ok ? 'success' : 'error');
      if (res.ok) contactForm.reset();
    } catch { showStatus(status, "Couldn't send message — please email hello@nexacore.com directly.", 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Send Message'; }
  });
}

function showStatus(el, msg, type) {
  if (!el) return;
  el.textContent = msg; el.className = `form-status ${type}`;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ── Careers job loader ── */
async function loadPublicJobs() {
  const grid = document.getElementById('jobGrid');
  if (!grid) return;
  try {
    const res = await fetch('/api/jobs', { credentials: 'include' });
    const data = await res.json();
    if (!data.success || !data.jobs?.length) {
      grid.innerHTML = `<div class="no-jobs"><p>No open positions right now. Check back soon or send your CV to <a href="mailto:careers@nexacore.com">careers@nexacore.com</a>.</p></div>`;
      return;
    }
    grid.innerHTML = data.jobs.map(job => `
      <div class="job-card reveal">
        <div class="job-card-top">
          <span class="job-type">${esc(job.type)}</span>
          <span class="job-dept">${esc(job.department)}</span>
        </div>
        <h3>${esc(job.title)}</h3>
        <p>${esc(job.description)}</p>
        <button onclick="openApplyModal('${esc(job._id)}','${esc(job.title)}')" class="btn btn-primary" style="margin-top:18px;display:inline-flex;">Apply Now <span class="arrow">→</span></button>
      </div>`).join('');
    initReveal();
  } catch {
    grid.innerHTML = `<div class="no-jobs"><p>Could not load positions. Please email <a href="mailto:careers@nexacore.com">careers@nexacore.com</a>.</p></div>`;
  }
}

function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
