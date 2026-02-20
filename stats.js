import { getTx, ym, won, getCatIconInfo, generateMonthlyInsight } from './app.js';

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

function render() {
    const month = ym(cur);
    document.getElementById('yearDisplay').textContent = `${cur.getFullYear()}년`;
    document.getElementById('monthDisplay').textContent = `${cur.getMonth() + 1}월`;

    const tx = getTx().filter(t => t.tx_date?.startsWith(month));

    let total = 0;
    let meAmt = 0;
    let youAmt = 0;
    let togetherAmt = 0;

    // category aggregation
    const catMap = {};

    tx.forEach(t => {
        const amt = Number(t.amount || 0);
        total += amt;

        if (t.payer === 'me') meAmt += amt;
        else if (t.payer === 'you') youAmt += amt;
        else if (t.payer === 'together') togetherAmt += amt;

        const cat = t.category || '기타';
        catMap[cat] = (catMap[cat] || 0) + amt;
    });

    document.getElementById('sumDisplay').textContent = won(total);

    const rows = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

    // Build AI Insight UI
    const aiInsightBox = document.getElementById('aiInsightBox');
    const btnAiInsight = document.getElementById('btnAiInsight');
    const aiInsightResult = document.getElementById('aiInsightResult');

    if (tx.length === 0) {
        aiInsightBox.classList.add('hidden');
    } else {
        aiInsightBox.classList.remove('hidden');
        const cacheKey = 'gemini_insight_' + month;
        const cached = localStorage.getItem(cacheKey);

        if (cached) {
            aiInsightResult.innerHTML = cached;
            btnAiInsight.innerHTML = '<span class="material-symbols-outlined text-[16px]">refresh</span> <span>다시 분석하기</span>';
            btnAiInsight.className = "relative z-10 w-full mt-4 bg-slate-800/50 hover:bg-slate-800/70 text-slate-400 transition-colors text-xs font-bold py-3 rounded-xl border border-white/10 flex items-center justify-center gap-2 shadow-sm";
        } else {
            aiInsightResult.innerHTML = '<p class="text-xs text-slate-400 leading-relaxed font-normal">이번 달 지출 데이터가 모두 모였습니다. 객관적이고 예리한 AI의 소비 패턴 분석을 시작해보세요!</p>';
            btnAiInsight.innerHTML = '<span class="material-symbols-outlined text-[16px]">magic_button</span> <span>이번 달 리포트 생성하기 (월 1회 권장)</span>';
            btnAiInsight.className = "relative z-10 w-full mt-4 bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-xs font-bold py-3 rounded-xl border border-primary/30 flex items-center justify-center gap-2 shadow-sm";
        }

        btnAiInsight.onclick = async () => {
            btnAiInsight.disabled = true;
            btnAiInsight.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">sync</span> <span>분석 중... (약 5-10초 소요)</span>';
            try {
                const resHtml = await generateMonthlyInsight(month, tx);
                localStorage.setItem(cacheKey, resHtml);
                render();
            } catch (err) {
                alert(err.message);
                render();
            } finally {
                btnAiInsight.disabled = false;
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

render();
