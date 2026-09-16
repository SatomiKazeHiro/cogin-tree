import { Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalysisService } from './analysis.service';

@Controller()
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  /** 对整棵树执行 AI 分析（新增发现 + 过期检查），返回本次产生的建议 */
  @UseGuards(JwtAuthGuard)
  @Post('skill-trees/:id/analysis')
  async analyze(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.analysisService.analyze(id, req.user.userId);
  }

  /** 某棵树的待处理建议列表 */
  @UseGuards(JwtAuthGuard)
  @Get('skill-trees/:id/analysis/suggestions')
  async getPendingSuggestions(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.analysisService.findPendingSuggestions(id, req.user.userId);
  }

  /** 采纳建议 */
  @UseGuards(JwtAuthGuard)
  @Post('analysis/suggestions/:sid/apply')
  async applySuggestion(
    @Request() req: { user: { userId: string } },
    @Param('sid') sid: string,
  ) {
    return this.analysisService.applySuggestion(sid, req.user.userId);
  }

  /** 忽略建议 */
  @UseGuards(JwtAuthGuard)
  @Post('analysis/suggestions/:sid/ignore')
  async ignoreSuggestion(
    @Request() req: { user: { userId: string } },
    @Param('sid') sid: string,
  ) {
    return this.analysisService.ignoreSuggestion(sid, req.user.userId);
  }
}
