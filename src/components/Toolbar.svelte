<script lang="ts">
  import { ArrowRight, BoxSelect, Eraser, MousePointer2, MoveUpRight, PenLine } from '@lucide/svelte';
  import { activeTool, clearSelection } from '../lib/stores/tactics';
  import type { Tool } from '../lib/types';

  const tools: { id: Tool; label: string; shortcut: string; hint: string; icon: typeof MousePointer2 }[] = [
    { id: 'select', label: 'Select', shortcut: 'V', hint: 'Drag players & ball', icon: MousePointer2 },
    { id: 'run', label: 'Run', shortcut: 'R', hint: 'Draw a curved run', icon: MoveUpRight },
    { id: 'pass', label: 'Pass', shortcut: 'P', hint: 'Draw a passing line', icon: ArrowRight },
    { id: 'line', label: 'Line', shortcut: 'L', hint: 'Draw a straight line', icon: PenLine },
    { id: 'draw', label: 'Draw', shortcut: 'D', hint: 'Draw freely', icon: PenLine },
    { id: 'zone', label: 'Zone', shortcut: 'Z', hint: 'Mark an area', icon: BoxSelect },
    { id: 'erase', label: 'Erase', shortcut: 'E', hint: 'Remove an annotation', icon: Eraser },
  ];

  function choose(tool: Tool) {
    activeTool.set(tool);
    clearSelection();
  }
</script>

<div class="toolbar-shell">
  <div class="tool-hint" aria-live="polite">
    <span class="status-dot"></span>
    {tools.find((tool) => tool.id === $activeTool)?.hint}
  </div>
  <div class="toolbar" role="toolbar" aria-label="Tactics drawing tools">
    {#each tools as tool (tool.id)}
      <button
        class:active={$activeTool === tool.id}
        class="tool-button"
        aria-pressed={$activeTool === tool.id}
        title={`${tool.label} (${tool.shortcut})`}
        onclick={() => choose(tool.id)}
      >
        <tool.icon size={19} strokeWidth={1.8} />
        <span>{tool.label}</span>
        <kbd>{tool.shortcut}</kbd>
      </button>
    {/each}
  </div>
</div>
