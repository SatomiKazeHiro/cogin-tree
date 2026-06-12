import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LearningRecordService } from './learning-record.service';
import { UpdateLearningRecordDto } from './dto/update-learning-record.dto';

@Controller('learning-records')
export class LearningRecordController {
  constructor(private readonly learningRecordService: LearningRecordService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Request() req: { user: { userId: string } }) {
    return this.learningRecordService.findByUser(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Request() req: { user: { userId: string } },
    @Body() dto: { skillTreeId: string },
  ) {
    return this.learningRecordService.create(req.user.userId, dto.skillTreeId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateLearningRecordDto,
  ) {
    return this.learningRecordService.update(req.user.userId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    await this.learningRecordService.remove(id, req.user.userId);
    return { id };
  }
}
