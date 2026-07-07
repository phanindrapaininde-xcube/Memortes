import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';

const server = express();

async function createNestServer(expressInstance: express.Express) {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
    {
      logger: ['error', 'warn', 'log', 'debug'],
    },
  );

  // CORS – allow the Expo dev server and any production origin
  app.enableCors({
    origin: ['http://localhost:8081', 'exp://localhost:8081', '*'],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // API versioning
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Global validation pipe (class-validator)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global response envelope interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  // Global error formatter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Memortes API')
    .setDescription('Backend API for the Memortes social media app')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.init();
  return app;
}

// Bootstrap for local development
async function bootstrap() {
  const expressApp = express();
  const app = await createNestServer(expressApp);
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Memortes backend running on http://localhost:${port}/api/v1`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

// If not running on Vercel, run normal bootstrap
if (!process.env.VERCEL) {
  bootstrap();
}

// Export the serverless handler for Vercel
let cachedServer: any;
export default async (req: any, res: any) => {
  if (!cachedServer) {
    cachedServer = await createNestServer(server);
  }
  return server(req, res);
};
