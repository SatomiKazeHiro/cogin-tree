import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('global_configs')
export class GlobalConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @Column({ nullable: true })
  description?: string;
}
