import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UsersService } from './users.service';
import { TicketsService } from '../tickets/tickets.service';
import { ProjectsService } from '../projects/projects.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { UserRole } from '../common/enums';
import { toPublicUser } from './public-user';
import { toInvestorProfile } from './investor-profile';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly ticketsService: TicketsService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: User) {
    return toPublicUser(user);
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    const updated = await this.usersService.update(user.id, dto);
    return toPublicUser(updated ?? user);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/avatars',
        filename: (req, file, cb) => {
          cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(@CurrentUser() user: User, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const updated = await this.usersService.setAvatar(user.id, `/uploads/avatars/${file.filename}`);
    return toPublicUser(updated ?? user);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('all')
  async findAll() {
    const users = await this.usersService.findAllForModeration();
    return users.map(toPublicUser);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/admin')
  async adminUpdate(@CurrentUser() admin: User, @Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return toPublicUser(await this.usersService.adminUpdate(id, dto, admin.id));
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/ban')
  async ban(@CurrentUser() admin: User, @Param('id') id: string) {
    return toPublicUser(await this.usersService.setBanned(id, true, admin.id));
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/unban')
  async unban(@CurrentUser() admin: User, @Param('id') id: string) {
    return toPublicUser(await this.usersService.setBanned(id, false, admin.id));
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async softDelete(@CurrentUser() admin: User, @Param('id') id: string) {
    return toPublicUser(await this.usersService.setDeleted(id, true, admin.id));
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/restore')
  async restore(@CurrentUser() admin: User, @Param('id') id: string) {
    return toPublicUser(await this.usersService.setDeleted(id, false, admin.id));
  }

  @Get(':id/investor-profile')
  async getInvestorProfile(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const [projects, foundedProjects] = await Promise.all([
      this.ticketsService.findActiveProjectsForOwner(id),
      this.projectsService.findByFounder(id),
    ]);
    return toInvestorProfile(user, projects, foundedProjects.length > 0);
  }
}
