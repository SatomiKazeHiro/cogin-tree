import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AI_CONFIG_KEY } from '@skill/shared';
import { GlobalConfig } from './entities/global-config.entity';

@Injectable()
export class GlobalConfigService {
  constructor(
    @InjectRepository(GlobalConfig)
    private configRepo: Repository<GlobalConfig>,
    private readonly env: ConfigService,
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

  async getAIConfig(): Promise<Record<string, unknown> | null> {
    const dbConfig = await this.get<Record<string, unknown>>(AI_CONFIG_KEY);
    const envConfig = {
      provider: this.env.get('AI_PROVIDER'),
      apiKey: this.env.get('AI_API_KEY'),
      model: this.env.get('AI_MODEL'),
      baseUrl: this.env.get('AI_BASE_URL'),
    };

    const hasEnvValue = Object.values(envConfig).some((v) => v !== undefined && v !== '');
    if (!dbConfig && !hasEnvValue) {
      return null;
    }

    return {
      ...envConfig,
      ...dbConfig,
    };
  }

  async setAIConfig(value: Record<string, unknown>): Promise<void> {
    return this.set(AI_CONFIG_KEY, value, 'AI provider global configuration');
  }
}
