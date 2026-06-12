import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalConfig } from './entities/global-config.entity';
import { GlobalConfigService } from './config.service';
import { ConfigController } from './config.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GlobalConfig])],
  providers: [GlobalConfigService],
  controllers: [ConfigController],
  exports: [GlobalConfigService],
})
export class ConfigModule {}
