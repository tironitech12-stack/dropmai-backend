import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// cookie-parser is CJS; Nest nodenext needs require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser') as () => unknown;

/** Always allow local + production Vercel front; merge with CORS_ORIGINS. */
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://dropmai.vercel.app',
];

function resolveCorsOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_CORS_ORIGINS, ...fromEnv])];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const origins = resolveCorsOrigins();
  console.log(`CORS origins: ${origins.join(', ')}`);

  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'X-Dropmai-User',
      'X-Requested-With',
    ],
    optionsSuccessStatus: 204,
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Render / cloud: bind 0.0.0.0:$PORT
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`Dropmai Backend listening on http://0.0.0.0:${port}`);
}
bootstrap();
