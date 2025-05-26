import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
// import { AllExceptionsFilter } from './all-exceptions.filter'; // Import if you have this file

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: true, // Allow any origin for now, or specifically your frontend http://localhost:5173
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Automatically remove non-whitelisted properties
    transform: true, // Automatically transform payloads to DTO instances
    forbidNonWhitelisted: true, // Throw an error if non-whitelisted properties are present
  }));
  // app.useGlobalFilters(new AllExceptionsFilter()); // Uncomment if you have this file
  await app.listen(5000);
}
bootstrap();
