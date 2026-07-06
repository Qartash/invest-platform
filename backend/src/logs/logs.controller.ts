import { Body, Controller, Delete, Get, Headers, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LogsService } from './logs.service';
import { ClientLogDto } from './dto/client-log.dto';
import { UpdateLogSettingsDto } from './dto/update-log-settings.dto';
import { QueryLogsDto } from './dto/query-logs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@Controller('logs')
export class LogsController {
  constructor(
    private readonly logsService: LogsService,
    private readonly jwtService: JwtService,
  ) {}

  // Public and unauthenticated by design: the frontend must be able to log actions taken
  // before login (e.g. on the login screen itself). If a valid token is present, the log
  // is attributed to that user; otherwise it's recorded anonymously.
  @Post('client')
  logClientEvent(@Body() dto: ClientLogDto, @Headers('authorization') authHeader?: string) {
    const userId = this.tryExtractUserId(authHeader);
    this.logsService.logClient(dto.category, dto.message, dto.level, dto.metadata, userId);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  findLogs(@Query() query: QueryLogsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    return this.logsService.findLogs(
      { source: query.source, level: query.level, category: query.category, userId: query.userId, search: query.search },
      page,
      pageSize,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('settings')
  getSettings() {
    return this.logsService.getSettings();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('settings')
  updateSettings(@Body() dto: UpdateLogSettingsDto) {
    return this.logsService.updateSettings(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete()
  clearLogs() {
    return this.logsService.clearLogs();
  }

  private tryExtractUserId(authHeader?: string): string | null {
    if (!authHeader?.startsWith('Bearer ')) return null;
    try {
      const payload = this.jwtService.verify(authHeader.slice('Bearer '.length));
      return payload?.sub ?? null;
    } catch {
      return null;
    }
  }
}
