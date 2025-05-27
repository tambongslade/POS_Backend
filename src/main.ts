import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
// import { AllExceptionsFilter } from './all-exceptions.filter'; // Import if you have this file

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS with comprehensive configuration
  app.enableCors({
    origin: [
      'https://pos-dashboard-blue.vercel.app',  // Production frontend
      'http://localhost:5173',                  // Vite dev server
      'http://localhost:3000',                  // Alternative local port
      'http://127.0.0.1:5173',                 // Local IP
      'http://127.0.0.1:3000'                  // Local IP alternative port
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Access-Control-Allow-Methods',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Origin'
    ],
    exposedHeaders: ['Content-Length', 'Content-Range'],
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
