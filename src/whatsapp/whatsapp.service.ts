import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WAMessage,
  WASocket,
  proto, // Added for REVOKE
  WAMessageContent, // Added for typing
  fetchLatestBaileysVersion, // Added fetchLatestBaileysVersion, removed makeInMemoryStore
  ConnectionState,
  // MessageType, // Removed as it's not directly used for sending documents this way
  // MessageOptions, // Removed as it's not directly used for sending documents this way
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as path from 'path';
import * as fs from 'fs';
import * as qrcode from 'qrcode-terminal'; // Import qrcode-terminal
import * as qrcodeGenerator from 'qrcode'; // Import qrcode for image generation
import pino from 'pino';
import { AiChatbotService } from '../ai-chatbot/ai-chatbot.service';
import { Sale, Order, Customer, Product } from '../models';

// Constants
const SESSION_DIR = path.join(process.cwd(), 'whatsapp-session');
const RECONNECT_INTERVAL = 3000; // 3 seconds
const MAX_RECONNECT_RETRIES = 5;
const SESSION_FLUSH_INTERVAL = 60000; // 1 minute

export interface InvoiceData {
  sale: Sale;
  order: Order;
  customer?: Customer;
  items: Array<{
    product: Product;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  storeName: string;
  cashierName: string;
}

export interface TransactionFollowUp {
  id: number;
  customerPhone: string;
  customerName: string;
  orderId: number;
  totalAmount: number;
  status: 'PENDING' | 'REMINDED_ONCE' | 'REMINDED_TWICE' | 'ABANDONED';
  createdAt: Date;
  lastReminderAt?: Date;
  reminderCount: number;
}

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private sock: WASocket | undefined;
  private readonly logger = new Logger(WhatsappService.name);
  private baileysLogger: pino.Logger;
  private connectionRetryCount = 0;
  private maxConnectionRetries = MAX_RECONNECT_RETRIES;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private sessionFlushInterval: NodeJS.Timeout | null = null;
  public isConnectedFlag: boolean = false;
  private readonly adminJid: string;
  private messageCache = new Map<string, WAMessage>();
  private qrCode: string | null = null;
  private connectionState: string = 'close';
  private pendingTransactions: Map<number, TransactionFollowUp> = new Map();
  private authState: any = null;
  private saveCreds: any = null;

  constructor(
    private configService: ConfigService,
    private aiChatbotService: AiChatbotService,
  ) {
    this.adminJid = this.configService.get<string>('WHATSAPP_ADMIN_JID') || '237674805934@s.whatsapp.net';
    this.initializeSessionDirectory();
    this.initializeLogger();
  }

  private initializeSessionDirectory(): void {
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
      this.logger.log(`Created WhatsApp session directory: ${SESSION_DIR}`);
    }
  }

  private initializeLogger(): void {
    this.baileysLogger = pino({ 
      level: this.configService.get<string>('NODE_ENV') === 'production' ? 'error' : 'silent'
    });
  }

  async onModuleInit() {
    await this.start();
    this.startTransactionFollowUpScheduler();
    this.startSessionFlushInterval();
  }

  async onModuleDestroy() {
    this.cleanup();
  }

  private cleanup(): void {
    this.isConnectedFlag = false;
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    if (this.sessionFlushInterval) {
      clearInterval(this.sessionFlushInterval);
      this.sessionFlushInterval = null;
    }
    if (this.sock) {
      this.sock.end(new Error('Module destroyed'));
      this.sock = undefined;
    }
  }

  private startSessionFlushInterval(): void {
    this.sessionFlushInterval = setInterval(async () => {
      if (this.saveCreds) {
        try {
          await this.saveCreds();
          this.logger.debug('Session credentials flushed to disk');
        } catch (error) {
          this.logger.error('Failed to flush session credentials:', error);
        }
      }
    }, SESSION_FLUSH_INTERVAL);
  }

  async start(): Promise<void> {
    try {
      // Load or initialize auth state
      const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
      this.authState = state;
      this.saveCreds = saveCreds;

      // Get latest version
      const { version, isLatest } = await fetchLatestBaileysVersion();
      this.logger.log(`Using Baileys version: ${version.join('.')}, isLatest: ${isLatest}`);

      // Create socket connection
      this.sock = makeWASocket({
        version,
        auth: state,
        logger: this.baileysLogger,
        browser: ['NestJS-POS', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60_000, // 60 seconds
        qrTimeout: 40_000, // 40 seconds
        defaultQueryTimeoutMs: 60_000, // 60 seconds
        emitOwnEvents: true, // Emit events for own messages
        markOnlineOnConnect: true, // Mark client as online on connect
        syncFullHistory: false, // Don't sync full history to save bandwidth
      });

      // Set up event handlers
      this.setupEventHandlers();

    } catch (error) {
      this.logger.error('Failed to start WhatsApp service:', error);
      this.handleConnectionError(error);
    }
  }

  private setupEventHandlers(): void {
    if (!this.sock) return;

    // Credentials update handler
    this.sock.ev.on('creds.update', async () => {
      if (this.saveCreds) {
        await this.saveCreds();
      }
    });

    // Connection update handler
    this.sock.ev.on('connection.update', (update) => {
      this.handleConnectionUpdate(update);
    });

    // Message handler
    this.sock.ev.on('messages.upsert', ({ messages, type }) => {
      this.handleMessages(messages, type);
    });
  }

  private async handleConnectionUpdate(update: Partial<ConnectionState>): Promise<void> {
    const { connection, lastDisconnect, qr } = update;
    this.connectionState = connection || 'close';

    if (qr) {
      await this.handleQRCode(qr);
    }

    if (connection === 'close') {
      await this.handleDisconnection(lastDisconnect);
    } else if (connection === 'open') {
      await this.handleSuccessfulConnection();
    }
  }

  private async handleQRCode(qr: string): Promise<void> {
    this.qrCode = qr;
    this.logger.log('New QR code received. Scan with WhatsApp to authenticate.');
    
    // Generate terminal QR
    const qrToPrint = qr.includes(',') ? qr.split(',')[0].trim() : qr.trim();
    qrcode.generate(qrToPrint, { small: true });

    // Store QR image
    try {
      const qrImageBuffer = await qrcodeGenerator.toBuffer(qr);
      fs.writeFileSync(path.join(SESSION_DIR, 'latest-qr.png'), qrImageBuffer);
    } catch (error) {
      this.logger.error('Failed to generate QR image:', error);
    }
  }

  private async handleDisconnection(lastDisconnect: any): Promise<void> {
    this.isConnectedFlag = false;
    const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

    if (shouldReconnect && this.connectionRetryCount < this.maxConnectionRetries) {
      this.connectionRetryCount++;
      this.logger.log(`Attempting to reconnect... (Attempt ${this.connectionRetryCount}/${this.maxConnectionRetries})`);
      
      // Schedule reconnection
      setTimeout(() => {
        this.start();
      }, RECONNECT_INTERVAL * this.connectionRetryCount); // Exponential backoff
    } else if (statusCode === DisconnectReason.loggedOut) {
      this.logger.warn('WhatsApp session logged out. New QR code scan required.');
      this.cleanup();
      await this.deleteSession();
      await this.start(); // Restart to get new QR code
    } else {
      this.logger.error('Max reconnection attempts reached or permanent disconnection.');
      this.cleanup();
    }
  }

  private async handleSuccessfulConnection(): Promise<void> {
    this.isConnectedFlag = true;
    this.qrCode = null;
    this.connectionRetryCount = 0;
    this.logger.log('WhatsApp connection established successfully.');
    
    // Flush credentials to disk immediately after successful connection
    if (this.saveCreds) {
      try {
        await this.saveCreds();
      } catch (error) {
        this.logger.error('Failed to save credentials after connection:', error);
      }
    }
  }

  private async deleteSession(): Promise<void> {
    try {
      await fs.promises.rm(SESSION_DIR, { recursive: true, force: true });
      await fs.promises.mkdir(SESSION_DIR, { recursive: true });
      this.logger.log('WhatsApp session deleted successfully');
    } catch (error) {
      this.logger.error('Failed to delete WhatsApp session:', error);
    }
  }

  private handleConnectionError(error: any): void {
    this.logger.error('WhatsApp connection error:', error);
    if (this.connectionRetryCount < this.maxConnectionRetries) {
      this.connectionRetryCount++;
      setTimeout(() => {
        this.start();
      }, RECONNECT_INTERVAL * this.connectionRetryCount);
    } else {
      this.logger.error('Max connection retries reached. Manual restart required.');
    }
  }

  private extractMessageText(message: WAMessageContent | undefined | null): string {
    if (!message) return "";
    // Handle ephemeral messages by unwrapping them first
    if (message.ephemeralMessage) {
      message = message.ephemeralMessage.message;
      if (!message) return "";
    }
    // Handle document messages with captions
    if (message.documentMessage && message.documentMessage.caption) {
      return message.documentMessage.caption;
    }
    return message.conversation ||
           message.extendedTextMessage?.text ||
           message.imageMessage?.caption ||
           message.videoMessage?.caption ||
           ""; // return empty string if no text
  }

  private getMediaType(message: WAMessageContent | undefined | null): string {
    if (!message) return "[Unknown Media]";
    if (message.ephemeralMessage) {
      message = message.ephemeralMessage.message;
      if (!message) return "[Unknown Media]";
    }
    if (message.imageMessage) return "[Image]";
    if (message.videoMessage) return "[Video]";
    if (message.audioMessage) return "[Audio]";
    if (message.stickerMessage) return "[Sticker]";
    if (message.documentMessage) return "[Document]";
    if (message.locationMessage) return "[Location]";
    if (message.contactMessage) return "[Contact]";
    if (message.contactsArrayMessage) return "[Contacts List]";
    return "[Media or non-text message]";
  }

  private async handleMessages(messages: WAMessage[], type: string): Promise<void> {
    if (type !== 'notify') { // only process new messages that should be notified
      return;
    }

    for (const m of messages) {
      if (!m.message) continue; // Skip if message content is empty

      // Log basic info
      // this.logger.debug(`Raw message: ${JSON.stringify(m, null, 2)}`);
      const from = m.key.remoteJid;
      const messageId = m.key.id;

      // 1. Cache the message if it has an ID (for deletion tracking)
      if (messageId) {
        this.messageCache.set(messageId, m);
        // Optional: Add TTL for cache entries
        // setTimeout(() => this.messageCache.delete(messageId), 24 * 3600 * 1000); // 24 hour TTL
      }

      // 2. Handle REVOKE messages (deleted messages)
      // Check if this is a protocol message indicating a revoke
      if (m.message?.protocolMessage?.type === proto.Message.ProtocolMessage.Type.REVOKE) {
        const revokedMsgId = m.message.protocolMessage.key?.id;
        if (revokedMsgId) {
          const originalMessage = this.messageCache.get(revokedMsgId);
          const deletedByJid = m.message.protocolMessage.key?.remoteJid || from; // Who sent the revoke
          const deletedByParticipantJid = m.message.protocolMessage.key?.participant || m.key.participant || deletedByJid;
          const actorName = m.pushName || deletedByParticipantJid?.split('@')[0] || 'Someone';

          if (originalMessage) {
            const originalSenderJid = originalMessage.key.remoteJid;
            const originalParticipant = originalMessage.key.participant || originalSenderJid;
            const originalSenderName = originalMessage.pushName || originalParticipant?.split('@')[0] || 'Unknown';
            
            let content = this.extractMessageText(originalMessage.message);
            if (!content.trim()) {
              content = this.getMediaType(originalMessage.message);
            }
            const notification = `Message deleted by ${actorName} (sent by ${originalSenderName} in ${originalSenderJid}):\n\"${content}\"`;
            // this.logger.log(`Sending deletion notification to admin: ${notification}`); // Commented out
            // await this.sendMessage(this.adminJid, notification); // Commented out admin forward
            this.messageCache.delete(revokedMsgId); // Clean up cache
          } else {
            // this.logger.log(`Original message for revoked ID ${revokedMsgId} not found in cache.`); // Commented out
            // await this.sendMessage(this.adminJid, `A message (ID: ${revokedMsgId}) was deleted by ${actorName} from ${deletedByJid}, but its original content was not in cache.`); // Commented out admin forward
          }
        }
        continue; // Processed as a revoke
      }

      // 3. Handle Status/Broadcast messages
      if (from === 'status@broadcast') {
        const senderName = m.pushName || m.key.participant?.split('@')[0] || 'Unknown Contact';
        let statusContent = this.extractMessageText(m.message);
        if (!statusContent.trim()) {
          statusContent = this.getMediaType(m.message);
        }
        const broadcastNotification = `Status from ${senderName}: ${statusContent}`;
        // this.logger.log(`Forwarding status to admin: ${broadcastNotification}`); // Commented out
        // await this.sendMessage(this.adminJid, broadcastNotification); // Commented out admin forward
        continue; // Processed as broadcast
      }
      
      // Ignore messages from self or from the adminJid to prevent loops, unless it's a command for the bot from admin
      if (m.key.fromMe || from === this.adminJid) {
         // Log if needed: this.logger.debug(`Ignoring message from self or admin JID: ${from}`);
         // We still cache them above, but don't process for auto-reply/AI.
         continue;
      }

      // ---- Existing logic for yo and AI ----
      // this.logger.log(`Processing message from ${from}: ${JSON.stringify(m.message)}`); // Commented out
      const messageText = this.extractMessageText(m.message);

      if (messageText && from) { // Added null check for from
        const lowerCaseMessage = messageText.toLowerCase();
        if (lowerCaseMessage === 'yo') {
          // this.logger.log('Received "yo", replying with "lol"'); // Commented out
          await this.sendMessage(from, 'lol');
        } else {
          // this.logger.log(`Sending to AI chatbot: "${messageText}" from ${from}`); // Commented out
          // const aiResponse = await this.aiChatbotService.handleIncomingMessage(
          //   messageText, // Corrected: first argument is messageText
          //   from,      // Corrected: second argument is senderId (from)
          // );
          // await this.sendMessage(from, aiResponse);
          this.logger.log(`AI chatbot auto-reply disabled. Received message: "${messageText}" from ${from}`);
        }
      } else {
        // this.logger.log('No text content found in message or sender JID missing, not processing for yo/AI.'); // Commented out
      }
    }
  }

  async sendMessage(to: string, text: string, media?: { buffer: Buffer, mimetype: string, fileName: string }): Promise<WAMessage | undefined> {
    if (!this.sock || !this.isConnectedFlag) {
      this.logger.error('WhatsApp not connected. Cannot send message.');
      return undefined;
    }
    // this.logger.log(`Sending message to ${to}: "${text}"`); // Commented out
    try {
      if (media) {
        const messageContent = {
          document: media.buffer,
          mimetype: media.mimetype,
          fileName: media.fileName,
          caption: text // Use text as caption for the document
        };
        return await this.sock.sendMessage(to, messageContent);
      } else {
        return await this.sock.sendMessage(to, { text });
      }
    } catch (error) {
      this.logger.error(`Failed to send message to ${to}: `, error);
      return undefined;
    }
  }

  isConnected(): boolean {
    return this.isConnectedFlag;
  }

  private async handleIncomingMessage(message: any) {
    try {
      const messageText = message.message?.conversation || 
                         message.message?.extendedTextMessage?.text || '';
      const from = message.key.remoteJid;

      this.logger.log(`Received message from ${from}: ${messageText}`);

      // Handle transaction status inquiries
      if (messageText.toLowerCase().includes('order') || messageText.toLowerCase().includes('status')) {
        await this.handleOrderStatusInquiry(from, messageText);
      }

    } catch (error) {
      this.logger.error('Error handling incoming message:', error);
    }
  }

  private async handleOrderStatusInquiry(from: string, messageText: string) {
    // Extract order ID from message if present
    const orderIdMatch = messageText.match(/\d+/);
    if (orderIdMatch) {
      const orderId = parseInt(orderIdMatch[0]);
      const transaction = this.pendingTransactions.get(orderId);
      
      if (transaction) {
        const statusMessage = `📋 *Order Status Update*\n\n` +
          `Order ID: #${transaction.orderId}\n` +
          `Amount: $${transaction.totalAmount.toFixed(2)}\n` +
          `Status: ${transaction.status}\n\n` +
          `Please complete your payment to proceed with your order.`;
        
        await this.sendMessage(from, statusMessage);
      }
    }
  }

  async sendInvoice(invoiceData: InvoiceData, customerPhone: string, pdfBuffer?: Buffer): Promise<boolean> {
    if (!this.isConnectedFlag) {
      this.logger.warn('WhatsApp not connected. Cannot send invoice.');
      return false;
    }

    try {
      const formattedPhone = this.formatPhoneNumber(customerPhone);
      const invoiceMessage = this.formatInvoiceMessage(invoiceData);
      
      if (pdfBuffer) {
        await this.sendMessage(formattedPhone, invoiceMessage, { 
          buffer: pdfBuffer, 
          mimetype: 'application/pdf',
          fileName: `Invoice_${invoiceData.sale.id}.pdf` 
        });
      } else {
        await this.sendMessage(formattedPhone, invoiceMessage);
      }
      
      this.logger.log(`Invoice sent successfully to ${formattedPhone} for Sale ID: ${invoiceData.sale.id}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to send invoice:', error);
      return false;
    }
  }

  async sendPaymentReminder(orderId: number, customerPhone: string, customerName: string, totalAmount: number): Promise<boolean> {
    if (!this.isConnectedFlag) {
      this.logger.warn('WhatsApp not connected. Cannot send payment reminder.');
      return false;
    }

    try {
      const formattedPhone = this.formatPhoneNumber(customerPhone);
      const reminderMessage = this.formatPaymentReminderMessage(orderId, customerName, totalAmount);
      
      await this.sendMessage(formattedPhone, reminderMessage);
      
      // Update transaction follow-up
      this.updateTransactionFollowUp(orderId);
      
      this.logger.log(`Payment reminder sent to ${formattedPhone} for Order ID: ${orderId}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to send payment reminder:', error);
      return false;
    }
  }

  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Add country code if not present (assuming default country)
    if (!cleaned.startsWith('1') && cleaned.length === 10) {
      cleaned = '1' + cleaned; // US/Canada
    }
    
    return cleaned + '@s.whatsapp.net';
  }

  private formatInvoiceMessage(invoiceData: InvoiceData): string {
    const { sale, order, customer, items, storeName, cashierName } = invoiceData;
    
    let message = `🧾 *INVOICE - ${storeName}*\n\n`;
    message += `📅 Date: ${sale.createdAt.toLocaleDateString()}\n`;
    message += `🆔 Sale ID: #${sale.id}\n`;
    message += `🆔 Order ID: #${order.id}\n`;
    message += `👤 Customer: ${customer ? `${customer.firstName} ${customer.lastName}` : 'Walk-in Customer'}\n`;
    message += `👨‍💼 Cashier: ${cashierName}\n\n`;
    
    message += `📦 *ITEMS:*\n`;
    message += `${'─'.repeat(30)}\n`;
    
    items.forEach(item => {
      message += `• ${item.product.name}\n`;
      const unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice : 0;
      const total = typeof item.total === 'number' ? item.total : 0;
      message += `  Qty: ${item.quantity} × ${unitPrice.toFixed(2)} XAF = ${total.toFixed(2)} XAF\n\n`;
    });
    
    message += `${'─'.repeat(30)}\n`;
    const saleAmountPaid = typeof sale.amountPaid === 'number' ? sale.amountPaid : 0;
    message += `💰 *TOTAL: ${saleAmountPaid.toFixed(2)} XAF*\n`;
    message += `💳 Payment: ${sale.paymentMethodReceived}\n\n`;
    
    if (sale.notes) {
      message += `📝 Notes: ${sale.notes}\n\n`;
    }
    
    message += `✅ *Payment Completed Successfully*\n`;
    message += `Thank you for your business! 🙏\n\n`;
    message += `For support, reply to this message.`;
    
    return message;
  }

  private formatPaymentReminderMessage(orderId: number, customerName: string, totalAmount: number): string {
    const transaction = this.pendingTransactions.get(orderId);
    const reminderCount = transaction ? transaction.reminderCount + 1 : 1;
    
    let message = `⏰ *Payment Reminder*\n\n`;
    message += `Hi ${customerName}! 👋\n\n`;
    message += `We noticed your order is still pending payment:\n\n`;
    message += `🆔 Order ID: #${orderId}\n`;
    message += `💰 Amount: $${totalAmount.toFixed(2)}\n\n`;
    
    if (reminderCount === 1) {
      message += `Please complete your payment to proceed with your order.\n\n`;
      message += `If you have any questions, feel free to reply to this message.`;
    } else if (reminderCount === 2) {
      message += `This is your second reminder. Your order will be cancelled if payment is not received within 24 hours.\n\n`;
      message += `Need help? Reply to this message for assistance.`;
    } else {
      message += `Final reminder: Your order will be cancelled soon due to non-payment.\n\n`;
      message += `Contact us immediately if you still want to proceed.`;
    }
    
    return message;
  }

  addPendingTransaction(orderId: number, customerPhone: string, customerName: string, totalAmount: number): void {
    const transaction: TransactionFollowUp = {
      id: Date.now(),
      customerPhone,
      customerName,
      orderId,
      totalAmount,
      status: 'PENDING',
      createdAt: new Date(),
      reminderCount: 0,
    };
    
    this.pendingTransactions.set(orderId, transaction);
    this.logger.log(`Added pending transaction for Order ID: ${orderId}`);
  }

  private updateTransactionFollowUp(orderId: number): void {
    const transaction = this.pendingTransactions.get(orderId);
    if (transaction) {
      transaction.reminderCount++;
      transaction.lastReminderAt = new Date();
      
      if (transaction.reminderCount === 1) {
        transaction.status = 'REMINDED_ONCE';
      } else if (transaction.reminderCount === 2) {
        transaction.status = 'REMINDED_TWICE';
      } else {
        transaction.status = 'ABANDONED';
      }
      
      this.pendingTransactions.set(orderId, transaction);
    }
  }

  removePendingTransaction(orderId: number): void {
    this.pendingTransactions.delete(orderId);
    this.logger.log(`Removed pending transaction for Order ID: ${orderId}`);
  }

  getPendingTransactions(): TransactionFollowUp[] {
    return Array.from(this.pendingTransactions.values());
  }

  getTransactionById(orderId: number): TransactionFollowUp | undefined {
    return this.pendingTransactions.get(orderId);
  }

  private startTransactionFollowUpScheduler(): void {
    // Check for pending transactions every hour
    setInterval(() => {
      this.checkPendingTransactions();
    }, 60 * 60 * 1000); // 1 hour

    this.logger.log('Transaction follow-up scheduler started');
  }

  private async checkPendingTransactions(): Promise<void> {
    const now = new Date();
    const transactions = Array.from(this.pendingTransactions.values());
    
    for (const transaction of transactions) {
      const hoursSinceCreated = (now.getTime() - transaction.createdAt.getTime()) / (1000 * 60 * 60);
      const hoursSinceLastReminder = transaction.lastReminderAt 
        ? (now.getTime() - transaction.lastReminderAt.getTime()) / (1000 * 60 * 60)
        : hoursSinceCreated;
      
      // Send first reminder after 2 hours
      if (transaction.reminderCount === 0 && hoursSinceCreated >= 2) {
        await this.sendPaymentReminder(
          transaction.orderId,
          transaction.customerPhone,
          transaction.customerName,
          transaction.totalAmount
        );
      }
      // Send second reminder after 24 hours from first reminder
      else if (transaction.reminderCount === 1 && hoursSinceLastReminder >= 24) {
        await this.sendPaymentReminder(
          transaction.orderId,
          transaction.customerPhone,
          transaction.customerName,
          transaction.totalAmount
        );
      }
      // Mark as abandoned after 48 hours from second reminder
      else if (transaction.reminderCount === 2 && hoursSinceLastReminder >= 48) {
        transaction.status = 'ABANDONED';
        this.pendingTransactions.set(transaction.orderId, transaction);
        this.logger.log(`Transaction ${transaction.orderId} marked as abandoned`);
      }
    }
  }

  getConnectionStatus(): { connected: boolean; qrCode: string | null; state: string } {
    return {
      connected: this.isConnectedFlag,
      qrCode: this.qrCode,
      state: this.connectionState,
    };
  }

  getCurrentQRCode(): string | null {
    return this.qrCode;
  }

  async getCurrentQRCodeAsImage(): Promise<Buffer | null> {
    if (this.qrCode) {
      try {
        this.logger.log(`Generating QR image from string: ${this.qrCode.substring(0, 30)}...`); // Log part of QR string
        const qrImageBuffer = await qrcodeGenerator.toBuffer(this.qrCode, {
          type: 'png',
          errorCorrectionLevel: 'L',
          margin: 2,
          scale: 4,
        });
        return qrImageBuffer;
      } catch (error) {
        this.logger.error('Failed to generate QR code image in service:', error.stack);
        return null;
      }
    } else {
      this.logger.warn('getCurrentQRCodeAsImage called but this.qrCode is null.'); // ADDED THIS LOG
    }
    return null;
  }

  async sendLowStockReport(products: Product[], targetPhoneNumber: string): Promise<boolean> {
    if (!this.isConnectedFlag) {
      this.logger.warn('WhatsApp not connected. Cannot send low stock report.');
      return false;
    }

    if (!products || products.length === 0) {
      this.logger.log('No low stock products to report.');
      // Optionally send a message saying "All products have sufficient stock."
      // await this.sendMessage(targetPhoneNumber, "All products currently have sufficient stock. 👍");
      return true; // No report needed, but operation considered successful
    }

    let reportMessage = "🚨 *Low Stock Report* 🚨\n\n";
    reportMessage += "The following products are running low on stock:\n";
    reportMessage += "${'─'.repeat(30)}\n";

    products.forEach(product => {
      reportMessage += `📦 *${product.name}* (ID: ${product.id})\n`;
      reportMessage += `   Store: ${product.store ? product.store.name : 'N/A'} (ID: ${product.storeId})\n`;
      reportMessage += `   Current Stock: *${product.stock}*\n`;
      reportMessage += `   Threshold: ${product.lowStockThreshold}\n`;
      reportMessage += "${'─'.repeat(30)}\n";
    });

    reportMessage += "\nPlease restock these items soon to avoid shortages.";

    try {
      const formattedPhone = this.formatPhoneNumber(targetPhoneNumber);
      await this.sendMessage(formattedPhone, reportMessage);
      this.logger.log(`Low stock report sent successfully to ${formattedPhone}. Items reported: ${products.length}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to send low stock report:', error);
      return false;
    }
  }
} 