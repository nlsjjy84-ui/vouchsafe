import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1, { message: '댓글 내용을 입력해 주세요' })
  @MaxLength(1000, { message: '댓글은 1000자 이하로 입력해 주세요' })
  content: string;

  /** 대댓글이면 부모 댓글 id */
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
