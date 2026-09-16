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
import { TreeNode } from '../../skill-tree/entities/tree-node.entity';

@Entity('interview_questions')
export class InterviewQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tree_id' })
  treeId: string;

  /** 题目所属的 L2 节点；节点删除时题目级联删除 */
  @Column({ name: 'l2_node_id' })
  l2NodeId: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text' })
  answer: string;

  @Column({ type: 'enum', enum: InterviewDifficulty })
  difficulty: InterviewDifficulty;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => SkillTree, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tree_id' })
  tree: SkillTree;

  @ManyToOne(() => TreeNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'l2_node_id' })
  node: TreeNode;
}
