import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToOne
} from 'typeorm';
import { Order } from './order.entity';
import { Store } from './store.entity';
import { Personnel } from './personnel.entity';
import { Customer } from './customer.entity';

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true }) // Ensure one sale per order
  @Column({ name: 'order_id' })
  orderId: number;

  @OneToOne(() => Order, { onDelete: 'RESTRICT' }) // Prevent deleting order if a sale exists for it
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'transaction_id', nullable: true })
  transactionId?: string; // e.g., from payment gateway

  @Column({ name: 'payment_method_received' })
  paymentMethodReceived: string; // Actual payment method used for the sale

  @Column('decimal', { precision: 10, scale: 2, name: 'amount_paid' })
  amountPaid: number;

  // sale_date can be represented by createdAt

  @Column({ name: 'store_id' })
  storeId: number;

  @ManyToOne(() => Store, { onDelete: 'RESTRICT' }) // Sale belongs to a store
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ name: 'personnel_id' }) // Employee who processed the sale
  personnelId: number;

  @ManyToOne(() => Personnel, { onDelete: 'SET NULL', nullable: true }) // If personnel is deleted, keep sale but set personnel_id to null
  @JoinColumn({ name: 'personnel_id' })
  personnel?: Personnel | null;

  @Column({ name: 'customer_id', nullable: true })
  customerId?: number | null;

  @ManyToOne(() => Customer, { onDelete: 'SET NULL', nullable: true }) // If customer is deleted, keep sale but set customer_id to null
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer | null;

  @Column('text', { nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date; // Effectively the sale_date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
} 