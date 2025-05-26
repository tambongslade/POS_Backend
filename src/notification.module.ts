import { Module, forwardRef } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ProductModule } from './product.module';

@Module({
  imports: [
    forwardRef(() => WhatsappModule), // Use forwardRef to break circular dependency
    ProductModule,
  ],
  providers: [NotificationService],
  exports: [NotificationService], // Export if other modules need to inject it
})
export class NotificationModule {}
