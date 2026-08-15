import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TeamMemberInputDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  @MaxLength(120)
  role: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  // Comes back from POST :id/team-photo. Uploading is a separate step so a photo can be
  // attached before the member row exists — otherwise a brand-new project could never have
  // team photos, since there is nothing to hang them off yet.
  @IsOptional()
  @IsString()
  photoUrl?: string;
}

export class SetTeamMembersDto {
  // Replaces the whole roster rather than patching it: the founder edits the list as a list
  // (add, remove, reorder), so sending it whole is what the screen actually does.
  // An empty array is valid and means "no team listed".
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TeamMemberInputDto)
  members: TeamMemberInputDto[];
}
