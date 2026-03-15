import { NestFactory } from '@nestjs/core';
import serverlessExpress from '@codegenie/serverless-express';
import { AppModule } from './app.module';

type LambdaHandler = (
  event: unknown,
  context: unknown,
  callback: unknown,
) => Promise<unknown>;

let cachedHandler: LambdaHandler | null = null;

async function bootstrapServer(): Promise<LambdaHandler> {
  const app = await NestFactory.create(AppModule);
  await app.init();

  const expressApp = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressApp }) as LambdaHandler;
}

export async function handler(
  event: unknown,
  context: unknown,
  callback: unknown,
): Promise<unknown> {
  if (!cachedHandler) {
    cachedHandler = await bootstrapServer();
  }

  return cachedHandler(event, context, callback);
}
