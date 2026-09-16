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
import { NodeContent } from './entities/node-content.entity';

@Controller('nodes/:id/content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  /**
   * 统一响应映射：只暴露前端消费的字段。
   * code_examples / exercises 是归一化后的子表，实体上的 id/nodeContentId/sortOrder
   * 属内部列，不应泄漏到 API 响应里。
   */
  private toResponse(content: NodeContent) {
    return {
      id: content.id,
      nodeId: content.nodeId,
      coreText: content.coreText,
      codeExamples: (content.codeExamples || []).map((item) => ({
        title: item.title,
        language: item.language,
        code: item.code,
      })),
      exercises: (content.exercises || []).map((item) => ({
        question: item.question,
        options: item.options,
        correctIndex: item.correctIndex,
        explanation: item.explanation,
      })),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async generate(@Param('id') nodeId: string) {
    return this.toResponse(await this.contentService.generateContent(nodeId));
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async get(@Param('id') nodeId: string) {
    const content = await this.contentService.getContentByNodeId(nodeId);
    if (!content) {
      return null;
    }
    return this.toResponse(content);
  }

  @UseGuards(JwtAuthGuard)
  @Patch()
  async update(@Param('id') nodeId: string, @Body() dto: { coreText?: string }) {
    return this.toResponse(await this.contentService.updateContent(nodeId, dto));
  }
}
