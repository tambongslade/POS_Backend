import { Controller, Get, Res, HttpStatus, Logger } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { Response } from 'express';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
// import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'; // Optional: For Swagger documentation

// @ApiTags('whatsapp') // Optional: For Swagger
@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly whatsappService: WhatsappService) {
    this.logger.log('WhatsappController instantiated'); // Log controller instantiation
  }

  @Get('qr-code')
  @ApiOperation({ summary: 'Get current WhatsApp QR code as a string' })
  @ApiResponse({ status: 200, description: 'QR code string or null if connected/not available.' })
  @ApiResponse({ status: 404, description: 'QR code not available.' })
  getCurrentQRCode(@Res() res: Response) {
    this.logger.log('[Entry] getCurrentQRCode method called'); // LOGGING ADDED HERE
    const qr = this.whatsappService.getCurrentQRCode();
    if (qr) {
      res.status(HttpStatus.OK).send(qr);
    } else {
      res.status(HttpStatus.NOT_FOUND).send('QR code not available or already connected.');
    }
  }

  @Get('qr-code-image')
  @ApiOperation({ summary: 'Get current WhatsApp QR code as a PNG image' })
  @ApiResponse({ status: 200, description: 'QR code image.', content: {'image/png': {}} })
  @ApiResponse({ status: 404, description: 'QR code not available.' })
  async getCurrentQRCodeImage(@Res() res: Response) {
    this.logger.log('[Entry] getCurrentQRCodeImage method called');
    try {
      this.logger.log('Attempting to serve QR code image...');
      const imageBuffer = await this.whatsappService.getCurrentQRCodeAsImage();
      if (imageBuffer) {
        res.setHeader('Content-Type', 'image/png');
        res.status(HttpStatus.OK).send(imageBuffer);
      } else {
        this.logger.warn('QR code image buffer not available or service returned null.');
        res.status(HttpStatus.NOT_FOUND).send('QR code not available or already connected.');
      }
    } catch (error) {
      this.logger.error('Failed to get QR code image in controller:', error.stack);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to generate QR code image.');
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'Get WhatsApp connection status' })
  @ApiResponse({ status: 200, description: 'Connection status details.' })
  getConnectionStatus() {
    return this.whatsappService.getConnectionStatus();
  }
} 