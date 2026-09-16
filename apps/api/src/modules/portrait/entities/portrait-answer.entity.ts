import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { UserProfile } from '../../user/entities/user-profile.entity';
import { PortraitQuestion } from './portrait-question.entity';

@Entity('portrait_answers')
export class PortraitAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'profile_id' })
  profileId: string;

  @Column({ name: 'question_id' })
  questionId: string;

  @Column({ name: 'selected_options', type: 'text', array: true })
  selectedOptions: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => UserProfile, (profile) => profile.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile: UserProfile;

  @ManyToOne(() => PortraitQuestion, (question) => question.answers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'question_id' })
  question: PortraitQuestion;
}
