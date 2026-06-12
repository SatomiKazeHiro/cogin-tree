import { Controller, Get, Put, Body } from '@nestjs/common';
import { GlobalConfigService } from './config.service';
import { AIConfigDto } from './dto/ai-config.dto';

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: GlobalConfigService) {}

  @Get('ai')
  async getAIConfig() {
    const config = await this.configService.getAIConfig();
    return config ?? {};
  }

  @Put('ai')
  async setAIConfig(@Body() dto: AIConfigDto) {
    await this.configService.setAIConfig((dto as unknown) as Record<string, unknown>);
    return dto;
  }
}
