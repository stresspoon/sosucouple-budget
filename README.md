# sosucouple-budget (Vercel Static)

## 배포
1. Vercel에서 New Project > Import (또는 ZIP 업로드)
2. Framework Preset: Other
3. Build Command: 없음
4. Output Directory: .

## 구조
- Gemini API는 브라우저에서 직접 호출
- API Key와 거래 데이터는 브라우저 localStorage 저장

## 주의
- 기기별 데이터는 별개로 저장됨(공유 DB 아님)
- 공유 DB가 필요하면 Supabase 연동 버전으로 전환 필요
