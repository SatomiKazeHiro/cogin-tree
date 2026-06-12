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
import { UserService } from '../user/user.service';

@Controller('portrait')
export class PortraitController {
  constructor(
    private questionService: PortraitQuestionService,
    private portraitAIService: PortraitAIService,
    private userService: UserService,
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

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: { user: { userId: string } }) {
    const profile = await this.userService.getProfile(req.user.userId);
    return profile?.computedPortrait ?? null;
  }
}
