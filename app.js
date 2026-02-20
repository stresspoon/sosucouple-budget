const KEY='gemini_api_key';
const TX='ledger_transactions_v1';
const CATS=['식비','카페','교통','쇼핑','의료','주거','기타'];

export function getKey(){return localStorage.getItem(KEY)||''}
export function setKey(v){localStorage.setItem(KEY,v||'')}
export function getTx(){try{return JSON.parse(localStorage.getItem(TX)||'[]')}catch{return []}}
export function setTx(arr){localStorage.setItem(TX,JSON.stringify(arr||[]))}
export function won(n){return Number(n||0).toLocaleString('ko-KR')+'원'}
export function ym(d){return (d||new Date()).toISOString().slice(0,7)}

export async function parseReceiptWithGemini(file,key){
  const b64 = await fileToBase64(file);
  const model='gemini-2.5-flash';
  const prompt=`너는 한국 가계부 영수증 추출기다. JSON만 출력해.
스키마: {"tx_date":"YYYY-MM-DD","merchant":"","amount":0,"category":"식비|카페|교통|쇼핑|의료|주거|기타","memo":""}
규칙: amount는 정수, tx_date 모르면 오늘 날짜`;
  const body={
    contents:[{parts:[
      {text:prompt},
      {inline_data:{mime_type:file.type||'image/jpeg',data:b64.split(',')[1]}}
    ]}]
  };
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  });
  const j=await r.json();
  if(!r.ok) throw new Error(j?.error?.message||'Gemini 호출 실패');
  const text=(j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('\n').trim();
  const cleaned=text.replace(/^```json\s*/i,'').replace(/```$/,'').trim();
  const obj=JSON.parse(cleaned);
  obj.category=CATS.includes(obj.category)?obj.category:'기타';
  return obj;
}

function fileToBase64(file){
  return new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onload=()=>res(fr.result);
    fr.onerror=rej;
    fr.readAsDataURL(file);
  });
}
