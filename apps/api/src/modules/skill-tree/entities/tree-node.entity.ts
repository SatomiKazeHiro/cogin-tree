import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { NodeLevel, NodeStatus } from '@skill/shared';
import { SkillTree } from './skill-tree.entity';
import { NodeContent } from '../../content/entities/node-content.entity';

@Entity('tree_nodes')
export class TreeNode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tree_id' })
  treeId: string;

  @Column({ name: 'parent_id', nullable: true })
  parentId?: string;

  @Column({ type: 'enum', enum: NodeLevel })
  level: NodeLevel;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'key_points', nullable: true })
  keyPoints?: string;

  @Column({ type: 'enum', enum: NodeStatus, default: NodeStatus.ACTIVE })
  status: NodeStatus;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => SkillTree, (tree) => tree.nodes)
  @JoinColumn({ name: 'tree_id' })
  tree: SkillTree;

  @OneToMany(() => TreeNode, (node) => node.parent)
  children: TreeNode[];

  @ManyToOne(() => TreeNode, (node) => node.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: TreeNode;

  @OneToOne(() => NodeContent, (content) => content.node)
  content: NodeContent;
}
