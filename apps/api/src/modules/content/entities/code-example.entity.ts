import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { NodeContent } from './node-content.entity';

/** L3 代码示例：与 exercises 对称归一化，取代原 node_contents.code_examples json 列 */
@Entity('code_examples')
export class CodeExample {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'node_content_id' })
  nodeContentId: string;

  @Column()
  title: string;

  @Column()
  language: string;

  @Column({ type: 'text' })
  code: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => NodeContent, (content) => content.codeExamples, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'node_content_id' })
  content: NodeContent;
}
