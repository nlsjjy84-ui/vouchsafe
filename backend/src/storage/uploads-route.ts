import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { StoredFile } from './stored-file.entity';
import { contentTypeForExt, isInlineSafe } from './content-types';

/**
 * 시연용 자리표시 PDF. 시드 데이터가 가리키는 '/uploads/mock-result-*.pdf' 는 실제 파일이 없어
 * 미리보기가 깨졌다 — "mock-" 로 시작하는 요청에는 이 한 장짜리 안내 PDF를 대신 내려준다.
 */
function placeholderPdf(label: string): Buffer {
  const safe = label.replace(/[^A-Za-z0-9 ._-]/g, '');
  const stream = `BT /F1 20 Tf 60 740 Td (Vouchsafe demo file) Tj 0 -32 Td /F1 12 Tf (${safe}) Tj 0 -24 Td (Sample deliverable for demonstration.) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => (out += `${String(o).padStart(10, '0')} 00000 n \n`));
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}

/**
 * main.ts 에서 정적 서빙(app.useStaticAssets) 바로 뒤에 한 번 호출한다.
 * 디스크에 파일이 있으면 정적 서빙이 먼저 응답하고, 없을 때만 이 라우트가 DB(stored_files)를 찾는다.
 * (전역 prefix 'api' 밖의 경로라 컨트롤러 대신 어댑터에 직접 등록)
 */
export function registerUploadsRoute(app: NestExpressApplication): void {
  const dataSource = app.get(DataSource);
  app.getHttpAdapter().get('/uploads/:name', async (req: any, res: any) => {
    try {
      const name: string = String(req.params.name ?? '');
      const dot = name.lastIndexOf('.');
      const id = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : '';

      if (/^[0-9a-fA-F-]{36}$/.test(id)) {
        const file = await dataSource.getRepository(StoredFile).findOne({ where: { id } });
        if (file) {
          res.setHeader('Content-Type', file.contentType);
          res.setHeader('Content-Length', String(file.size));
          res.setHeader('Cache-Control', 'private, max-age=300');
          if (!isInlineSafe(file.contentType)) {
            res.setHeader(
              'Content-Disposition',
              `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
            );
          }
          return res.end(file.data);
        }
      }

      if (name.startsWith('mock-') && ext.toLowerCase() === '.pdf') {
        const pdf = placeholderPdf(name);
        res.setHeader('Content-Type', contentTypeForExt('.pdf'));
        res.setHeader('Content-Length', String(pdf.length));
        return res.end(pdf);
      }

      return res.status(404).json({ statusCode: 404, message: '파일을 찾을 수 없습니다' });
    } catch {
      return res.status(500).json({ statusCode: 500, message: '파일을 불러오지 못했습니다' });
    }
  });
}
