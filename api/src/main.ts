import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { parseCorsUrls, resolveCorsOrigins } from './shared/config/cors';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // Profile photo URLs are stored absolute from API_URL, which is often the public URL behind a proxy that adds `/api`.
  // Serve them with or without that prefix so stored URLs keep working locally and behind the proxy.
  app.use((req: { url: string }, _res: unknown, next: () => void) => {
    if (req.url.startsWith('/api/auth/photos/')) req.url = req.url.slice(4);
    next();
  });
  app.set('trust proxy', 1);
  app.useBodyParser('json', { limit: '10mb' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Logiqdev OS API')
    .setDescription('REST API of Logiqdev OS. Authenticate with a user token or an API key (`lqk_…`). The organization comes from the credential (`X-Organization-Id` selects among a user\'s memberships).')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  const corsOrigins = resolveCorsOrigins({
    nodeEnv: process.env.NODE_ENV,
    corsUrls: parseCorsUrls(process.env.CORS_URLS),
    appUrl: process.env.APP_URL,
    landingUrl: process.env.LANDING_URL,
  });

  const appCors = {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Organization-Id', 'X-Api-Key', 'X-Mcp-Client', 'X-Branch-Id', 'X-Portal-Membership-Id', 'X-Proposal-Access', 'X-Client-Active'],
    // Headers the browser app reads from responses (CSV exports, file downloads).
    exposedHeaders: ['Content-Disposition', 'X-Record-Count', 'X-Row-Count'],
  };
  // 13 website chat widget: runs on customer sites, so any origin may call /support/widget/* without credentials;
  // the widget service checks the channel's allowed origins itself.
  const widgetCors = { origin: true, credentials: false, methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-Widget-Token'] };
  app.enableCors((req: { url?: string }, cb: (err: Error | null, options: typeof appCors | typeof widgetCors) => void) =>
    cb(null, req.url?.startsWith('/support/widget/') ? widgetCors : appCors),
  );

  app.enableShutdownHooks();
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}
bootstrap();
