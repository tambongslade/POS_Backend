import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { Order } from './order.entity'; // Will be used later

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ nullable: true, name: 'last_name' })
  lastName?: string;

  @Index({ unique: true, where: '"email" IS NOT NULL' }) // Ensure uniqueness only for non-null emails
  @Column({ nullable: true, unique: false }) // unique: false here, DB constraint handles it
  email?: string;

  @Index({ unique: true, where: '"phone_number" IS NOT NULL' }) // Unique for non-null phone numbers
  @Column({ nullable: true, unique: false, name: 'phone_number' })
  phoneNumber?: string;

  @Column({ nullable: true, name: 'address_line1' })
  addressLine1?: string;

  @Column({ nullable: true, name: 'address_line2' })
  addressLine2?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true, name: 'state_province' })
  stateProvince?: string;

  @Column({ nullable: true, name: 'postal_code' })
  postalCode?: string;

  @Column({ nullable: true })
  country?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relationship to Orders (One customer can have many orders)
  // This will be uncommented and fully defined when Order entity is updated
  @OneToMany(() => Order, (order) => order.customer, { cascade: ['soft-remove', 'recover'] }) // Example cascade options
  orders: Order[];
} 