/**
 * 语法高亮（highlight.js）。
 *
 * 为什么不用 `import hljs from 'highlight.js'`（全量构建）：
 * 它会把 384 个语法模块（约 1.5MB 源码）全部打进前端产物，而这里实际用到的只有少数几种。
 * 改为 `lib/core` + 显式注册，未注册的语言会**优雅降级为纯文本**（不会报错、不会白屏）。
 *
 * 为什么需要别名表：
 * AI 返回的 `language` 是自由文本（提示词只举例 `javascript/typescript/python/go`），
 * 实测真实模型返回过 `vue` —— 而 highlight.js **没有 Vue 语法**，
 * 于是那些代码块会被静默降级成纯文本（用户看到的就是「没有高亮」）。
 * 这里把常见写法/框架名归一，`vue` 按 `xml`（SFC 本质是 HTML 模板）高亮。
 */
import hljs from 'highlight.js/lib/core';

import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import dart from 'highlight.js/lib/languages/dart';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import graphql from 'highlight.js/lib/languages/graphql';
import http from 'highlight.js/lib/languages/http';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import less from 'highlight.js/lib/languages/less';
import lua from 'highlight.js/lib/languages/lua';
import makefile from 'highlight.js/lib/languages/makefile';
import markdown from 'highlight.js/lib/languages/markdown';
import nginx from 'highlight.js/lib/languages/nginx';
import perl from 'highlight.js/lib/languages/perl';
import php from 'highlight.js/lib/languages/php';
import plaintext from 'highlight.js/lib/languages/plaintext';
import powershell from 'highlight.js/lib/languages/powershell';
import protobuf from 'highlight.js/lib/languages/protobuf';
import python from 'highlight.js/lib/languages/python';
import r from 'highlight.js/lib/languages/r';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scala from 'highlight.js/lib/languages/scala';
import scss from 'highlight.js/lib/languages/scss';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

/** 注册名 → 模块（名字即 hljs 的正式名，别名由语言自身提供：ts/js/py/sh/yml…） */
const LANGUAGES: Record<string, Parameters<typeof hljs.registerLanguage>[1]> = {
  bash,
  c,
  cpp,
  csharp,
  css,
  dart,
  diff,
  dockerfile,
  go,
  graphql,
  http,
  ini,
  java,
  javascript,
  json,
  kotlin,
  less,
  lua,
  makefile,
  markdown,
  nginx,
  perl,
  php,
  plaintext,
  powershell,
  protobuf,
  python,
  r,
  ruby,
  rust,
  scala,
  scss,
  sql,
  swift,
  typescript,
  xml,
  yaml,
};

for (const [name, language] of Object.entries(LANGUAGES)) {
  hljs.registerLanguage(name, language);
}

/**
 * Vue 单文件组件。
 *
 * 为什么自己写、而不用 npm 上的 `highlightjs-vue`：
 * - 那个包只有 2019-11 发布的 1.0.0，`devDependencies` 是 **highlight.js ^9**（v11 API 已变）；
 * - 它的 ESM 产物只有 `module.exports = ...`、**没有 export 语句** → Vite 下 `import` 可能拿到空对象；
 * - 它的正则只认「裸 `<script>`」与「`<script lang="ts">`」，**不认 `<script setup>` / `<script setup lang="ts">`**
 *   —— 而后者恰恰是现在最普遍的写法（本次就是被它漏掉的那个场景）。
 *
 * 下面这版同样很小，但认任意属性顺序，并把三块内容交给对应子语言：
 * 整体先按 `xml`（标签/属性/注释），仅 script / style 的内容替换为 JS/TS/CSS/SCSS。
 */
const vueLanguage: Parameters<typeof hljs.registerLanguage>[1] = (h) => ({
  name: 'Vue',
  aliases: ['vue'],
  subLanguage: 'xml',
  contains: [
    {
      begin: /<script(?=[^>]*lang=["']ts["'])[^>]*>/,
      end: /<\/script>/,
      subLanguage: 'typescript',
      excludeBegin: true,
      excludeEnd: true,
    },
    {
      begin: /<script[^>]*>/,
      end: /<\/script>/,
      subLanguage: 'javascript',
      excludeBegin: true,
      excludeEnd: true,
    },
    {
      begin: /<style(?=[^>]*lang=["'](scss|sass)["'])[^>]*>/,
      end: /<\/style>/,
      subLanguage: 'scss',
      excludeBegin: true,
      excludeEnd: true,
    },
    {
      begin: /<style[^>]*>/,
      end: /<\/style>/,
      subLanguage: 'css',
      excludeBegin: true,
      excludeEnd: true,
    },
  ],
});

hljs.registerLanguage('vue', vueLanguage);

/**
 * 归一 AI 返回的语言标识。
 * `null` 表示无法识别 → 调用方降级为纯文本（不报错）。
 */
const LANGUAGE_ALIASES: Record<string, string> = {
  // 框架 / 运行时 → 最接近的已注册语法
  svelte: 'xml', // Svelte 也是 HTML + script/style，交给 xml（其自带嵌入 JS/CSS）
  react: 'typescript',
  jsx: 'javascript',
  node: 'javascript',
  nodejs: 'javascript',
  deno: 'typescript',
  bun: 'typescript',
  // 常见简写
  ts: 'typescript',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  kt: 'kotlin',
  yml: 'yaml',
  md: 'markdown',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  terminal: 'bash',
  ps1: 'powershell',
  docker: 'dockerfile',
  'docker-compose': 'yaml',
  html: 'xml',
  htm: 'xml',
  svg: 'xml',
  toml: 'ini',
  cfg: 'ini',
  conf: 'ini',
  env: 'ini',
  text: 'plaintext',
  txt: 'plaintext',
  '': 'plaintext',
};

/** 把 AI 给的语言名解析成 hljs 能用的名字；识别不了返回 null */
export function resolveLanguage(language?: string | null): string | null {
  if (!language) return null;
  const raw = String(language).trim().toLowerCase();
  if (!raw) return null;

  const aliased = LANGUAGE_ALIASES[raw] ?? raw;
  return aliased === 'plaintext' || hljs.getLanguage(aliased) ? aliased : null;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 高亮一段代码。识别不了的语言（或高亮过程报错）→ 返回转义后的纯文本，
 * 保证「代码永远能看」，只是没有配色。
 */
export function highlightCode(code: string, language?: string | null): string {
  const resolved = resolveLanguage(language);
  if (!resolved) return escapeHtml(code);

  try {
    return hljs.highlight(code, { language: resolved, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(code);
  }
}
