import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Store } from './store.entity';
import { Personnel } from './personnel.entity';
import { OrderItem } from './order-item.entity'; // Will be created next
import { Customer } from './customer.entity'; // Added Customer import
import { Payment } from './payment.entity'; // Import Payment entity

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  // REFUNDED = 'REFUNDED', // Future state
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true, name: 'customer_id' })
  customerId?: number | null;

  @ManyToOne(() => Customer, (customer) => customer.orders, { 
    nullable: true, 
    onDelete: 'SET NULL', // If customer is deleted, set customer_id to NULL in orders
    onUpdate: 'CASCADE' 
  })
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer | null;

  @Column('decimal', { precision: 10, scale: 2, name: 'total_amount' })
  totalAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0, name: 'amount_paid' })
  amountPaid: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.UNPAID,
    name: 'payment_status'
  })
  paymentStatus: PaymentStatus;

  @Column()
  status: string; // e.g., 'Pending', 'Completed', 'Cancelled', 'Processing'

  @Column({ name: 'payment_method' })
  paymentMethod: string;

  @Column({ name: 'store_id' })
  storeId: number;

  @ManyToOne(() => Store, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' }) // Prevent deleting store if it has orders
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ name: 'user_id' })
  userId: number; // Employee who processed the order

  @ManyToOne(() => Personnel, { onDelete: 'SET NULL', onUpdate: 'CASCADE' }) // If user is deleted, keep order but set user_id to null
  @JoinColumn({ name: 'user_id' })
  user: Personnel;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order, { cascade: true })
  items: OrderItem[]; // Order items associated with this order

  @OneToMany(() => Payment, (payment) => payment.order, { cascade: true }) // Relation to Payments
  payments: Payment[];
} 