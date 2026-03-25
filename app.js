document.addEventListener('DOMContentLoaded', () => {
    // --- Navbar Scroll Logic (Optimized) ---
    const navbar = document.querySelector('.navbar');
    let isScrolled = false;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50 && !isScrolled) {
            navbar.classList.add('scrolled');
            isScrolled = true;
        } else if (window.scrollY <= 50 && isScrolled) {
            navbar.classList.remove('scrolled');
            isScrolled = false;
        }
    }, { passive: true });

    // --- Hero Slider ---
    const slider = document.getElementById('hero-slider');
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    const prevBtn = document.querySelector('.slider-prev');
    const nextBtn = document.querySelector('.slider-next');

    let currentSlide = 0;
    const slideIntervalTime = 5000;
    let slideInterval;

    function updateSlider() {
        // Update main slider
        if (slider) {
            slider.style.transform = `translateX(-${currentSlide * 100}%)`;
        }
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentSlide);
        });

        // Sync with Lightbox if open
        const lightboxImg = document.getElementById('lightbox-img');
        if (lightboxImg && slides[currentSlide]) {
            lightboxImg.src = slides[currentSlide].src;
            // Reset zoom when sliding
            lightboxImg.classList.remove('zoomed');
        }
    }

    function goToSlide(index) {
        currentSlide = (index + slides.length) % slides.length;
        updateSlider();
    }

    function nextSlide() { goToSlide(currentSlide + 1); }
    function prevSlide() { goToSlide(currentSlide - 1); }

    function startAutoSlide() { slideInterval = setInterval(nextSlide, slideIntervalTime); }
    function resetAutoSlide() { clearInterval(slideInterval); startAutoSlide(); }

    if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); prevSlide(); resetAutoSlide(); });
    if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); nextSlide(); resetAutoSlide(); });

    dots.forEach((dot, index) => {
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            goToSlide(index);
            resetAutoSlide();
        });
    });

    // Start auto-sliding
    startAutoSlide();

    // --- Advanced Lightbox Slider ---
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lBoxPrev = document.querySelector('.lightbox-prev');
    const lBoxNext = document.querySelector('.lightbox-next');
    const lBoxClose = document.querySelector('.lightbox-close');
    const heroSliderArea = document.querySelector('.hero-slider');
    const giveawayImg = document.querySelector('.poster-card img');
    const qrImg = document.querySelector('.qr-image-large');

    function openLightbox(src, showNav = false) {
        if (!lightbox || !lightboxImg) return;
        lightboxImg.src = src;
        lightboxImg.classList.remove('zoomed');

        // Show/Hide slider navigation in lightbox
        if (lBoxPrev) lBoxPrev.style.display = showNav ? 'flex' : 'none';
        if (lBoxNext) lBoxNext.style.display = showNav ? 'flex' : 'none';

        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    // Open Lightbox on slider click
    if (heroSliderArea) {
        heroSliderArea.addEventListener('click', () => {
            if (slides[currentSlide]) {
                openLightbox(slides[currentSlide].src, true);
            }
        });
    }

    // Open Lightbox for other images
    if (giveawayImg) {
        giveawayImg.addEventListener('click', (e) => {
            e.stopPropagation();
            openLightbox(giveawayImg.src, false);
        });
    }

    if (qrImg) {
        qrImg.addEventListener('click', (e) => {
            e.stopPropagation();
            openLightbox(qrImg.src, false);
        });
    }

    // Lightbox Controls
    if (lBoxPrev) lBoxPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        prevSlide();
        resetAutoSlide();
        // Sync lightbox image after slide
        if (slides[currentSlide]) lightboxImg.src = slides[currentSlide].src;
    });

    if (lBoxNext) lBoxNext.addEventListener('click', (e) => {
        e.stopPropagation();
        nextSlide();
        resetAutoSlide();
        // Sync lightbox image after slide
        if (slides[currentSlide]) lightboxImg.src = slides[currentSlide].src;
    });

    // Zoom Toggle
    if (lightboxImg) {
        lightboxImg.addEventListener('click', (e) => {
            e.stopPropagation();
            lightboxImg.classList.toggle('zoomed');
        });
    }

    // Close Lightbox
    const closeLBox = () => {
        if (lightbox) {
            lightbox.style.display = 'none';
        }
        document.body.style.overflow = 'auto';
        if (lightboxImg) lightboxImg.classList.remove('zoomed');
    };

    if (lBoxClose) lBoxClose.addEventListener('click', closeLBox);
    if (lightbox) lightbox.addEventListener('click', closeLBox);

    // --- Countdown Timer ---
    const targetDateElement = document.getElementById('days');
    if (targetDateElement) {
        const targetDate = new Date('2026-04-16T23:59:59').getTime();

        function updateCountdown() {
            const now = new Date().getTime();
            const distance = targetDate - now;

            if (distance < 0) {
                document.getElementById('days').innerText = '00';
                document.getElementById('hours').innerText = '00';
                document.getElementById('mins').innerText = '00';
                document.getElementById('secs').innerText = '00';
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((distance % (1000 * 60)) / 1000);

            if (document.getElementById('days')) document.getElementById('days').innerText = String(days).padStart(2, '0');
            if (document.getElementById('hours')) document.getElementById('hours').innerText = String(hours).padStart(2, '0');
            if (document.getElementById('mins')) document.getElementById('mins').innerText = String(mins).padStart(2, '0');
            if (document.getElementById('secs')) document.getElementById('secs').innerText = String(secs).padStart(2, '0');
        }

        updateCountdown();
        setInterval(updateCountdown, 1000);
    }

    // --- Data Fetching from Google Sheets ---
    const GOOGLE_SHEET_URL = `${API_CONFIG.BASE_URL}?action=getSummary`;

    let allDonations = [];
    let currentPage = 1;
    const itemsPerPage = 10;

    function formatNumber(num) {
        return new Intl.NumberFormat('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    }

    function formatThaiDate(dateStr) {
        const date = new Date(dateStr);
        const day = date.getDate();
        const monthNamesShort = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const month = monthNamesShort[date.getMonth()];
        const yearBE = (date.getFullYear() + 543).toString().slice(-2);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${day} ${month} ${yearBE} ${hours}:${minutes}`;
    }

    function showLoading() {
        const tbody = document.getElementById('donation-table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 40px;">
                        <div class="loading-container">
                            <span class="loading-text">กำลังโหลดข้อมูล...</span>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    async function fetchDonationData() {
        if (allDonations.length === 0) {
            showLoading();
            const currentAmountEl = document.getElementById('current-amount');
            if (currentAmountEl) currentAmountEl.innerText = 'กำลังโหลด...';
        }
        try {
            const response = await fetch(GOOGLE_SHEET_URL);
            const result = await response.json();

            if (result.status === 'ok') {
                // 1. Filter out rejected entries (not shown in table)
                const rawData = result.data.filter(d => d.status !== 'rejected');

                // 2. allDonations for TABLE (Show all non-rejected)
                allDonations = rawData.filter(d => (parseFloat(d.amount) || 0) > 0);

                // 3. approvedDonations for PROGRESS BAR (Sum ONLY approved)
                const approvedDonations = rawData.filter(d => {
                    const amt = parseFloat(d.amount) || 0;
                    const isApproved = String(d.status).toLowerCase() === 'approved';
                    return amt > 0 && isApproved;
                });

                let calculatedTotal = 0;
                approvedDonations.forEach(d => {
                    let val = parseFloat(d.amount) || 0;
                    calculatedTotal += val;
                });

                // Use calculated total for progress bar, but total items in table is from allDonations
                updateStats(calculatedTotal, allDonations.length);
                renderDonationPage(currentPage);

                // --- Quote Marquee Rendering ---
                const quotesWithMsg = allDonations.filter(d => d.quote && d.quote.trim().length > 0);
                const marqueeSection = document.getElementById('quote-section');
                const marqueeContent = document.getElementById('quote-marquee-content');

                if (quotesWithMsg.length > 0 && marqueeSection && marqueeContent) {
                    marqueeSection.style.display = 'block';

                    // Filter out duplicates if needed, but here we just double for marquee effect
                    // If too few quotes, double them to ensure it fills the screen
                    const baseItems = quotesWithMsg.length < 5 ? [...quotesWithMsg, ...quotesWithMsg] : quotesWithMsg;
                    const itemsToRender = [...baseItems, ...baseItems]; // Double for seamless loop

                    marqueeContent.innerHTML = itemsToRender.map(q => `
                        <div class="quote-card-wrapper">
                            <div class="quote-card">
                                <span class="quote-mark left">“</span>
                                <p class="quote-text">${q.quote}</p>
                                <span class="quote-mark right">”</span>
                                <p class="quote-author">- ${q.name} -</p>
                            </div>
                        </div>
                    `).join('');

                    // --- Auto-scroll Logic ---
                    const scrollWrapper = document.querySelector('.marquee-wrapper');
                    if (scrollWrapper && marqueeContent) {
                        let isUserInteracting = false;
                        let scrollAmount = scrollWrapper.scrollLeft;
                        let interactionTimer = null;

                        const handleInteractionStart = () => {
                            isUserInteracting = true;
                            if (interactionTimer) clearTimeout(interactionTimer);
                        };

                        const handleInteractionEnd = () => {
                            interactionTimer = setTimeout(() => {
                                isUserInteracting = false;
                                scrollAmount = scrollWrapper.scrollLeft; // Sync after interaction
                            }, 2000);
                        };

                        scrollWrapper.addEventListener('mousedown', handleInteractionStart);
                        window.addEventListener('mouseup', handleInteractionEnd);
                        scrollWrapper.addEventListener('touchstart', handleInteractionStart, { passive: true });
                        scrollWrapper.addEventListener('touchend', handleInteractionEnd, { passive: true });

                        const animate = () => {
                            if (!isUserInteracting) {
                                scrollAmount += 0.6; // Speed
                                scrollWrapper.scrollLeft = scrollAmount;

                                // Seamless loop
                                if (scrollWrapper.scrollLeft >= marqueeContent.scrollWidth / 2) {
                                    scrollAmount = 0;
                                    scrollWrapper.scrollLeft = 0;
                                }
                            }
                            requestAnimationFrame(animate);
                        };
                        requestAnimationFrame(animate);
                    }
                } else if (marqueeSection) {
                    marqueeSection.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Error fetching donation data:', error);
            const totalDonationsEl = document.getElementById('total-donations');
            if (totalDonationsEl) totalDonationsEl.innerText = 'โหลดข้อมูลล้มเหลว';
            const currentAmountEl = document.getElementById('current-amount');
            if (currentAmountEl) currentAmountEl.innerText = '฿0.00';
        }
    }

    function updateStats(total, count) {
        const targetAmount = 47777;
        const currentAmountEl = document.getElementById('current-amount');
        const progressFillEl = document.getElementById('progress-fill');
        const totalDonationsEl = document.getElementById('total-donations');
        const statusMsgEl = document.getElementById('donation-status-msg');
        const remarlMsgEl = document.getElementById('donation-remark-msg');

        if (currentAmountEl) currentAmountEl.innerText = `฿${formatNumber(total)}`;
        if (progressFillEl) {
            const percentage = Math.min((total / targetAmount) * 100, 100);
            progressFillEl.style.width = `${percentage}%`;
        }
        if (totalDonationsEl) totalDonationsEl.innerText = `มี ${count} รายการ`;

        remarlMsgEl.innerHTML = `*ยอดสุทธิที่ผ่านการตรวจสอบความถูกต้องเรียบร้อยแล้ว`
        if (statusMsgEl) {
            const diff = total - targetAmount;
            if (diff < 0) {
                statusMsgEl.innerText = `เหลืออีกเพียง ${formatNumber(Math.abs(diff))}  บาท ก็จะถึงเป้าหมายแล้ว`;
                statusMsgEl.className = 'donation-status-msg status-short';
            } else {
                statusMsgEl.innerText = `ยอดเกินมา ${formatNumber(diff)} บาท`;
                statusMsgEl.className = 'donation-status-msg status-over';
            }
        }
    }

    function renderDonationPage(page) {
        currentPage = page;
        const tbody = document.getElementById('donation-table-body');
        const pagination = document.getElementById('donation-pagination');
        if (!tbody || !pagination) return;

        // Calculate slice
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageData = allDonations.slice(startIndex, endIndex);

        // Render Table
        tbody.innerHTML = '';
        if (pageData.length === 0 && allDonations.length > 0) {
            // Fallback to page 1 if current page is empty after update
            renderDonationPage(1);
            return;
        }

        pageData.forEach(item => {
            const tr = document.createElement('tr');

            // Add pending badge if status is pending (below name)
            const badgeHtml = item.status === 'pending'
                ? '<div class="status-badge-pending">รอตรวจสอบ</div>'
                : '';

            tr.innerHTML = `
                <td class="donor-name">${item.name}</td>
                <td class="amount">
                    <span class="price-text">฿${formatNumber(item.amount)}</span>
                    ${badgeHtml}
                </td>
                <td class="date">${formatThaiDate(item.transaction_date)}</td>
            `;
            tbody.appendChild(tr);
        });

        // Render Pagination
        renderPaginationUI(pagination);
    }

    function renderPaginationUI(container) {
        const numPages = Math.ceil(allDonations.length / itemsPerPage);
        container.innerHTML = '';
        if (numPages <= 1) return;

        for (let i = 1; i <= numPages; i++) {
            const btn = document.createElement('button');
            btn.innerText = i;
            if (i === currentPage) btn.classList.add('active');
            btn.addEventListener('click', () => {
                renderDonationPage(i);
                // Optional: Scroll to top of table
                document.querySelector('.latest-donations-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            container.appendChild(btn);
        }
    }

    fetchDonationData();
    setInterval(fetchDonationData, 30000);

    // --- Feature Toggles & Handlers ---
    window.handleDonate = function (e) {
        if (e) e.preventDefault();
        if (typeof API_CONFIG !== 'undefined' && API_CONFIG.IS_DONATE_OPEN === false) {
            window.location.href = 'https://forms.gle/zDtENR1ryZWJPD9z9';
        } else {
            window.location.href = 'donate.html';
        }
    };

    window.handleWorkshop = function (e) {
        if (e) e.preventDefault();
        if (typeof API_CONFIG !== 'undefined' && API_CONFIG.IS_WORKSHOP_OPEN === false) {
            window.showComingSoon(
                "Workshop Coming Soon!",
                "กิจกรรม Workshop กำลังอยู่ระหว่างการเตรียมความพร้อม อดใจรออีกนิด แล้วมาสนุกด้วยกันเร็วๆ นี้ค่ะ!"
            );
        } else {
            window.location.href = 'workshop.html';
        }
    };

    // Attach listeners to all donate/workshop links
    document.querySelectorAll('a[href="donate.html"]').forEach(link => {
        link.addEventListener('click', window.handleDonate);
    });
    document.querySelectorAll('a[href="workshop.html"]').forEach(link => {
        link.addEventListener('click', window.handleWorkshop);
    });

    // Special handler for CSR link
    window.handleCSR = function (e) {
        if (e) e.preventDefault();
        window.showComingSoon(
            "Coming Soon!",
            "รายละเอียดโครงการ CSR ของ NexT1DE Project Thailand อดใจรออีกนิด เร็วๆ นี้แน่นอน!"
        );
    };

    const navCSRLink = document.querySelector('.btn-pink');
    if (navCSRLink) {
        navCSRLink.addEventListener('click', window.handleCSR);
    }

    const navDonateLink = document.querySelector('.btn-blue');
    if (navDonateLink && navDonateLink.innerText.includes('โดเนท')) {
        navDonateLink.addEventListener('click', window.handleDonate);
    }
});

// --- Dynamic Modal Controls ---
window.showComingSoon = function (title, desc) {
    const modal = document.getElementById('coming-soon-modal');
    const card = document.getElementById('coming-soon-card');
    const titleEl = document.getElementById('cs-title');
    const descEl = document.getElementById('cs-desc');

    if (title && titleEl) titleEl.innerText = title;
    if (desc && descEl) descEl.innerHTML = desc; // Use innerHTML to support <br>

    if (modal && card) {
        modal.style.display = 'flex';
        // Trigger reflow for animation
        void modal.offsetWidth;
        modal.style.opacity = '1';
        card.style.transform = 'scale(1)';
    }
};

window.closeComingSoon = function () {
    const modal = document.getElementById('coming-soon-modal');
    const card = document.getElementById('coming-soon-card');
    if (modal && card) {
        modal.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
};

// --- Copy Function ---
function copyAccountNumber() {
    const accNumber = document.getElementById('account-number').innerText;
    navigator.clipboard.writeText(accNumber).then(() => {
        const copyBtn = document.querySelector('.btn-copy');
        if (copyBtn) {
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<span></span> คัดลอกแล้ว';
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
            }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}
