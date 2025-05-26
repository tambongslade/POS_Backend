import { Controller, Post, Get, Body, Param, UseGuards, HttpException, HttpStatus, Query, Delete, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express'; // Required for Express.Multer.File
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, Role } from '../auth/decorators/roles.decorator';
import { WhatsappService, InvoiceData, TransactionFollowUp } from './whatsapp.service';
import { SaleService } from '../sale.service';
import { OrderService } from '../order.service';
import { CustomerService } from '../customer.service';
import { PersonnelService } from '../personnel.service';
import { StoreService } from '../store.service';
import { ProductService } from '../product.service';

export interface SendInvoiceDto {
  saleId: number;
  customerPhone: string;
}

export interface AddPendingTransactionDto {
  orderId: number;
  customerPhone: string;
  customerName: string;
  totalAmount: number;
}

export interface SendReminderDto {
  orderId: number;
}

@Controller('api/whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WhatsappInvoiceController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly saleService: SaleService,
    private readonly orderService: OrderService,
    private readonly customerService: CustomerService,
    private readonly personnelService: PersonnelService,
    private readonly storeService: StoreService,
    private readonly productService: ProductService,
  ) {}

  @Post('send-invoice')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CASHIER)
  @UseInterceptors(FileInterceptor('pdfFile'))
  async sendInvoice(
    @Body() sendInvoiceDto: SendInvoiceDto,
    @UploadedFile() pdfFile: Express.Multer.File
  ) {
    try {
      const { saleId, customerPhone } = sendInvoiceDto;

      if (!pdfFile) {
        throw new HttpException('PDF file is required', HttpStatus.BAD_REQUEST);
      }

      // Get sale with all related data
      const sale = await this.saleService.findOne(saleId);
      if (!sale) {
        throw new HttpException('Sale not found', HttpStatus.NOT_FOUND);
      }

      // Get order with items
      const order = await this.orderService.findOne(sale.orderId);
      if (!order) {
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }

      // Get customer if exists
      let customer: any = undefined;
      if (order.customerId) {
        customer = await this.customerService.findOne(order.customerId);
      }

      // Get personnel (cashier)
      const personnel = await this.personnelService.findOne(order.userId);
      if (!personnel) {
        throw new HttpException('Personnel not found', HttpStatus.NOT_FOUND);
      }

      // Get store
      const store = await this.storeService.findOne(order.storeId);
      if (!store) {
        throw new HttpException('Store not found', HttpStatus.NOT_FOUND);
      }

      // Prepare invoice data
      const invoiceData: InvoiceData = {
        sale: {
          ...sale,
          amountPaid: parseFloat(sale.amountPaid as any),
        },
        order,
        customer,
        items: order.items.map(item => {
          const numericUnitPrice = parseFloat(item.unitPrice as any);
          return {
            product: item.product,
            quantity: item.quantity,
            unitPrice: numericUnitPrice,
            total: item.quantity * numericUnitPrice,
          };
        }),
        storeName: store.name,
        cashierName: `${personnel.firstName} ${personnel.lastName}`,
      };

      // Send invoice via WhatsApp
      const success = await this.whatsappService.sendInvoice(invoiceData, customerPhone, pdfFile.buffer);

      if (!success) {
        throw new HttpException('Failed to send invoice via WhatsApp', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return {
        success: true,
        message: 'Invoice sent successfully via WhatsApp',
        saleId,
        customerPhone,
      };

    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('Error in sendInvoice controller:', error);
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('add-pending-transaction')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CASHIER)
  async addPendingTransaction(@Body() addPendingTransactionDto: AddPendingTransactionDto) {
    try {
      const { orderId, customerPhone, customerName, totalAmount } = addPendingTransactionDto;

      // Verify order exists
      const order = await this.orderService.findOne(orderId);
      if (!order) {
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }

      // Add to pending transactions
      this.whatsappService.addPendingTransaction(orderId, customerPhone, customerName, totalAmount);

      return {
        success: true,
        message: 'Transaction added to follow-up list',
        orderId,
        customerPhone,
        customerName,
        totalAmount,
      };

    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('pending-transactions')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getPendingTransactions(): Promise<{
    transactions: TransactionFollowUp[];
    total: number;
    summary: {
      pending: number;
      remindedOnce: number;
      remindedTwice: number;
      abandoned: number;
    };
  }> {
    try {
      const transactions = this.whatsappService.getPendingTransactions();
      
      const summary = {
        pending: transactions.filter(t => t.status === 'PENDING').length,
        remindedOnce: transactions.filter(t => t.status === 'REMINDED_ONCE').length,
        remindedTwice: transactions.filter(t => t.status === 'REMINDED_TWICE').length,
        abandoned: transactions.filter(t => t.status === 'ABANDONED').length,
      };

      return {
        transactions,
        total: transactions.length,
        summary,
      };

    } catch (error) {
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('pending-transactions/:orderId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CASHIER)
  async getPendingTransaction(@Param('orderId') orderId: string) {
    try {
      const transaction = this.whatsappService.getTransactionById(parseInt(orderId));
      
      if (!transaction) {
        throw new HttpException('Transaction not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        transaction,
      };

    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('send-reminder/:orderId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CASHIER)
  async sendPaymentReminder(@Param('orderId') orderId: string) {
    try {
      const orderIdNum = parseInt(orderId);
      const transaction = this.whatsappService.getTransactionById(orderIdNum);
      
      if (!transaction) {
        throw new HttpException('Transaction not found', HttpStatus.NOT_FOUND);
      }

      const success = await this.whatsappService.sendPaymentReminder(
        transaction.orderId,
        transaction.customerPhone,
        transaction.customerName,
        transaction.totalAmount
      );

      if (!success) {
        throw new HttpException('Failed to send payment reminder', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return {
        success: true,
        message: 'Payment reminder sent successfully',
        orderId: orderIdNum,
        reminderCount: transaction.reminderCount + 1,
      };

    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('pending-transactions/:orderId')
  @Roles(Role.ADMIN, Role.MANAGER)
  async removePendingTransaction(@Param('orderId') orderId: string) {
    try {
      const orderIdNum = parseInt(orderId);
      const transaction = this.whatsappService.getTransactionById(orderIdNum);
      
      if (!transaction) {
        throw new HttpException('Transaction not found', HttpStatus.NOT_FOUND);
      }

      this.whatsappService.removePendingTransaction(orderIdNum);

      return {
        success: true,
        message: 'Transaction removed from follow-up list',
        orderId: orderIdNum,
      };

    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('connection-status')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getConnectionStatus() {
    try {
      const status = this.whatsappService.getConnectionStatus();
      
      return {
        success: true,
        ...status,
      };

    } catch (error) {
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('analytics')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getTransactionAnalytics(@Query('days') days?: string) {
    try {
      const daysNum = days ? parseInt(days) : 30;
      const transactions = this.whatsappService.getPendingTransactions();
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysNum);
      
      const recentTransactions = transactions.filter(t => t.createdAt >= cutoffDate);
      
      const analytics = {
        totalTransactions: recentTransactions.length,
        totalValue: recentTransactions.reduce((sum, t) => sum + t.totalAmount, 0),
        statusBreakdown: {
          pending: recentTransactions.filter(t => t.status === 'PENDING').length,
          remindedOnce: recentTransactions.filter(t => t.status === 'REMINDED_ONCE').length,
          remindedTwice: recentTransactions.filter(t => t.status === 'REMINDED_TWICE').length,
          abandoned: recentTransactions.filter(t => t.status === 'ABANDONED').length,
        },
        averageValue: recentTransactions.length > 0 
          ? recentTransactions.reduce((sum, t) => sum + t.totalAmount, 0) / recentTransactions.length 
          : 0,
        conversionRate: recentTransactions.length > 0 
          ? ((recentTransactions.length - recentTransactions.filter(t => t.status === 'ABANDONED').length) / recentTransactions.length) * 100
          : 0,
        period: `Last ${daysNum} days`,
      };

      return {
        success: true,
        analytics,
      };

    } catch (error) {
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('qr-code')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getQrCode() {
    try {
      const qrString = this.whatsappService.getCurrentQRCode();
      if (qrString) {
        return { 
          success: true, 
          message: 'QR code string retrieved. Use a QR generator to display it.',
          qrCode: qrString 
        };
      } else {
        const status = this.whatsappService.getConnectionStatus();
        if (status.connected) {
          return { 
            success: true, 
            message: 'WhatsApp is already connected. No QR code available.', 
            qrCode: null 
          };
        } else {
          throw new HttpException(
            'QR code not available yet. WhatsApp might be initializing or disconnected. Please try again shortly.',
            HttpStatus.NOT_FOUND
          );
        }
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error retrieving QR code:', error);
      throw new HttpException('Failed to retrieve QR code', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
} 