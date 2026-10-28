import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ArtifactKind, GenerationTaskStatus } from '@skill/shared';
import { GenerationTask } from './entities/generation-task.entity';

/** GENERATING 超过该时长即视为僵死，可被重新认领 */
export const STALE_GENERATING_MS = 120_000;

/**
 * 产物生成状态机。
 *
 * 认领是**数据库级**的原子操作（UNIQUE(node_id, artifact_kind) + 条件 UPDATE），
 * 因此跨进程/跨实例安全 —— 这是它取代内存 Map 的原因。
 *
 * 认领返回 fencing token（本次认领写入的 started_at）：陈旧 GENERATING 被他人回收后，
 * 旧写者仍可能醒来继续执行，token 让它的 markReady/markFailed 与落库事务全部失效
 * （条件 UPDATE 匹配 0 行），避免双写者互相覆盖。
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
   * - `force=false`（默认）：已 READY 直接返回 null（幂等，绝不重复调 AI）
   * - `force=true`：允许从 READY 重新认领（「重新生成」的地基）
   *
   * 两种情况都**不允许抢占新鲜的 GENERATING** —— 否则并发重新生成会变成多写者。
   *
   * 返回 fencing token（本次认领的 started_at，文本形式保证微秒精度无损往返）；
   * 后续 markReady/markFailed 必须带上它。抢不到返回 null。
   */
  async claim(nodeId: string, kind: ArtifactKind, force = false): Promise<string | null> {
    const rows: { claim_token: string }[] = await this.dataSource.query(
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
       returning started_at::text as claim_token`,
      [nodeId, kind, STALE_GENERATING_MS, force],
    );
    return rows.length > 0 ? rows[0].claim_token : null;
  }

  /**
   * 在内容落库的**同一事务**里把任务标记为 READY。
   *
   * token 不匹配（认领已被回收）时更新 0 行并返回 false —— 调用方应抛错回滚整个事务，
   * 让陈旧写者的内容写入一并作废。
   */
  async markReady(
    manager: EntityManager,
    nodeId: string,
    kind: ArtifactKind,
    claimToken: string,
    meta: { promptVersion: string; model?: string },
  ): Promise<boolean> {
    const rows: unknown[] = await manager.query(
      `update generation_tasks
         set status = 'READY',
             prompt_version = $4,
             model = $5,
             last_error = null,
             finished_at = now(),
             updated_at = now()
       where node_id = $1
         and artifact_kind = $2
         and started_at = $3::timestamp
       returning id`,
      [nodeId, kind, claimToken, meta.promptVersion, meta.model ?? null],
    );
    return rows.length > 0;
  }

  /**
   * 标记失败。同样带 fencing token：认领已被回收时静默跳过，
   * 不覆盖新认领方的 GENERATING 状态。
   */
  async markFailed(
    nodeId: string,
    kind: ArtifactKind,
    claimToken: string,
    error: string,
  ): Promise<void> {
    this.logger.warn(`产物生成失败 node=${nodeId} kind=${kind}: ${error.slice(0, 200)}`);
    await this.dataSource.query(
      `update generation_tasks
         set status = 'FAILED',
             last_error = $4,
             finished_at = now(),
             updated_at = now()
       where node_id = $1
         and artifact_kind = $2
         and started_at = $3::timestamp`,
      [nodeId, kind, claimToken, error.slice(0, 1000)],
    );
  }

  async findForNode(nodeId: string): Promise<GenerationTask[]> {
    return this.taskRepo.find({ where: { nodeId } });
  }
}
