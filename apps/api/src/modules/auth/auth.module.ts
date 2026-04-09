import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { RuntimeConfigModule } from "../../config/runtime-config.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SecurityEventsModule } from "../security-events/security-events.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { GoogleAuthController } from "./google-auth.controller";
import { SessionResolverService } from "./session-resolver.service";

@Module({
  imports: [
    ConfigModule,
    RuntimeConfigModule,
    NotificationsModule,
    SecurityEventsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: "15m"
        }
      })
    })
  ],
  controllers: [AuthController, GoogleAuthController],
  providers: [AuthService, SessionResolverService],
  exports: [AuthService, SessionResolverService, JwtModule]
})
export class AuthModule {}
