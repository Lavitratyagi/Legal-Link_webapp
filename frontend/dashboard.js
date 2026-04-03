// // Lucide Icon Initializer
// lucide.createIcons();

// // Smooth Scrolling for Navbar and Buttons
// document.querySelectorAll('a[href^="#"], .btn-primary').forEach(element => {
//     element.addEventListener('click', function(e) {
//         const targetAttr = this.getAttribute('href') || '#about';
//         const targetElement = document.querySelector(targetAttr);
        
//         if (targetElement) {
//             e.preventDefault();
//             window.scrollTo({
//                 top: targetElement.offsetTop - 80,
//                 behavior: 'smooth'
//             });
//         }
//     });
// });

// // Scroll Navbar Effect
// window.addEventListener('scroll', () => {
//     const nav = document.querySelector('.navbar');
//     if (window.scrollY > 50) {
//         nav.style.padding = '0.8rem 8%';
//         nav.style.borderBottom = '1px solid #eee';
//     } else {
//         nav.style.padding = '1rem 8%';
//         nav.style.borderBottom = 'none';
//     }
// });

// // Simple Reveal on Scroll
// const revealElements = document.querySelectorAll('.feature-card, .stat-box');
// const observer = new IntersectionObserver((entries) => {
//     entries.forEach(entry => {
//         if (entry.isIntersecting) {
//             entry.target.style.opacity = '1';
//             entry.target.style.transform = 'translateY(0)';
//         }
//     });
// }, { threshold: 0.1 });

// revealElements.forEach(el => {
//     el.style.opacity = '0';
//     el.style.transform = 'translateY(30px)';
//     el.style.transition = '0.6s ease-out';
//     observer.observe(el);
// });
// ══════════════════════════════════════════════
// Dashboard.js  — FIXED
// Adds to your existing Dashboard.html:
//   1. Profile dropdown with logout
//   2. Contact form wired to backend
//   3. Real case stats from MongoDB
// ══════════════════════════════════════════════

const API = 'http://localhost:5000/api';

document.addEventListener('DOMContentLoaded', () => {
  lucide?.createIcons?.();
  initProfileDropdown();
  initContactForm();
  loadCaseStats();
});

/* ════════════════════════════════════
   FIX 5 — PROFILE DROPDOWN + LOGOUT
   ════════════════════════════════════ */
function initProfileDropdown() {
  const navProfile = document.querySelector('.nav-profile');
  if (!navProfile) return;

  // Make it position:relative so dropdown sits under it
  navProfile.style.position = 'relative';
  navProfile.style.cursor   = 'pointer';

  // Inject dropdown
  navProfile.insertAdjacentHTML('beforeend', `
    <div id="profile-dropdown" class="glass-card" style="
      display:none; position:absolute; top:calc(100% + 15px); right:0;
      min-width:200px; overflow:hidden; z-index:9999; padding: 8px 0; background: var(--base-light);
    ">
      <div style="padding:12px 20px;font-size:0.8rem;font-weight:700;
                  border-bottom:1px solid var(--glass-border);color:var(--gold);text-transform:uppercase;">
        👤 <span id="nav-username">Lawyer</span>
      </div>

      <button onclick="logout()" style="
        display:flex;align-items:center;gap:12px;width:100%;padding:14px 20px;
        font-size:0.9rem;color:#ef4444;background:none;border:none;cursor:pointer;
        text-align:left;font-family:inherit;font-weight:600;
      " onmouseover="this.style.background='rgba(239, 68, 68, 0.1)'" onmouseout="this.style.background='none'">
        🚪 Logout session
      </button>
    </div>
  `);

  // Toggle on click
  navProfile.addEventListener('click', (e) => {
    e.stopPropagation();
    const dd = document.getElementById('profile-dropdown');
    dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
  });

  // Close on outside click
  document.addEventListener('click', () => {
    const dd = document.getElementById('profile-dropdown');
    if (dd) dd.style.display = 'none';
  });

  // Show stored username
  try {
    const raw = localStorage.getItem('user') || localStorage.getItem('username');
    if (raw) {
      let name = raw;
      try { name = JSON.parse(raw).username || JSON.parse(raw).name || raw; } catch {}
      const el = document.getElementById('nav-username');
      if (el) el.textContent = name;
    }
  } catch {}
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('username');
  sessionStorage.clear();
  window.location.href = 'index.html';
}

/* ════════════════════════════════════
   FIX 3 — REAL CASE STATS
   Replaces hardcoded 12 / 4 / 28
   ════════════════════════════════════ */
async function loadCaseStats() {
  const statBoxes = document.querySelectorAll('.stat-box h3');
  if (!statBoxes.length) return;

  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch(`${API}/legal/my-cases`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    const s = data.stats || {};
    if (statBoxes[0]) statBoxes[0].textContent = s.total ?? 0;
    if (statBoxes[1]) statBoxes[1].textContent = s.active ?? 0;
    if (statBoxes[2]) statBoxes[2].textContent = s.resolved ?? 0;
  } catch (err) {
    console.warn('Could not load case stats:', err.message);
  }
}

/* ════════════════════════════════════
   FIX 4 — CONTACT FORM
   Wires your existing Dashboard.html
   contact form to POST /api/contact
   ════════════════════════════════════ */
function initContactForm() {
  // Your Dashboard.html has <form class="contact-form">
  const form = document.querySelector('.contact-form');
  if (!form) return;

  // Give the form an id so we can reference it
  form.id = 'contact-form-dashboard';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Get fields from your existing form inputs
    const inputs  = form.querySelectorAll('input, textarea');
    const nameEl  = inputs[0];   // "Full Name"
    const emailEl = inputs[1];   // "Email Address"
    const msgEl   = form.querySelector('textarea');

    const name    = nameEl?.value.trim();
    const email   = emailEl?.value.trim();
    const message = msgEl?.value.trim();

    if (!name || !email || !message) {
      showContactMsg('Please fill in all fields.', false);
      return;
    }

    const btn = form.querySelector('.submit-btn, button[type="submit"]');
    if (btn) { btn.textContent = 'Sending...'; btn.disabled = true; }

    try {
      const res  = await fetch(`${API}/contact`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, email, message })
      });
      const data = await res.json();

      if (data.success) {
        showContactMsg('✅ Message sent! We will reply within 24 hours.', true);
        form.reset();
      } else {
        showContactMsg('❌ Failed: ' + (data.message || 'Please try again.'), false);
      }
    } catch {
      showContactMsg('❌ Network error — make sure the backend is running.', false);
    } finally {
      if (btn) { btn.textContent = 'Submit Request'; btn.disabled = false; }
    }
  });
}

function showContactMsg(msg, success) {
  let el = document.getElementById('contact-msg');
  if (!el) {
    el = document.createElement('p');
    el.id = 'contact-msg';
    el.style.cssText = 'margin-top:12px;font-size:14px;font-weight:500;text-align:center;';
    document.querySelector('.contact-form')?.after(el);
  }
  el.textContent = msg;
  el.style.color = success ? '#10b981' : '#ef4444';
  if (success) setTimeout(() => el?.remove(), 5000);
}