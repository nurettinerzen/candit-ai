import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { RuntimeConfigService } from "./config/runtime-config.service";
import { StructuredLoggerService } from "./common/logging/structured-logger.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const runtimeConfig = app.get(RuntimeConfigService);
  const logger = app.get(StructuredLoggerService);
  // Validate startup configuration (includes production safety check)
  const startupValidation = runtimeConfig.validateAtStartup();

  app.enableCors({
    origin: runtimeConfig.corsOrigins,
    credentials: runtimeConfig.authTokenTransport === "cookie"
  });

  app.setGlobalPrefix("v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  await app.listen(runtimeConfig.port);

  logger.info("api.started", {
    port: runtimeConfig.port,
    runtimeMode: runtimeConfig.runtimeMode,
    authMode: runtimeConfig.authMode,
    authTransport: runtimeConfig.authTokenTransport,
    healthy: startupValidation.healthy,
    providers: startupValidation.providers
  });

  for (const warning of startupValidation.warnings) {
    logger.warn("runtime.provider_config.warning", {
      warning
    });
  }

  if (!startupValidation.healthy) {
    logger.warn("runtime.startup.unhealthy", {
      message: "One or more critical providers are not configured. System may have limited functionality."
    });
  }
}

void bootstrap();
