import { NodeLearningStatus } from '@skill/shared';
import type { FlowTreeNode, FlowContent, FlowNode, FlowEdge } from './useTreeLayout';

export interface SkillTreeDetail {
  id: string;
  name: string;
  description?: string;
  nodes: FlowTreeNode[];
}

export function useSkillTreePage(treeId: string) {
  const { api } = useApi();
  const { buildFlowElements } = useTreeLayout();
  const toast = useToast();

  const tree = ref<SkillTreeDetail | null>(null);
  const childrenByL1 = ref<Record<string, FlowTreeNode[]>>({});
  const contents = ref<Record<string, FlowContent>>({});
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

  const selectedL2Content = computed(() => {
    if (!selectedL2Id.value) return null;
    return contents.value[selectedL2Id.value] || null;
  });

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
      await loadExistingContents(l2Ids);
    }

    await loadLearningProgress();
    rebuildGraph();
  }

  async function loadExistingContents(l2Ids: string[]) {
    const results = await Promise.all(
      l2Ids.map(async (id) => {
        try {
          const content = await api<FlowContent | null>(`/nodes/${id}/content`);
          return { id, content };
        } catch {
          return { id, content: null };
        }
      }),
    );

    const newContents: Record<string, FlowContent> = {};
    for (const { id, content } of results) {
      if (content) {
        newContents[id] = content;
      }
    }
    contents.value = newContents;
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
      contents.value,
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
        await generateContent(nodeId);
      } else if (action === 'open') {
        selectedL2Id.value = nodeId;
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

  async function generateContent(l2Id: string) {
    setNodeLoading(l2Id, true);
    try {
      const content = await api<FlowContent>(`/nodes/${l2Id}/content`, {
        method: 'POST',
      });
      contents.value = { ...contents.value, [l2Id]: content };
      selectedL2Id.value = l2Id;
      toast.success('分析完成，学习内容已生成');
      rebuildGraph();
    } finally {
      setNodeLoading(l2Id, false);
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
    selectedL2Content,
    loadTreeData,
    onNodeAction,
    toggleCollapse,
    onSelectL1,
    onSelectL2,
    handleStatusChange,
  };
}
