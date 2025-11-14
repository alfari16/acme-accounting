import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configure global ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip away any non-decorated properties
      transform: true, // Automatically transform payloads to be objects typed according to their DTO classes
      forbidNonWhitelisted: true, // Throw an error if non-whitelisted properties are provided
      transformOptions: {
        enableImplicitConversion: true, // Allow implicit conversion of primitive types
      },
    }),
  );

  void app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
