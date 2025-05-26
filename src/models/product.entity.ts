import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Store } from './store.entity';

export enum ProductCategory {
  PHONE = 'Phone',
  LAPTOP = 'Laptop',
  ACCESSORIES = 'Accessories',
  TABLET = 'Tablet',
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column('text') // Use 'text' for potentially longer descriptions
  description: string;

  @Column({
    type: 'enum',
    enum: ProductCategory,
    // default: ProductCategory.ACCESSORIES // Removing default as user will clear table
  })
  category: ProductCategory;

  @Column('int')
  stock: number;

  @Column({ type: 'int' })
  storeId: number;

  @ManyToOne(() => Store, (store) => store.products, { onDelete: 'CASCADE', onUpdate: 'CASCADE' }) // Assuming Store will have a @OneToMany products field
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column('decimal', { precision: 10, scale: 2 }) // This is the selling price
  price: number; 

  @Column('decimal', { precision: 10, scale: 2 })
  cost_price: number;

  @Column('int', { nullable: true, name: 'low_stock_threshold' }) // Renamed from stock_level and mapped to DB name
  lowStockThreshold: number;

  // We might need an @UpdateDateColumn if products can be updated
} 