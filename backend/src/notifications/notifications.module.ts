import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

// Imported by every module that raises notifications. It imports none of them
// back — the service knows about users and its own table and nothing else — so
// adding it to a module can never introduce a cycle.
@Module({
  imports: [TypeOrmModule.forFeature([Notification, User])],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
