import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { PortraitAnswer } from '../../portrait/entities/portrait-answer.entity';

@Entity('user_profiles')
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ name: 'computed_portrait', type: 'jsonb', nullable: true })
  computedPortrait?: Record<string, unknown>;

  /** computedPortrait 的 zod 契约版本（阶段 3 起写入） */
  @Column({ name: 'portrait_schema_version', nullable: true })
  portraitSchemaVersion?: string;

  @Column({ name: 'portrait_updated_at', nullable: true })
  portraitUpdatedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => User, (user) => user.profile)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => PortraitAnswer, (answer) => answer.profile)
  answers: PortraitAnswer[];
}
