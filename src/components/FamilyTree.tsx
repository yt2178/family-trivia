import React, { useState, useRef, useEffect } from 'react';
import { FamilyMember, GameSettings } from '../utils/db';
import { calculateTreeLayout, TreeNode, TreeEdge } from '../utils/treeLayout';
import { ZoomIn, ZoomOut, Maximize2, User, Heart, HeartHandshake, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FamilyTreeProps {
  members: FamilyMember[];
  settings: GameSettings;
  solvedQuestions: Record<string, string>;
  currentSpeakerId: string | null;
  isAnswerRevealed: boolean;
  onNodeClick?: (member: TreeNode) => void;
  interactive?: boolean;
  revealedMembers?: Record<string, boolean>; // Track which members have been revealed in the game
}

export const FamilyTree: React.FC<FamilyTreeProps> = React.memo(({
  members,
  settings,
  solvedQuestions,
  currentSpeakerId,
  isAnswerRevealed,
  onNodeClick,
  interactive = true,
  revealedMembers = {},
}) => {
  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState({ x: 100, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set()); // Track which nodes are expanded
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null); // Track which node is currently focused
  const dragStart = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate layout
  const layout = calculateTreeLayout(members, settings);

  // Progressive reveal logic: Determine which nodes should be visible
  const getVisibleNodes = () => {
    // Always show grandparents
    const visible = new Set<string>();
    
    layout.nodes.forEach(node => {
      // Always show grandparents (generation 0)
      if (node.generation === 'grandparent') {
        visible.add(node.id);
      }
      // Always show first generation (parents) initially
      else if (node.generation === 'parent') {
        visible.add(node.id);
      }
      // Show children/grandchildren only if their parent is revealed/expanded
      else if (node.parentId) {
        const parent = layout.nodes.find(n => n.id === node.parentId);
        if (parent && (expandedNodes.has(parent.id) || revealedMembers[parent.id])) {
          visible.add(node.id);
        }
      }
    });

    // Also show current speaker and their ancestors ONLY when answer is revealed
    if (currentSpeakerId && isAnswerRevealed) {
      let currentNode = layout.nodes.find(n => n.id === currentSpeakerId);
      while (currentNode) {
        visible.add(currentNode.id);
        const pid = currentNode.parentId;
        if (pid) {
          currentNode = layout.nodes.find(n => n.id === pid);
        } else {
          currentNode = undefined;
        }
      }
    }

    return visible;
  };

  const visibleNodes = getVisibleNodes();

  // Auto-expand branches when members are revealed in the game
  useEffect(() => {
    const newExpanded = new Set(expandedNodes);
    
    // When a member is revealed, expand their parent to show them
    if (revealedMembers && typeof revealedMembers === 'object') {
      Object.keys(revealedMembers).forEach(memberId => {
        if (revealedMembers[memberId]) {
          const member = layout.nodes.find(n => n.id === memberId);
          if (member && member.parentId) {
            newExpanded.add(member.parentId);
          }
        }
      });
    }
    
    setExpandedNodes(newExpanded);
  }, [revealedMembers]);

  // Auto-zoom to current speaker when it changes
  useEffect(() => {
    if (currentSpeakerId) {
      const speakerNode = layout.nodes.find(n => n.id === currentSpeakerId);
      if (speakerNode) {
        setFocusedNodeId(currentSpeakerId);
        
        // Auto-zoom to the speaker
        const targetZoom = 1.2;
        const targetPan = {
          x: -speakerNode.x * targetZoom + (containerRef.current?.clientWidth || 800) / 2,
          y: -speakerNode.y * targetZoom + (containerRef.current?.clientHeight || 600) / 2
        };
        
        setZoom(targetZoom);
        setPan(targetPan);
      }
    }
  }, [currentSpeakerId]);

  // Handle node click - toggle expansion or focus
  const handleNodeClick = (node: TreeNode) => {
    if (!interactive) return;
    
    setFocusedNodeId(node.id);
    
    // Toggle expansion for nodes with children
    const hasChildren = layout.nodes.some(n => n.parentId === node.id);
    if (hasChildren) {
      setExpandedNodes(prev => {
        const newSet = new Set(prev);
        if (newSet.has(node.id)) {
          newSet.delete(node.id);
        } else {
          newSet.add(node.id);
        }
        return newSet;
      });
    }
    
    if (onNodeClick) {
      onNodeClick(node);
    }
  };

  // Reset focus when clicking on empty space
  const handleBackgroundClick = () => {
    setFocusedNodeId(null);
  };

  // Keyboard shortcuts for navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!interactive) return;
      
      switch (e.key) {
        case 'ArrowUp':
          setPan(prev => ({ ...prev, y: prev.y + 50 }));
          break;
        case 'ArrowDown':
          setPan(prev => ({ ...prev, y: prev.y - 50 }));
          break;
        case 'ArrowLeft':
          setPan(prev => ({ ...prev, x: prev.x + 50 }));
          break;
        case 'ArrowRight':
          setPan(prev => ({ ...prev, x: prev.x - 50 }));
          break;
        case '+':
        case '=':
          setZoom(prev => Math.min(3, prev + 0.1));
          break;
        case '-':
          setZoom(prev => Math.max(0.1, prev - 0.1));
          break;
        case '0':
          handleFitToScreen();
          break;
        case 'Escape':
          setFocusedNodeId(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [interactive]);

  // Fit tree to container
  const handleFitToScreen = () => {
    if (!containerRef.current || layout.nodes.length === 0) return;
    
    // Set fallbacks in case dimensions are not yet fully measured by the browser
    const containerWidth = containerRef.current.clientWidth > 100 ? containerRef.current.clientWidth : 800;
    const containerHeight = containerRef.current.clientHeight > 100 ? containerRef.current.clientHeight : 600;

    const { minX, maxX, minY, maxY } = layout.bounds;
    const treeW = maxX - minX;
    const treeH = maxY - minY;

    const padding = 100;
    const scaleX = containerWidth / (treeW + padding);
    const scaleY = containerHeight / (treeH + padding);
    
    // Clamp the zoom: minimum 0.15 so it never becomes 0 (invisible), maximum 1.2
    const newZoom = Math.max(0.15, Math.min(scaleX, scaleY, 1.2));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setZoom(newZoom);
    setPan({
      x: containerWidth / 2 - centerX * newZoom,
      y: containerHeight / 2 - centerY * newZoom,
    });
  };

  // Run fit to screen on load
  useEffect(() => {
    // Small delay to ensure dimensions are rendered
    const timer = setTimeout(handleFitToScreen, 150);
    return () => clearTimeout(timer);
  }, [members, settings.treeLayout]);

  // Zoom helpers
  const handleZoom = (factor: number) => {
    setZoom((prev) => Math.max(0.1, Math.min(3, prev * factor)));
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for tablets/phones
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStart.current = {
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.current.x,
      y: e.touches[0].clientY - dragStart.current.y,
    });
  };

  // Wheel zoom centered at cursor or center
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const direction = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;

    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - pan.x;
    const mouseY = e.clientY - rect.top - pan.y;

    const newZoom = Math.max(0.1, Math.min(3, zoom * direction));

    setPan({
      x: e.clientX - rect.left - mouseX * (newZoom / zoom),
      y: e.clientY - rect.top - mouseY * (newZoom / zoom),
    });
    setZoom(newZoom);
  };


  // We can build a map of speakerId -> winner from solvedQuestions
  const speakerWinners = React.useMemo(() => {
    const map: Record<string, string> = {};
    
    // We need to match question's speakerId to winner
    // The parent passes solvedQuestions which maps questionId -> winner.
    // Let's fetch questions from localStorage or pass them, but since we have members list,
    // we can pass solved status directly or build it.
    // Wait, let's look at the props: we have solvedQuestions. If solvedQuestions holds speakerId -> winner,
    // that would be much easier! Let's structure solvedQuestions as: Record<questionId, winner>.
    // Wait, in db.ts I defined solvedQuestions: Record<string, 'grandpa' | 'grandma' | 'nobody'> where key is questionId.
    // So to know if a speaker is solved, we need to map questionId back to speakerId.
    // Let's retrieve the list of questions from localStorage to map speakerId to their solve state.
    const savedQuestionsStr = localStorage.getItem('family_game_questions');
    if (savedQuestionsStr) {
      try {
        const questions = JSON.parse(savedQuestionsStr);
        questions.forEach((q: any) => {
          const winner = solvedQuestions[q.id];
          if (winner) {
            map[q.speakerId] = winner;
          }
        });
      } catch (e) {
        console.error(e);
      }
    }
    return map;
  }, [solvedQuestions]);

  // Color theme variables based on settings.theme
  const getThemeStyles = () => {
    switch (settings.theme) {
      case 'gold':
        return {
          bg: 'bg-slate-950',
          branchStroke: '#e2b857',
          trunkFill: 'url(#goldTrunkGradient)',
          leafBorder: 'border-amber-600/40',
          leafBg: 'bg-slate-900/90',
          leafText: 'text-amber-100',
        };
      case 'neon':
        return {
          bg: 'bg-zinc-950',
          branchStroke: '#00f5ff',
          trunkFill: 'url(#neonTrunkGradient)',
          leafBorder: 'border-cyan-600/30',
          leafBg: 'bg-zinc-900/95',
          leafText: 'text-cyan-100',
        };
      case 'classic':
        return {
          bg: 'bg-gray-900',
          branchStroke: '#4b5563',
          trunkFill: 'url(#classicTrunkGradient)',
          leafBorder: 'border-gray-700',
          leafBg: 'bg-gray-800/90',
          leafText: 'text-gray-100',
        };
      case 'forest':
      default:
        return {
          bg: 'bg-emerald-950/20',
          branchStroke: '#10b981',
          trunkFill: 'url(#forestTrunkGradient)',
          leafBorder: 'border-emerald-800/30',
          leafBg: 'bg-slate-900/95',
          leafText: 'text-emerald-50',
        };
    }
  };

  const themeStyles = getThemeStyles();
  const isBotanical = settings.treeLayout === 'botanical';

  const getNameFontSize = (name: string) => {
    if (name.length > 18) return 'text-[10px] leading-tight';
    if (name.length > 13) return 'text-xs leading-tight';
    return 'text-sm';
  };

  const getRelationLabel = (node: TreeNode) => {
    const isCouple = node.name.includes(' ו');
    if (node.generation === 'grandparent') {
      return isCouple ? 'סבא וסבתא' : (node.gender === 'female' ? 'סבתא' : 'סבא');
    }
    if (node.generation === 'parent') {
      return isCouple ? 'ילד וילדה' : (node.gender === 'female' ? 'ילדה' : 'ילד');
    }
    if (node.generation === 'child') {
      return isCouple ? 'נכד ונכדה' : (node.gender === 'female' ? 'נכדה' : 'נכד');
    }
    return isCouple ? 'נין ונינה' : (node.gender === 'female' ? 'נינה' : 'נין');
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full select-none overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/40 backdrop-blur-sm`}
    >
      {/* Control Buttons */}
      <div className="absolute bottom-6 right-6 z-10 flex gap-2">
        <button
          onClick={() => handleZoom(1.2)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/90 text-slate-300 border border-slate-800 hover:text-white hover:bg-slate-800 transition-colors shadow-lg"
          title="התקרב"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => handleZoom(0.8)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/90 text-slate-300 border border-slate-800 hover:text-white hover:bg-slate-800 transition-colors shadow-lg"
          title="התרחק"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={handleFitToScreen}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/90 text-slate-300 border border-slate-800 hover:text-white hover:bg-slate-800 transition-colors shadow-lg"
          title="התאם למסך"
        >
          <Maximize2 size={18} />
        </button>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleBackgroundClick}
      >
        {/* Defs for gradients and filters */}
        <defs>
          {/* Forest Trunk */}
          <linearGradient id="forestTrunkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#451a03" />
            <stop offset="50%" stopColor="#78350f" />
            <stop offset="100%" stopColor="#451a03" />
          </linearGradient>
          
          {/* Gold Trunk */}
          <linearGradient id="goldTrunkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2e1f00" />
            <stop offset="50%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#2e1f00" />
          </linearGradient>

          {/* Neon Trunk */}
          <linearGradient id="neonTrunkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#09090b" />
            <stop offset="50%" stopColor="#27272a" />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>

          {/* Classic Trunk */}
          <linearGradient id="classicTrunkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1f2937" />
            <stop offset="50%" stopColor="#4b5563" />
            <stop offset="100%" stopColor="#1f2937" />
          </linearGradient>

          {/* Shadow Filter */}
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity="0.4" />
          </filter>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          
          {/* 1. Draw Tree Trunk (only in Botanical layout for organic wow factor) */}
          {isBotanical && layout.nodes.length > 0 && (
            <g opacity="0.8">
              {/* Main Trunk Body with theme gradient */}
              <path
                d={`M ${(layout.bounds.minX + layout.bounds.maxX) / 2 - 50} ${layout.bounds.maxY + 150}
                    C ${(layout.bounds.minX + layout.bounds.maxX) / 2 - 35} ${layout.bounds.maxY + 60}, 
                      ${(layout.bounds.minX + layout.bounds.maxX) / 2 - 20} ${layout.bounds.maxY + 20}, 
                      ${(layout.bounds.minX + layout.bounds.maxX) / 2 - 20} ${layout.bounds.maxY - 40}
                    L ${(layout.bounds.minX + layout.bounds.maxX) / 2 + 20} ${layout.bounds.maxY - 40}
                    C ${(layout.bounds.minX + layout.bounds.maxX) / 2 + 20} ${layout.bounds.maxY + 20}, 
                      ${(layout.bounds.minX + layout.bounds.maxX) / 2 + 35} ${layout.bounds.maxY + 60}, 
                      ${(layout.bounds.minX + layout.bounds.maxX) / 2 + 50} ${layout.bounds.maxY + 150}
                    Z`}
                fill={themeStyles.trunkFill}
              />
              {/* Left root spreading out */}
              <path
                d={`M ${(layout.bounds.minX + layout.bounds.maxX) / 2 - 40} ${layout.bounds.maxY + 120} 
                    Q ${(layout.bounds.minX + layout.bounds.maxX) / 2 - 90} ${layout.bounds.maxY + 140}, 
                      ${(layout.bounds.minX + layout.bounds.maxX) / 2 - 130} ${layout.bounds.maxY + 160}`}
                fill="none"
                stroke={themeStyles.branchStroke}
                strokeWidth="10"
                strokeLinecap="round"
                opacity="0.65"
              />
              {/* Right root spreading out */}
              <path
                d={`M ${(layout.bounds.minX + layout.bounds.maxX) / 2 + 40} ${layout.bounds.maxY + 120} 
                    Q ${(layout.bounds.minX + layout.bounds.maxX) / 2 + 90} ${layout.bounds.maxY + 140}, 
                      ${(layout.bounds.minX + layout.bounds.maxX) / 2 + 130} ${layout.bounds.maxY + 160}`}
                fill="none"
                stroke={themeStyles.branchStroke}
                strokeWidth="10"
                strokeLinecap="round"
                opacity="0.65"
              />
              {/* Middle root extending down */}
              <path
                d={`M ${(layout.bounds.minX + layout.bounds.maxX) / 2} ${layout.bounds.maxY + 130} 
                    Q ${(layout.bounds.minX + layout.bounds.maxX) / 2 - 15} ${layout.bounds.maxY + 150}, 
                      ${(layout.bounds.minX + layout.bounds.maxX) / 2 - 25} ${layout.bounds.maxY + 175}`}
                fill="none"
                stroke={themeStyles.branchStroke}
                strokeWidth="6"
                strokeLinecap="round"
                opacity="0.65"
              />
            </g>
          )}

          {/* 2. Draw Branch Edges */}
          <g>
            {layout.edges.map((edge, index) => {
              const maxLvl = Math.max(1, ...layout.nodes.map(n => n.level));
              // Thicker stroke for lower levels (closer to root)
              const thickness = isBotanical
                ? (maxLvl - edge.level + 1) * 2.5
                : (edge.level + 1) * 2.5;

              // Solved speaker branch gets glowing color
              let strokeColor = themeStyles.branchStroke;
              const sourceWinner = speakerWinners[edge.fromId];
              const destWinner = speakerWinners[edge.toId];
              
              const destWinnersList = destWinner ? destWinner.split(',') : [];
              const primaryDestWinner = destWinnersList[0];
              if (destWinnersList.length > 0) {
                const contestantIndex = settings.contestants.findIndex(c => c.id === primaryDestWinner);
                if (destWinnersList.length > 1) strokeColor = '#ef4444'; // Red for multiple winners
                else if (contestantIndex === 0 || primaryDestWinner === 'grandpa') strokeColor = '#0ea5e9';
                else if (contestantIndex === 1 || primaryDestWinner === 'grandma') strokeColor = '#d946ef';
                else if (contestantIndex === 2) strokeColor = '#f97316';
                else if (contestantIndex === 3) strokeColor = '#10b981';
                else if (primaryDestWinner === 'nobody') strokeColor = '#64748b';
              }

              return (
                <path
                  key={`edge-${index}`}
                  d={edge.path}
                  className="tree-branch"
                  style={{
                    stroke: strokeColor,
                    strokeWidth: Math.max(1.5, thickness),
                    opacity: destWinner ? 0.9 : 0.4
                  }}
                />
              );
            })}
          </g>

          {/* 2.5 Draw Marriage Connections (between spouses) */}
          <g>
            {layout.nodes.map((node) => {
              if (!node.spouseId) return null;
              
              // Find spouse node
              const spouse = layout.nodes.find(n => n.id === node.spouseId);
              if (!spouse) return null;
              
              // Only draw once per couple (draw from node with lower ID to avoid duplicates)
              if (node.id > spouse.id) return null;
              
              // Calculate midpoint
              const midX = (node.x + spouse.x) / 2;
              const midY = (node.y + spouse.y) / 2;
              
              return (
                <g key={`marriage-${node.id}-${spouse.id}`}>
                  {/* Marriage line */}
                  <line
                    x1={node.x}
                    y1={node.y}
                    x2={spouse.x}
                    y2={spouse.y}
                    stroke="#f43f5e"
                    strokeWidth="2"
                    strokeDasharray="4,4"
                    opacity="0.6"
                  />
                  {/* Heart icon at midpoint */}
                  <foreignObject
                    x={midX - 10}
                    y={midY - 10}
                    width="20"
                    height="20"
                  >
                    <div className="flex items-center justify-center w-full h-full">
                      <HeartHandshake size={14} className="text-rose-400" />
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </g>

          {/* 3. Draw Family Nodes */}
          <g>
            {layout.nodes.map((node) => {
              // Only render visible nodes (progressive reveal)
              if (!visibleNodes.has(node.id)) return null;
              
              const isCurrentQuestionSpeaker = currentSpeakerId === node.id;
              const winner = speakerWinners[node.id];
              const isSolved = !!winner;
              const isFocused = focusedNodeId === node.id;
              const hasChildren = layout.nodes.some(n => n.parentId === node.id);
              const isExpanded = expandedNodes.has(node.id);
              
              // Dim non-focused nodes when there's a focused node
              const opacity = focusedNodeId && !isFocused ? 0.3 : 1;

              // Glowing and border class calculation
              let nodeGlowClass = '';
              let borderClass = themeStyles.leafBorder;
              let bgClass = themeStyles.leafBg;
              let textClass = themeStyles.leafText;

              if (isAnswerRevealed && isCurrentQuestionSpeaker) {
                // If it is the current answer, highlight it!
                const winnersList = winner ? winner.split(',') : [];
                const primaryWinner = winnersList[0];
                const contestantIndex = settings.contestants.findIndex(c => c.id === primaryWinner);
                
                if (winnersList.length > 1) {
                  nodeGlowClass = 'animate-pulse border-red-400 bg-red-950/90 shadow-[0_0_20px_#ef4444]';
                  borderClass = 'border-red-400';
                  bgClass = 'bg-red-950/90';
                } else if (contestantIndex === 0 || primaryWinner === 'grandpa') {
                  nodeGlowClass = 'animate-pulse-glow-grandpa border-sky-400 bg-sky-950/90 shadow-[0_0_20px_#0ea5e9]';
                  borderClass = 'border-sky-400';
                  bgClass = 'bg-sky-950/90';
                } else if (contestantIndex === 1 || primaryWinner === 'grandma') {
                  nodeGlowClass = 'animate-pulse-glow-grandma border-fuchsia-400 bg-fuchsia-950/90 shadow-[0_0_20px_#d946ef]';
                  borderClass = 'border-fuchsia-400';
                  bgClass = 'bg-fuchsia-950/90';
                } else if (contestantIndex === 2) {
                  nodeGlowClass = 'animate-pulse border-amber-400 bg-amber-950/90 shadow-[0_0_20px_#f97316]';
                  borderClass = 'border-amber-400';
                  bgClass = 'bg-amber-950/90';
                } else if (contestantIndex === 3) {
                  nodeGlowClass = 'animate-pulse border-emerald-400 bg-emerald-950/90 shadow-[0_0_20px_#10b981]';
                  borderClass = 'border-emerald-400';
                  bgClass = 'bg-emerald-950/90';
                } else {
                  nodeGlowClass = 'animate-pulse-glow-reveal border-slate-400 bg-slate-900/90 shadow-[0_0_15px_#94a3b8]';
                  borderClass = 'border-slate-400';
                  bgClass = 'bg-slate-900/90';
                }
              } else if (isSolved) {
                // Solved in past questions
                const winnersList = winner ? winner.split(',') : [];
                const primaryWinner = winnersList[0];
                const contestantIndex = settings.contestants.findIndex(c => c.id === primaryWinner);
                
                if (winnersList.length > 1) {
                  borderClass = 'border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]';
                  bgClass = 'bg-red-950/80';
                } else if (contestantIndex === 0 || primaryWinner === 'grandpa') {
                  borderClass = 'border-sky-500 shadow-[0_0_12px_rgba(14,165,233,0.5)]';
                  bgClass = 'bg-sky-950/80';
                } else if (contestantIndex === 1 || primaryWinner === 'grandma') {
                  borderClass = 'border-fuchsia-500 shadow-[0_0_12px_rgba(217,70,239,0.5)]';
                  bgClass = 'bg-fuchsia-950/80';
                } else if (contestantIndex === 2) {
                  borderClass = 'border-amber-500 shadow-[0_0_12px_rgba(249,115,22,0.5)]';
                  bgClass = 'bg-amber-950/80';
                } else if (contestantIndex === 3) {
                  borderClass = 'border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]';
                  bgClass = 'bg-emerald-950/80';
                } else {
                  borderClass = 'border-slate-500 shadow-[0_0_8px_rgba(148,163,184,0.3)]';
                  bgClass = 'bg-slate-800/80';
                }
              }

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x - 85}, ${node.y - 40})`}
                  style={{ opacity }}
                  onClick={() => handleNodeClick(node)}
                  className="cursor-pointer"
                >
                  <foreignObject width="170" height="80" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility">
                    <div
                      title={node.name}
                      className={`w-full h-full flex items-center p-2 rounded-tl-2xl rounded-br-2xl border text-right transition-all duration-300 leaf-node ${bgClass} ${borderClass} ${nodeGlowClass}`}
                    >
                      {/* Avatar container */}
                      <div className="relative w-12 h-12 flex-shrink-0 rounded-tl-xl rounded-br-xl overflow-hidden bg-slate-950/60 border border-slate-800 flex items-center justify-center">
                        {node.image ? (
                          <img
                            src={node.image}
                            alt={node.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl select-none">
                            {node.generation === 'grandparent' ? (node.gender === 'female' ? '👵' : '👴') :
                             node.generation === 'parent' ? (node.gender === 'female' ? '👩' : '👨') :
                             node.generation === 'child' ? (node.gender === 'female' ? '👧' : '👦') : '👶'}
                          </span>
                        )}
                        
                        {/* Little gender or generation indicator */}
                        {node.level === 0 && (
                          <span className="absolute bottom-0 right-0 p-0.5 bg-amber-500 rounded-tl-md text-[8px] text-slate-950 font-bold leading-none">
                            סבא/ת
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="mr-2 flex-grow overflow-hidden select-none">
                        <div className={`font-bold whitespace-normal break-words ${getNameFontSize(node.name)} ${textClass}`}>
                          {node.name.length > 12 ? node.name.slice(0, 11) + '...' : node.name}
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5">
                          {getRelationLabel(node)}
                        </div>
                      </div>

                      {/* Expand/Collapse indicator */}
                      {hasChildren && (
                        <div className="flex-shrink-0 ml-1">
                          {isExpanded ? (
                            <ChevronDown size={14} className="text-slate-500" />
                          ) : (
                            <ChevronRight size={14} className="text-slate-500" />
                          )}
                        </div>
                      )}

                      {isSolved && (
                        <div className="absolute -top-1 -left-1 bg-slate-950 border border-slate-800 p-0.5 rounded-full">
                          <Heart
                            size={10}
                            className={(() => {
                              const winnersList = winner ? winner.split(',') : [];
                              if (winnersList.length > 1) return 'fill-red-500 text-red-500';
                              const primaryWinner = winnersList[0];
                              const contestantIndex = settings.contestants.findIndex(c => c.id === primaryWinner);
                              if (contestantIndex === 0 || primaryWinner === 'grandpa') return 'fill-sky-500 text-sky-500';
                              if (contestantIndex === 1 || primaryWinner === 'grandma') return 'fill-fuchsia-500 text-fuchsia-500';
                              if (contestantIndex === 2) return 'fill-amber-500 text-amber-500';
                              if (contestantIndex === 3) return 'fill-emerald-500 text-emerald-500';
                              return 'fill-slate-500 text-slate-500';
                            })()}
                          />
                        </div>
                      )}
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
});
