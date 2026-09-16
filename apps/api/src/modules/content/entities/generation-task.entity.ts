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
import { ArtifactKind, GenerationTaskStatus } from '@skill/shared';
import { TreeNode } from '../../skill-tree/entities/tree-node.entity';

/** 某节点上某类产物的生成意图与状态（幂等键：node_id + artifact_kind） */
@Entity('generation_tasks')
@Unique(['nodeId', 'artifactKind'])
export class GenerationTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'node_id', type: 'uuid' })
  nodeId: string;

  @Column({ name: 'artifact_kind', type: 'enum', enum: ArtifactKind })
  artifactKind: ArtifactKind;

  @Index()
  @Column({ type: 'enum', enum: GenerationTaskStatus, default: GenerationTaskStatus.PENDING })
  status: GenerationTaskStatus;

  @Column({ default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string;

  @Column({ name: 'prompt_version', nullable: true })
  promptVersion?: string;

  @Column({ nullable: true })
  model?: string;

  @Column({ name: 'started_at', nullable: true })
  startedAt?: Date;

  @Column({ name: 'finished_at', nullable: true })
  finishedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => TreeNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'node_id' })
  node: TreeNode;
}
