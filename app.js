const KEY = 'gemini_api_key';
const TX = 'ledger_transactions_v2';
const CATS = ['식비', '카페', '교통', '쇼핑', '의료', '주거', '문화생활', '기타'];

export function getKey() { return localStorage.getItem(KEY) || ''; }
export function setKey(v) { localStorage.setItem(KEY, v || ''); }

const BUDGET_KEY = 'couple_monthly_budget';
export function getBudget() { return Number(localStorage.getItem(BUDGET_KEY)) || 1500000; }
export function setBudget(v) { localStorage.setItem(BUDGET_KEY, Number(v) || 1500000); }

export function getTx() {
  try {
    const data = JSON.parse(localStorage.getItem(TX) || '[]');
    return data.map(t => ({
      ...t,
      payer: t.payer || 'me',
      items: t.items || [] // 세부 내역 항목 배열 기본값 추가
    }));
  } catch {
    return [];
  }
}
export function setTx(arr) { localStorage.setItem(TX, JSON.stringify(arr || [])); }
export function won(n) { return Number(n || 0).toLocaleString('ko-KR'); }
export function ym(d) { return (d || new Date()).toISOString().slice(0, 7); }
export function ymd(d) {
  const date = d || new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split('T')[0];
}

export function getPayerLabel(payer) {
  if (payer === 'me') return '나';
  if (payer === 'you') return '상대방';
  if (payer === 'together') return '함께';
  return '나';
}

export const catIconRecord = {
  '식비': { icon: 'restaurant', bgColor: 'bg-emerald-100 dark:bg-emerald-900/20', textColor: 'text-emerald-600 dark:text-emerald-400' },
  '카페': { icon: 'coffee', bgColor: 'bg-amber-100 dark:bg-amber-900/20', textColor: 'text-amber-600 dark:text-amber-400' },
  '교통': { icon: 'directions_bus', bgColor: 'bg-blue-100 dark:bg-blue-900/20', textColor: 'text-blue-600 dark:text-blue-400' },
  '쇼핑': { icon: 'shopping_bag', bgColor: 'bg-purple-100 dark:bg-purple-900/20', textColor: 'text-purple-600 dark:text-purple-400' },
  '의료': { icon: 'medical_services', bgColor: 'bg-red-100 dark:bg-red-900/20', textColor: 'text-red-600 dark:text-red-400' },
  '주거': { icon: 'home', bgColor: 'bg-indigo-100 dark:bg-indigo-900/20', textColor: 'text-indigo-600 dark:text-indigo-400' },
  '문화생활': { icon: 'movie', bgColor: 'bg-pink-100 dark:bg-pink-900/20', textColor: 'text-pink-600 dark:text-pink-400' },
  '기타': { icon: 'receipt_long', bgColor: 'bg-slate-200 dark:bg-slate-800', textColor: 'text-slate-600 dark:text-slate-400' }
};

export function getCatIconInfo(category) {
  return catIconRecord[category] || catIconRecord['기타'];
}

export async function parseReceiptWithGemini(file, key) {
  const b64 = await fileToBase64(file);
  const model = 'gemini-2.5-flash';
  const prompt = `너는 커플 가계부 영수증 데이터 추출기다. JSON만 출력해.
스키마: 
{
  "tx_date": "YYYY-MM-DD", 
  "merchant": "가맹점명", 
  "amount": 0, 
  "category": "식비|카페|교통|쇼핑|의료|주거|문화생활|기타", 
  "payer": "me|together", 
  "memo": "영수증 분석 후 짧은 요약",
  "items": [{"name": "품목명", "price": 0}]
}
규칙: 
1. amount는 쉼표 없는 정수로 전체 합계 금액.
2. tx_date를 정수(년/월/일)로 추출해. 모르면 오늘 날짜.
3. 식비가 매우 크거나, 2인 이상 결제, 데이트 코스 관련이면 payer를 "together"로, 그 외엔 "me"로 추측.
4. 이모티콘은 절대 쓰지 마.
5. items 배열에 영수증에 적힌 개별 품목명과 가격을 필수로 남겨줘.
`;
  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: file.type || 'image/jpeg', data: b64.split(',')[1] } }
      ]
    }]
  };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent?key=\${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || 'Gemini 호출 실패');
  const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n').trim();
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  const obj = JSON.parse(cleaned);
  obj.category = CATS.includes(obj.category) ? obj.category : '기타';
  if (!['me', 'you', 'together'].includes(obj.payer)) obj.payer = 'me';
  if (!Array.isArray(obj.items)) obj.items = [];
  return obj;
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}
