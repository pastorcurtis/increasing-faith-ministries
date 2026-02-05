/* ═══════════════════════════════════════════════════════════════════════════
   ULTRA SPECTACULAR ENHANCEMENTS - JavaScript
   GSAP + ScrollTrigger + Barba.js + Lenis + Custom Cursor + Preloader
   ═══════════════════════════════════════════════════════════════════════════ */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════════
    // REDUCED MOTION CHECK - Respect user accessibility preferences
    // ═══════════════════════════════════════════════════════════════════════════
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. PRELOADER
    // ═══════════════════════════════════════════════════════════════════════════

    function initPreloader() {
        const preloader = document.querySelector('.preloader');
        const progressBar = document.querySelector('.preloader-progress-bar');

        if (!preloader) return;

        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 30;
            if (progress > 100) progress = 100;
            if (progressBar) progressBar.style.width = progress + '%';

            if (progress >= 100) {
                clearInterval(interval);
                setTimeout(() => {
                    preloader.classList.add('loaded');
                    document.body.classList.add('loaded');

                    // Trigger entrance animations after preloader
                    if (typeof gsap !== 'undefined') {
                        animatePageEntrance();
                    }
                }, 200);
            }
        }, 50);

        // Fallback - hide preloader after max 1 second
        setTimeout(() => {
            preloader.classList.add('loaded');
            document.body.classList.add('loaded');
        }, 1000);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. CUSTOM CURSOR
    // ═══════════════════════════════════════════════════════════════════════════

    function initCustomCursor() {
        // Don't init on touch devices
        if ('ontouchstart' in window) return;

        const cursorDot = document.querySelector('.cursor-dot');
        const cursorOutline = document.querySelector('.cursor-outline');

        if (!cursorDot || !cursorOutline) return;

        let mouseX = 0, mouseY = 0;
        let outlineX = 0, outlineY = 0;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;

            cursorDot.style.left = mouseX + 'px';
            cursorDot.style.top = mouseY + 'px';
        });

        // Smooth outline follow
        function animateOutline() {
            outlineX += (mouseX - outlineX) * 0.15;
            outlineY += (mouseY - outlineY) * 0.15;

            cursorOutline.style.left = outlineX + 'px';
            cursorOutline.style.top = outlineY + 'px';

            requestAnimationFrame(animateOutline);
        }
        animateOutline();

        // Hover effects
        const hoverElements = document.querySelectorAll('a, button, .btn, .nav-btn, .card, .value-card, .testimonial-card, .pathway-step, .week-card, .way-card, .leader-card, .mission-card');

        hoverElements.forEach(el => {
            el.addEventListener('mouseenter', () => {
                cursorDot.classList.add('hover');
                cursorOutline.classList.add('hover');
            });
            el.addEventListener('mouseleave', () => {
                cursorDot.classList.remove('hover');
                cursorOutline.classList.remove('hover');
            });
        });

        // Click effect
        document.addEventListener('mousedown', () => {
            cursorOutline.classList.add('clicking');
        });
        document.addEventListener('mouseup', () => {
            cursorOutline.classList.remove('clicking');
        });

        // Hide cursor when leaving window
        document.addEventListener('mouseleave', () => {
            cursorDot.style.opacity = '0';
            cursorOutline.style.opacity = '0';
        });
        document.addEventListener('mouseenter', () => {
            cursorDot.style.opacity = '1';
            cursorOutline.style.opacity = '1';
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. MAGNETIC BUTTONS
    // ═══════════════════════════════════════════════════════════════════════════

    function initMagneticButtons() {
        if ('ontouchstart' in window) return;
        // Skip magnetic effect if user prefers reduced motion
        if (prefersReducedMotion) return;

        const magneticElements = document.querySelectorAll('.btn, .nav-btn, .logo-img');

        magneticElements.forEach(el => {
            el.addEventListener('mousemove', (e) => {
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;

                if (typeof gsap !== 'undefined') {
                    gsap.to(el, {
                        x: x * 0.3,
                        y: y * 0.3,
                        duration: 0.3,
                        ease: 'power2.out'
                    });
                }
            });

            el.addEventListener('mouseleave', () => {
                if (typeof gsap !== 'undefined') {
                    gsap.to(el, {
                        x: 0,
                        y: 0,
                        duration: 0.5,
                        ease: 'elastic.out(1, 0.5)'
                    });
                }
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. SCROLL PROGRESS INDICATOR
    // ═══════════════════════════════════════════════════════════════════════════

    function initScrollProgress() {
        const progressBar = document.querySelector('.scroll-progress');
        if (!progressBar) return;

        function updateProgress() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = (scrollTop / scrollHeight) * 100;
            progressBar.style.width = progress + '%';
        }

        window.addEventListener('scroll', updateProgress, { passive: true });
        updateProgress();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. DARK MODE TOGGLE
    // ═══════════════════════════════════════════════════════════════════════════

    function initDarkModeToggle() {
        const toggle = document.querySelector('.theme-toggle');
        if (!toggle) return;

        // Check for saved preference or system preference
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else if (!prefersDark) {
            // Default is dark, only change if system prefers light
            // document.documentElement.setAttribute('data-theme', 'light');
        }

        toggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';

            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);

            // Animate toggle
            if (typeof gsap !== 'undefined') {
                gsap.to(toggle, {
                    rotation: '+=360',
                    duration: 0.5,
                    ease: 'power2.out'
                });
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. LENIS SMOOTH SCROLL
    // ═══════════════════════════════════════════════════════════════════════════

    let lenis;

    function initSmoothScroll() {
        if (typeof Lenis === 'undefined') return;

        lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 2,
            infinite: false,
        });

        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);

        // Integrate with GSAP ScrollTrigger
        if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
            lenis.on('scroll', ScrollTrigger.update);
            gsap.ticker.add((time) => {
                lenis.raf(time * 1000);
            });
            gsap.ticker.lagSmoothing(0);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. GSAP SCROLL ANIMATIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function initGSAPAnimations() {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
        // Skip heavy animations if user prefers reduced motion
        if (prefersReducedMotion) return;

        gsap.registerPlugin(ScrollTrigger);

        // Replace default reveal with GSAP
        const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
        reveals.forEach((el, i) => {
            const direction = el.classList.contains('reveal-left') ? -60 :
                              el.classList.contains('reveal-right') ? 60 : 0;

            gsap.fromTo(el,
                {
                    opacity: 0,
                    y: el.classList.contains('reveal') ? 60 : 0,
                    x: direction
                },
                {
                    opacity: 1,
                    y: 0,
                    x: 0,
                    duration: 1,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: el,
                        start: 'top 85%',
                        toggleActions: 'play none none none'
                    },
                    delay: i * 0.1
                }
            );
        });

        // Stagger animations for cards
        const cardGrids = document.querySelectorAll('.values-grid, .pathway-grid, .testimonials-grid, .cards-grid, .weeks-grid, .ways-grid, .mission-grid, .leadership-grid');
        cardGrids.forEach(grid => {
            const cards = grid.children;
            gsap.fromTo(cards,
                { opacity: 0, y: 50, scale: 0.95 },
                {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: 0.8,
                    stagger: 0.15,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: grid,
                        start: 'top 80%',
                        toggleActions: 'play none none none'
                    }
                }
            );
        });

        // Parallax for floating images
        const floatImgs = document.querySelectorAll('.float-img');
        floatImgs.forEach((img, i) => {
            gsap.to(img, {
                yPercent: -20 * (i % 3 + 1),
                ease: 'none',
                scrollTrigger: {
                    trigger: document.body,
                    start: 'top top',
                    end: 'bottom bottom',
                    scrub: 1
                }
            });
        });

        // Hero text animation
        const heroH1 = document.querySelector('.hero h1');
        if (heroH1) {
            gsap.fromTo(heroH1,
                { opacity: 0, y: 100, scale: 0.9 },
                { opacity: 1, y: 0, scale: 1, duration: 1.5, ease: 'power4.out', delay: 0.3 }
            );
        }

        // Section headers with text reveal effect
        const sectionHeaders = document.querySelectorAll('.section-header h2');
        sectionHeaders.forEach(header => {
            gsap.fromTo(header,
                { opacity: 0, y: 50, clipPath: 'polygon(0 0, 100% 0, 100% 0, 0 0)' },
                {
                    opacity: 1,
                    y: 0,
                    clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
                    duration: 1,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: header,
                        start: 'top 85%',
                        toggleActions: 'play none none none'
                    }
                }
            );
        });

        // Nav background on scroll
        const nav = document.querySelector('.nav');
        if (nav) {
            ScrollTrigger.create({
                start: 100,
                onUpdate: (self) => {
                    if (self.scroll() > 100) {
                        nav.classList.add('scrolled');
                    } else {
                        nav.classList.remove('scrolled');
                    }
                }
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 8. COUNTER ANIMATIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function initCounterAnimations() {
        const counters = document.querySelectorAll('.impact-number, .counter');

        counters.forEach(counter => {
            const text = counter.textContent;
            const isNumber = /^\d+/.test(text);

            if (!isNumber) return;

            const target = parseInt(text);
            counter.textContent = '0';

            if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
                ScrollTrigger.create({
                    trigger: counter,
                    start: 'top 85%',
                    onEnter: () => {
                        gsap.to(counter, {
                            textContent: target,
                            duration: 2,
                            ease: 'power2.out',
                            snap: { textContent: 1 },
                            onUpdate: function() {
                                counter.textContent = Math.round(this.targets()[0].textContent);
                            }
                        });
                    },
                    once: true
                });
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 9. PAGE ENTRANCE ANIMATION
    // ═══════════════════════════════════════════════════════════════════════════

    function animatePageEntrance() {
        if (typeof gsap === 'undefined') return;

        const tl = gsap.timeline();

        // Animate hero content
        const heroContent = document.querySelector('.hero-content');
        if (heroContent) {
            tl.fromTo(heroContent,
                { opacity: 0, y: 50 },
                { opacity: 1, y: 0, duration: 1, ease: 'power3.out' }
            );
        }

        // Animate nav
        const navLinks = document.querySelectorAll('.nav-links li');
        tl.fromTo(navLinks,
            { opacity: 0, y: -20 },
            { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' },
            '-=0.5'
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 10. BARBA.JS PAGE TRANSITIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function initBarba() {
        if (typeof barba === 'undefined' || typeof gsap === 'undefined') return;

        barba.init({
            transitions: [{
                name: 'default-transition',
                leave(data) {
                    const layers = document.querySelectorAll('.page-transition-layer');

                    return gsap.timeline()
                        .to(layers, {
                            y: 0,
                            stagger: 0.1,
                            duration: 0.5,
                            ease: 'power3.inOut'
                        })
                        .to(data.current.container, {
                            opacity: 0,
                            duration: 0.3
                        }, '-=0.3');
                },
                enter(data) {
                    const layers = document.querySelectorAll('.page-transition-layer');

                    return gsap.timeline()
                        .set(data.next.container, { opacity: 0 })
                        .to(layers, {
                            y: '-100%',
                            stagger: 0.1,
                            duration: 0.5,
                            ease: 'power3.inOut'
                        })
                        .to(data.next.container, {
                            opacity: 1,
                            duration: 0.3
                        }, '-=0.3')
                        .set(layers, { y: '100%' });
                },
                afterEnter() {
                    window.scrollTo(0, 0);

                    // Reinitialize components
                    initCustomCursor();
                    initMagneticButtons();
                    initGSAPAnimations();
                    initCounterAnimations();

                    // Refresh ScrollTrigger
                    if (typeof ScrollTrigger !== 'undefined') {
                        ScrollTrigger.refresh();
                    }

                    // Refresh Lenis
                    if (lenis) {
                        lenis.scrollTo(0, { immediate: true });
                    }
                }
            }]
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 11. IMAGE REVEAL ON SCROLL
    // ═══════════════════════════════════════════════════════════════════════════

    function initImageReveals() {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
        // Skip image reveal animations if user prefers reduced motion
        if (prefersReducedMotion) return;

        const imgReveals = document.querySelectorAll('.img-reveal');

        imgReveals.forEach(el => {
            const img = el.querySelector('img');
            const overlay = el.querySelector('::after') || el;

            gsap.fromTo(el,
                { clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)' },
                {
                    clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
                    duration: 1.2,
                    ease: 'power3.inOut',
                    scrollTrigger: {
                        trigger: el,
                        start: 'top 80%',
                        toggleActions: 'play none none none'
                    },
                    onComplete: () => el.classList.add('revealed')
                }
            );
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 12. TESTIMONIAL CARD TILT EFFECT
    // ═══════════════════════════════════════════════════════════════════════════

    function initCardTilt() {
        if ('ontouchstart' in window) return;
        // Skip tilt animations if user prefers reduced motion
        if (prefersReducedMotion) return;

        const cards = document.querySelectorAll('.testimonial-card, .value-card, .card, .week-card');

        cards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = (y - centerY) / 20;
                const rotateY = (centerX - x) / 20;

                if (typeof gsap !== 'undefined') {
                    gsap.to(card, {
                        rotateX: rotateX,
                        rotateY: rotateY,
                        transformPerspective: 1000,
                        duration: 0.3,
                        ease: 'power2.out'
                    });
                }
            });

            card.addEventListener('mouseleave', () => {
                if (typeof gsap !== 'undefined') {
                    gsap.to(card, {
                        rotateX: 0,
                        rotateY: 0,
                        duration: 0.5,
                        ease: 'power2.out'
                    });
                }
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 13. SCROLL-TRIGGERED BACKGROUND COLOR SHIFT
    // ═══════════════════════════════════════════════════════════════════════════

    function initBackgroundShift() {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
        // Skip background animations if user prefers reduced motion
        if (prefersReducedMotion) return;

        const sections = document.querySelectorAll('section');

        sections.forEach((section, i) => {
            const hue = (i * 5) % 360;

            ScrollTrigger.create({
                trigger: section,
                start: 'top center',
                onEnter: () => {
                    gsap.to('.bg-gradient', {
                        filter: `hue-rotate(${hue}deg)`,
                        duration: 1,
                        ease: 'power2.out'
                    });
                },
                onEnterBack: () => {
                    gsap.to('.bg-gradient', {
                        filter: `hue-rotate(${hue}deg)`,
                        duration: 1,
                        ease: 'power2.out'
                    });
                }
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INITIALIZE EVERYTHING
    // ═══════════════════════════════════════════════════════════════════════════

    function init() {
        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initAll);
        } else {
            initAll();
        }
    }

    function initAll() {
        initPreloader();
        initCustomCursor();
        initMagneticButtons();
        initScrollProgress();
        initDarkModeToggle();
        initSmoothScroll();
        initGSAPAnimations();
        initCounterAnimations();
        initBarba();
        initImageReveals();
        initCardTilt();
        initBackgroundShift();

        console.log('IFM Enhancements loaded successfully!');
    }

    // Start initialization
    init();

    // Expose some functions globally for debugging
    window.IFMEnhancements = {
        initCustomCursor,
        initGSAPAnimations,
        animatePageEntrance,
        lenis: () => lenis
    };

})();
