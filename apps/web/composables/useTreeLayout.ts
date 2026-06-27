import { NodeLevel, NodeStatus, NodeLearningStatus } from '@skill/shared';

export interface FlowSkillTree {
  id: string;
  name: string;
  description?: string;
}

export interface FlowTreeNode {
  id: string;
  treeId: string;
  parentId?: string;
  level: number;
  title: string;
  description?: string;
  status: NodeStatus;
  sortOrder: number;
}

export interface FlowCodeExample {
  title: string;
  language: string;
  code: string;
}

export interface FlowExercise {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface FlowContent {
  id: string;
  nodeId: string;
  coreText: string;
  codeExamples?: FlowCodeExample[];
  exercises?: FlowExercise[];
}

export interface FlowNodeData {
  type: 'root' | 'l1' | 'l2';
  label: string;
  description?: string;
  status: NodeStatus;
  hasChildren?: boolean;
  hasContent?: boolean;
  sortOrder: number;
  loading?: boolean;
  collapsed?: boolean;
  learningStatus?: NodeLearningStatus;
}

export interface FlowNode {
  id: string;
  type: 'flowNode';
  position: { x: number; y: number };
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

export { NodeLevel, NodeStatus, NodeLearningStatus };

const NODE_WIDTH = 340;
const NODE_HEIGHT = 190;
const LEVEL_GAP_X = 460;
const NODE_GAP_Y = 28;
const LEVEL_GAP_Y = 52;

export function useTreeLayout() {
  function buildFlowElements(
    tree: FlowSkillTree,
    nodes: FlowTreeNode[],
    childrenByL1: Record<string, FlowTreeNode[]>,
    contents: Record<string, FlowContent>,
    options?: {
      collapsedL1Ids?: Set<string>;
      loadingNodeId?: string | null;
    },
  ): { nodes: FlowNode[]; edges: FlowEdge[] } {
    const flowNodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];

    flowNodes.push({
      id: 'root',
      type: 'flowNode',
      position: { x: 0, y: 0 },
      data: {
        type: 'root',
        label: tree.name,
        description: tree.description,
        status: NodeStatus.ACTIVE,
        sortOrder: 0,
      },
    });

    const l1Nodes = nodes
      .filter((n) => n.level === NodeLevel.L1)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const collapsed = options?.collapsedL1Ids ?? new Set<string>();
    const loadingNodeId = options?.loadingNodeId;

    for (const l1 of l1Nodes) {
      const isCollapsed = collapsed.has(l1.id);
      flowNodes.push({
        id: l1.id,
        type: 'flowNode',
        position: { x: 0, y: 0 },
        data: {
          type: 'l1',
          label: l1.title,
          description: l1.description,
          status: l1.status,
          hasChildren: (childrenByL1[l1.id]?.length ?? 0) > 0,
          sortOrder: l1.sortOrder,
          collapsed: isCollapsed,
          loading: l1.id === loadingNodeId,
        },
      });
      edges.push({ id: `root-${l1.id}`, source: 'root', target: l1.id });
    }

    for (const l1 of l1Nodes) {
      if (collapsed.has(l1.id)) continue;

      const l2Children = (childrenByL1[l1.id] || [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder);

      for (const l2 of l2Children) {
        flowNodes.push({
          id: l2.id,
          type: 'flowNode',
          position: { x: 0, y: 0 },
          data: {
            type: 'l2',
            label: l2.title,
            description: l2.description,
            status: l2.status,
            hasContent: !!contents[l2.id],
            sortOrder: l2.sortOrder,
            loading: l2.id === loadingNodeId,
          },
        });
        edges.push({ id: `${l1.id}-${l2.id}`, source: l1.id, target: l2.id });
      }
    }

    const positioned = calculatePositions(flowNodes, edges);
    return { nodes: positioned, edges };
  }

  function calculatePositions(
    nodes: FlowNode[],
    edges: FlowEdge[],
  ): FlowNode[] {
    const byLevel: Record<number, FlowNode[]> = { 0: [], 1: [], 2: [] };

    for (const node of nodes) {
      const type = node.data.type;
      const level = type === 'root' ? 0 : type === 'l1' ? 1 : 2;
      byLevel[level].push(node);
    }

    for (const level of [0, 1, 2]) {
      byLevel[level].sort((a, b) => a.data.sortOrder - b.data.sortOrder);
    }

    const positioned: FlowNode[] = [];
    const parentMap: Record<string, string[]> = {};
    for (const edge of edges) {
      if (!parentMap[edge.source]) parentMap[edge.source] = [];
      parentMap[edge.source].push(edge.target);
    }

    // Build L1 subtrees: each L1 occupies a vertical block tall enough for its L2 children.
    interface L1Subtree {
      node: FlowNode;
      children: FlowNode[];
      blockHeight: number;
    }

    const subtrees: L1Subtree[] = byLevel[1].map((l1Node) => {
      const children = (parentMap[l1Node.id] || [])
        .map((id) => byLevel[2].find((n) => n.id === id))
        .filter((n): n is FlowNode => !!n)
        .sort((a, b) => a.data.sortOrder - b.data.sortOrder);

      if (l1Node.data.collapsed || children.length === 0) {
        return { node: l1Node, children: [], blockHeight: NODE_HEIGHT };
      }

      const childrenHeight = children.length * NODE_HEIGHT + Math.max(0, children.length - 1) * NODE_GAP_Y;
      const blockHeight = Math.max(NODE_HEIGHT, childrenHeight);
      return { node: l1Node, children, blockHeight };
    });

    // Position L1 nodes and their L2 children block by block.
    let currentY = 0;
    for (const subtree of subtrees) {
      const { node: l1Node, children, blockHeight } = subtree;

      // Center L1 vertically inside its block.
      const l1Y = currentY + blockHeight / 2 - NODE_HEIGHT / 2;
      positioned.push({
        ...l1Node,
        position: { x: LEVEL_GAP_X, y: l1Y },
      });

      // Place L2 children starting from the top of the block.
      let childY = currentY;
      for (const child of children) {
        positioned.push({
          ...child,
          position: { x: LEVEL_GAP_X * 2, y: childY },
        });
        childY += NODE_HEIGHT + NODE_GAP_Y;
      }

      currentY += blockHeight + LEVEL_GAP_Y;
    }

    // Root is vertically centered relative to the whole tree.
    const totalHeight = Math.max(0, currentY - LEVEL_GAP_Y);
    const rootY = totalHeight / 2 - NODE_HEIGHT / 2;

    positioned.unshift({
      ...byLevel[0][0],
      position: { x: 0, y: rootY },
    });

    return positioned;
  }

  return {
    NODE_WIDTH,
    NODE_HEIGHT,
    buildFlowElements,
    calculatePositions,
  };
}
