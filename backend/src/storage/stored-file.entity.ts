import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * 업로드 파일을 DB(bytea)에 보관하는 행.
 * 무료 호스팅(Render 등)은 서버가 재시작되면 로컬 디스크(uploads 폴더)가 비워지므로,
 * 데모에서 올린 증빙·결과물이 사라지는 문제를 피하려고 파일 내용을 Postgres에 같이 저장한다.
 * id는 URL(/uploads/<id>.<확장자>)에 쓰이는 UUID 문자열.
 */
@Entity('stored_files')
export class StoredFile {
  @PrimaryColumn('varchar', { length: 64 })
  id: string;

  @Column('varchar', { length: 255 })
  originalName: string;

  @Column('varchar', { length: 100 })
  contentType: string;

  @Column('int')
  size: number;

  @Column('bytea')
  data: Buffer;

  @CreateDateColumn()
  createdAt: Date;
}
