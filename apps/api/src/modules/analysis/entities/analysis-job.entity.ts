import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AnalysisJobStatus, AnalysisType } from '@skill/shared';
import { SkillTree } from '../../skill-tree/entities/skill-tree.entity';

@Entity('analysis_jobs')
export class AnalysisJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tree_id' })
  treeId: string;

  @Column({ name: 'analysis_type', type: 'enum', enum: AnalysisType })
  analysisType: AnalysisType;

  @Column({ name: 'prompt_snapshot', type: 'text' })
  promptSnapshot: string;

  @Column({ name: 'raw_response', type: 'jsonb', nullable: true })
  rawResponse?: unknown;

  @Column({ type: 'enum', enum: AnalysisJobStatus })
  status: AnalysisJobStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => SkillTree, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tree_id' })
  tree: SkillTree;
}
