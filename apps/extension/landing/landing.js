// =============================================
// SnapRec Landing Page - JavaScript
// =============================================

document.addEventListener('DOMContentLoaded', function () {
    // Mobile menu toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', function () {
            navLinks.classList.toggle('active');
            mobileMenuBtn.classList.toggle('active');
        });
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });

                // Close mobile menu if open
                if (navLinks) {
                    navLinks.classList.remove('active');
                    mobileMenuBtn.classList.remove('active');
                }
            }
        });
    });

    // Navbar background on scroll
    const navbar = document.querySelector('.navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', function () {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 50) {
            navbar.style.background = 'rgba(10, 10, 20, 0.95)';
        } else {
            navbar.style.background = 'rgba(10, 10, 20, 0.8)';
        }

        lastScroll = currentScroll;
    });

    // Fade-in animation on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    // Add fade-in class and observe elements
    const animateElements = document.querySelectorAll(
        '.feature-card, .step-card, .testimonial-card, .section-header'
    );

    animateElements.forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });

    // Stagger animation for feature cards
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach((card, index) => {
        card.style.transitionDelay = `${index * 100}ms`;
    });

    // Stagger animation for testimonial cards
    const testimonialCards = document.querySelectorAll('.testimonial-card');
    testimonialCards.forEach((card, index) => {
        card.style.transitionDelay = `${index * 100}ms`;
    });

    // Typing effect for hero (optional enhancement)
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
        heroTitle.style.opacity = '0';
        heroTitle.style.transform = 'translateY(20px)';

        setTimeout(() => {
            heroTitle.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
            heroTitle.style.opacity = '1';
            heroTitle.style.transform = 'translateY(0)';
        }, 100);
    }

    // Animate hero elements sequentially
    const heroElements = [
        '.hero-subtitle',
        '.hero-cta',
        '.hero-trust'
    ];

    heroElements.forEach((selector, index) => {
        const el = document.querySelector(selector);
        if (el) {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';

            setTimeout(() => {
                el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, 300 + (index * 150));
        }
    });

    // Browser mockup entrance animation
    const browserMockup = document.querySelector('.browser-mockup');
    if (browserMockup) {
        browserMockup.style.opacity = '0';
        browserMockup.style.transform = 'translateY(30px) scale(0.95)';

        setTimeout(() => {
            browserMockup.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
            browserMockup.style.opacity = '1';
            browserMockup.style.transform = 'translateY(0) scale(1)';
        }, 500);
    }

    // Add hover sound effect to buttons (optional - disabled by default)
    // Uncomment to enable subtle click sounds
    /*
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Add click animation
            btn.style.transform = 'scale(0.98)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 100);
        });
    });
    */

    // Parallax effect for hero glow
    const heroGlows = document.querySelectorAll('.hero-glow');

    window.addEventListener('mousemove', (e) => {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;

        heroGlows.forEach((glow, index) => {
            const speed = index === 0 ? 30 : 20;
            const xOffset = (x - 0.5) * speed;
            const yOffset = (y - 0.5) * speed;

            glow.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
        });
    });

    console.log('🎬 SnapRec Landing Page loaded');
});

// Add mobile menu styles dynamically
const mobileMenuStyles = document.createElement('style');
mobileMenuStyles.textContent = `
    @media (max-width: 768px) {
        .nav-links.active {
            display: flex;
            flex-direction: column;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: rgba(10, 10, 20, 0.98);
            padding: var(--spacing-xl);
            gap: var(--spacing-lg);
            border-bottom: 1px solid var(--color-border);
            animation: slideDown 0.3s ease;
        }
        
        .mobile-menu-btn.active span:nth-child(1) {
            transform: rotate(45deg) translate(5px, 5px);
        }
        
        .mobile-menu-btn.active span:nth-child(2) {
            opacity: 0;
        }
        
        .mobile-menu-btn.active span:nth-child(3) {
            transform: rotate(-45deg) translate(7px, -6px);
        }
        
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    }
`;
document.head.appendChild(mobileMenuStyles);
