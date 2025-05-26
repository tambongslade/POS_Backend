import { Module } from '@nestjs/common';
import { AiChatbotService } from './ai-chatbot.service';
import { ProductModule } from '../product.module'; // Assuming ProductModule path
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ProductModule, // To use ProductService
    ConfigModule,  // To use ConfigService for API keys
  ],
  providers: [AiChatbotService],
  exports: [AiChatbotService] // Export if other modules need to use it directly (e.g., WhatsappModule)
})
export class AiChatbotModule {} 