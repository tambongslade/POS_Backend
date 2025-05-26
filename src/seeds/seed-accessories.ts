import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module'; // Adjust path to your AppModule
import { ProductService } from '../product.service'; // Adjust path to your ProductService
import { ProductCategory } from '../models/product.entity'; // Adjust path to your ProductEntity
import { CreateProductDto } from '../product/dto/create-product.dto'; // Adjust path to your DTO

// Data to seed - using the structure of CreateProductDto
const productsToSeed: CreateProductDto[] = [
  { name: "SCREEN PROTECTORS", stock: 1050, category: ProductCategory.ACCESSORIES, costPrice: 100, price: 300, storeId: 3, description: "Glass screen protectors", lowStockThreshold: 5 },
  { name: "SILICONE PHONE CASE", stock: 40, category: ProductCategory.ACCESSORIES, costPrice: 300, price: 800, storeId: 3, description: "Silicone protective phone case", lowStockThreshold: 5 },
  { name: "PHONE BATTERY XR", stock: 5, category: ProductCategory.ACCESSORIES, costPrice: 2500, price: 4500, storeId: 3, description: "Phone battery replacement", lowStockThreshold: 5, imei: "IMEI12345XR" },
  { name: "BATTERY 12 PRO MAX", stock: 2, category: ProductCategory.ACCESSORIES, costPrice: 3000, price: 5000, storeId: 3, description: "Battery for iPhone 12 Pro Max", lowStockThreshold: 5, imei: "IMEI67890PM" },
  { name: "BATTERY XS MAX", stock: 5, category: ProductCategory.ACCESSORIES, costPrice: 2700, price: 4700, storeId: 3, description: "Battery for iPhone XS Max", lowStockThreshold: 5, imei: "IMEI13579XM" },
 
  { name: "SILICONE IPHONE Case", stock: 352, category: ProductCategory.ACCESSORIES, costPrice: 800, price: 1500, storeId: 3, description: "Silicone iPhone protective case", lowStockThreshold: 5 },
  { name: "ORIGINAL SILICONE", stock: 72, category: ProductCategory.ACCESSORIES, costPrice: 1200, price: 2000, storeId: 3, description: "High-quality original Samsung charger", lowStockThreshold: 5 },
  { name: "ORIGINAL SAMFOLD", stock: 17, category: ProductCategory.ACCESSORIES, costPrice: 1500, price: 2500, storeId: 3, description: "Original Sat Flip case", lowStockThreshold: 5 },
  { name: "ORIGINAL FLIP", stock: 8, category: ProductCategory.ACCESSORIES, costPrice: 1600, price: 2800, storeId: 3, description: "Original Z-Flip case", lowStockThreshold: 5 },
  { name: "IPHONE 15PM 360 Case", stock: 19, category: ProductCategory.ACCESSORIES, costPrice: 1200, price: 2000, storeId: 3, description: "360 protective case for iPhone 13", lowStockThreshold: 5 },
  { name: "IPHONE XS MAX", stock: 3, category: ProductCategory.ACCESSORIES, costPrice: 1200, price: 2000, storeId: 3, description: "360 protective case for iPhone 13", lowStockThreshold: 5 },
  { name: "IPHONE XR Case", stock: 2, category: ProductCategory.ACCESSORIES, costPrice: 1200, price: 2000, storeId: 3, description: "360 protective case for iPhone 13", lowStockThreshold: 5 },
  { name: "IPHONE 12PM Case", stock: 4, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "IPHONE 13PM Case", stock: 1, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "IPHONE 11 Case", stock: 1, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "PIXEL SILICONE", stock: 115, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "SAMSUNG CASING (S8)", stock: 13, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "SCREEN PROTECTOR(PIXEL)", stock: 263, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "SCREEN PROTECTOR(IPHONE)", stock: 297, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "SCREEN PROTECTOR(SAMSUNG)", stock: 9, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "FULL SCREEN PROTECTOR", stock: 30, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "USB KEY (64G)", stock: 11, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "USB KEY (128G)", stock: 4, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "MEMORY CARD (128G)", stock: 11, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "HARD DRIVE (250G)", stock: 6, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "CAMERA PROTECTOR", stock: 27, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "DTG", stock: 10, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "LED LIGHTS", stock: 4, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "WIRELESS BLUETOOTH", stock: 5, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "PHONE CHARGER(14PM)", stock: 17, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "SAM EARPHONE", stock: 7, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "HOCO SPEAKER", stock: 2, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "SMART WATCH(X 16PRO)", stock: 3, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "POWER BANK (30000MA)", stock: 2, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "WIRELESS SPEAKER(YS-110)", stock: 2, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
  { name: "JBL HEADSET(JB7700)", stock: 1, category: ProductCategory.ACCESSORIES, costPrice: 1300, price: 2100, storeId: 3, description: "Protective case for iPhone 12", lowStockThreshold: 5 },
 { name: "JBL HEADSET 720", stock: 8, category: ProductCategory.ACCESSORIES, costPrice: 3500, price: 6000, storeId: 3, description: "JBL headset", lowStockThreshold: 5 },
  { name: "JBL 86", stock: 5, category: ProductCategory.ACCESSORIES, costPrice: 4000, price: 6500, storeId: 3, description: "JBL 83L speaker", lowStockThreshold: 5 },
  { name: "BOX 3JBL", stock: 5, category: ProductCategory.ACCESSORIES, costPrice: 3700, price: 6200, storeId: 3, description: "BOX 33BL Bluetooth speaker", lowStockThreshold: 5 },
  { name: "WIFI BOX", stock: 4, category: ProductCategory.ACCESSORIES, costPrice: 3700, price: 6200, storeId: 3, description: "BOX 33BL Bluetooth speaker", lowStockThreshold: 5 },
  { name: "WIRERLESS GLASSES F07", stock: 2, category: ProductCategory.ACCESSORIES, costPrice: 3700, price: 6200, storeId: 3, description: "BOX 33BL Bluetooth speaker", lowStockThreshold: 5 },
  
  { name: "JBL SMART GLASSES", stock: 2, category: ProductCategory.ACCESSORIES, costPrice: 3700, price: 6200, storeId: 3, description: "BOX 33BL Bluetooth speaker", lowStockThreshold: 5 },
  { name: "WATCH HANDEL", stock: 1, category: ProductCategory.ACCESSORIES, costPrice: 3700, price: 6200, storeId: 3, description: "BOX 33BL Bluetooth speaker", lowStockThreshold: 5 },
  { name: "WIRELESS MOUSE", stock: 1, category: ProductCategory.ACCESSORIES, costPrice: 3700, price: 6200, storeId: 3, description: "BOX 33BL Bluetooth speaker", lowStockThreshold: 5 },
  { name: "WIRELESS KEYBOARD", stock: 3, category: ProductCategory.ACCESSORIES, costPrice: 3700, price: 6200, storeId: 3, description: "BOX 33BL Bluetooth speaker", lowStockThreshold: 5 },
  { name: "IPHONE POWER ADAPTER", stock: 9, category: ProductCategory.ACCESSORIES, costPrice: 3700, price: 6200, storeId: 3, description: "BOX 33BL Bluetooth speaker", lowStockThreshold: 5 },
  { name: "POWER BANK (10,000 MAH)", stock: 5, category: ProductCategory.ACCESSORIES, costPrice: 3700, price: 6200, storeId: 3, description: "BOX 33BL Bluetooth speaker", lowStockThreshold: 5 },
  { name: "WIRELESS CHARGER", stock: 8, category: ProductCategory.ACCESSORIES, costPrice: 2000, price: 3800, storeId: 3, description: "Wireless charger", lowStockThreshold: 5 },
  { name: "GOOGLE USB UNDDER", stock: 3, category: ProductCategory.ACCESSORIES, costPrice: 2000, price: 3800, storeId: 3, description: "Wireless charger", lowStockThreshold: 5 },
  { name: "ORAIMO USB", stock: 19, category: ProductCategory.ACCESSORIES, costPrice: 2000, price: 3800, storeId: 3, description: "Wireless charger", lowStockThreshold: 5 },
  { name: "NORMAL EARPODS", stock: 3, category: ProductCategory.ACCESSORIES, costPrice: 2000, price: 3800, storeId: 3, description: "Wireless charger", lowStockThreshold: 5 },
  { name: "AIRPODS PRO", stock: 22, category: ProductCategory.ACCESSORIES, costPrice: 2000, price: 3800, storeId: 3, description: "Wireless charger", lowStockThreshold: 5 },
  { name: "WALKING TOCKY", stock: 2, category: ProductCategory.ACCESSORIES, costPrice: 2000, price: 3800, storeId: 3, description: "Wireless charger", lowStockThreshold: 5 },
  { name: "SMART WATCH (A50 PLUS)", stock: 3, category: ProductCategory.ACCESSORIES, costPrice: 2000, price: 3800, storeId: 3, description: "Wireless charger", lowStockThreshold: 5 },
  { name: "PRIMS POWER BANK", stock: 10, category: ProductCategory.ACCESSORIES, costPrice: 2000, price: 3800, storeId: 3, description: "Wireless charger", lowStockThreshold: 5 },
  { name: "PHONE STAND", stock: 6, category: ProductCategory.ACCESSORIES, costPrice: 2000, price: 3800, storeId: 3, description: "Wireless charger", lowStockThreshold: 5 },
  

];

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const productService = appContext.get(ProductService);
  // Optional: Define an actorId if your ProductService.create method uses it for logging
  const actorIdForSeeding = 1; // Example: system user or a specific admin ID

  console.log('Starting to seed products...');

  for (const productDto of productsToSeed) {
    try {
      // actorIdForSeeding can be passed as the second argument if your service method expects it
      await productService.create(productDto, actorIdForSeeding); 
      console.log(`Successfully seeded product: ${productDto.name}`);
    } catch (error) {
      console.error(`Failed to seed product: ${productDto.name}`, error.response?.message || error.message, error.stack);
    }
  }

  await appContext.close();
  console.log('Product seeding finished.');
}

bootstrap().catch(err => {
  console.error('Error during seeding process:', err);
  process.exit(1);
}); 