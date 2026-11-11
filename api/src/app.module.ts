import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MailModule } from './modules/internal/mail/mail.module';
import { SmsModule } from './modules/internal/sms/sms.module';
import { AiModule } from './modules/internal/ai/ai.module';
import { RedisModule } from './core/databases/redis/redis.module';
import { RedisCacheModule } from './modules/internal/redis-cache/redis-cache.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { ConfigModule } from './shared/config/env/env.module';
import { PlatformModule } from './shared/platform.module';
import { McpModule } from './core/mcp/mcp.module';
import { FEATURE_MODULES } from './modules/feature-modules';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    RedisModule,
    PlatformModule,
    MailModule,
    SmsModule,
    AiModule,
    RedisCacheModule,
    AuthModule,
    HealthModule,
    McpModule,
    ...FEATURE_MODULES,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
