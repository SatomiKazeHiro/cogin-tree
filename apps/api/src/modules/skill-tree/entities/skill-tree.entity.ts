import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TreeType } from '@skill/shared';
import { TreeNode } from './tree-node.entity';
import { Recommendation } from '../../recommendation/entities/recommendation.entity';

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

  @Column({ name: 'global_config_id', nullable: true })
  globalConfigId?: string;

  @Column({ type: 'enum', enum: ['ACTIVE', 'ARCHIVED'], default: 'ACTIVE' })
  status: 'ACTIVE' | 'ARCHIVED';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => TreeNode, (node) => node.tree)
  nodes: TreeNode[];

  @OneToMany(() => Recommendation, (rec) => rec.skillTree)
  recommendations: Recommendation[];
}
