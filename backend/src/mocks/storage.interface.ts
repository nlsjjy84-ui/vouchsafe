/**
 * =========================================================================
 * StorageService — "파일을 어딘가에 저장하고 접근 가능한 URL을 돌려준다"는
 * 계약(인터페이스)만 정의한다. 실제로 어디에 저장하는지(로컬 디스크 vs AWS S3)는
 * 이 인터페이스를 구현하는 쪽(MockStorageService / S3StorageService)이 결정한다.
 * =========================================================================
 * TypeScript의 interface는 컴파일 후 자바스크립트에서 완전히 사라지기 때문에,
 * NestJS의 의존성 주입(DI) 토큰으로 쓸 수 없다. 그래서 "추상 클래스"로 선언한다 —
 * 추상 클래스는 런타임에도 존재하는 실제 값(클래스)이라서 DI 토큰이 될 수 있다.
 * 이게 NestJS 공식 문서에서 권장하는 "인터페이스 기반 의존성 주입" 표준 기법이다.
 *
 * 컨트롤러(certifications.controller.ts, bounties.controller.ts)는 이제
 * MockStorageService라는 "구체적인 구현체"가 아니라 이 StorageService
 * "계약"에만 의존한다. 그래서 storage.module.ts에서 실제로 어떤 구현체를
 * 연결할지만 바꾸면, 컨트롤러 코드는 단 한 줄도 안 고쳐도 된다.
 * =========================================================================
 */
export abstract class StorageService {
  /**
   * @param originalName 업로드된 파일의 원래 이름 (확장자 검사용)
   * @param buffer 파일의 실제 바이트 내용
   * @param maxSizeBytes 이 업로드 용도에 허용되는 최대 용량 (호출하는 쪽이 용도에 맞는
   *   값을 넘긴다 - file-validation.util.ts의 MAX_CERTIFICATION_EVIDENCE_SIZE_BYTES /
   *   MAX_RESULT_FILE_SIZE_BYTES 참고. 용도마다 정상적으로 올라올 파일 크기가 달라서
   *   하나의 값을 공유하지 않는다)
   * @returns 저장된 파일에 접근할 수 있는 URL (로컬이면 `/uploads/...`, S3면 실제 S3 URL)
   */
  abstract saveFile(originalName: string, buffer: Buffer, maxSizeBytes: number): Promise<string>;
}
