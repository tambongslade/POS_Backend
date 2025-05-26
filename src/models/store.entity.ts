import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from './product.entity'; // Import Product entity
import { Personnel } from './personnel.entity'; // Import Personnel entity

@Entity('stores') // You can specify the table name, defaults to class name
export class Store {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column()
  phone: string;

  @ManyToOne(() => Personnel, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'managerId' })
  manager: Personnel | null;

  @Column({ type: 'int', name: 'managerId', nullable: true })
  managerId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date; // Changed from created_at

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date; // Changed from updated_at

  @OneToMany(() => Product, (product) => product.store)
  products: Product[];

  @OneToMany(() => Personnel, (personnel) => personnel.store)
  personnel: Personnel[];
} 