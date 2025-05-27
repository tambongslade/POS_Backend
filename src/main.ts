import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
// import { AllExceptionsFilter } from './all-exceptions.filter'; // Import if you have this file

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS with specific origin
  app.enableCors({
    origin: [
      'https://pos-dashboard-blue.vercel.app',  // Production Vercel frontend
      'http://localhost:5173',                  // Local development frontend
      'http://localhost:3000'                   // Alternative local development port
    ],
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

  // Get port from environment variable or default to 5000
  const port = process.env.PORT || 5000;
  await app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });
}
bootstrap();
