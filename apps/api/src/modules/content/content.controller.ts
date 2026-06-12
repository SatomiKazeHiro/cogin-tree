import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContentService } from './content.service';

@Controller('nodes/:id/content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async generate(@Param('id') nodeId: string) {
    const content = await this.contentService.generateContent(nodeId);
    return {
      id: content.id,
      nodeId: content.nodeId,
      coreText: content.coreText,
      codeExamples: content.codeExamples || [],
      exercises: content.exercises || [],
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async get(@Param('id') nodeId: string) {
    const content = await this.contentService.getContentByNodeId(nodeId);
    if (!content) {
      return null;
    }
    return {
      id: content.id,
      nodeId: content.nodeId,
      coreText: content.coreText,
      codeExamples: content.codeExamples || [],
      exercises: content.exercises || [],
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch()
  async update(@Param('id') nodeId: string, @Body() dto: { coreText?: string }) {
    const content = await this.contentService.updateContent(nodeId, dto);
    return {
      id: content.id,
      nodeId: content.nodeId,
      coreText: content.coreText,
      codeExamples: content.codeExamples || [],
      exercises: content.exercises || [],
    };
  }
}
