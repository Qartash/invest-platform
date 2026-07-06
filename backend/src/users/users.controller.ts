import {
  BadRequestException,
  Body,
  Controller,
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
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { toPublicUser } from './public-user';
import { toInvestorProfile } from './investor-profile';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly ticketsService: TicketsService,
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

  @Get(':id/investor-profile')
  async getInvestorProfile(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const projects = await this.ticketsService.findActiveProjectsForOwner(id);
    return toInvestorProfile(user, projects);
  }
}
