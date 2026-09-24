import { ArtifactKind, GenerationTaskStatus, NodeLearningStatus, TreeType } from '@skill/shared';
import type { NodeArtifactsResponse } from '@skill/shared';
import type { FlowTreeNode, FlowNode, FlowEdge } from './useTreeLayout';

export interface SkillTreeDetail {
  id: string;
  name: string;
  description?: string;
  type?: TreeType;
  nodes: FlowTreeNode[];
}

export function useSkillTreePage(treeId: string) {
  const { api } = useApi();
  const { buildFlowElements } = useTreeLayout();
  const toast = useToast();

  const tree = ref<SkillTreeDetail | null>(null);
  const childrenByL1 = ref<Record<string, FlowTreeNode[]>>({});
  const artifactsByNodeId = ref<Record<string, NodeArtifactsResponse>>({});
  const learningStatusByNodeId = ref<Record<string, NodeLearningStatus>>({});

  const selectedL2Id = ref<string | null>(null);
  const loadingNodeId = ref<string | null>(null);
  const collapsedL1Ids = ref<Set<string>>(new Set());

  const directoryOpen = ref(true);
  const activeDirectoryNodeId = ref<string | null>(null);

  const flowNodes = ref<FlowNode[]>([]);
  const flowEdges = ref<FlowEdge[]>([]);

  const showPanel = computed(() => !!selectedL2Id.value);

  const l1Nodes = computed(() => {
    if (!tree.value) return [];
    return tree.value.nodes
      .filter((n) => n.level === 1)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  });

  const selectedNodeId = computed(() => activeDirectoryNodeId.value ?? selectedL2Id.value);

  // Sync directory highlight when a drawer is opened from the graph.
  watch(selectedL2Id, (id) => {
    if (id) activeDirectoryNodeId.value = id;
  });

  const selectedL2Title = computed(() => {
    if (!selectedL2Id.value || !tree.value) return '';
    const node = tree.value.nodes.find((n) => n.id === selectedL2Id.value);
    return node?.title || '';
  });

  const selectedArtifacts = computed(() => {
    if (!selectedL2Id.value) return null;
    return artifactsByNodeId.value[selectedL2Id.value] ?? null;
  });

  /** 图上「分析 / 详情」按钮的依据：coreText 就绪才算有内容 */
  const contentReadyByNodeId = computed<Record<string, boolean>>(() =>
    Object.fromEntries(
      Object.entries(artifactsByNodeId.value).map(([id, view]) => [
        id,
        view.coreText.status === GenerationTaskStatus.READY && !!view.coreText.text,
      ]),
    ),
  );

  function storeArtifacts(nodeId: string, view: NodeArtifactsResponse) {
    artifactsByNodeId.value = { ...artifactsByNodeId.value, [nodeId]: view };
  }

  async function loadArtifacts(nodeId: string): Promise<NodeArtifactsResponse | null> {
    try {
      const view = await api<NodeArtifactsResponse>(`/nodes/${nodeId}/artifacts`);
      storeArtifacts(nodeId, view);
      return view;
    } catch (err) {
      console.error('[useSkillTreePage] loadArtifacts failed', err);
      return null;
    }
  }

  async function loadTreeData() {
    const data = await api<SkillTreeDetail>(`/skill-trees/${treeId}`);
    tree.value = data;

    const groups: Record<string, FlowTreeNode[]> = {};
    const l2Ids: string[] = [];
    for (const node of data.nodes) {
      if (node.level === 2 && node.parentId) {
        if (!groups[node.parentId]) groups[node.parentId] = [];
        groups[node.parentId].push(node);
        l2Ids.push(node.id);
      }
    }
    childrenByL1.value = groups;

    if (l2Ids.length > 0) {
      // 一次性拉取每个 L2 的产物状态，用于决定节点上显示「分析」还是「详情」
      await Promise.all(l2Ids.map((id) => loadArtifacts(id)));
    }

    await loadLearningProgress();
    rebuildGraph();
  }

  async function loadLearningProgress() {
    try {
      const data = await api<{ statusByNodeId: Record<string, NodeLearningStatus> }>(
        `/skill-trees/${treeId}/progress`,
      );
      learningStatusByNodeId.value = data.statusByNodeId;
    } catch (err) {
      console.error('[useSkillTreePage] loadLearningProgress failed', err);
    }
  }

  function rebuildGraph() {
    if (!tree.value) return;
    const { nodes, edges } = buildFlowElements(
      tree.value,
      tree.value.nodes,
      childrenByL1.value,
      contentReadyByNodeId.value,
      {
        collapsedL1Ids: collapsedL1Ids.value,
        loadingNodeId: loadingNodeId.value,
      },
    );
    for (const node of nodes) {
      node.data.learningStatus = learningStatusByNodeId.value[node.id];
    }
    flowNodes.value = nodes;
    flowEdges.value = edges;
  }

  function setNodeLoading(nodeId: string, loading: boolean) {
    loadingNodeId.value = loading ? nodeId : null;
    rebuildGraph();
  }

  async function onNodeAction(nodeId: string, action: 'expand' | 'generate' | 'open') {
    try {
      if (action === 'expand') {
        await expandL1(nodeId);
      } else if (action === 'generate') {
        // 「分析」：打开抽屉并确保 coreText 就绪
        selectedL2Id.value = nodeId;
        await ensureCoreText(nodeId);
      } else if (action === 'open') {
        selectedL2Id.value = nodeId;
        await ensureCoreText(nodeId);
      }
    } catch (err) {
      console.error('[useSkillTreePage] onNodeAction failed', err);
      toast.error(err instanceof Error ? err.message : '操作失败，请稍后重试');
    }
  }

  function toggleCollapse(l1Id: string) {
    const next = new Set(collapsedL1Ids.value);
    if (next.has(l1Id)) {
      next.delete(l1Id);
    } else {
      next.add(l1Id);
    }
    collapsedL1Ids.value = next;
    rebuildGraph();
  }

  function onSelectL1(l1Id: string, fitView: (nodeId: string) => void) {
    activeDirectoryNodeId.value = l1Id;
    toggleCollapse(l1Id);
    nextTick(() => fitView(l1Id));
  }

  function onSelectL2(l2Id: string, fitView: (nodeId: string) => void) {
    activeDirectoryNodeId.value = l2Id;
    const l2 = tree.value?.nodes.find((n) => n.id === l2Id);
    if (l2?.parentId && collapsedL1Ids.value.has(l2.parentId)) {
      const next = new Set(collapsedL1Ids.value);
      next.delete(l2.parentId);
      collapsedL1Ids.value = next;
      rebuildGraph();
    }
    nextTick(() => fitView(l2Id));
  }

  /**
   * 画布上直接点击节点：与点击左侧目录等价 —— 只更新聚焦态，不移动视口、不打开抽屉。
   * 聚焦态是**唯一**的高亮来源（画布不再使用 Vue Flow 自身的选中态），
   * 因此不会出现「目录点了 A、画布点了 B」导致两个节点同时带虚线描边。
   */
  function onCanvasNodeClick(nodeId: string) {
    activeDirectoryNodeId.value = nodeId;
  }

  /** 点击画布空白：清掉手动聚焦；抽屉仍开着时由 selectedNodeId 回落到抽屉所属节点 */
  function onCanvasPaneClick() {
    activeDirectoryNodeId.value = null;
  }

  async function expandL1(l1Id: string) {
    setNodeLoading(l1Id, true);
    try {
      const children = await api<FlowTreeNode[]>(`/nodes/${l1Id}/expand`, {
        method: 'POST',
      });
      childrenByL1.value = { ...childrenByL1.value, [l1Id]: children };

      if (tree.value) {
        const existingIds = new Set(tree.value.nodes.map((n) => n.id));
        for (const child of children) {
          if (!existingIds.has(child.id)) {
            tree.value.nodes.push(child);
          }
        }
      }

      toast.success(`初始化完成，已生成 ${children.length} 个 L2 知识点`);
      rebuildGraph();
    } finally {
      setNodeLoading(l1Id, false);
    }
  }

  /**
   * coreText 正由**他人**生成时的轮询等待（两个标签页同开、或刷新时上一次请求仍在飞行）。
   * 不等待的话抽屉会永远停在「正在生成核心内容…」，只能靠用户自己刷新。
   * 只读状态，不发新请求、不消耗 token。
   */
  const CORE_TEXT_POLL_INTERVAL_MS = 2_500;
  const CORE_TEXT_POLL_MAX = 24; // ≈60s，与后端 ensureCoreText 的等待预算对齐

  async function waitForCoreText(nodeId: string) {
    for (let i = 0; i < CORE_TEXT_POLL_MAX; i++) {
      await new Promise((resolve) => setTimeout(resolve, CORE_TEXT_POLL_INTERVAL_MS));
      const view = await loadArtifacts(nodeId);
      if (!view) return;
      if (view.coreText.status === GenerationTaskStatus.FAILED) {
        return; // 交给 UI 显示「失败 + 重试」
      }
      if (view.coreText.status === GenerationTaskStatus.READY && view.coreText.text) {
        rebuildGraph();
        prefetchCodeExamples(nodeId);
        return;
      }
    }
    // 轮询用尽（对方可能已僵死，服务端 120s 后才会回收陈旧认领）——明确告诉用户怎么办
    toast.error('核心内容生成超时，请刷新页面或稍后重试');
  }

  /**
   * 打开 L2 抽屉：拉状态 → 未就绪则生成 coreText（阻塞）→ ready 后后台预取代码示例。
   * 练习题不预取，等用户切到该 tab 时再按需生成（见 generateExercises）。
   */
  async function ensureCoreText(nodeId: string) {
    const view = await loadArtifacts(nodeId);
    if (!view) return;

    if (
      view.coreText.status === GenerationTaskStatus.READY &&
      !!view.coreText.text
    ) {
      prefetchCodeExamples(nodeId);
      return;
    }

    // 已有请求在生成（本次认领必定失败）→ 等它落库即可，不必再发一次
    if (view.coreText.status === GenerationTaskStatus.GENERATING) {
      await waitForCoreText(nodeId);
      return;
    }

    setNodeLoading(nodeId, true);
    try {
      const next = await api<NodeArtifactsResponse>(
        `/nodes/${nodeId}/artifacts/${ArtifactKind.L3_CORE_TEXT}/generate`,
        { method: 'POST' },
      );
      storeArtifacts(nodeId, next);
      rebuildGraph();

      if (next.coreText.status === GenerationTaskStatus.READY && next.coreText.text) {
        toast.success('学习内容已生成');
        prefetchCodeExamples(nodeId);
      } else {
        // 认领失败（他人抢先）→ 等对方落库，而不是假装成功
        await waitForCoreText(nodeId);
      }
    } catch (err) {
      console.error('[useSkillTreePage] ensureCoreText failed', err);
      toast.error(err instanceof Error ? err.message : '核心内容生成失败');
    } finally {
      setNodeLoading(nodeId, false);
    }
  }

  /** 后台预取代码示例：不阻塞、失败静默（用户切到该 tab 时还能手动重试） */
  function prefetchCodeExamples(nodeId: string) {
    const current = artifactsByNodeId.value[nodeId];
    if (current && current.codeExamples.status !== GenerationTaskStatus.PENDING) {
      // 已就绪 / 生成中 / 失败待重试：不重复触发
      return;
    }
    void api<NodeArtifactsResponse>(
      `/nodes/${nodeId}/artifacts/${ArtifactKind.L3_CODE_EXAMPLES}/generate`,
      { method: 'POST' },
    )
      .then((next) => {
        storeArtifacts(nodeId, next);
        rebuildGraph();
      })
      .catch(() => undefined);
  }

  /** 练习题按需生成（用户切到「练习题」tab 时触发） */
  async function generateExercises(nodeId: string) {
    try {
      const next = await api<NodeArtifactsResponse>(
        `/nodes/${nodeId}/artifacts/${ArtifactKind.L3_EXERCISES}/generate`,
        { method: 'POST' },
      );
      storeArtifacts(nodeId, next);
    } catch (err) {
      console.error('[useSkillTreePage] generateExercises failed', err);
      toast.error(err instanceof Error ? err.message : '练习题生成失败');
    }
  }

  /** 失败后重试某一类产物 */
  async function retryArtifact(nodeId: string, kind: ArtifactKind) {
    try {
      const next = await api<NodeArtifactsResponse>(
        `/nodes/${nodeId}/artifacts/${kind}/generate`,
        { method: 'POST' },
      );
      storeArtifacts(nodeId, next);
      toast.success('已重新生成');
    } catch (err) {
      console.error('[useSkillTreePage] retryArtifact failed', err);
      toast.error(err instanceof Error ? err.message : '生成失败');
    }
  }

  async function handleStatusChange(nodeId: string, status: NodeLearningStatus) {
    try {
      await api(`/skill-trees/${treeId}/nodes/${nodeId}/learning-status`, {
        method: 'POST',
        body: { status },
      });
      learningStatusByNodeId.value = { ...learningStatusByNodeId.value, [nodeId]: status };
      const node = flowNodes.value.find((n) => n.id === nodeId);
      if (node) {
        node.data.learningStatus = status;
      }
      toast.success('学习状态已更新');
    } catch (err) {
      console.error('[useSkillTreePage] handleStatusChange failed', err);
      toast.error(err instanceof Error ? err.message : '状态更新失败');
    }
  }

  return {
    tree,
    flowNodes,
    flowEdges,
    directoryOpen,
    activeDirectoryNodeId,
    selectedL2Id,
    loadingNodeId,
    showPanel,
    l1Nodes,
    childrenByL1,
    learningStatusByNodeId,
    selectedNodeId,
    selectedL2Title,
    selectedArtifacts,
    artifactsByNodeId,
    loadTreeData,
    onNodeAction,
    toggleCollapse,
    onSelectL1,
    onSelectL2,
    onCanvasNodeClick,
    onCanvasPaneClick,
    handleStatusChange,
    ensureCoreText,
    generateExercises,
    retryArtifact,
  };
}
