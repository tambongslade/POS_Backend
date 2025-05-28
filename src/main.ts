import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
// import { AllExceptionsFilter } from './all-exceptions.filter'; // Import if you have this file

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: 'https://pos-dashboard-blue.vercel.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'content-type',
      'authorization',
      'x-requested-with',
      'accept',
      'origin',
      'access-control-request-method',
      'access-control-request-headers'
    ],
    exposedHeaders: [
      'content-type',
      'authorization',
      'x-requested-with',
      'accept',
      'origin'
    ],
    credentials: true,
    maxAge: 3600,
    preflightContinue: false,
    optionsSuccessStatus: 204
  });

 
  

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Automatically remove non-whitelisted properties
    transform: true, // Automatically transform payloads to DTO instances
    forbidNonWhitelisted: true, // Throw an error if non-whitelisted properties are present
  }));
  // app.useGlobalFilters(new AllExceptionsFilter()); // Uncomment if you have this file

  // Get port from environment variable or default to 5000
  const port = process.env.PORT || 5000;
  await app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });
}
bootstrap();
