import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TreeType } from '@skill/shared';
import { TreeNode } from './tree-node.entity';
import { Recommendation } from '../../recommendation/entities/recommendation.entity';
import { User } from '../../user/entities/user.entity';

@Entity('skill_trees')
export class SkillTree {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'enum', enum: TreeType, default: TreeType.ENTRY })
  type: TreeType;

  @Column({ nullable: true })
  keywords?: string;

  @Column({ type: 'enum', enum: ['ACTIVE', 'ARCHIVED'], default: 'ACTIVE' })
  status: 'ACTIVE' | 'ARCHIVED';

  /** 归属用户：技能树为私有资源，仅创建者可读写 */
  @Index()
  @Column({ name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => TreeNode, (node) => node.tree)
  nodes: TreeNode[];

  @OneToMany(() => Recommendation, (rec) => rec.skillTree)
  recommendations: Recommendation[];
}
