import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SkillTreeService } from './skill-tree.service';
import { CreateSkillTreeDto } from './dto/create-skill-tree.dto';
import { GenerateKnowledgePointsDto } from './dto/generate-knowledge-points.dto';

@Controller('skill-trees')
export class SkillTreeController {
  constructor(private readonly skillTreeService: SkillTreeService) {}

  @UseGuards(JwtAuthGuard)
  @Post('knowledge-points')
  async generateKnowledgePoints(
    @Body() dto: GenerateKnowledgePointsDto,
  ) {
    return this.skillTreeService.generateKnowledgePoints(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreateSkillTreeDto,
  ) {
    const tree = await this.skillTreeService.create(dto, req.user.userId);
    return tree;
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.skillTreeService.findById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateSkillTreeDto>) {
    return this.skillTreeService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.skillTreeService.remove(id);
    return { id };
  }
}
