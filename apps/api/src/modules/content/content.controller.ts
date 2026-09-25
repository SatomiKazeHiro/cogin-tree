import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Request,
  UseGuards,
  ParseEnumPipe,
} from '@nestjs/common';
import { ArtifactKind } from '@skill/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContentService } from './content.service';
import { ArtifactService } from './artifact.service';
import { UpdateNodeContentDto } from './dto/update-node-content.dto';
import { NodeContent } from './entities/node-content.entity';

/**
 * 路由前缀为 `nodes/:id`（而非 `nodes/:id/content`），这样产物接口是
 * `/nodes/:id/artifacts`，与设计文档一致；旧的内容接口补上 `content` 段保持原路径。
 */
@Controller('nodes/:id')
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly artifactService: ArtifactService,
  ) {}

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

  // ── 新接口：按产物粒度读写 ────────────────────────────────────────

  /** 三类产物的状态 + 已就绪内容（前端分块渲染依据） */
  @UseGuards(JwtAuthGuard)
  @Get('artifacts')
  async getArtifacts(
    @Request() req: { user: { userId: string } },
    @Param('id') nodeId: string,
  ) {
    return this.artifactService.getArtifacts(nodeId, req.user.userId);
  }

  /** 生成某一类产物（幂等：已就绪或他人生成中会直接返回当前状态） */
  @UseGuards(JwtAuthGuard)
  @Post('artifacts/:kind/generate')
  async generateArtifact(
    @Request() req: { user: { userId: string } },
    @Param('id') nodeId: string,
    @Param('kind', new ParseEnumPipe(ArtifactKind)) kind: ArtifactKind,
  ) {
    return this.artifactService.generateArtifact(nodeId, req.user.userId, kind);
  }

  // ── 重新生成：已就绪的产物也允许换新（过期节点的修复入口） ────────

  /**
   * 节点级「重新生成」：重生成正文并作废下游产物（示例 / 练习题按消费时机重新生成）。
   * 节点状态为 `OUTDATED_I` / `OUTDATED_II` 时，成功后清回 `ACTIVE`。
   */
  @UseGuards(JwtAuthGuard)
  @Post('regenerate')
  async regenerateNode(
    @Request() req: { user: { userId: string } },
    @Param('id') nodeId: string,
  ) {
    return this.artifactService.regenerateNode(nodeId, req.user.userId);
  }

  /** 单产物「重新生成」（只换这一类，不影响其他区块） */
  @UseGuards(JwtAuthGuard)
  @Post('artifacts/:kind/regenerate')
  async regenerateArtifact(
    @Request() req: { user: { userId: string } },
    @Param('id') nodeId: string,
    @Param('kind', new ParseEnumPipe(ArtifactKind)) kind: ArtifactKind,
  ) {
    return this.artifactService.regenerateArtifact(nodeId, req.user.userId, kind);
  }

  // ── legacy 接口：语义收窄为 coreText，路径与响应形状保持向后兼容 ──

  /** 确保 coreText（等同 POST /artifacts/L3_CORE_TEXT/generate，但已有内容时直接返回） */
  @UseGuards(JwtAuthGuard)
  @Post('content')
  async generate(
    @Request() req: { user: { userId: string } },
    @Param('id') nodeId: string,
  ) {
    return this.toResponse(await this.contentService.generateContent(nodeId, req.user.userId));
  }

  /** 纯内容 + 产物状态（新增 artifacts 字段） */
  @UseGuards(JwtAuthGuard)
  @Get('content')
  async get(@Request() req: { user: { userId: string } }, @Param('id') nodeId: string) {
    const content = await this.contentService.getContentByNodeId(nodeId, req.user.userId);
    if (!content) {
      return null;
    }
    const artifacts = await this.artifactService.getArtifacts(nodeId, req.user.userId);
    return { ...this.toResponse(content), artifacts };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('content')
  async update(
    @Request() req: { user: { userId: string } },
    @Param('id') nodeId: string,
    @Body() dto: UpdateNodeContentDto,
  ) {
    return this.toResponse(await this.contentService.updateContent(nodeId, dto, req.user.userId));
  }
}
