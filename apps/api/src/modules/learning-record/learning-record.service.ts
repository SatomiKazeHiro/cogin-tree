import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningStatus } from '@skill/shared';
import { LearningRecord } from './entities/learning-record.entity';
import { TreeAccessService } from '../tree-access/tree-access.service';

@Injectable()
export class LearningRecordService {
  constructor(
    @InjectRepository(LearningRecord)
    private recordRepo: Repository<LearningRecord>,
    private treeAccess: TreeAccessService,
  ) {}

  async findByUser(userId: string): Promise<LearningRecord[]> {
    return this.recordRepo.find({
      where: { userId },
      order: { startedAt: 'DESC' },
    });
  }

  async create(userId: string, skillTreeId: string): Promise<LearningRecord> {
    // 私有技能树：不允许给别人的树挂学习记录
    await this.treeAccess.assertTreeOwner(skillTreeId, userId);

    const existing = await this.recordRepo.findOne({
      where: { userId, skillTreeId },
    });
    if (existing) {
      return existing;
    }

    const record = this.recordRepo.create({
      userId,
      skillTreeId,
      status: LearningStatus.IN_PROGRESS,
    });
    return this.recordRepo.save(record);
  }

  async update(
    userId: string,
    id: string,
    data: Partial<LearningRecord>,
  ): Promise<LearningRecord> {
    const record = await this.recordRepo.findOne({
      where: { id, userId },
    });
    if (!record) {
      throw new Error('Learning record not found');
    }

    if (data.status === LearningStatus.COMPLETED) {
      data.completedAt = new Date();
    }

    Object.assign(record, data);
    return this.recordRepo.save(record);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.recordRepo.delete({ id, userId });
  }
}
