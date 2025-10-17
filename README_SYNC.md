# 이미지 자동 복사 & JSON 반영 (sync-images)

## 사용법
```bash
npm ci

# 대화형 실행(폴더 물어봄)
npm run sync-images

# 외장하드 경로 직접 지정
npm run sync-from -- "D:\포카사진"
# macOS 예시
npm run sync-from -- "/Volumes/EXT/포카사진"
```

- 이미지(jpg/jpeg/png/webp)만 복사합니다.
- `public/images/`로 복사하고, `public/catalog.json`에 새 항목을 자동 추가/병합합니다.
- 기본 구매 날짜/이벤트/구매처 입력 시, 새 항목들의 기본값으로 들어갑니다.

## 배포/공유
- 커밋/푸시 후 GitHub Pages 배포 → JSON: `https://<USER>.github.io/<REPO>/catalog.json`
- 뷰어(자동 반영) 링크:  
  `https://<USER>.github.io/<REPO>/?src=https%3A%2F%2F<USER>.github.io%2F<REPO>%2Fcatalog.json`
