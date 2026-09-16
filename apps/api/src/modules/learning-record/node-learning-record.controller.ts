import { Controller, Get, Post, Param, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NodeLearningRecordService } from './node-learning-record.service';
import { UpdateNodeLearningStatusDto } from './dto/update-node-learning-status.dto';

@Controller('skill-trees/:treeId')
export class NodeLearningRecordController {
  constructor(private readonly nodeLearningRecordService: NodeLearningRecordService) {}

  @UseGuards(JwtAuthGuard)
  @Get('progress')
  async getProgress(
    @Request() req: { user: { userId: string } },
    @Param('treeId') treeId: string,
  ) {
    const records = await this.nodeLearningRecordService.findBySkillTree(req.user.userId, treeId);
    const statusByNodeId = Object.fromEntries(records.map((r) => [r.nodeId, r.status]));
    return { statusByNodeId };
  }

  @UseGuards(JwtAuthGuard)
  @Post('nodes/:nodeId/learning-status')
  async updateStatus(
    @Request() req: { user: { userId: string } },
    @Param('treeId') treeId: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: UpdateNodeLearningStatusDto,
  ) {
    return this.nodeLearningRecordService.updateStatus(
      req.user.userId,
      treeId,
      nodeId,
      dto.status,
    );
  }
}
