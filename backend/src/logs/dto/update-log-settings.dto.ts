import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateLogSettingsDto {
  @IsOptional()
  @IsBoolean()
  frontendClicksEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  backendRequestsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  errorsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  databaseQueriesEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  consoleLogsEnabled?: boolean;
}
