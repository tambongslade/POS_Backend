import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn
} from 'typeorm';
import { Order } from './order.entity';
import { Personnel } from './personnel.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'order_id' })
  orderId: number;

  @ManyToOne(() => Order, order => order.payments, { onDelete: 'CASCADE' }) // If order is deleted, delete associated payments
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @CreateDateColumn({ name: 'payment_date' }) // Using CreateDateColumn, assumes paymentDate is when record is created
  paymentDate: Date;                     // Or use @Column('timestamp') if manually set

  @Column({ name: 'payment_method' })
  paymentMethod: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'transaction_id' })
  transactionId?: string | null;

  @Column('text', { nullable: true })
  notes?: string | null;

  @Column({ type: 'int', name: 'recorded_by_user_id' })
  recordedByUserId: number;

  @ManyToOne(() => Personnel, { onDelete: 'SET NULL', nullable: true }) // If user is deleted, keep payment but set FK to null
  @JoinColumn({ name: 'recorded_by_user_id' })
  recordedBy: Personnel | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
} 