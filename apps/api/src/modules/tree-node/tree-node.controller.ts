import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TreeNodeService } from './tree-node.service';

@Controller('nodes')
export class TreeNodeController {
  constructor(private readonly treeNodeService: TreeNodeService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':id/children')
  async getChildren(@Param('id') id: string) {
    return this.treeNodeService.findChildren(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/expand')
  async expand(@Param('id') id: string) {
    return this.treeNodeService.expand(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.treeNodeService.findById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<{ title: string; description: string }>) {
    return this.treeNodeService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.treeNodeService.remove(id);
    return { id };
  }
}
