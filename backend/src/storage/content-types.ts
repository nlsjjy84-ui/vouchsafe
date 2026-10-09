const TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
};

export function contentTypeForExt(ext: string): string {
  return TYPES[ext.toLowerCase()] ?? 'application/octet-stream';
}

/** 브라우저 안에서 바로 보여도 안전한 형식(이미지·PDF)만 inline, 나머지는 내려받기로 강제. */
export function isInlineSafe(contentType: string): boolean {
  return contentType === 'application/pdf' || contentType.startsWith('image/');
}
