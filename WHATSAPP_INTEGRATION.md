# WhatsApp Integration for POS System

## Overview

The WhatsApp integration provides automated invoice delivery and transaction follow-up capabilities for the POS system. This feature allows businesses to:

- Send professional invoices via WhatsApp after sales completion
- Track and follow up on pending transactions
- Automatically send payment reminders
- Monitor transaction analytics and conversion rates

## Features

### 1. Invoice Delivery
- **Automated Invoice Sending**: Send detailed invoices to customers via WhatsApp
- **Professional Formatting**: Invoices include store branding, itemized details, and payment confirmation
- **Customer Information**: Supports both registered customers and walk-in sales
- **Multi-language Support**: Ready for internationalization

### 2. Transaction Follow-up
- **Pending Transaction Tracking**: Monitor orders awaiting payment completion
- **Automated Reminders**: Scheduled payment reminders at configurable intervals
- **Status Management**: Track reminder attempts and transaction abandonment
- **Manual Override**: Send immediate reminders or remove transactions from follow-up

### 3. Analytics & Reporting
- **Conversion Tracking**: Monitor payment completion rates
- **Reminder Effectiveness**: Analyze the impact of follow-up messages
- **Time-based Analytics**: Filter data by custom date ranges
- **Status Breakdown**: Detailed statistics on transaction statuses

## API Endpoints

### Authentication
All endpoints require JWT authentication with appropriate role permissions:
- **ADMIN, MANAGER, CASHIER**: Can send invoices and manage transactions
- **ADMIN, MANAGER**: Can access analytics and system status

### Core Endpoints

#### 1. Send Invoice
```http
POST /api/whatsapp/send-invoice
Content-Type: application/json
Authorization: Bearer {token}

{
  "saleId": 1,
  "customerPhone": "+1234567890"
}
```

#### 2. Add Pending Transaction
```http
POST /api/whatsapp/add-pending-transaction
Content-Type: application/json
Authorization: Bearer {token}

{
  "orderId": 1,
  "customerPhone": "+1234567890",
  "customerName": "John Doe",
  "totalAmount": 299.99
}
```

#### 3. Get Pending Transactions
```http
GET /api/whatsapp/pending-transactions
Authorization: Bearer {token}
```

#### 4. Send Manual Reminder
```http
POST /api/whatsapp/send-reminder/{orderId}
Authorization: Bearer {token}
```

#### 5. Transaction Analytics
```http
GET /api/whatsapp/analytics?days=30
Authorization: Bearer {token}
```

#### 6. Connection Status
```http
GET /api/whatsapp/connection-status
Authorization: Bearer {token}
```

## Setup Instructions

### 1. Dependencies Installation
```bash
npm install @whiskeysockets/baileys @hapi/boom
```

### 2. WhatsApp Authentication
1. Start the server
2. Check connection status via API
3. Scan QR code with WhatsApp mobile app
4. Verify connection is established

### 3. Environment Configuration
```env
# Optional: Configure WhatsApp session directory
WHATSAPP_SESSION_DIR=./whatsapp-session

# Optional: Configure reminder intervals (in hours)
FIRST_REMINDER_DELAY=2
SECOND_REMINDER_DELAY=24
ABANDONMENT_DELAY=48
```

## Usage Workflow

### Invoice Sending Workflow
1. **Sale Completion**: After a sale is finalized
2. **Customer Phone**: Collect customer's WhatsApp number
3. **Send Invoice**: Call the send-invoice endpoint
4. **Delivery Confirmation**: Check response for success status

### Transaction Follow-up Workflow
1. **Order Creation**: When an order is created but payment is pending
2. **Add to Follow-up**: Register the transaction for monitoring
3. **Automated Reminders**: System sends reminders automatically:
   - First reminder: 2 hours after creation
   - Second reminder: 24 hours after first reminder
   - Abandonment: 48 hours after second reminder
4. **Manual Intervention**: Send immediate reminders or remove from follow-up

## Message Templates

### Invoice Message Format
```
🧾 *INVOICE - Store Name*

📅 Date: MM/DD/YYYY
🆔 Sale ID: #123
🆔 Order ID: #456
👤 Customer: John Doe
👨‍💼 Cashier: Jane Smith

📦 *ITEMS:*
──────────────────────────────
• Product Name
  Qty: 2 × $50.00 = $100.00

──────────────────────────────
💰 *TOTAL: $100.00*
💳 Payment: Credit Card

✅ *Payment Completed Successfully*
Thank you for your business! 🙏

For support, reply to this message.
```

### Payment Reminder Format
```
⏰ *Payment Reminder*

Hi John! 👋

We noticed your order is still pending payment:

🆔 Order ID: #456
💰 Amount: $100.00

Please complete your payment to proceed with your order.

If you have any questions, feel free to reply to this message.
```

## Error Handling

### Common Error Scenarios
1. **WhatsApp Not Connected**: Service returns connection status
2. **Invalid Phone Number**: Automatic formatting and validation
3. **Missing Data**: Comprehensive validation for required fields
4. **Rate Limiting**: Built-in retry mechanisms for WhatsApp API

### Error Response Format
```json
{
  "statusCode": 500,
  "message": "Failed to send invoice via WhatsApp",
  "error": "Internal Server Error"
}
```

## Monitoring & Maintenance

### Health Checks
- **Connection Status**: Monitor WhatsApp connection state
- **Message Queue**: Track pending and failed messages
- **Session Management**: Automatic session persistence and recovery

### Performance Metrics
- **Message Delivery Rate**: Track successful vs failed deliveries
- **Response Times**: Monitor API endpoint performance
- **Conversion Rates**: Measure payment completion after reminders

### Troubleshooting
1. **Connection Issues**: Check QR code authentication
2. **Message Failures**: Verify phone number format
3. **Session Expiry**: Re-authenticate with WhatsApp
4. **Rate Limiting**: Implement message queuing

## Security Considerations

### Data Protection
- **Phone Number Encryption**: Secure storage of customer contact information
- **Message Logging**: Audit trail for all WhatsApp communications
- **Access Control**: Role-based permissions for all endpoints

### Privacy Compliance
- **Opt-in Consent**: Ensure customer consent for WhatsApp communications
- **Data Retention**: Configurable retention policies for message history
- **GDPR Compliance**: Support for data deletion requests

## Future Enhancements

### Planned Features
1. **Message Templates**: Customizable message formats
2. **Multi-language Support**: Localized messages
3. **Rich Media**: Support for images and documents
4. **Chatbot Integration**: Automated customer service responses
5. **Bulk Messaging**: Campaign management for promotions
6. **Integration APIs**: Webhook support for external systems

### Scalability Considerations
- **Message Queuing**: Redis-based queue for high-volume scenarios
- **Load Balancing**: Multiple WhatsApp instances for redundancy
- **Database Optimization**: Efficient storage for message history
- **Caching**: Redis caching for frequently accessed data

## Support

For technical support or feature requests, please contact the development team or create an issue in the project repository.

## License

This WhatsApp integration is part of the POS system and follows the same licensing terms as the main application. 