import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, BeforeInsert, UpdateDateColumn } from 'typeorm';
import { Store } from './store.entity';
import * as bcrypt from 'bcrypt';

@Entity('personnel')
export class Personnel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column()
  role: string; // Should map to our Role enum in usage

  @Column()
  phone: string;

  @Column({ select: false, nullable: true })
  password?: string; // Made optional for updates where password isn't changed

  @Column({ type: 'int', nullable: true })
  storeId: number | null;

  @ManyToOne(() => Store, (store) => store.personnel, { onDelete: 'SET NULL', onUpdate: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'storeId' })
  store: Store | null;

  @Column({ unique: true })
  email: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  async hashPasswordOnInsert() { // Renamed to be specific to insert
    if (this.password) {
      const saltRounds = 10;
      this.password = await bcrypt.hash(this.password, saltRounds);
    }
  }

  // For password updates, a separate method in the service would handle hashing
  // and explicitly updating the password.
  // Example: async updatePassword(newPassword: string) {
  //   const saltRounds = 10;
  //   this.password = await bcrypt.hash(newPassword, saltRounds);
  // }
} 