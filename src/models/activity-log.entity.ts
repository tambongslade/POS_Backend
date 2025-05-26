import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Personnel } from './personnel.entity';
import { Store } from './store.entity';

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @ManyToOne(() => Personnel, { onDelete: 'SET NULL' }) // If user is deleted, keep log but set user_id to null
  @JoinColumn({ name: 'user_id' })
  user: Personnel;

  @Column()
  action: string; // e.g., 'Added employee', 'Deleted product'

  @Column()
  entity_type: string; // e.g., 'Personnel', 'Product'

  @Column()
  entity_id: number; // ID of the affected entity

  @Column({ type: 'int', nullable: true })
  store_id?: number; // Optional store_id

  @ManyToOne(() => Store, { onDelete: 'SET NULL', nullable: true }) // If store is deleted, set store_id to null
  @JoinColumn({ name: 'store_id' })
  store?: Store;

  @Column('text')
  details: string; // Descriptive text of the activity

  @CreateDateColumn()
  created_at: Date;
} 