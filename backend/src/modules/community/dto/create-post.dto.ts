import { IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { PostCategory } from '../entities/community-post.entity';
import { DomainType } from '../../../common/enums/domain-type.enum';

export class CreatePostDto {
  @IsEnum(PostCategory, { message: '분류를 선택해 주세요' })
  category: PostCategory;

  // 멀티파트 폼은 빈 값을 ''로 보내므로, 값이 있을 때만 검증한다
  @IsOptional()
  @ValidateIf((o) => o.domainType !== undefined && o.domainType !== null && o.domainType !== '')
  @IsEnum(DomainType, { message: '분야 값이 올바르지 않습니다' })
  domainType?: DomainType | '';

  @IsString()
  @MinLength(2, { message: '제목은 2자 이상 입력해 주세요' })
  @MaxLength(120, { message: '제목은 120자 이하로 입력해 주세요' })
  title: string;

  @IsString()
  @MinLength(5, { message: '내용은 5자 이상 입력해 주세요' })
  @MaxLength(5000, { message: '내용은 5000자 이하로 입력해 주세요' })
  content: string;
}
