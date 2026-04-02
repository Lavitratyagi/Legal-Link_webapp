// /* ══════════════════════════════════════════════
//    contact-support.js
//    FIX 4: Wires the Contact Support form to backend
//    FIX 5: Profile dropdown + Logout
//           (add <script src="contact-support.js"> to
//            any page that has the profile icon)
//    ══════════════════════════════════════════════ */

// const API = 'http://localhost:5000/api';

// /* ════════════════════════════════════
//    FIX 5 — PROFILE DROPDOWN + LOGOUT
//    Works on ANY page that has:
//      <div class="nav-right"> or
//      a button with id="profile-btn"
//    ════════════════════════════════════ */
// function initProfileDropdown() {
//   // Build dropdown HTML and inject it if not already in page
//   const navRight = document.querySelector('.nav-right') || document.querySelector('.nav-profile');
//   if (!navRight) return;

//   // Check if dropdown already exists (e.g. cases.html has it built-in)
//   if (document.getElementById('profile-dropdown')) {
//     // Just wire up the existing one
//     wireDropdown();
//     return;
//   }

//   // Inject dropdown markup after the profile button/icon
//   navRight.style.position = 'relative';
//   navRight.insertAdjacentHTML('beforeend', `
//     <div id="profile-dropdown" style="
//       display:none;position:absolute;top:calc(100% + 8px);right:0;
//       background:#fff;border:1px solid #e5e7eb;border-radius:10px;
//       box-shadow:0 8px 24px rgba(0,0,0,0.1);min-width:160px;
//       overflow:hidden;z-index:9999;
//     ">
//       <div style="padding:11px 16px;font-size:14px;font-weight:600;
//                   border-bottom:1px solid #f3f4f6;color:#374151;cursor:default">
//         👤 <span id="username-display">My Account</span>
//       </div>
//       <button onclick="goToCases()" style="
//         display:flex;align-items:center;gap:10px;width:100%;padding:11px 16px;
//         font-size:14px;color:#374151;background:none;border:none;cursor:pointer;
//         text-align:left;font-family:inherit;
//       " onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='none'">
//         📋 My Cases
//       </button>
//       <button onclick="logout()" style="
//         display:flex;align-items:center;gap:10px;width:100%;padding:11px 16px;
//         font-size:14px;color:#dc2626;background:none;border:none;cursor:pointer;
//         border-top:1px solid #f3f4f6;text-align:left;font-family:inherit;
//       " onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='none'">
//         🚪 Logout
//       </button>
//     </div>
//   `);

//   wireDropdown();
// }

// function wireDropdown() {
//   const dropdown = document.getElementById('profile-dropdown');
//   if (!dropdown) return;

//   // Find the profile trigger (button or icon)
//   const trigger = document.getElementById('profile-btn')
//     || document.querySelector('[data-lucide="user"]')?.closest('div')
//     || document.querySelector('.nav-profile');

//   if (trigger) {
//     trigger.style.cursor = 'pointer';
//     trigger.addEventListener('click', (e) => {
//       e.stopPropagation();
//       const isOpen = dropdown.style.display === 'block';
//       dropdown.style.display = isOpen ? 'none' : 'block';
//     });
//   }

//   // Close on outside click
//   document.addEventListener('click', () => {
//     dropdown.style.display = 'none';
//   });

//   // Show username
//   try {
//     const raw = localStorage.getItem('user') || localStorage.getItem('username');
//     if (raw) {
//       const parsed = JSON.parse(raw);
//       const name   = parsed.username || parsed.name || raw;
//       const el     = document.getElementById('username-display');
//       if (el) el.textContent = name;
//     }
//   } catch {
//     // not JSON — use raw value
//     const raw = localStorage.getItem('username');
//     const el  = document.getElementById('username-display');
//     if (el && raw) el.textContent = raw;
//   }
// }

// function goToCases() {
//   window.location.href = 'cases.html';
// }

// // ── FIX 5: Logout ────────────────────────────
// function logout() {
//   localStorage.removeItem('token');
//   localStorage.removeItem('user');
//   localStorage.removeItem('username');
//   sessionStorage.clear();
//   window.location.href = 'index.html'; // ← change to your login page if different
// }

// /* ════════════════════════════════════
//    FIX 4 — CONTACT SUPPORT FORM
//    Wires the form to POST /api/contact
//    Works with your existing HTML form
//    ════════════════════════════════════ */
// function initContactForm() {
//   // Support multiple possible form IDs / selectors
//   const form = document.getElementById('contact-form')
//     || document.querySelector('form[data-contact]')
//     || document.querySelector('.contact-form');

//   if (!form) return;   // not on a contact page — skip

//   form.addEventListener('submit', async (e) => {
//     e.preventDefault();

//     // Get fields — support various input name/id conventions
//     const nameEl    = form.querySelector('#contact-name, [name="name"], [placeholder*="Name"]');
//     const emailEl   = form.querySelector('#contact-email, [name="email"], [type="email"]');
//     const messageEl = form.querySelector('#contact-message, [name="message"], textarea');

//     const name    = nameEl?.value.trim();
//     const email   = emailEl?.value.trim();
//     const message = messageEl?.value.trim();

//     if (!name || !email || !message) {
//       showContactStatus('Please fill in all fields.', 'error');
//       return;
//     }

//     // Show loading state
//     const btn = form.querySelector('button[type="submit"], .submit-btn, [type="submit"]');
//     const originalText = btn?.textContent;
//     if (btn) { btn.textContent = 'Sending...'; btn.disabled = true; }

//     try {
//       const res  = await fetch(`${API}/contact`, {
//         method:  'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body:    JSON.stringify({ name, email, message })
//       });
//       const data = await res.json();

//       if (data.success) {
//         showContactStatus('✅ ' + data.message, 'success');
//         form.reset();
//       } else {
//         showContactStatus('❌ ' + (data.message || 'Submission failed'), 'error');
//       }
//     } catch (err) {
//       showContactStatus('❌ Network error — please try again.', 'error');
//     } finally {
//       if (btn) { btn.textContent = originalText; btn.disabled = false; }
//     }
//   });
// }

// function showContactStatus(msg, type) {
//   let el = document.getElementById('contact-status');
//   if (!el) {
//     el = document.createElement('div');
//     el.id = 'contact-status';
//     const form = document.getElementById('contact-form') || document.querySelector('form');
//     form?.after(el);
//   }
//   el.textContent = msg;
//   el.style.cssText = `
//     margin-top:12px; padding:12px 16px; border-radius:8px; font-size:14px;
//     font-weight:500;
//     background: ${type === 'success' ? '#dcfce7' : '#fee2e2'};
//     color:       ${type === 'success' ? '#166534' : '#991b1b'};
//   `;
//   if (type === 'success') setTimeout(() => el.remove(), 5000);
// }

// /* ── INIT on DOM ready ── */
// document.addEventListener('DOMContentLoaded', () => {
//   initProfileDropdown();
//   initContactForm();
// });