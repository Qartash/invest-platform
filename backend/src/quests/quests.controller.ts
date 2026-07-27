import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { QuestsService } from './quests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums';
import { CreateProjectQuestDto } from './dto/create-project-quest.dto';
import { AwardQuestDto } from './dto/award-quest.dto';

@UseGuards(JwtAuthGuard)
@Controller('quests')
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.questsService.listFor(user.id);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.questsService.complete(user.id, id);
  }

  // A founder paying for attention on their own project.
  @Post('project')
  createProjectQuest(@CurrentUser() user: User, @Body() dto: CreateProjectQuestDto) {
    return this.questsService.createProjectQuest(user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/pending')
  adminPending() {
    return this.questsService.adminPending();
  }

  // Confirming a bug report and paying it, in full or in part.
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/:id/award')
  award(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AwardQuestDto) {
    return this.questsService.completeAsAdmin(dto.userId, id, dto.amount);
  }
}
