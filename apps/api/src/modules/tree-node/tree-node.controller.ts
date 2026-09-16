import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TreeNodeService } from './tree-node.service';
import { UpdateNodeDto } from './dto/update-node.dto';

@Controller('nodes')
export class TreeNodeController {
  constructor(private readonly treeNodeService: TreeNodeService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':id/children')
  async getChildren(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.treeNodeService.findChildren(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/expand')
  async expand(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.treeNodeService.expand(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.treeNodeService.findById(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateNodeDto,
  ) {
    return this.treeNodeService.update(id, dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    await this.treeNodeService.remove(id, req.user.userId);
    return { id };
  }
}
