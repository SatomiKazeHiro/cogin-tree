import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InterviewDifficulty } from '@skill/shared';
import { SkillTree } from '../../skill-tree/entities/skill-tree.entity';

@Entity('interview_questions')
export class InterviewQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tree_id' })
  treeId: string;

  @Column({ name: 'l2_node_id', nullable: true })
  l2NodeId?: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text' })
  answer: string;

  @Column({ type: 'enum', enum: InterviewDifficulty })
  difficulty: InterviewDifficulty;

  @Column()
  topic: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => SkillTree, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tree_id' })
  tree: SkillTree;
}
