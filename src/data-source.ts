import { DataSource } from "typeorm";
import { Store, Personnel, Product, Order, OrderItem, ActivityLog, Sale, Cart, CartItem, Customer, Payment, } from './models';
import { CreateAndMigrateImeis1685106123456 } from "./migrations/1685106123456-CreateAndMigrateImeis";

export const AppDataSource = new DataSource({
    type: "postgres",
    url: 'postgresql://neondb_owner:npg_Xv3hQxLeOYE7@ep-round-paper-a2odkwfa-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { 
        rejectUnauthorized: false
    },
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
        Payment,
        // IMEI
    ],
    migrations: [CreateAndMigrateImeis1685106123456],
    logging: ['query', 'error', 'schema'],
}); 