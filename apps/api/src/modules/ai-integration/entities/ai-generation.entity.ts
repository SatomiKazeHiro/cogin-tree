import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AiGenerationErrorKind } from '@skill/shared';
import { User } from '../../user/entities/user.entity';
import { SkillTree } from '../../skill-tree/entities/skill-tree.entity';
import { TreeNode } from '../../skill-tree/entities/tree-node.entity';

/** 一次真实 AI 调用的审计记录（重试各占一行） */
@Entity('ai_generations')
@Index(['treeId', 'createdAt'])
@Index(['stage', 'createdAt'])
export class AiGeneration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  stage: string;

  @Column({ name: 'prompt_version' })
  promptVersion: string;

  @Column()
  provider: string;

  @Column()
  model: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ name: 'tree_id', type: 'uuid', nullable: true })
  treeId?: string | null;

  @Column({ name: 'node_id', type: 'uuid', nullable: true })
  nodeId?: string | null;

  @Column({ name: 'request_hash' })
  requestHash: string;

  /** 原始响应可能不是合法 JSON，故用 text 而非 jsonb */
  @Column({ name: 'raw_response', type: 'text' })
  rawResponse: string;

  @Column({ name: 'parsed_ok', default: false })
  parsedOk: boolean;

  @Column({ name: 'error_kind', type: 'enum', enum: AiGenerationErrorKind, nullable: true })
  errorKind?: AiGenerationErrorKind | null;

  @Column({ name: 'error_detail', type: 'text', nullable: true })
  errorDetail?: string | null;

  @Column({ name: 'prompt_tokens', nullable: true })
  promptTokens?: number;

  @Column({ name: 'completion_tokens', nullable: true })
  completionTokens?: number;

  @Column({ name: 'latency_ms' })
  latencyMs: number;

  @Column({ default: 1 })
  attempt: number;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @ManyToOne(() => SkillTree, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tree_id' })
  tree?: SkillTree | null;

  @ManyToOne(() => TreeNode, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'node_id' })
  node?: TreeNode | null;
}
