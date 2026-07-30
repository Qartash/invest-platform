import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { DemoSeedService } from './demo-seed.service';
import { WipeDataDto } from './dto/wipe-data.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly demoSeedService: DemoSeedService,
  ) {}

  // Three locks, because this is the only call in the API that cannot be undone: a valid
  // session, the admin role, and a password that is not stored anywhere the app can read
  // back. POST rather than DELETE so the password travels in a body and never in a URL
  // that would end up in access logs.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('wipe')
  wipe(@CurrentUser() admin: User, @Body() dto: WipeDataDto) {
    return this.adminService.wipeEverything(admin.id, dto.password);
  }

  // Behind the same password as the wipe. Nothing here destroys data, but it invents four
  // accounts and a project with money moving through them, and that is not something a
  // live platform should be one stray tap away from.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('seed-demo')
  seedDemo(@CurrentUser() admin: User, @Body() dto: WipeDataDto) {
    this.adminService.assertWipePassword(dto.password);
    return this.demoSeedService.seed(admin.id, admin.fullName ?? admin.username ?? 'admin');
  }
}
