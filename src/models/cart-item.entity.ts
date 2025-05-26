import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Cart } from './cart.entity';
import { Product } from './product.entity';

@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  cart_id: number;

  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' }) // If cart is deleted, delete its items
  @JoinColumn({ name: 'cart_id' })
  cart: Cart;

  @Column()
  product_id: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' }) // Or RESTRICT if a product in a cart shouldn't be deleted
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column('int')
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2, comment: 'Price of the product at the time it was added to cart' })
  price_at_addition: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
} 