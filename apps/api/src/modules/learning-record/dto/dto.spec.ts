import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NodeLearningStatus, TreeType } from '@skill/shared';
import { CreateLearningRecordDto } from './create-learning-record.dto';
import { UpdateNodeLearningStatusDto } from './update-node-learning-status.dto';
import { FromRecommendationDto } from '../../recommendation/dto/from-recommendation.dto';

async function validateWhitelisted<T extends object>(cls: new () => T, payload: object) {
  const instance = plainToInstance(cls, payload);
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: false });
  return { instance, errors };
}

describe('裸类型 body 收口为 DTO', () => {
  it('CreateLearningRecordDto 剥离未知字段（mass assignment 防护）', async () => {
    const { instance, errors } = await validateWhitelisted(CreateLearningRecordDto, {
      skillTreeId: '3f1a5b2c-0000-4000-8000-000000000001',
      userId: 'attacker',
    });

    expect(errors).toHaveLength(0);
    expect(instance).toEqual({ skillTreeId: '3f1a5b2c-0000-4000-8000-000000000001' });
  });

  it('CreateLearningRecordDto 缺 skillTreeId 时报错', async () => {
    const { errors } = await validateWhitelisted(CreateLearningRecordDto, {});
    expect(errors.length).toBeGreaterThan(0);
  });

  it('UpdateNodeLearningStatusDto 校验枚举', async () => {
    const ok = await validateWhitelisted(UpdateNodeLearningStatusDto, {
      status: NodeLearningStatus.COMPLETED,
    });
    expect(ok.errors).toHaveLength(0);

    const bad = await validateWhitelisted(UpdateNodeLearningStatusDto, { status: 'NOPE' });
    expect(bad.errors.length).toBeGreaterThan(0);
  });

  it('FromRecommendationDto 校验 recommendationId 必填与 type 枚举', async () => {
    const ok = await validateWhitelisted(FromRecommendationDto, {
      recommendationId: '3f1a5b2c-0000-4000-8000-000000000002',
      type: TreeType.ENTRY,
      selectedPoints: ['a'],
    });
    expect(ok.errors).toHaveLength(0);

    const bad = await validateWhitelisted(FromRecommendationDto, {
      recommendationId: '3f1a5b2c-0000-4000-8000-000000000002',
      type: 'X',
    });
    expect(bad.errors.length).toBeGreaterThan(0);
  });
});
