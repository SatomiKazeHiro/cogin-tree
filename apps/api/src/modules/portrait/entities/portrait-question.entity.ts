import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { PortraitQuestionCategory } from '@skill/shared';
import { PortraitAnswer } from './portrait-answer.entity';

@Entity('portrait_questions')
export class PortraitQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: PortraitQuestionCategory,
  })
  category: PortraitQuestionCategory;

  @Column()
  question: string;

  @Column({ type: 'text', array: true })
  options: string[];

  @Column({ name: 'allow_multiple', default: true })
  allowMultiple: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => PortraitAnswer, (answer) => answer.question)
  answers: PortraitAnswer[];
}
