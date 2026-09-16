import { existsSync, readFileSync } from 'node:fs';

/**
 * 极简 .env 加载器。
 *
 * 为什么不直接用 dotenv：pnpm 严格隔离下 `dotenv` 只是 `@nestjs/config` 的传递依赖，
 * `apps/api` 无法解析它（不是直接依赖）。为一个 10 行的功能引入新依赖不划算。
 *
 * 语义与 dotenv 一致：已存在的 process.env 优先，不被文件覆盖。
 */
export function loadEnvFile(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }

  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const idx = trimmed.indexOf('=');
    if (idx === -1) {
      continue;
    }
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
  return true;
}

/** 按顺序尝试多个候选路径，返回第一个存在的（供脚本/CLI 复用） */
export function loadFirstExistingEnvFile(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (loadEnvFile(candidate)) {
      return candidate;
    }
  }
  return null;
}
