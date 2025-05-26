import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProductService } from './product.service';
import { WhatsappService } from './whatsapp/whatsapp.service';
import { Sale } from './models'; // Assuming Sale is used elsewhere, kept it

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly productService: ProductService, // Injected ProductService
  ) {}

  /**
   * Sends a sale invoice notification (placeholder).
   * Later, this will be replaced with actual WhatsApp API (Baileys) integration.
   * @param sale - The Sale entity, expected to have customer.phone_number if available.
   */
  async sendSaleInvoice(sale: Sale): Promise<void> {
    this.logger.log(`Attempting to send sale invoice for Sale ID: ${sale.id}`);

    if (sale.customer && sale.customer.phoneNumber) {
      const customerPhoneNumber = sale.customer.phoneNumber;
      let invoiceMessage = `Dear ${sale.customer.firstName || 'Customer'}, your invoice for sale ID ${sale.id} (Order ID: ${sale.orderId}) for a total of ${sale.amountPaid} XAF is ready. Thank you for your purchase!`;
      
      this.logger.log(`Sending WhatsApp invoice to: ${customerPhoneNumber} via WhatsappService.`);
      this.logger.log(`Message: "${invoiceMessage}"`);

      try {
        const result = await this.whatsappService.sendMessage(customerPhoneNumber, invoiceMessage);
        if (result && result.key && result.key.id) {
          this.logger.log(`Successfully sent WhatsApp message for Sale ID: ${sale.id}. Message ID: ${result.key.id}`);
        } else {
          this.logger.error(`Failed to send WhatsApp message for Sale ID: ${sale.id}.`);
        }
      } catch (error) {
        this.logger.error(`Error calling WhatsappService for Sale ID: ${sale.id}`, error.stack);
      }
    } else {
      this.logger.warn(`Cannot send WhatsApp invoice for Sale ID: ${sale.id}. Customer phone number is missing.`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM, { 
    name: 'lowStockNotification',
  })
  async handleLowStockCheck() {
    this.logger.log('Running scheduled job: Checking for low stock products...');
    try {
      const lowStockProducts = await this.productService.getLowStockProductsReport();
      
      if (lowStockProducts && lowStockProducts.length > 0) {
        const targetPhoneNumber = '670527426'; // As specified by user
        this.logger.log(`Found ${lowStockProducts.length} low stock products. Sending report to ${targetPhoneNumber}.`);
        await this.whatsappService.sendLowStockReport(lowStockProducts, targetPhoneNumber);
      } else {
        this.logger.log('No low stock products found. No report sent.');
      }
    } catch (error) {
      this.logger.error('Error during scheduled low stock check:', error.stack);
    }
  }
}
