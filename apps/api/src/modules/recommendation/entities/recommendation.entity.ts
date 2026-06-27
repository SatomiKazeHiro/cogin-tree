import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RecommendationSource } from '@skill/shared';
import { SkillTree } from '../../skill-tree/entities/skill-tree.entity';

@Entity('recommendations')
export class Recommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'skill_tree_id', nullable: true })
  skillTreeId?: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ name: 'match_tags', type: 'text', array: true, default: [] })
  matchTags: string[];

  @Column({ name: 'suggested_mode', nullable: true })
  suggestedMode?: string;

  @Column({ name: 'keywords', type: 'text', array: true, default: [] })
  keywords: string[];

  @Column({ type: 'enum', enum: RecommendationSource, default: RecommendationSource.AI_GENERATED })
  source: RecommendationSource;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'expire_at', nullable: true })
  expireAt?: Date;

  @ManyToOne(() => SkillTree, (tree) => tree.recommendations, { nullable: true })
  @JoinColumn({ name: 'skill_tree_id' })
  skillTree?: SkillTree;
}
