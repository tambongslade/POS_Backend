import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';
import { WhatsappInvoiceController } from './whatsapp-invoice.controller';
import { SaleService } from '../sale.service';
import { OrderService } from '../order.service';
import { CustomerService } from '../customer.service';
import { PersonnelService } from '../personnel.service';
import { StoreService } from '../store.service';
import { ProductService } from '../product.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale, Order, Customer, Personnel, Store, Product, OrderItem, ActivityLog, Cart, CartItem } from '../models';
import { AiChatbotService } from '../ai-chatbot/ai-chatbot.service';
import { NotificationModule } from '../notification.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Sale,
      Order,
      Customer,
      Personnel,
      Store,
      Product,
      OrderItem,
      ActivityLog,
      Cart,
      CartItem,
    ]),
    forwardRef(() => NotificationModule),
    ActivityLogModule,
  ],
  controllers: [WhatsappInvoiceController],
  providers: [
    WhatsappService,
    SaleService,
    OrderService,
    CustomerService,
    PersonnelService,
    StoreService,
    ProductService,
    AiChatbotService,
  ],
  exports: [WhatsappService],
})
export class WhatsappModule {} 