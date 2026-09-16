import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { LearningStatus } from '@skill/shared';
import { User } from '../../user/entities/user.entity';
import { SkillTree } from '../../skill-tree/entities/skill-tree.entity';

@Entity('learning_records')
@Unique(['userId', 'skillTreeId'])
export class LearningRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index()
  @Column({ name: 'skill_tree_id', type: 'uuid' })
  skillTreeId: string;

  @Column({ type: 'enum', enum: LearningStatus, default: LearningStatus.IN_PROGRESS })
  status: LearningStatus;

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => SkillTree, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_tree_id' })
  skillTree: SkillTree;
}
