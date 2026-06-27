import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GlobalConfig } from './entities/global-config.entity';

@Injectable()
export class GlobalConfigService {
  constructor(
    @InjectRepository(GlobalConfig)
    private configRepo: Repository<GlobalConfig>,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const config = await this.configRepo.findOne({ where: { key } });
    return config ? (config.value as T) : null;
  }

  async set<T>(key: string, value: T, description?: string): Promise<void> {
    const existing = await this.configRepo.findOne({ where: { key } });
    if (existing) {
      existing.value = value;
      await this.configRepo.save(existing);
    } else {
      await this.configRepo.save({
        key,
        value,
        description,
      });
    }
  }
}
