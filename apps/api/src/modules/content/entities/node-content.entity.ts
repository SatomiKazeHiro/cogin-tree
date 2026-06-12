import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { CodeExample } from '@skill/shared';
import { TreeNode } from '../../skill-tree/entities/tree-node.entity';
import { Exercise } from './exercise.entity';

@Entity('node_contents')
export class NodeContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'node_id', unique: true })
  nodeId: string;

  @Column({ name: 'core_text', type: 'text' })
  coreText: string;

  @Column({ name: 'code_examples', type: 'json', nullable: true })
  codeExamples?: CodeExample[];

  @Column({ default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => TreeNode, (node) => node.content)
  @JoinColumn({ name: 'node_id' })
  node: TreeNode;

  @OneToMany(() => Exercise, (exercise) => exercise.content)
  exercises: Exercise[];
}
