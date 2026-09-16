import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecommendationService } from './recommendation.service';
import { FromRecommendationDto } from './dto/from-recommendation.dto';

@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Request() req: { user: { userId: string } }) {
    return this.recommendationService.findForUser(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  async refresh(@Request() req: { user: { userId: string } }) {
    return this.recommendationService.refreshForUser(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('from-recommendation')
  async createFromRecommendation(
    @Request() req: { user: { userId: string } },
    @Body() dto: FromRecommendationDto,
  ) {
    return this.recommendationService.createSkillTreeFromRecommendation(
      req.user.userId,
      dto.recommendationId,
      dto.type,
      dto.selectedPoints,
    );
  }
}
