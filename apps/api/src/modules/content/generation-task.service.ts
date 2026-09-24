import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ArtifactKind, GenerationTaskStatus } from '@skill/shared';
import { GenerationTask } from './entities/generation-task.entity';

/** GENERATING 超过该时长即视为僵死，可被重新认领 */
export const STALE_GENERATING_MS = 120_000;

/**
 * 产物生成状态机。
 *
 * 认领是**数据库级**的原子操作（UNIQUE(node_id, artifact_kind) + 条件 UPDATE），
 * 因此跨进程/跨实例安全 —— 这是它取代内存 Map 的原因。
 */
@Injectable()
export class GenerationTaskService {
  private readonly logger = new Logger(GenerationTaskService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(GenerationTask)
    private readonly taskRepo: Repository<GenerationTask>,
  ) {}

  /**
   * 尝试认领 (nodeId, kind) 的生成权。
   *
   * - `force=false`（默认）：已 READY 直接返回 false（幂等，绝不重复调 AI）
   * - `force=true`：允许从 READY 重新认领（「重新生成」的地基）
   *
   * 两种情况都**不允许抢占新鲜的 GENERATING** —— 否则并发重新生成会变成多写者。
   */
  async claim(nodeId: string, kind: ArtifactKind, force = false): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      `insert into generation_tasks (node_id, artifact_kind, status, attempts, started_at)
       values ($1, $2, 'GENERATING', 1, now())
       on conflict (node_id, artifact_kind) do update
         set status = 'GENERATING',
             attempts = generation_tasks.attempts + 1,
             started_at = now(),
             updated_at = now()
         where generation_tasks.status in ('PENDING', 'FAILED')
            or (generation_tasks.status = 'GENERATING'
                and generation_tasks.started_at < now() - ($3::int * interval '1 millisecond'))
            or ($4::boolean and generation_tasks.status = 'READY')
       returning id`,
      [nodeId, kind, STALE_GENERATING_MS, force],
    );
    return rows.length > 0;
  }

  async markReady(
    nodeId: string,
    kind: ArtifactKind,
    meta: { promptVersion: string; model?: string },
  ): Promise<void> {
    await this.taskRepo.update(
      { nodeId, artifactKind: kind },
      {
        status: GenerationTaskStatus.READY,
        promptVersion: meta.promptVersion,
        model: meta.model ?? null,
        lastError: null,
        finishedAt: new Date(),
      },
    );
  }

  async markFailed(nodeId: string, kind: ArtifactKind, error: string): Promise<void> {
    this.logger.warn(`产物生成失败 node=${nodeId} kind=${kind}: ${error.slice(0, 200)}`);
    await this.taskRepo.update(
      { nodeId, artifactKind: kind },
      {
        status: GenerationTaskStatus.FAILED,
        lastError: error.slice(0, 1000),
        finishedAt: new Date(),
      },
    );
  }

  async findForNode(nodeId: string): Promise<GenerationTask[]> {
    return this.taskRepo.find({ where: { nodeId } });
  }
}
