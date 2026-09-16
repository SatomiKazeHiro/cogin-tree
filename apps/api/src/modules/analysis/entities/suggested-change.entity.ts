import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ExpireLevel, SuggestionAction, SuggestionStatus } from '@skill/shared';
import { AnalysisJob } from './analysis-job.entity';
import { TreeNode } from '../../skill-tree/entities/tree-node.entity';

@Entity('suggested_changes')
@Index(['jobId'])
@Index(['status'])
export class SuggestedChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'job_id' })
  jobId: string;

  @Column({ type: 'enum', enum: SuggestionAction })
  action: SuggestionAction;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  /** action=ADD 时建议挂载的 L1 节点；为空表示建议新增 L1 */
  @Column({ name: 'parent_node_id', type: 'uuid', nullable: true })
  parentNodeId?: string;

  /** action=EXPIRE 时的目标节点 */
  @Column({ name: 'target_node_id', type: 'uuid', nullable: true })
  targetNodeId?: string;

  @Column({ name: 'expire_level', type: 'enum', enum: ExpireLevel, nullable: true })
  expireLevel?: ExpireLevel;

  @Column({ type: 'enum', enum: SuggestionStatus, default: SuggestionStatus.PENDING })
  status: SuggestionStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => AnalysisJob, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: AnalysisJob;

  /** 节点被删除时仅断引用，保留建议本身用于审计 */
  @ManyToOne(() => TreeNode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_node_id' })
  parentNode?: TreeNode | null;

  @ManyToOne(() => TreeNode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'target_node_id' })
  targetNode?: TreeNode | null;
}
