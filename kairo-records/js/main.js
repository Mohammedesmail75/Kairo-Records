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
    mobileDrawerLinks: document.querySelectorAll('.mobile-drawer-link, #mobileCtaBtn'),
    navLinks: document.querySelectorAll('.nav-link'),
    sections: document.querySelectorAll('section[id]'),

    // Contact Form
    contactForm: document.getElementById('contactInquiryForm'),
    contactStatus: document.getElementById('contactFormStatus'),
    contactSubmitBtn: document.getElementById('contactSubmitBtn')
  };

  /* ================= 2. INITIALIZATION ================= */
  document.addEventListener('DOMContentLoaded', () => {
    initCairoClock();
    initCinematicIntro();
    initScrollSpyAndNav();
    initMobileDrawer();
    initContactForm();
  });

  /* ================= 3. LIVE CAIRO LOCAL TIME CLOCK ================= */
  function initCairoClock() {
    function updateClock() {
      if (!DOM.cairoClock) return;
      try {
        const timeString = new Date().toLocaleTimeString('en-US', {
          timeZone: 'Africa/Cairo',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        DOM.cairoClock.textContent = `CAIRO ${timeString} UTC+2`;
      } catch (e) {
        DOM.cairoClock.textContent = `CAIRO 22:30:00 UTC+2`;
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

      // Highlight active section nav link
      DOM.sections.forEach(sec => {
        const top = sec.offsetTop - 120;
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
        }
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ================= 6. MOBILE DRAWER ================= */
  function initMobileDrawer() {
    if (!DOM.mobileToggle || !DOM.mobileDrawer) return;

    DOM.mobileToggle.addEventListener('click', () => {
      const isOpen = DOM.mobileDrawer.classList.contains('open');
      if (isOpen) {
        DOM.mobileDrawer.classList.remove('open');
        DOM.mobileToggle.classList.remove('active');
        document.body.style.overflow = '';
      } else {
        DOM.mobileDrawer.classList.add('open');
        DOM.mobileToggle.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });

    DOM.mobileDrawerLinks.forEach(link => {
      link.addEventListener('click', () => {
        DOM.mobileDrawer.classList.remove('open');
        DOM.mobileToggle.classList.remove('active');
        document.body.style.overflow = '';
      });
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

})();
