import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { WipeDataDto } from './dto/wipe-data.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
}
