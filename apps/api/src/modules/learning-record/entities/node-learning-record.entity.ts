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
import { NodeLearningStatus } from '@skill/shared';
import { User } from '../../user/entities/user.entity';
import { SkillTree } from '../../skill-tree/entities/skill-tree.entity';
import { TreeNode } from '../../skill-tree/entities/tree-node.entity';

@Entity('node_learning_records')
@Unique(['userId', 'nodeId'])
@Index(['userId', 'skillTreeId'])
export class NodeLearningRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'skill_tree_id', type: 'uuid' })
  skillTreeId: string;

  @Index()
  @Column({ name: 'node_id', type: 'uuid' })
  nodeId: string;

  @Column({ type: 'enum', enum: NodeLearningStatus, default: NodeLearningStatus.NOT_STARTED })
  status: NodeLearningStatus;

  @Column({ name: 'started_at', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => SkillTree, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_tree_id' })
  skillTree: SkillTree;

  @ManyToOne(() => TreeNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'node_id' })
  node: TreeNode;
}
