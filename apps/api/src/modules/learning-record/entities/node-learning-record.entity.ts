import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NodeLearningStatus } from '@skill/shared';

@Entity('node_learning_records')
export class NodeLearningRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'skill_tree_id' })
  skillTreeId: string;

  @Column({ name: 'node_id' })
  nodeId: string;

  @Column({ type: 'enum', enum: NodeLearningStatus, default: NodeLearningStatus.NOT_STARTED })
  status: NodeLearningStatus;

  @Column({ name: 'started_at', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @Column({ name: 'duration_seconds', nullable: true })
  durationSeconds?: number;

  @Column({ name: 'exercise_correct_count', nullable: true })
  exerciseCorrectCount?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
