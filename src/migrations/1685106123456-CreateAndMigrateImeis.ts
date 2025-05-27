import { MigrationInterface, QueryRunner } from "typeorm";
// import { IMEIStatus } from "../models/imei.entity";
import { ProductCategory } from "../models/product.entity";

export class CreateAndMigrateImeis1685106123456 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create products table if it doesn't exist
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "products" (
                "id" SERIAL PRIMARY KEY,
                "name" VARCHAR NOT NULL,
                "description" TEXT NOT NULL,
                "category" VARCHAR NOT NULL,
                "stock" INTEGER NOT NULL,
                "storeId" INTEGER NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "price" DECIMAL(10,2) NOT NULL,
                "cost_price" DECIMAL(10,2) NOT NULL,
                "low_stock_threshold" INTEGER,
                "imei" VARCHAR(255)
            )
        `);

        // First create the IMEI status enum type
        await queryRunner.query(`DROP TYPE IF EXISTS "imei_status_enum" CASCADE`);
        await queryRunner.query(`
            CREATE TYPE "imei_status_enum" AS ENUM ('available', 'sold', 'defective')
        `);

        // Create the new imeis table
        await queryRunner.query(`
            CREATE TABLE "imeis" (
                "id" SERIAL PRIMARY KEY,
                "imei" VARCHAR(15) NOT NULL UNIQUE,
                "status" "imei_status_enum" NOT NULL DEFAULT 'available',
                "productId" INTEGER NOT NULL,
                "soldAt" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "fk_product_imeis" FOREIGN KEY ("productId") 
                    REFERENCES "products"("id") ON DELETE CASCADE
            )
        `);

        // Create index on productId for better performance
        await queryRunner.query(`
            CREATE INDEX "idx_imeis_product_id" ON "imeis"("productId")
        `);

        // Migrate existing IMEI data from products table
        await queryRunner.query(`
            INSERT INTO "imeis" (imei, status, "productId", created_at)
            SELECT 
                imei,
                'available' as status,
                id as "productId",
                created_at
            FROM products 
            WHERE imei IS NOT NULL AND imei != ''
        `);

        // Now that data is migrated, we can safely remove the old column
        await queryRunner.query(`
            ALTER TABLE "products" DROP COLUMN IF EXISTS "imei"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Add back the imei column
        await queryRunner.query(`
            ALTER TABLE "products" ADD COLUMN "imei" VARCHAR(255)
        `);

        // Migrate data back to products table (only the most recent IMEI per product)
        await queryRunner.query(`
            UPDATE products p
            SET imei = i.imei
            FROM (
                SELECT DISTINCT ON ("productId") 
                    "productId",
                    imei
                FROM imeis
                ORDER BY "productId", created_at DESC
            ) i
            WHERE p.id = i."productId"
        `);

        // Drop the imeis table and related objects
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_imeis_product_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "imeis"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "imei_status_enum"`);
    }
} 