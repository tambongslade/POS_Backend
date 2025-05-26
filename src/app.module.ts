import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DebugController } from './debug.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import {
  Store,
  Personnel,
  Product,
  Order,
  OrderItem,
  ActivityLog,
  Sale,
  Cart,
  CartItem,
  Customer,
  Payment
} from './models';
import { StoreModule } from './store.module';
import { PersonnelModule } from './personnel.module';
// PersonnelController and PersonnelService are now managed by PersonnelModule
// import { PersonnelController } from './personnel.controller';
// import { PersonnelService } from './personnel.service';
import { ProductModule } from './product.module';
// ProductController and ProductService are now managed by ProductModule
// import { ProductController } from './product.controller';
// import { ProductService } from './product.service';
import { OrderModule } from './order.module';
// OrderController and OrderService are now managed by OrderModule
// import { OrderController } from './order.controller';
// import { OrderService } from './order.service';
import { CartModule } from './cart.module';
// CartController and CartService are now managed by CartModule
// import { CartController } from './cart.controller';
// import { CartService } from './cart.service';
import { CustomerModule } from './customer.module';
// CustomerController and CustomerService are now managed by CustomerModule
// import { CustomerController } from './customer.controller';
// import { CustomerService } from './customer.service';
import { SaleModule } from './sale.module';
// SaleController and SaleService are now managed by SaleModule
// import { SaleController } from './sale.controller';
// import { SaleService } from './sale.service';
import { NotificationModule } from './notification.module';
// NotificationService is now managed by NotificationModule
// import { NotificationService } from './notification.service';
import { AuthModule } from './auth/auth.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { AiChatbotModule } from './ai-chatbot/ai-chatbot.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: 'postgresql://neondb_owner:npg_Xv3hQxLeOYE7@ep-round-paper-a2odkwfa-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
      entities: [
        Store,
        Personnel,
        Product,
        Order,
        OrderItem,
        ActivityLog,
        Sale,
        Cart,
        CartItem,
        Customer,
        Payment
      ],
      synchronize: true,
      logging: ['query', 'error', 'schema'],
      ssl: { 
        rejectUnauthorized: false
      },
    }),
    TypeOrmModule.forFeature([Personnel, Store]), // Add repositories for DebugController
    StoreModule,
    PersonnelModule,
    ProductModule,
    OrderModule,
    CartModule,
    CustomerModule,
    SaleModule,
    NotificationModule,
    AuthModule,
    ActivityLogModule,
    WhatsappModule,
    AiChatbotModule,
    DashboardModule,
  ],
  controllers: [AppController, DebugController],
  providers: [AppService],
})
export class AppModule {}
