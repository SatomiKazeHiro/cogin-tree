import { Controller } from '@nestjs/common';
import { GlobalConfigService } from './config.service';

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: GlobalConfigService) {}
}
