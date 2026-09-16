import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContentService } from './content.service';
import { UpdateNodeContentDto } from './dto/update-node-content.dto';
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
  async generate(
    @Request() req: { user: { userId: string } },
    @Param('id') nodeId: string,
  ) {
    return this.toResponse(
      await this.contentService.generateContent(nodeId, req.user.userId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async get(
    @Request() req: { user: { userId: string } },
    @Param('id') nodeId: string,
  ) {
    const content = await this.contentService.getContentByNodeId(
      nodeId,
      req.user.userId,
    );
    if (!content) {
      return null;
    }
    return this.toResponse(content);
  }

  @UseGuards(JwtAuthGuard)
  @Patch()
  async update(
    @Request() req: { user: { userId: string } },
    @Param('id') nodeId: string,
    @Body() dto: UpdateNodeContentDto,
  ) {
    return this.toResponse(
      await this.contentService.updateContent(nodeId, dto, req.user.userId),
    );
  }
}
