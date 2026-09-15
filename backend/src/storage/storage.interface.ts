/**
 * "어디에 파일을 저장하는가"를 감춘 공용 인터페이스.
 * MockStorageService(로컬 디스크)와 S3StorageService(AWS S3)가 둘 다 이 인터페이스만
 * 구현하면 되고, 컨트롤러(BountiesController, CertificationsController)는 이 토큰으로만
 * 주입받아서 어떤 구현체가 실제로 뒤에 붙었는지 전혀 몰라도 된다 —
 * 환경변수 STORAGE_DRIVER 하나로 Mock ↔ S3를 전환한다 (StorageModule 참고).
 */
export interface StorageService {
  /**
   * maxSizeBytes: 보안 강화 2탄 — 호출하는 쪽(컨트롤러)이 "이 업로드의 용도"에 맞는 상한을
   * 넘겨준다 (증빙 15MB / 결과물 20MB, storage/upload-limits.const.ts). multer 자체도
   * FileInterceptor의 limits.fileSize로 스트림 단계에서 동일한 값을 먼저 강제하므로, 여기서
   * 하는 검사는 "버퍼까지 넘어온 뒤"의 2차 방어선이다.
   */
  saveFile(originalName: string, buffer: Buffer, maxSizeBytes: number): string | Promise<string>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
