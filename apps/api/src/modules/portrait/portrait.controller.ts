import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PortraitQuestionService } from './portrait-question.service';
import { PortraitAIService } from './portrait-ai.service';
import { SubmitPortraitDto } from './dto/submit-portrait.dto';

@Controller('portrait')
export class PortraitController {
  constructor(
    private questionService: PortraitQuestionService,
    private portraitAIService: PortraitAIService,
  ) {}

  @Get('questions')
  async getQuestions() {
    return this.questionService.findActiveGrouped();
  }

  @UseGuards(JwtAuthGuard)
  @Post('submit')
  async submit(
    @Request() req: { user: { userId: string } },
    @Body() dto: SubmitPortraitDto,
  ) {
    const portrait = await this.portraitAIService.generatePortrait(
      req.user.userId,
      dto.answers,
    );
    return portrait;
  }
}
