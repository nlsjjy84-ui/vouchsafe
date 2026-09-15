/**
 * 보안 강화 2탄 — "용도별 용량 상한 분리(15MB/20MB)".
 * 기존에는 두 업로드(자격 증빙 / 결과물 제출)가 똑같이 50MB 한도를 공유했다.
 * 용도가 다르면 위험도 다르다 — 증빙 서류는 이미지/PDF 한두 장이면 충분하니 더 빡빡하게,
 * 결과물(코드 zip 등)은 조금 더 여유 있게 잡되 둘 다 기존 50MB보다는 크게 낮췄다.
 */
export const EVIDENCE_MAX_BYTES = 15 * 1024 * 1024; // 자격 증빙(evidenceFile) — 15MB
export const SUBMISSION_MAX_BYTES = 20 * 1024 * 1024; // 결과물 제출(resultFile) — 20MB
