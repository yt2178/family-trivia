import { FamilyMember, GameSettings } from './db';

export interface TreeNode {
  id: string;
  name: string;
  image: string | null;
  gender?: 'male' | 'female';
  generation: FamilyMember['generation'];
  x: number;
  y: number;
  level: number;
  parentId: string | null;
  spouseId?: string | null;
  familyName?: string;
}

export interface TreeEdge {
  fromId: string;
  toId: string;
  path: string; // SVG path
  level: number; // For styling thickness
}

export interface TreeLayout {
  nodes: TreeNode[];
  edges: TreeEdge[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

export const calculateTreeLayout = (
  members: FamilyMember[],
  settings: GameSettings
): TreeLayout => {
  if (members.length === 0) {
    return { nodes: [], edges: [], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };
  }

  // 1. Build hierarchy map
  const memberMap = new Map<string, FamilyMember>();
  members.forEach(m => memberMap.set(m.id, m));

  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string | null>();

  members.forEach(m => {
    parentMap.set(m.id, m.parentId);
    if (m.parentId) {
      const list = childrenMap.get(m.parentId) || [];
      list.push(m.id);
      childrenMap.set(m.parentId, list);
    }
  });

  // Determine dynamic levels (depth from grandparents)
  const levels = new Map<string, number>();
  const getLevel = (id: string): number => {
    if (levels.has(id)) return levels.get(id)!;
    const parentId = parentMap.get(id);
    if (!parentId || !memberMap.has(parentId)) {
      levels.set(id, 0);
      return 0;
    }
    const parentLevel = getLevel(parentId);
    levels.set(id, parentLevel + 1);
    return parentLevel + 1;
  };

  members.forEach(m => getLevel(m.id));

  // Find roots (grandparents)
  const roots = members.filter(m => getLevel(m.id) === 0);

  // Settings & Spacing constants
  const isBotanical = settings.treeLayout === 'botanical';
  const nodeWidth = 170;
  const nodeHeight = 80;
  const siblingGap = 150; // Horizontal gap between sibling subtrees
  const verticalSpacing = 170;

  // Track coordinates
  const coordsX = new Map<string, number>();
  const subtreeWidths = new Map<string, number>();

  // Pass 1: Recursively calculate subtree widths
  const calculateSubtreeWidth = (nodeId: string): number => {
    const children = childrenMap.get(nodeId) || [];
    if (children.length === 0) {
      subtreeWidths.set(nodeId, nodeWidth);
      return nodeWidth;
    }

    // Width is sum of children's subtree widths + gaps
    let totalChildrenWidth = 0;
    children.forEach((childId, idx) => {
      const childW = calculateSubtreeWidth(childId);
      totalChildrenWidth += childW;
      if (idx > 0) {
        totalChildrenWidth += siblingGap;
      }
    });

    const nodeW = Math.max(nodeWidth, totalChildrenWidth);
    subtreeWidths.set(nodeId, nodeW);
    return nodeW;
  };

  // Run width calculation for root nodes
  roots.forEach(root => calculateSubtreeWidth(root.id));

  // Pass 2: Recursively assign X coordinates
  const assignXCoordinates = (nodeId: string, x: number) => {
    coordsX.set(nodeId, x);
    const children = childrenMap.get(nodeId) || [];
    if (children.length === 0) return;

    // Check if the current node is a grandparent (level 0)
    // Its children are the 8 couples, and we want to space them equally!
    const isRoot = getLevel(nodeId) === 0;
    if (isRoot) {
      let maxChildW = 0;
      children.forEach(childId => {
        const childW = subtreeWidths.get(childId)!;
        if (childW > maxChildW) maxChildW = childW;
      });
      
      const equalGap = maxChildW + 50; // Add 50px buffer between subtrees for visual clarity
      const totalWidth = (children.length - 1) * equalGap;
      const startX = x - totalWidth / 2;
      
      children.forEach((childId, idx) => {
        const childCenterX = startX + idx * equalGap;
        assignXCoordinates(childId, childCenterX);
      });
      return;
    }

    // For married couples at the same level, position them close together
    const currentNode = members.find(m => m.id === nodeId);
    if (currentNode?.spouseId) {
      const spouse = members.find(m => m.id === currentNode.spouseId);
      if (spouse && spouse.parentId === currentNode.parentId) {
        // They are married and share the same parent - position them close
        const spouseIndex = children.indexOf(spouse.id);
        if (spouseIndex !== -1) {
          // Position spouses close together
          const spouseGap = 60; // Small gap between spouses
          const coupleCenterX = x;
          
          // Assign positions to both spouses
          coordsX.set(nodeId, coupleCenterX - spouseGap / 2);
          coordsX.set(spouse.id, coupleCenterX + spouseGap / 2);
          
          // Remove spouse from children list to avoid double processing
          const remainingChildren = children.filter(c => c !== spouse.id);
          
          // Process remaining children normally
          if (remainingChildren.length > 0) {
            const totalWidth = remainingChildren.reduce((sum, childId) => {
              return sum + subtreeWidths.get(childId)!;
            }, 0) + (remainingChildren.length - 1) * 30;
            
            let startX = coupleCenterX - totalWidth / 2;
            
            remainingChildren.forEach((childId) => {
              const childW = subtreeWidths.get(childId)!;
              const childCenterX = startX + childW / 2;
              assignXCoordinates(childId, childCenterX);
              startX += childW + 30;
            });
          }
          return;
        }
      }
    }

    // Otherwise, use standard centering layout for children and grandchildren
    let childrenWidth = 0;
    children.forEach((childId, idx) => {
      childrenWidth += subtreeWidths.get(childId)!;
      if (idx > 0) childrenWidth += siblingGap;
    });

    let currentX = x - childrenWidth / 2;
    children.forEach(childId => {
      const childW = subtreeWidths.get(childId)!;
      const childCenterX = currentX + childW / 2;
      assignXCoordinates(childId, childCenterX);
      currentX += childW + siblingGap;
    });
  };

  // Space out roots if there are multiple roots
  // If roots represent a single couple like "סבא וסבתא צברי", we center them at X=0
  if (roots.length === 1) {
    assignXCoordinates(roots[0].id, 0);
  } else {
    let totalRootsW = 0;
    roots.forEach((r, idx) => {
      totalRootsW += subtreeWidths.get(r.id)!;
      if (idx > 0) totalRootsW += siblingGap;
    });
    
    let startX = -totalRootsW / 2;
    roots.forEach(r => {
      const rW = subtreeWidths.get(r.id)!;
      assignXCoordinates(r.id, startX + rW / 2);
      startX += rW + siblingGap;
    });
  }

  // Create nodes list with final X and Y coordinates
  const nodesList: TreeNode[] = [];
  const maxLevel = Math.max(0, ...Array.from(levels.values()));

  members.forEach(m => {
    const level = levels.get(m.id)!;
    const x = coordsX.get(m.id) || 0;
    
    // Y coordinate based on botanical or traditional layout
    let y = 0;
    if (isBotanical) {
      // Roots at the bottom (highest Y), leaves at top (Y=100)
      y = (maxLevel - level) * verticalSpacing + 100;
    } else {
      // Roots at top (Y=100), leaves at bottom
      y = level * verticalSpacing + 100;
    }

    nodesList.push({
      id: m.id,
      name: m.name,
      image: m.image,
      gender: m.gender,
      generation: m.generation,
      x,
      y,
      level,
      parentId: m.parentId,
      spouseId: m.spouseId,
      familyName: m.familyName
    });
  });

  // 3. Create edges (branches)
  const edgesList: TreeEdge[] = [];
  nodesList.forEach(node => {
    if (node.parentId) {
      const parent = nodesList.find(n => n.id === node.parentId);
      if (parent) {
        let path = '';
        let x1 = parent.x;
        const y1 = parent.y;
        const x2 = node.x;
        const y2 = node.y;

        // If parent has a spouse, draw edge from the midpoint between them!
        if (parent.spouseId) {
          const spouse = nodesList.find(n => n.id === parent.spouseId);
          if (spouse) {
            x1 = (parent.x + spouse.x) / 2;
          }
        }

        // Draw smooth organic Cubic Bezier curve paths
        if (isBotanical) {
          const cpY1 = y1 - verticalSpacing * 0.45;
          const cpY2 = y2 + verticalSpacing * 0.45;
          path = `M ${x1} ${y1} C ${x1} ${cpY1}, ${x2} ${cpY2}, ${x2} ${y2}`;
        } else {
          const cpY1 = y1 + verticalSpacing * 0.45;
          const cpY2 = y2 - verticalSpacing * 0.45;
          path = `M ${x1} ${y1} C ${x1} ${cpY1}, ${x2} ${cpY2}, ${x2} ${y2}`;
        }

        edgesList.push({
          fromId: parent.id,
          toId: node.id,
          path,
          level: Math.min(parent.level, node.level)
        });
      }
    }
  });

  // Calculate bounds
  const xs = nodesList.map(n => n.x);
  const ys = nodesList.map(n => n.y);
  
  const minX = Math.min(...xs) - nodeWidth;
  const maxX = Math.max(...xs) + nodeWidth;
  const minY = Math.min(...ys) - nodeHeight;
  const maxY = Math.max(...ys) + nodeHeight;

  return {
    nodes: nodesList,
    edges: edgesList,
    bounds: { minX, maxX, minY, maxY }
  };
};
