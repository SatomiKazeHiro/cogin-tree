import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InterviewService } from './interview.service';

@Controller('skill-trees')
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':id/interview')
  async getInterviewQA(@Param('id') id: string) {
    return this.interviewService.findForTree(id);
  }
}
