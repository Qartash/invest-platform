import { IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ContentReportStatus, ContentVoteKind } from '../../common/enums';

// Long enough for a real question with context, short enough that nobody posts
// an essay a founder will not read. The same ceiling the app shows a counter for.
export const MAX_QUESTION_LENGTH = 500;
// An answer gets more room: it is the one that has to explain itself.
export const MAX_ANSWER_LENGTH = 1000;

export class AskQuestionDto {
  @IsString()
  @MinLength(5)
  @MaxLength(MAX_QUESTION_LENGTH)
  body: string;
}

export class AnswerQuestionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(MAX_ANSWER_LENGTH)
  body: string;

  // The switch that turns one good answer into news for every holder rather than
  // for the handful of people reading this thread. Founder-only, and only on the
  // founder's own answer — the service checks both.
  @IsOptional()
  alsoPostAsUpdate?: boolean;

  // Pins the question to the top of the list. Set here rather than as a separate
  // request because the moment a founder knows a question matters to everyone is
  // the moment they are answering it.
  @IsOptional()
  pin?: boolean;
}

export class VoteDto {
  @IsEnum(ContentVoteKind)
  kind: ContentVoteKind;
}

// A fixed list, because the point of a code is that a moderator can filter on
// it. `other` exists so the list does not have to be complete, and carries the
// reporter's own words in `comment`.
export const REPORT_REASONS = ['off_platform', 'contacts', 'spam', 'not_an_answer', 'other'] as const;

export class ReportContentDto {
  @IsIn(REPORT_REASONS as unknown as string[])
  reason: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  comment?: string;
}

export class ResolveReportDto {
  // Only the two decisions a moderator can reach; `pending` is where a report
  // starts, not somewhere it can be put back.
  @IsIn([ContentReportStatus.HIDDEN, ContentReportStatus.DISMISSED])
  status: ContentReportStatus.HIDDEN | ContentReportStatus.DISMISSED;

  // Shown to the author of the hidden content, so it is not optional when
  // hiding — the service enforces that, since it depends on `status`.
  @IsString()
  @IsOptional()
  @MaxLength(200)
  reason?: string;
}
