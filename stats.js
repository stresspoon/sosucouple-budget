import { getTx, ym, won, getCatIconInfo, generateMonthlyInsight, getMeAlias, getYouAlias, parseReceiptWithGemini, addTx, getKey } from './app.js';

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

async function render() {
    const month = ym(cur);
    document.getElementById('yearDisplay').textContent = `${cur.getFullYear()}년`;
    document.getElementById('monthDisplay').textContent = `${cur.getMonth() + 1}월`;

    const allTx = await getTx();
    const tx = allTx.filter(t => t.tx_date?.startsWith(month));

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

        if (t.payer === 'me') payerMap['me'] += amt;
        else if (t.payer === 'you') payerMap['you'] += amt;
        else if (t.payer === 'together') payerMap['together'] += amt;

        const cat = t.category || '기타';
        catMap[cat] = (catMap[cat] || 0) + amt;
    });

    document.getElementById('sumDisplay').textContent = won(total);

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
        const cacheKey = 'gemini_insight_v2_' + month;
        const downloadKey = 'gemini_download_v2_' + month;
        const cached = localStorage.getItem(cacheKey);
        const isDownloaded = localStorage.getItem(downloadKey) === 'true';

        const isTestMode = true; // 임시: 지금 테스트를 위해 항시 열림 상태 유지
        const realCurrentMonth = ym(new Date());
        let canGenerate = true;
        let lockMsg = "";

        if (!isTestMode && month === realCurrentMonth) {
            canGenerate = false;
            lockMsg = "해당 월이 종료된 후, 다음 달 1일에 리포트를 생성할 수 있습니다!";
        }

        const geminiModal = document.getElementById('geminiModal');
        const geminiModalContent = document.getElementById('geminiModalContent');

        if (cached) {
            if (isDownloaded) {
                aiInsightResult.innerHTML = '<p class="text-xs text-slate-400 leading-relaxed font-normal">이번 달 리포트를 성공적으로 저장하셨네요! 다음 달 1일에 새로운 분석으로 만나요.</p>';
                btnAiInsight.disabled = true;
                btnAiInsight.innerHTML = '<span class="material-symbols-outlined text-[16px]">hourglass_empty</span> <span>다음 달 리포트를 기다려주세요</span>';
                btnAiInsight.className = "relative z-10 w-full mt-4 bg-slate-800/30 text-slate-600 cursor-not-allowed text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm border border-white/5";
            } else {
                aiInsightResult.innerHTML = '<p class="text-xs text-primary leading-relaxed font-bold">아직 리포트를 보관하기 전이에요! 이미지를 다운로드해서 꼭 소장해보세요.</p>';
                btnAiInsight.disabled = false;
                btnAiInsight.innerHTML = '<span class="material-symbols-outlined text-[16px]">visibility</span> <span>이번 달 리포트 계속 훔쳐보기</span>';
                btnAiInsight.className = "relative z-10 w-full mt-4 bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-xs font-bold py-3 rounded-xl border border-primary/30 flex items-center justify-center gap-2 shadow-sm";

                btnAiInsight.onclick = () => {
                    geminiModalContent.innerHTML = cached;
                    geminiModal.classList.remove('hidden');
                    setTimeout(() => geminiModal.classList.remove('opacity-0'), 10);
                };
            }
        } else {
            if (canGenerate) {
                aiInsightResult.innerHTML = '<p class="text-xs text-slate-400 leading-relaxed font-normal">최신 데이터로 준비를 마쳤습니다! 아래 버튼을 눌러 새로워진 AI 분석 리포트를 확인해보세요.</p>';
                btnAiInsight.disabled = false;
                btnAiInsight.innerHTML = '<span class="material-symbols-outlined text-[16px]">magic_button</span> <span>이번 달 리포트 생성하기 (월 1회 권장)</span>';
                btnAiInsight.className = "relative z-10 w-full mt-4 bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-xs font-bold py-3 rounded-xl border border-primary/30 flex items-center justify-center gap-2 shadow-sm";

                btnAiInsight.onclick = async () => {
                    btnAiInsight.disabled = true;
                    btnAiInsight.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">sync</span> <span>분석 중... (약 5-10초 소요)</span>';
                    try {
                        const resHtml = await generateMonthlyInsight(month, tx);
                        localStorage.setItem(cacheKey, resHtml);
                        geminiModalContent.innerHTML = resHtml;
                        render(); // update button state
                        geminiModal.classList.remove('hidden');
                        setTimeout(() => geminiModal.classList.remove('opacity-0'), 10);
                    } catch (err) {
                        alert(err.message);
                        render();
                    } finally {
                        btnAiInsight.disabled = false;
                    }
                };
            } else {
                aiInsightResult.innerHTML = `<p class="text-xs text-slate-400 leading-relaxed font-normal">${lockMsg}</p>`;
                btnAiInsight.disabled = true;
                btnAiInsight.innerHTML = '<span class="material-symbols-outlined text-[16px]">lock</span> <span>다음 달 오픈 예정</span>';
                btnAiInsight.className = "relative z-10 w-full mt-4 bg-slate-800/30 text-slate-600 cursor-not-allowed text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm border border-white/5";
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
        document.getElementById('downloadGeminiBtn').onclick = () => {
            const content = document.getElementById('geminiModalContent');
            const cacheKey = 'gemini_download_v2_' + month;
            html2canvas(content, { backgroundColor: '#131e16' }).then(canvas => {
                const link = document.createElement('a');
                link.download = `Gemini_월간분석_${month}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();

                localStorage.setItem(cacheKey, 'true');
                alert("리포트가 이미지로 저장되었습니다!\n모달을 닫으시면 새로 생성 버튼이 잠깁니다.");
                document.getElementById('closeGeminiModal').click();
            });
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

            // List rendering
            const cIcon = getCatIconInfo(catTitle);

            listEl.innerHTML += `
    <div class="group flex items-center justify-between rounded-xl bg-white p-4 shadow-sm transition-all hover:bg-slate-50 dark:bg-white/5 dark:hover:bg-white/10">
        <div class="flex items-center gap-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-full ${colorObj.fill}">
                <span class="material-symbols-outlined">${cIcon.icon}</span>
            </div>
            <div class="flex flex-col">
                <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-900 dark:text-white">${catTitle}</span>
                    <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-white/10 dark:text-slate-400">${percString}</span>
                </div>
                <span class="text-xs text-slate-500 dark:text-slate-400">총 ${tx.filter(t => t.category === catTitle).length}건</span>
            </div>
        </div>
        <div class="flex flex-col items-end">
            <span class="font-bold text-slate-900 dark:text-white">${won(val)}</span>
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
        if (!getKey()) { alert('설정에서 Gemini API 키를 먼저 등록해주세요.'); return; }
        try {
            const r = await parseReceiptWithGemini(f, getKey());
            await addTx({ ...r, payer: selectedPayer, amount: Number(r.amount || 0) });
            location.reload();
        } catch (err) {
            alert('영수증 인식 실패: ' + err.message);
        }
    };
}

render();
