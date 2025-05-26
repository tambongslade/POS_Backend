import { Injectable, Logger } from '@nestjs/common';
import { Sale } from './models'; // Assuming Sale model will be passed with customer info populated
import { WhatsappService } from './whatsapp/whatsapp.service'; // Corrected import path

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly whatsappService: WhatsappService) {} // Inject WhatsappService

  /**
   * Sends a sale invoice notification (placeholder).
   * Later, this will be replaced with actual WhatsApp API (Baileys) integration.
   * @param sale - The Sale entity, expected to have customer.phone_number if available.
   */
  async sendSaleInvoice(sale: Sale): Promise<void> {
    this.logger.log(`Attempting to send sale invoice for Sale ID: ${sale.id}`);

    if (sale.customer && sale.customer.phoneNumber) {
      const customerPhoneNumber = sale.customer.phoneNumber;
      const invoiceMessage = `Dear ${sale.customer.firstName || 'Customer'}, your invoice for sale ID ${sale.id} (Order ID: ${sale.orderId}) for a total of ${sale.amountPaid} is ready. Thank you for your purchase!`;
      
      this.logger.log(`Sending WhatsApp invoice to: ${customerPhoneNumber} via WhatsappService.`);
      this.logger.log(`Message: "${invoiceMessage}"`);

      try {
        const result = await this.whatsappService.sendMessage(customerPhoneNumber, invoiceMessage);
        if (result && result.key && result.key.id) {
          this.logger.log(`Successfully sent WhatsApp message for Sale ID: ${sale.id}. Message ID: ${result.key.id}`);
        } else {
          this.logger.error(`Failed to send WhatsApp message for Sale ID: ${sale.id}. WhatsappService.sendMessage returned undefined or no message ID.`);
          // Optionally, queue for retry or log to a more persistent error tracking
        }
      } catch (error) {
        this.logger.error(`Error calling WhatsappService for Sale ID: ${sale.id}`, error.stack);
      }
    } else {
      this.logger.warn(`Cannot send WhatsApp invoice for Sale ID: ${sale.id}. Customer phone number is missing.`);
    }
  }

  // Example of what a private method for Baileys might look like (to be implemented later)
  // private async sendWhatsAppMessage(recipient: string, message: string): Promise<void> {
  //   // 1. Ensure Baileys client is connected/authenticated
  //   // 2. Format recipient JID (e.g., recipient@s.whatsapp.net)
  //   // 3. Use Baileys sock.sendMessage(jid, { text: message })
  //   // Handle errors, disconnections, etc.
  //   this.logger.debug(`[Baileys Placeholder] Sending to ${recipient}: ${message}`);
  // }
}
