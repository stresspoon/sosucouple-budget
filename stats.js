import { getTx, ym, won, getCatIconInfo } from './app.js';

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

    // Insights
    let insightStr = "이번 달은 지출이 없습니다.";
    if (total > 0) {
        let maxSub = "알 수 없음";
        let maxVal = 0;
        if (meAmt > maxVal) { maxVal = meAmt; maxSub = "본인"; }
        if (youAmt > maxVal) { maxVal = youAmt; maxSub = "상대방"; }
        if (togetherAmt > maxVal) { maxVal = togetherAmt; maxSub = "공동(함께)"; }

        const mostCat = rows[0][0];
        insightStr = `이번 달은 ${mostCat} 항목의 지출이 가장 컸습니다. 전체 결제 중 <span class="text-primary font-bold">${maxSub}</span> 결제 비중이 제일 높네요!`;
    }
    document.getElementById('insightText').innerHTML = insightStr;

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
