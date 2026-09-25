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
  lastError?: string | null;

  @Column({ name: 'prompt_version', nullable: true })
  promptVersion?: string;

  /** 显式 type 是必需的：没有它时 `string | null` 会让 design:type 退化成 Object，TypeORM 启动即报错 */
  @Column({ type: 'varchar', nullable: true })
  model?: string | null;

  @Column({ name: 'started_at', nullable: true })
  startedAt?: Date;

  /** 同 model：要写 null（作废依赖产物时清空）就必须显式声明列类型 */
  @Column({ name: 'finished_at', type: 'timestamp', nullable: true })
  finishedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => TreeNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'node_id' })
  node: TreeNode;
}
