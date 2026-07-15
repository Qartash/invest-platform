import { IsNumber, IsOptional, IsPositive } from 'class-validator';

export class SelectApplicantDto {
  // The amount the founder agrees to freeze for this work. Defaults to the
  // applicant's offered price (or the work's price) when omitted. Lets a founder
  // assign at the actually-negotiated amount even if the work was created with a
  // higher planned price than the treasury can currently cover.
  @IsNumber()
  @IsPositive()
  @IsOptional()
  agreedAmount?: number;
}
