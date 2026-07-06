import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { SystemLog } from './entities/system-log.entity';
import { LogSettings } from './entities/log-settings.entity';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';
import { HttpLoggingInterceptor } from './http-logging.interceptor';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([SystemLog, LogSettings]), AuthModule],
  controllers: [LogsController],
  providers: [
    LogsService,
    { provide: APP_INTERCEPTOR, useClass: HttpLoggingInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
  exports: [LogsService],
})
export class LogsModule {}
