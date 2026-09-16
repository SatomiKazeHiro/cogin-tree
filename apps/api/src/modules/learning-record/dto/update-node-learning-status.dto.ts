import { IsEnum } from 'class-validator';
import { NodeLearningStatus } from '@skill/shared';

/** POST /skill-trees/:treeId/nodes/:nodeId/learning-status 的白名单入参 */
export class UpdateNodeLearningStatusDto {
  @IsEnum(NodeLearningStatus)
  status: NodeLearningStatus;
}
