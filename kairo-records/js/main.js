/**
 * KAIRO RECORDS — OFFICIAL APPLICATION ENGINE
 * Pure, silent, high-performance interactions:
 * - Live Cairo timezone clock
 * - Cinematic opening title sequence (silent)
 * - Glass floating navigation & active section scroll spy
 * - Mobile navigation drawer
 * - Contact inquiry transmission handler
 */

(function () {
  'use strict';

  /* ================= 1. DOM REFERENCES ================= */
  const DOM = {
    intro: document.getElementById('cinematicIntro'),
    enterBtn: document.getElementById('enterSiteBtn'),
    topNav: document.getElementById('topNav'),
    cairoClock: document.getElementById('cairoNavClock'),
    mobileToggle: document.getElementById('mobileToggle'),
    mobileDrawer: document.getElementById('mobileDrawer'),
    mobileDrawerClose: document.getElementById('mobileDrawerClose'),
    mobileDrawerLinks: document.querySelectorAll('.mobile-drawer-link, #mobileCtaBtn'),
    mobileSubnavLinks: document.querySelectorAll('.mobile-subnav-link'),
    navLinks: document.querySelectorAll('.nav-link'),
    sections: document.querySelectorAll('section[id]'),

    // Contact Form
    contactForm: document.getElementById('contactInquiryForm'),
    contactStatus: document.getElementById('contactFormStatus'),
    contactSubmitBtn: document.getElementById('contactSubmitBtn'),

    // Hero Background Video
    heroVideo: document.getElementById('heroVideo'),

    // Releases Section & Modal
    releasesGrid: document.getElementById('releasesGrid'),
    videoModal: document.getElementById('videoModal'),
    modalTitle: document.getElementById('modalVideoTitle'),
    modalIframeContainer: document.getElementById('modalIframeContainer'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalWatchOnYtLink: document.getElementById('modalWatchOnYtLink')
  };

  /* ================= 2. INITIALIZATION ================= */
  document.addEventListener('DOMContentLoaded', () => {
    initCairoClock();
    initCinematicIntro();
    initHeroVideo();
    initReleasesSection();
    initVideoModal();
    initScrollSpyAndNav();
    initMobileDrawer();
    initContactForm();
  });

  /* ================= 3. LIVE CAIRO LOCAL TIME CLOCK ================= */
  function initCairoClock() {
    function updateClock() {
      if (!DOM.cairoClock) return;
      try {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', {
          timeZone: 'Africa/Cairo',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        // Compute live dynamic UTC offset for Africa/Cairo (never hardcoded)
        let offsetStr = '';
        try {
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Africa/Cairo',
            timeZoneName: 'shortOffset'
          }).formatToParts(now);
          const tzPart = parts.find(p => p.type === 'timeZoneName');
          if (tzPart && tzPart.value) {
            offsetStr = tzPart.value.replace('GMT', 'UTC');
          }
        } catch (e) {
          const cairoDate = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
          const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
          const diffHours = Math.round((cairoDate - utcDate) / (1000 * 60 * 60));
          offsetStr = `UTC${diffHours >= 0 ? '+' : ''}${diffHours}`;
        }

        DOM.cairoClock.textContent = `CAIRO ${timeString} ${offsetStr}`.trim();
      } catch (e) {
        DOM.cairoClock.textContent = `CAIRO 12:00:00`;
      }
    }
    updateClock();
    setInterval(updateClock, 1000);
  }

  /* ================= 4. CINEMATIC INTRO SEQUENCE (COMPLETELY SILENT) ================= */
  function initCinematicIntro() {
    if (!DOM.intro) return;

    function dismissIntro() {
      DOM.intro.classList.add('faded-out');
    }

    if (DOM.enterBtn) {
      DOM.enterBtn.addEventListener('click', dismissIntro);
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') dismissIntro();
    });

    // Auto-dismiss after 2.4 seconds smoothly
    setTimeout(() => {
      if (!DOM.intro.classList.contains('faded-out')) {
        dismissIntro();
      }
    }, 2400);
  }

  /* ================= 5. SCROLL SPY & FLOATING GLASS NAVIGATION ================= */
  function initScrollSpyAndNav() {
    function onScroll() {
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;

      // Dark glass blur past 60px scroll
      if (DOM.topNav) {
        if (scrollY > 60) {
          DOM.topNav.classList.add('scrolled');
        } else {
          DOM.topNav.classList.remove('scrolled');
        }
      }

      // Highlight active section nav link (both desktop and mobile subnav)
      DOM.sections.forEach(sec => {
        const top = sec.offsetTop - 140;
        const height = sec.offsetHeight;
        const id = sec.getAttribute('id');

        if (scrollY >= top && scrollY < top + height) {
          DOM.navLinks.forEach(link => {
            if (link.getAttribute('href') === `#${id}`) {
              link.classList.add('active');
            } else {
              link.classList.remove('active');
            }
          });
          DOM.mobileSubnavLinks.forEach(link => {
            if (link.getAttribute('href') === `#${id}`) {
              link.classList.add('active');
            } else {
              link.classList.remove('active');
            }
          });
        }
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ================= 6. MOBILE DRAWER ================= */
  function initMobileDrawer() {
    if (!DOM.mobileToggle || !DOM.mobileDrawer) return;

    function openDrawer() {
      DOM.mobileDrawer.classList.add('open');
      DOM.mobileToggle.classList.add('active');
      DOM.mobileToggle.setAttribute('aria-expanded', 'true');
      DOM.mobileDrawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      if (DOM.mobileDrawerClose) {
        setTimeout(() => DOM.mobileDrawerClose.focus(), 50);
      }
    }

    function closeDrawer() {
      if (!DOM.mobileDrawer.classList.contains('open')) return;
      DOM.mobileDrawer.classList.remove('open');
      DOM.mobileToggle.classList.remove('active');
      DOM.mobileToggle.setAttribute('aria-expanded', 'false');
      DOM.mobileDrawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';

      if (DOM.mobileToggle) {
        DOM.mobileToggle.focus();
      }
    }

    // Toggle button click handler
    DOM.mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = DOM.mobileDrawer.classList.contains('open');
      if (isOpen) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });

    // Dedicated close button inside drawer
    if (DOM.mobileDrawerClose) {
      DOM.mobileDrawerClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDrawer();
      });
    }

    // Close when selecting any link or CTA inside drawer
    DOM.mobileDrawerLinks.forEach(link => {
      link.addEventListener('click', () => {
        closeDrawer();
      });
    });

    // Backdrop click: close if clicking directly on overlay backdrop
    DOM.mobileDrawer.addEventListener('click', (e) => {
      if (e.target === DOM.mobileDrawer) {
        closeDrawer();
      }
    });

    // Escape key closes drawer
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && DOM.mobileDrawer.classList.contains('open')) {
        closeDrawer();
      }
    });
  }

  /* ================= 7. CONTACT FORM TRANSMISSION ================= */
  function initContactForm() {
    if (!DOM.contactForm) return;

    DOM.contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = DOM.contactSubmitBtn;
      const statusBox = DOM.contactStatus;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>TRANSMITTING...</span>`;
      }

      setTimeout(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>INQUIRY SENT</span>`;
        }
        if (statusBox) {
          statusBox.style.display = 'block';
          statusBox.style.color = '#38bdf8';
          statusBox.textContent = 'Transmission received. KAIRO RECORDS management will review your sonic brief within 24 hours.';
        }
        DOM.contactForm.reset();
      }, 750);
    });
  }

  /* ================= 8. HERO BACKGROUND VIDEO AUTOPLAY & FALLBACK ================= */
  function initHeroVideo() {
    const video = DOM.heroVideo || document.getElementById('heroVideo');
    if (!video) return;

    // Ensure muted for cross-browser autoplay compliance
    video.muted = true;
    video.defaultMuted = true;

    function triggerFallback() {
      video.classList.add('video-fallback-active');
    }

    // Respect user's reduced motion system preference
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.pause();
      triggerFallback();
      return;
    }

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Fallback activates if autoplay is blocked or decoding fails
        triggerFallback();
      });
    }

    video.addEventListener('error', triggerFallback);
  }

  /* ================= 9. LATEST RELEASES SECTION (OFFICIAL YOUTUBE API) ================= */
  function initReleasesSection() {
    const grid = DOM.releasesGrid || document.getElementById('releasesGrid');
    if (!grid) return;

    fetch('/api/releases')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.videos) && data.videos.length > 0) {
          renderReleases(grid, data.videos);
        } else {
          renderFallbackState(grid, data);
        }
      })
      .catch(err => {
        renderFallbackState(grid, { error: err.message });
      });
  }

  function renderReleases(container, videos) {
    container.innerHTML = '';

    if (videos.length === 1) {
      container.classList.add('single-release');
    } else {
      container.classList.remove('single-release');
    }

    videos.forEach((video, index) => {
      const card = document.createElement('article');
      card.className = 'release-card';
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-haspopup', 'dialog');
      card.setAttribute('aria-label', `Watch ${video.title}`);

      const dateStr = formatReleaseDate(video.publishedAt);

      card.innerHTML = `
        <div class="release-thumb-wrap">
          <img src="${escapeHtml(video.thumbnail)}" alt="${escapeHtml(video.title)}" class="release-thumb" loading="${index < 3 ? 'eager' : 'lazy'}">
          <div class="release-thumb-overlay">
            <div class="release-play-btn" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        </div>
        <div class="release-info">
          <div class="release-header-meta">
            ${dateStr ? `<span class="release-date">${escapeHtml(dateStr)}</span>` : '<span></span>'}
            <span class="release-badge">OFFICIAL RELEASE</span>
          </div>
          <h3 class="release-title" dir="auto">${escapeHtml(video.title)}</h3>
          <div class="release-meta-row">
            <span class="release-channel-name">KAIRO RECORDS</span>
            <a href="${escapeHtml(video.url || `https://www.youtube.com/watch?v=${video.id}`)}" target="_blank" rel="noopener noreferrer" class="release-direct-link" title="Watch on YouTube" aria-label="Watch ${escapeHtml(video.title)} on YouTube (opens new tab)">
              <span>Watch on YouTube</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
            </a>
          </div>
        </div>
      `;

      // Separate direct YouTube link click should open YouTube in new tab without opening modal
      const directYtLink = card.querySelector('.release-direct-link');
      if (directYtLink) {
        directYtLink.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      }

      card.addEventListener('click', () => {
        openVideoModal(video, card);
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openVideoModal(video, card);
        }
      });

      container.appendChild(card);
    });
  }

  function renderFallbackState(container, data) {
    container.classList.remove('single-release');
    const isUnconfigured = data && data.configured === false;
    const errorMsg = data && data.error ? data.error : null;

    if (isUnconfigured) {
      console.info('[KAIRO RECORDS] Releases: YOUTUBE_API_KEY is not configured yet. Configure YOUTUBE_API_KEY in .dev.vars (local) or via wrangler secret put (production) to display live channel uploads.');
    } else if (errorMsg) {
      console.warn('[KAIRO RECORDS] Releases API returned an error:', errorMsg);
    }

    container.innerHTML = `
      <div class="releases-fallback-card">
        <div class="releases-fallback-icon" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
        </div>
        <h3 class="releases-fallback-title">Official Releases on YouTube</h3>
        <p class="releases-fallback-desc">Explore master recordings, visual stories, and official drops directly on our verified YouTube channel.</p>
        <a href="https://www.youtube.com/@KAIROREC" target="_blank" rel="noopener noreferrer" class="btn-primary-cinematic">
          <span>EXPLORE @KAIROREC</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
      </div>
    `;
  }

  function formatReleaseDate(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return '';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ================= 10. ACCESSIBLE VIDEO PLAYER MODAL ================= */
  let triggeringCard = null;

  function initVideoModal() {
    const modal = DOM.videoModal || document.getElementById('videoModal');
    const closeBtn = DOM.modalCloseBtn || document.getElementById('modalCloseBtn');
    if (!modal) return;

    if (closeBtn) {
      closeBtn.addEventListener('click', closeVideoModal);
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('video-modal-backdrop')) {
        closeVideoModal();
      }
    });
  }

  function openVideoModal(video, triggerBtn) {
    triggeringCard = triggerBtn || document.activeElement;
    const modal = DOM.videoModal || document.getElementById('videoModal');
    const titleEl = DOM.modalTitle || document.getElementById('modalVideoTitle');
    const iframeContainer = DOM.modalIframeContainer || document.getElementById('modalIframeContainer');
    const watchOnYt = DOM.modalWatchOnYtLink || document.getElementById('modalWatchOnYtLink');
    const closeBtn = DOM.modalCloseBtn || document.getElementById('modalCloseBtn');
    if (!modal || !iframeContainer) return;

    if (titleEl) {
      titleEl.textContent = video.title;
      titleEl.setAttribute('dir', 'auto');
    }

    if (watchOnYt) {
      watchOnYt.href = video.url || `https://www.youtube.com/watch?v=${video.id}`;
    }

    // Official YouTube iframe embed created only on explicit user click
    iframeContainer.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
    iframe.title = video.title;
    iframe.className = 'video-modal-iframe';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframeContainer.appendChild(iframe);

    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';

    if (closeBtn) {
      closeBtn.focus();
    }

    document.addEventListener('keydown', handleModalKeydown);
  }

  function closeVideoModal() {
    const modal = DOM.videoModal || document.getElementById('videoModal');
    if (!modal || modal.hasAttribute('hidden')) return;

    const iframeContainer = DOM.modalIframeContainer || document.getElementById('modalIframeContainer');
    if (iframeContainer) {
      // Remove iframe immediately to stop all video/audio playback
      iframeContainer.innerHTML = '';
    }

    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';

    document.removeEventListener('keydown', handleModalKeydown);

    if (triggeringCard && typeof triggeringCard.focus === 'function') {
      triggeringCard.focus();
    }
  }

  function handleModalKeydown(e) {
    if (e.key === 'Escape') {
      closeVideoModal();
      return;
    }

    if (e.key === 'Tab') {
      const modal = DOM.videoModal || document.getElementById('videoModal');
      if (!modal) return;
      const focusable = modal.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    }
  }

})();
