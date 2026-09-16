import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { NodeContent } from './node-content.entity';

@Entity('exercises')
export class Exercise {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'node_content_id' })
  nodeContentId: string;

  @Column()
  question: string;

  @Column({ type: 'text', array: true })
  options: string[];

  @Column({ name: 'correct_index' })
  correctIndex: number;

  @Column({ type: 'text' })
  explanation: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @ManyToOne(() => NodeContent, (content) => content.exercises, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'node_content_id' })
  content: NodeContent;
}
