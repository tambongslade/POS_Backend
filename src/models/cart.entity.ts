import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CartItem } from './cart-item.entity';
import { Personnel } from './personnel.entity';
// import { Customer } from './customer.entity'; // Assuming not for customer based on prior discussion

@Entity('carts')
export class Cart {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'int', nullable: true }) // Renamed and made nullable
  personnel_id?: number | null; // Foreign key for the personnel (employee)

  @ManyToOne(() => Personnel, { nullable: true, onDelete: 'SET NULL', onUpdate: 'CASCADE' }) // Made nullable
  @JoinColumn({ name: 'personnel_id' })
  personnel?: Personnel | null;

  // Example if personal_id was a ForeignKey to a Customer entity:
  // @ManyToOne(() => Customer)
  // @JoinColumn({ name: 'customer_id' }) // Would likely be customer_id
  // customer: Customer;

  @OneToMany(() => CartItem, (cartItem) => cartItem.cart, { cascade: true })
  items: CartItem[];
} 