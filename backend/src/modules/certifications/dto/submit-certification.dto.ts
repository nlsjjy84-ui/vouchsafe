import { IsEnum, IsString, MinLength } from 'class-validator';
import { DomainType } from '../../../common/enums/domain-type.enum';
import { VerificationTrack } from '../../../common/enums/verification-track.enum';

export class SubmitCertificationDto {
  @IsEnum(DomainType)
  domainType: DomainType;

  @IsEnum(VerificationTrack)
  track: VerificationTrack;

  @IsString()
  @MinLength(2)
  licenseNumber: string;
}
