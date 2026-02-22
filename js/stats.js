import { getTx, ym, won, getCatIconInfo, generateMonthlyInsight, getMeAlias, getYouAlias, getPayerLabel, handleReceiptScan, escapeHtml, sanitizeHtml, toRelativePayer, checkAndSetRedMode, checkRedModeCache } from './app.js';
checkRedModeCache();

const colors = [
    { name: 'green', code: '#13ec5b', fill: 'bg-[#13ec5b]/20 text-[#13ec5b]' },
    { name: 'teal', code: '#2dd4bf', fill: 'bg-[#2dd4bf]/20 text-[#2dd4bf]' },
    { name: 'blue', code: '#60a5fa', fill: 'bg-[#60a5fa]/20 text-[#60a5fa]' },
    { name: 'purple', code: '#c084fc', fill: 'bg-[#c084fc]/20 text-[#c084fc]' },
    { name: 'pink', code: '#f472b6', fill: 'bg-[#f472b6]/20 text-[#f472b6]' },
    { name: 'orange', code: '#fb923c', fill: 'bg-[#fb923c]/20 text-[#fb923c]' },
    { name: 'yellow', code: '#facc15', fill: 'bg-[#facc15]/20 text-[#facc15]' },
];

let cur = new Date();
let currentMode = 'cat'; // 'cat' or 'payer'

// Color map for award cards
const awardColorMap = {
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-500', title: 'text-orange-400' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-500', title: 'text-purple-400' },
    blue:   { bg: 'bg-blue-500/10', text: 'text-blue-500', title: 'text-blue-400' },
    pink:   { bg: 'bg-pink-500/10', text: 'text-pink-500', title: 'text-pink-400' },
    green:  { bg: 'bg-emerald-500/10', text: 'text-emerald-500', title: 'text-emerald-400' },
    red:    { bg: 'bg-red-500/10', text: 'text-red-500', title: 'text-red-400' },
    amber:  { bg: 'bg-amber-500/10', text: 'text-amber-500', title: 'text-amber-400' },
};

function renderGeminiModal(data) {
    const geminiModal = document.getElementById('geminiModal');
    const subtitle = document.getElementById('geminiSubtitle');
    const awardsEl = document.getElementById('geminiAwards');
    const commentBox = document.getElementById('geminiComment');
    const commentText = document.getElementById('geminiCommentText');
    const slideTrack = document.getElementById('geminiSlideTrack');
    const dot1 = document.getElementById('geminiDot1');
    const dot2 = document.getElementById('geminiDot2');

    if (!data || !data.awards) {
        awardsEl.innerHTML = '<p class="text-sm text-slate-400 py-4">리포트 데이터를 불러올 수 없습니다.</p>';
        commentBox.classList.add('hidden');
        dot2.style.display = 'none';
        geminiModal.classList.remove('hidden');
        setTimeout(() => geminiModal.classList.remove('opacity-0'), 10);
        return;
    }

    // Slide 1: header + awards
    // Store emoji in data attribute for clean export (no Material Symbols in html2canvas)
    subtitle.textContent = data.subtitle || '';
    awardsEl.innerHTML = data.awards.map(a => {
        const c = awardColorMap[a.color] || awardColorMap.orange;
        return `<div class="flex items-center gap-3 bg-[#1c2e22] p-3 rounded-xl border border-[#2a4232]">
            <div class="w-12 h-12 rounded-lg ${c.bg} flex items-center justify-center text-2xl shadow-inner ${c.text}" data-award-emoji="${escapeHtml(a.emoji || '')}">
                <span class="material-symbols-outlined">${escapeHtml(a.icon || 'emoji_events')}</span>
            </div>
            <div class="text-left flex-1">
                <h3 class="text-sm font-bold ${c.title}">${escapeHtml(a.title || '')}</h3>
                <p class="text-xs text-slate-400">${escapeHtml(a.desc || '')}</p>
            </div>
            <span class="text-xl">${a.emoji || ''}</span>
        </div>`;
    }).join('');

    // Slide 2: GEMINI SAYS — strip material-symbols spans to prevent export garbling
    const hasComment = !!data.comment;
    if (hasComment) {
        commentBox.classList.remove('hidden');
        const tmp = document.createElement('div');
        tmp.innerHTML = sanitizeHtml(data.comment);
        tmp.querySelectorAll('.material-symbols-outlined').forEach(el => el.remove());
        commentText.innerHTML = tmp.innerHTML;
    } else {
        commentBox.classList.add('hidden');
    }

    // Dot 2 visibility
    dot2.style.display = hasComment ? '' : 'none';

    // Slide navigation
    let currentSlide = 0;
    function goToSlide(idx) {
        currentSlide = Math.max(0, Math.min(idx, hasComment ? 1 : 0));
        slideTrack.style.transform = currentSlide === 1 ? 'translateX(-50%)' : 'translateX(0)';
        dot1.classList.toggle('bg-primary', currentSlide === 0);
        dot1.classList.toggle('w-4', currentSlide === 0);
        dot1.classList.toggle('bg-white/20', currentSlide !== 0);
        dot1.classList.toggle('w-2', currentSlide !== 0);
        dot2.classList.toggle('bg-primary', currentSlide === 1);
        dot2.classList.toggle('w-4', currentSlide === 1);
        dot2.classList.toggle('bg-white/20', currentSlide !== 1);
        dot2.classList.toggle('w-2', currentSlide !== 1);
    }
    dot1.onclick = () => goToSlide(0);
    dot2.onclick = () => goToSlide(1);

    // Touch swipe
    const viewport = document.getElementById('geminiSlideViewport');
    let touchStartX = 0;
    viewport.ontouchstart = e => { touchStartX = e.touches[0].clientX; };
    viewport.ontouchend = e => {
        const dx = touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(dx) > 50) goToSlide(currentSlide + (dx > 0 ? 1 : -1));
    };

    goToSlide(0);
    geminiModal.classList.remove('hidden');
    setTimeout(() => geminiModal.classList.remove('opacity-0'), 10);
}

async function render() {
    const month = ym(cur);
    document.getElementById('yearDisplay').textContent = `${cur.getFullYear()}년`;
    document.getElementById('monthDisplay').textContent = `${cur.getMonth() + 1}월`;

    const tx = await getTx(month);

    let total = 0;
    let meAmt = 0;
    let youAmt = 0;
    let togetherAmt = 0;

    // category vs payer mode
    const catMap = {};
    const payerMap = { 'me': 0, 'you': 0, 'together': 0 };

    tx.forEach(t => {
        const amt = Number(t.amount || 0);
        total += amt;

        const rel = toRelativePayer(t.payer);
        if (rel === 'me') payerMap['me'] += amt;
        else if (rel === 'you') payerMap['you'] += amt;
        else if (rel === 'together') payerMap['together'] += amt;

        const cat = t.category || '기타';
        catMap[cat] = (catMap[cat] || 0) + amt;
    });

    document.getElementById('sumDisplay').textContent = won(total);

    if (month === ym(new Date())) checkAndSetRedMode(total);

    let rows = [];
    if (currentMode === 'cat') {
        rows = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    } else {
        const payerNames = {
            'me': getMeAlias(),
            'you': getYouAlias(),
            'together': '함께'
        };
        rows = Object.entries(payerMap).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]).map(r => [payerNames[r[0]], r[1]]);
    }

    // Build AI Insight UI
    const aiInsightBox = document.getElementById('aiInsightBox');
    const btnAiInsight = document.getElementById('btnAiInsight');
    const aiInsightResult = document.getElementById('aiInsightResult');

    if (tx.length === 0) {
        aiInsightBox.classList.add('hidden');
    } else {
        aiInsightBox.classList.remove('hidden');
        const cacheKey = 'gemini_insight_v3_' + month;
        const downloadKey = 'gemini_download_v3_' + month;
        const cached = localStorage.getItem(cacheKey);
        const isDownloaded = localStorage.getItem(downloadKey) === 'true';

        const isTestMode = true;
        const realCurrentMonth = ym(new Date());
        let canGenerate = true;
        let lockMsg = "";

        if (!isTestMode && month === realCurrentMonth) {
            canGenerate = false;
            lockMsg = "해당 월이 종료된 후, 다음 달 1일에 리포트를 생성할 수 있습니다!";
        }

        if (cached) {
            const resultMsg = isDownloaded
                ? '<p class="text-xs text-slate-400 leading-relaxed font-normal">이번 달 리포트를 저장하셨네요! 언제든 다시 확인할 수 있어요.</p>'
                : '<p class="text-xs text-primary leading-relaxed font-bold">아직 리포트를 보관하기 전이에요! 이미지를 다운로드해서 꼭 소장해보세요.</p>';
            aiInsightResult.innerHTML = resultMsg;
            btnAiInsight.disabled = false;
            btnAiInsight.innerHTML = '<span class="material-symbols-outlined text-[16px]">visibility</span> <span>이번 달 리포트 다시 보기</span>';
            btnAiInsight.className = "relative z-10 w-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-xs font-bold py-3 rounded-xl border border-primary/30 flex items-center justify-center gap-2 shadow-sm";

            btnAiInsight.onclick = () => {
                try {
                    const data = JSON.parse(cached);
                    renderGeminiModal(data);
                } catch { renderGeminiModal(null); }
            };
        } else {
            if (canGenerate) {
                aiInsightResult.innerHTML = '<p class="text-xs text-slate-400 leading-relaxed font-normal">최신 데이터로 준비를 마쳤습니다! 아래 버튼을 눌러 새로워진 AI 분석 리포트를 확인해보세요.</p>';
                btnAiInsight.disabled = false;
                btnAiInsight.innerHTML = '<span class="material-symbols-outlined text-[16px]">magic_button</span> <span>이번 달 리포트 생성하기 (월 1회 권장)</span>';
                btnAiInsight.className = "relative z-10 w-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-xs font-bold py-3 rounded-xl border border-primary/30 flex items-center justify-center gap-2 shadow-sm";

                btnAiInsight.onclick = async () => {
                    btnAiInsight.disabled = true;
                    btnAiInsight.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">sync</span> <span>분석 중... (약 5-10초 소요)</span>';
                    try {
                        const data = await generateMonthlyInsight(month, tx);
                        localStorage.setItem(cacheKey, JSON.stringify(data));
                        renderGeminiModal(data);
                        render(); // update button state
                    } catch (err) {
                        alert(err.message);
                        render();
                    } finally {
                        btnAiInsight.disabled = false;
                    }
                };
            } else {
                aiInsightResult.innerHTML = `<p class="text-xs text-slate-400 leading-relaxed font-normal">${escapeHtml(lockMsg)}</p>`;
                btnAiInsight.disabled = true;
                btnAiInsight.innerHTML = '<span class="material-symbols-outlined text-[16px]">lock</span> <span>다음 달 오픈 예정</span>';
                btnAiInsight.className = "relative z-10 w-full bg-slate-800/30 text-slate-600 cursor-not-allowed text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm border border-white/5";
            }
        }
    }

    // Modal Events
    const geminiModal = document.getElementById('geminiModal');
    if (geminiModal) {
        document.getElementById('closeGeminiModal').onclick = () => {
            geminiModal.classList.add('opacity-0');
            setTimeout(() => {
                geminiModal.classList.add('hidden');
                render(); // Reload outer states immediately once it's closed
            }, 300);
        };
        document.getElementById('downloadGeminiBtn').onclick = async () => {
            if (typeof html2canvas === 'undefined') {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
                    s.onload = resolve;
                    s.onerror = () => reject(new Error('html2canvas 로드 실패'));
                    document.head.appendChild(s);
                });
            }

            async function captureSlide(slideEl) {
                const clone = slideEl.cloneNode(true);

                // Replace award icon boxes (data-award-emoji) with the award emoji
                // This avoids Material Symbols garbling in html2canvas
                clone.querySelectorAll('[data-award-emoji]').forEach(el => {
                    const emoji = el.getAttribute('data-award-emoji');
                    el.innerHTML = `<span style="font-size:22px;line-height:1;">${emoji}</span>`;
                });

                // Replace smart_toy icon with robot emoji, hide all other Material Symbols
                clone.querySelectorAll('.material-symbols-outlined').forEach(el => {
                    if (el.textContent.trim() === 'smart_toy') {
                        el.removeAttribute('class');
                        el.style.cssText = 'font-size:2rem;font-family:system-ui,sans-serif;display:block;';
                        el.textContent = '🤖';
                    } else {
                        el.textContent = '';
                        el.style.display = 'none';
                    }
                });

                // Remove flex/overflow constraints for full-height capture
                Object.assign(clone.style, {
                    position: 'fixed',
                    top: '-99999px',
                    left: '0',
                    flex: 'none',
                    width: slideEl.offsetWidth + 'px',
                    maxHeight: 'none',
                    overflow: 'visible',
                    height: 'auto',
                    background: '#15231a',
                    borderRadius: '16px',
                });
                clone.classList.remove('overflow-y-auto');

                document.body.appendChild(clone);
                try {
                    await new Promise(r => setTimeout(r, 80));
                    return await html2canvas(clone, {
                        backgroundColor: '#15231a',
                        scale: 2,
                        useCORS: true,
                        logging: false,
                    });
                } finally {
                    document.body.removeChild(clone);
                }
            }

            try {
                const slide1 = document.getElementById('geminiSlide1');
                const slide2 = document.getElementById('geminiSlide2');
                const commentBox = document.getElementById('geminiComment');

                // Save slide 1 (어워즈)
                const canvas1 = await captureSlide(slide1);
                const link1 = document.createElement('a');
                link1.download = `커플리포트_${month}_어워즈.png`;
                link1.href = canvas1.toDataURL('image/png');
                link1.click();

                // Save slide 2 (GEMINI SAYS) if it has content
                if (!commentBox.classList.contains('hidden')) {
                    await new Promise(r => setTimeout(r, 400));
                    const canvas2 = await captureSlide(slide2);
                    const link2 = document.createElement('a');
                    link2.download = `커플리포트_${month}_GEMINI_SAYS.png`;
                    link2.href = canvas2.toDataURL('image/png');
                    link2.click();
                }

                const cacheKey = 'gemini_download_v3_' + month;
                localStorage.setItem(cacheKey, 'true');
                alert('리포트를 2장 이미지로 저장했습니다!');
                document.getElementById('closeGeminiModal').click();
            } catch (err) {
                alert('저장 실패: ' + err.message);
            }
        };
    }

    // Build SVG Doughnut + Category list DOM
    const donutSvg = document.getElementById('donut');
    let svgHtml = `<path class="text-slate-200 dark:text-white/5" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3"></path>`;

    const listEl = document.getElementById('catList');
    listEl.innerHTML = '';

    if (rows.length === 0) {
        listEl.innerHTML = '<div class="text-center text-slate-400 py-4">데이터 없음</div>';
    } else {
        let currentOffset = 0; // percentage

        rows.forEach(([catTitle, val], index) => {
            const percNumber = total > 0 ? (val / total) * 100 : 0;
            const percString = Math.round(percNumber) + '%';

            // Map colors safely
            const colorObj = colors[index % colors.length];

            // Avoid drawing if 0%
            if (percNumber > 0) {
                const dashArray = `${percNumber}, 100`;
                const offset = -currentOffset;

                svgHtml += `<path stroke="${colorObj.code}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke-dasharray="${dashArray}" stroke-dashoffset="${offset}" stroke-linecap="round" stroke-width="3" style="transition: stroke-dasharray 1s ease-out;"></path>`;

                currentOffset += percNumber;
            }

            // Get transactions for this category/payer
            const catTxList = currentMode === 'cat'
                ? tx.filter(t => (t.category || '기타') === catTitle)
                : tx.filter(t => getPayerLabel(t.payer) === catTitle);

            const txItemsHtml = catTxList.map(t => {
                const ci = getCatIconInfo(t.category);
                return `<a href="/add?id=${t.id}" class="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.98]">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg ${ci.bgColor} flex items-center justify-center ${ci.textColor}">
                            <span class="material-symbols-outlined text-[16px]">${ci.icon}</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-sm font-bold text-white">${escapeHtml(t.merchant || '미분류')}</span>
                            <span class="text-[10px] text-slate-400">${t.tx_date.slice(5)}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="text-sm font-bold text-white">-₩${Number(t.amount || 0).toLocaleString()}</span>
                        <span class="material-symbols-outlined text-[14px] text-slate-500">chevron_right</span>
                    </div>
                </a>`;
            }).join('');

            const rowId = `stats-row-${index}`;
            const cIcon = getCatIconInfo(catTitle);

            listEl.innerHTML += `
    <div>
        <div class="group flex items-center justify-between rounded-xl bg-white p-4 shadow-sm transition-all hover:bg-slate-50 dark:bg-white/5 dark:hover:bg-white/10 cursor-pointer" onclick="const el=document.getElementById('${rowId}');el.classList.toggle('hidden');this.querySelector('.expand-icon').classList.toggle('rotate-180')">
            <div class="flex items-center gap-4">
                <div class="flex h-12 w-12 items-center justify-center rounded-full ${colorObj.fill}">
                    <span class="material-symbols-outlined">${cIcon.icon}</span>
                </div>
                <div class="flex flex-col">
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-slate-900 dark:text-white">${escapeHtml(catTitle)}</span>
                        <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-white/10 dark:text-slate-400">${percString}</span>
                    </div>
                    <span class="text-xs text-slate-500 dark:text-slate-400">총 ${catTxList.length}건</span>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <span class="font-bold text-slate-900 dark:text-white">${won(val)}</span>
                <span class="expand-icon material-symbols-outlined text-[18px] text-slate-400 transition-transform duration-200">expand_more</span>
            </div>
        </div>
        <div id="${rowId}" class="hidden mt-1 ml-4 border-l-2 border-white/10 pl-2 space-y-0.5">
            ${txItemsHtml}
        </div>
    </div>`;
        });
    }

    donutSvg.innerHTML = svgHtml;
}

document.getElementById('prevBtn').onclick = () => { cur.setMonth(cur.getMonth() - 1); render(); };
document.getElementById('nextBtn').onclick = () => { cur.setMonth(cur.getMonth() + 1); render(); };

const modeCat = document.getElementById('modeCat');
const modePayer = document.getElementById('modePayer');
const modeBg = document.getElementById('modeBg');

if (modeCat && modePayer && modeBg) {
    modeCat.onclick = () => {
        currentMode = 'cat';
        modeBg.style.transform = 'translateX(0)';
        modeCat.classList.replace('text-slate-600', 'text-black');
        modeCat.classList.replace('dark:text-slate-400', 'dark:text-background-dark');
        modePayer.classList.replace('text-black', 'text-slate-600');
        modePayer.classList.replace('dark:text-background-dark', 'dark:text-slate-400');
        render();
    };

    modePayer.onclick = () => {
        currentMode = 'payer';
        modeBg.style.transform = 'translateX(100%)';
        modePayer.classList.replace('text-slate-600', 'text-black');
        modePayer.classList.replace('dark:text-slate-400', 'dark:text-background-dark');
        modeCat.classList.replace('text-black', 'text-slate-600');
        modeCat.classList.replace('dark:text-background-dark', 'dark:text-slate-400');
        render();
    };
}

// Set modal aliases
const modalMe = document.getElementById('modalMeAlias');
const modalYou = document.getElementById('modalYouAlias');
if (modalMe) modalMe.textContent = getMeAlias();
if (modalYou) modalYou.textContent = getYouAlias();

// Payer modal handler for camera FAB
let selectedPayer = 'me';
window.handleModalPayerSelect = (payer) => {
    selectedPayer = payer;
    const modal = document.getElementById('payerModal');
    const content = document.getElementById('payerModalContent');
    modal.classList.add('opacity-0');
    content.classList.add('translate-y-full');
    setTimeout(() => modal.classList.add('hidden'), 300);
    document.getElementById('modalCameraInput').click();
};

const modalCameraInput = document.getElementById('modalCameraInput');
if (modalCameraInput) {
    modalCameraInput.onchange = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
            await handleReceiptScan(f, selectedPayer);
            location.reload();
        } catch (err) {
            alert('영수증 인식 실패: ' + err.message);
        }
    };
}

render();
