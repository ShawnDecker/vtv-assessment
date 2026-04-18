/**
 * VTV Global Navigation — Sticky top bar with Assessment, Member Portal, Products dropdown
 * Inject via <script src="/nav.js"></script> on any page
 */
(function() {
  // Don't double-inject
  if (document.getElementById('vtv-global-nav')) return;

  // Remove the old fixed member-login button if it exists
  var oldBtn = document.getElementById('member-login-btn');
  if (oldBtn) oldBtn.style.display = 'none';

  // Current path for active state
  var path = window.location.pathname;

  // Check if user is logged in
  var isLoggedIn = false;
  try {
    isLoggedIn = !!localStorage.getItem('vtv_token') || !!localStorage.getItem('ve_email');
  } catch(e) {}

  // ── CSS ──
  var css = document.createElement('style');
  css.textContent = `
    #vtv-global-nav {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10000;
      background: rgba(10, 10, 10, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid #1e1e21;
      font-family: 'Satoshi', sans-serif;
      transition: transform 0.3s ease;
    }
    #vtv-global-nav.nav-hidden {
      transform: translateY(-100%);
    }
    .vtv-nav-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.25rem;
      height: 56px;
    }

    /* Logo */
    .vtv-nav-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      color: #fff;
      font-weight: 700;
      font-size: 0.9rem;
      letter-spacing: 0.02em;
      flex-shrink: 0;
    }
    .vtv-nav-logo svg { flex-shrink: 0; }
    .vtv-nav-logo-text {
      font-family: 'Instrument Serif', serif;
      font-style: italic;
      font-size: 1.1rem;
      color: #D4A847;
    }

    /* Desktop links */
    .vtv-nav-links {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .vtv-nav-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 8px 14px;
      color: #a1a1aa;
      text-decoration: none;
      font-size: 0.82rem;
      font-weight: 500;
      border-radius: 6px;
      transition: color 0.2s, background 0.2s;
      white-space: nowrap;
      position: relative;
    }
    .vtv-nav-link:hover { color: #fff; background: rgba(255,255,255,0.05); }
    .vtv-nav-link.active { color: #D4A847; }
    .vtv-nav-link svg { width: 15px; height: 15px; flex-shrink: 0; }

    /* Dropdown */
    .vtv-nav-dropdown {
      position: relative;
    }
    .vtv-nav-dropdown-trigger {
      cursor: pointer;
      user-select: none;
    }
    .vtv-nav-dropdown-trigger .vtv-chevron {
      transition: transform 0.2s;
    }
    .vtv-nav-dropdown:hover .vtv-chevron,
    .vtv-nav-dropdown.open .vtv-chevron {
      transform: rotate(180deg);
    }
    .vtv-nav-dropdown-menu {
      position: absolute;
      top: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 8px;
      min-width: 260px;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s, transform 0.2s;
      transform: translateX(-50%) translateY(-4px);
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    }
    .vtv-nav-dropdown:hover .vtv-nav-dropdown-menu,
    .vtv-nav-dropdown.open .vtv-nav-dropdown-menu {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(0);
    }
    .vtv-dd-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      text-decoration: none;
      border-radius: 8px;
      transition: background 0.15s;
    }
    .vtv-dd-item:hover { background: rgba(212,168,71,0.08); }
    .vtv-dd-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 1rem;
    }
    .vtv-dd-icon.green { background: rgba(74,222,128,0.12); }
    .vtv-dd-icon.gold { background: rgba(212,168,71,0.12); }
    .vtv-dd-icon.purple { background: rgba(167,139,250,0.12); }
    .vtv-dd-icon.cyan { background: rgba(34,211,238,0.12); }
    .vtv-dd-icon.pink { background: rgba(244,114,182,0.12); }
    .vtv-dd-info { flex: 1; }
    .vtv-dd-title {
      font-size: 0.82rem;
      font-weight: 600;
      color: #fff;
      line-height: 1.3;
    }
    .vtv-dd-desc {
      font-size: 0.7rem;
      color: #71717a;
      line-height: 1.4;
    }
    .vtv-dd-price {
      font-size: 0.65rem;
      color: #D4A847;
      font-weight: 700;
    }
    .vtv-dd-divider {
      height: 1px;
      background: #27272a;
      margin: 4px 8px;
    }

    /* CTA buttons (right side) */
    .vtv-nav-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .vtv-nav-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 18px;
      font-family: 'Satoshi', sans-serif;
      font-size: 0.8rem;
      font-weight: 700;
      border-radius: 8px;
      text-decoration: none;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .vtv-nav-btn-primary {
      background: linear-gradient(135deg, #D4A847, #b8942e);
      color: #0a0a0a;
      border: none;
    }
    .vtv-nav-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
    .vtv-nav-btn-ghost {
      background: transparent;
      color: #D4A847;
      border: 1px solid rgba(212,168,71,0.3);
    }
    .vtv-nav-btn-ghost:hover { border-color: #D4A847; background: rgba(212,168,71,0.06); }
    .vtv-nav-btn svg { width: 14px; height: 14px; }

    /* Mobile hamburger */
    .vtv-nav-hamburger {
      display: none;
      flex-direction: column;
      gap: 5px;
      cursor: pointer;
      padding: 6px;
      border: none;
      background: none;
      z-index: 10001;
    }
    .vtv-nav-hamburger span {
      display: block;
      width: 22px;
      height: 2px;
      background: #a1a1aa;
      border-radius: 2px;
      transition: all 0.3s;
    }
    .vtv-nav-hamburger.open span:nth-child(1) { transform: rotate(45deg) translate(5px, 5px); }
    .vtv-nav-hamburger.open span:nth-child(2) { opacity: 0; }
    .vtv-nav-hamburger.open span:nth-child(3) { transform: rotate(-45deg) translate(5px, -5px); }

    /* Mobile menu */
    .vtv-mobile-menu {
      display: none;
      position: fixed;
      top: 56px;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(10,10,10,0.98);
      backdrop-filter: blur(12px);
      z-index: 9999;
      padding: 1.5rem;
      overflow-y: auto;
    }
    .vtv-mobile-menu.open { display: block; animation: vtvSlideDown 0.25s ease; }
    @keyframes vtvSlideDown { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
    .vtv-mobile-menu a {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      color: #d4d4d8;
      text-decoration: none;
      font-size: 0.95rem;
      font-weight: 500;
      border-radius: 10px;
      transition: background 0.15s;
    }
    .vtv-mobile-menu a:hover { background: rgba(255,255,255,0.05); }
    .vtv-mobile-menu a.active { color: #D4A847; }
    .vtv-mobile-menu svg { width: 18px; height: 18px; flex-shrink: 0; }
    .vtv-mobile-divider { height: 1px; background: #27272a; margin: 12px 0; }
    .vtv-mobile-label {
      font-size: 0.65rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #52525b;
      padding: 8px 16px 4px;
      font-weight: 700;
    }
    .vtv-mobile-cta {
      display: flex;
      gap: 10px;
      padding: 16px;
      margin-top: 8px;
    }
    .vtv-mobile-cta a {
      flex: 1;
      justify-content: center;
      padding: 14px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 0.9rem;
    }
    .vtv-mobile-cta .vtv-m-primary {
      background: linear-gradient(135deg, #D4A847, #b8942e);
      color: #0a0a0a;
    }
    .vtv-mobile-cta .vtv-m-ghost {
      background: transparent;
      border: 1px solid rgba(212,168,71,0.3);
      color: #D4A847;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .vtv-nav-links { display: none; }
      .vtv-nav-actions { display: none; }
      .vtv-nav-hamburger { display: flex; }
    }

    /* Push body content below nav */
    body { padding-top: 56px !important; }
  `;
  document.head.appendChild(css);

  // ── SVG Icons ──
  var icons = {
    assess: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    member: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    products: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    chevron: '<svg class="vtv-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><polyline points="6 9 12 15 18 9"/></svg>',
    pricing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    dating: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    coaching: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    pink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    teams: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    login: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>'
  };

  // ── Active state helper ──
  function isActive(href) {
    if (href === '/') return path === '/' || path === '/index.html';
    return path.indexOf(href) === 0;
  }
  function activeClass(href) { return isActive(href) ? ' active' : ''; }

  // ── Build nav HTML ──
  var nav = document.createElement('nav');
  nav.id = 'vtv-global-nav';
  nav.innerHTML = `
    <div class="vtv-nav-inner">
      <!-- Logo -->
      <a href="/" class="vtv-nav-logo">
        <span class="vtv-nav-logo-text">Value to Victory</span>
      </a>

      <!-- Center links -->
      <ul class="vtv-nav-links">
        <li><a href="/" class="vtv-nav-link${activeClass('/')}">Home</a></li>
        <li><a href="/about-pink" class="vtv-nav-link${activeClass('/about-pink')}">P.I.N.K. Framework</a></li>
        <li class="vtv-nav-dropdown">
          <a class="vtv-nav-link vtv-nav-dropdown-trigger${activeClass('/pricing')}">
            ${icons.products} Products ${icons.chevron}
          </a>
          <div class="vtv-nav-dropdown-menu">
            <a href="/pricing" class="vtv-dd-item">
              <div class="vtv-dd-icon gold">${icons.pricing}</div>
              <div class="vtv-dd-info">
                <div class="vtv-dd-title">All Plans & Pricing</div>
                <div class="vtv-dd-desc">Compare VictoryPath, Value Builder, Victory VIP</div>
              </div>
            </a>
            <div class="vtv-dd-divider"></div>
            <a href="/pricing#victorypathCard" class="vtv-dd-item">
              <div class="vtv-dd-icon green">🟢</div>
              <div class="vtv-dd-info">
                <div class="vtv-dd-title">VictoryPath</div>
                <div class="vtv-dd-desc">Core assessment + AI coaching</div>
                <div class="vtv-dd-price">$29/mo · $290/yr</div>
              </div>
            </a>
            <a href="/pricing#valueBuilderCard" class="vtv-dd-item">
              <div class="vtv-dd-icon gold">⭐</div>
              <div class="vtv-dd-info">
                <div class="vtv-dd-title">Value Builder</div>
                <div class="vtv-dd-desc">Couples mode + dating + groups</div>
                <div class="vtv-dd-price">$47/mo · $470/yr</div>
              </div>
            </a>
            <a href="/pricing#victoryVIPCard" class="vtv-dd-item">
              <div class="vtv-dd-icon purple">👑</div>
              <div class="vtv-dd-info">
                <div class="vtv-dd-title">Victory VIP</div>
                <div class="vtv-dd-desc">1:1 coaching + all access</div>
                <div class="vtv-dd-price">$497/mo · $4,970/yr</div>
              </div>
            </a>
            <div class="vtv-dd-divider"></div>
            <a href="/coaching" class="vtv-dd-item">
              <div class="vtv-dd-icon cyan">${icons.coaching}</div>
              <div class="vtv-dd-info">
                <div class="vtv-dd-title">1:1 Coaching</div>
                <div class="vtv-dd-desc">Personal sessions with Shawn</div>
              </div>
            </a>
            <a href="/faith-match" class="vtv-dd-item">
              <div class="vtv-dd-icon pink">${icons.dating}</div>
              <div class="vtv-dd-info">
                <div class="vtv-dd-title">Faith Match Dating</div>
                <div class="vtv-dd-desc">Standards-based, not photo swiping</div>
              </div>
            </a>
            <a href="/teams" class="vtv-dd-item">
              <div class="vtv-dd-icon cyan">${icons.teams}</div>
              <div class="vtv-dd-info">
                <div class="vtv-dd-title">Enterprise & Teams</div>
                <div class="vtv-dd-desc">Group assessments for organizations</div>
              </div>
            </a>
          </div>
        </li>
        <li><a href="/free-book" class="vtv-nav-link${activeClass('/free-book')}">Free Book</a></li>
      </ul>

      <!-- Right actions -->
      <div class="vtv-nav-actions">
        <a href="/member" class="vtv-nav-btn vtv-nav-btn-ghost">
          ${icons.login} ${isLoggedIn ? 'My Portal' : 'Member Login'}
        </a>
        <a href="/#/mode-select" class="vtv-nav-btn vtv-nav-btn-primary">
          Take Assessment
        </a>
      </div>

      <!-- Mobile hamburger -->
      <button class="vtv-nav-hamburger" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>

    <!-- Mobile menu -->
    <div class="vtv-mobile-menu">
      <div class="vtv-mobile-cta">
        <a href="/#/mode-select" class="vtv-m-primary">Take Assessment</a>
        <a href="/member" class="vtv-m-ghost">${isLoggedIn ? 'My Portal' : 'Login'}</a>
      </div>
      <div class="vtv-mobile-divider"></div>

      <a href="/"${isActive('/') ? ' class="active"' : ''}>${icons.assess} Home</a>
      <a href="/about-pink"${isActive('/about-pink') ? ' class="active"' : ''}>${icons.pink} P.I.N.K. Framework</a>
      <a href="/free-book"${isActive('/free-book') ? ' class="active"' : ''}>${icons.book} Free Book</a>

      <div class="vtv-mobile-divider"></div>
      <div class="vtv-mobile-label">Products & Tiers</div>

      <a href="/pricing">${icons.pricing} All Plans & Pricing</a>
      <a href="/pricing#victorypathCard">🟢 VictoryPath — $29/mo</a>
      <a href="/pricing#valueBuilderCard">⭐ Value Builder — $47/mo</a>
      <a href="/pricing#victoryVIPCard">👑 Victory VIP — $497/mo</a>

      <div class="vtv-mobile-divider"></div>
      <div class="vtv-mobile-label">Features</div>

      <a href="/coaching">${icons.coaching} 1:1 Coaching</a>
      <a href="/faith-match">${icons.dating} Faith Match Dating</a>
      <a href="/teams">${icons.teams} Enterprise & Teams</a>
    </div>
  `;

  // Insert at top of body
  document.body.insertBefore(nav, document.body.firstChild);

  // ── Mobile toggle ──
  var hamburger = nav.querySelector('.vtv-nav-hamburger');
  var mobileMenu = nav.querySelector('.vtv-mobile-menu');
  hamburger.addEventListener('click', function() {
    hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
    document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
  });

  // Close mobile menu on link click
  mobileMenu.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', function() {
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  // ── Mobile dropdown toggle (touch) ──
  var dropdowns = nav.querySelectorAll('.vtv-nav-dropdown-trigger');
  dropdowns.forEach(function(trigger) {
    trigger.addEventListener('click', function(e) {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        trigger.closest('.vtv-nav-dropdown').classList.toggle('open');
      }
    });
  });

  // ── Auto-hide on scroll down, show on scroll up ──
  var lastScroll = 0;
  var navEl = document.getElementById('vtv-global-nav');
  window.addEventListener('scroll', function() {
    var current = window.pageYOffset;
    if (current > lastScroll && current > 120) {
      navEl.classList.add('nav-hidden');
    } else {
      navEl.classList.remove('nav-hidden');
    }
    lastScroll = current;
  }, { passive: true });

})();
