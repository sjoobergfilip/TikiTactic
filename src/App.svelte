<script lang="ts">
  import {
    ChevronLeft,
    ChevronRight,
    Keyboard,
    Minus,
    PanelLeft,
    Pause,
    Play,
    Plus,
    RotateCcw,
    Settings2,
    X,
  } from '@lucide/svelte';
  import Header from './components/Header.svelte';
  import Inspector from './components/Inspector.svelte';
  import SlideRail from './components/SlideRail.svelte';
  import TacticsBoard from './components/TacticsBoard.svelte';
  import Toolbar from './components/Toolbar.svelte';
  import { CATEGORY_LABELS, type Tool } from './lib/types';
  import {
    activeTool,
    clearSelection,
    currentSlideId,
    deleteSelection,
    flash,
    notice,
    redo,
    resetSession,
    selectSlide,
    session,
    undo,
  } from './lib/stores/tactics';
  import { downloadBlob } from './lib/utils/board';

  let presentation = $state(false);
  let phasesOpen = $state(false);
  let inspectorOpen = $state(false);
  let inspectorCollapsed = $state(false);
  let playing = $state(false);
  let showHelp = $state(false);
  let zoom = $state(100);
  let boardSvg = $state<SVGSVGElement | null>(null);

  let currentSlide = $derived($session.slides.find((slide) => slide.id === $currentSlideId) ?? $session.slides[0]);
  let phaseIndex = $derived($session.slides.findIndex((slide) => slide.id === currentSlide.id));

  $effect(() => {
    if (!presentation || !playing) return;
    const timer = window.setTimeout(() => {
      const nextIndex = (phaseIndex + 1) % $session.slides.length;
      selectSlide($session.slides[nextIndex].id);
    }, 3400);
    return () => window.clearTimeout(timer);
  });

  function togglePresentation() {
    presentation = !presentation;
    phasesOpen = false;
    inspectorOpen = false;
    if (!presentation) playing = false;
    clearSelection();
  }

  function changePhase(direction: -1 | 1) {
    playing = false;
    const target = $session.slides[phaseIndex + direction];
    if (target) selectSlide(target.id);
  }

  function toggleInspector() {
    if (window.innerWidth < 1280) {
      inspectorCollapsed = false;
      inspectorOpen = !inspectorOpen;
    } else {
      inspectorCollapsed = !inspectorCollapsed;
    }
  }

  function closeInspector() {
    inspectorOpen = false;
    if (window.innerWidth >= 1280) inspectorCollapsed = true;
  }

  async function exportPng() {
    if (!boardSvg) return;
    flash('Preparing pitch image…');
    try {
      const clone = boardSvg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', '2100');
      clone.setAttribute('height', '1400');
      const source = new XMLSerializer().serializeToString(clone);
      const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 2100;
        canvas.height = 1400;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas unavailable');
        context.drawImage(image, 0, 0, 2100, 1400);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (blob) {
            downloadBlob(blob, `${currentSlide.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`);
            flash('Pitch image exported');
          }
        }, 'image/png');
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        flash('Image export failed. Try the JSON backup instead.');
      };
      image.src = url;
    } catch {
      flash('Image export failed. Try the JSON backup instead.');
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify($session, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'tikitactic-session.json');
    flash('Session backup exported');
  }

  function restoreExamples() {
    if (
      window.confirm(
        'Replace the current plan with the original example phases? Export a backup first if you want to keep your work.',
      )
    ) {
      resetSession();
      showHelp = false;
    }
  }

  function handleKeyboard(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const isEditing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
    const modifier = event.metaKey || event.ctrlKey;

    if (modifier && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (event.key === 'Escape') {
      showHelp = false;
      phasesOpen = false;
      inspectorOpen = false;
      playing = false;
      if (presentation) presentation = false;
      return;
    }
    if (isEditing) return;
    if (presentation && event.key === ' ') {
      event.preventDefault();
      playing = !playing;
      return;
    }
    if (presentation && event.key === 'ArrowRight') {
      event.preventDefault();
      changePhase(1);
      return;
    }
    if (presentation && event.key === 'ArrowLeft') {
      event.preventDefault();
      changePhase(-1);
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      deleteSelection();
      return;
    }
    const shortcuts: Record<string, Tool> = {
      v: 'select',
      r: 'run',
      p: 'pass',
      l: 'line',
      d: 'draw',
      z: 'zone',
      e: 'erase',
    };
    const tool = shortcuts[event.key.toLowerCase()];
    if (tool && !modifier) {
      activeTool.set(tool);
      clearSelection();
    }
    if (event.key === '?') showHelp = true;
  }
</script>

<svelte:window onkeydown={handleKeyboard} />

<div class:presentation class="app-shell">
  <Header
    {presentation}
    onpresent={togglePresentation}
    onexportpng={exportPng}
    onexportjson={exportJson}
    onhelp={() => (showHelp = true)}
  />

  <div class="workspace" class:inspector-hidden={inspectorCollapsed}>
    {#if !presentation}
      <SlideRail open={phasesOpen} onclose={() => (phasesOpen = false)} />
    {/if}

    <main class="board-workspace">
      <div class="workspace-topbar">
        <div class="phase-breadcrumb">
          {#if !presentation}<button
              class="icon-button mobile-panel-button"
              aria-label="Open phases"
              onclick={() => (phasesOpen = true)}><PanelLeft size={18} /></button
            >{/if}
          <span>{CATEGORY_LABELS[currentSlide.category]}</span>
          <strong>{currentSlide.title}</strong>
        </div>
        <div class="workspace-actions">
          <span class="phase-position"
            >PHASE {String(phaseIndex + 1).padStart(2, '0')} / {String($session.slides.length).padStart(2, '0')}</span
          >
          {#if !presentation}<button
              class="icon-button inspector-toggle"
              class:active={!inspectorCollapsed}
              aria-label={inspectorCollapsed ? 'Open inspector' : 'Toggle inspector'}
              title={inspectorCollapsed ? 'Open inspector' : 'Toggle inspector'}
              onclick={toggleInspector}><Settings2 size={18} /></button
            >{/if}
        </div>
      </div>

      <section class="board-stage" aria-label="Tactics drawing workspace">
        <div class="pitch-caption"><span class="live-dot"></span> ATTACKING LEFT → RIGHT</div>
        <TacticsBoard slide={currentSlide} {zoom} onsvg={(value) => (boardSvg = value)} />

        {#if presentation}
          <div class="presentation-controls">
            <button
              class="icon-button"
              aria-label="Previous phase"
              disabled={phaseIndex === 0}
              onclick={() => changePhase(-1)}><ChevronLeft size={22} /></button
            >
            <button
              class="icon-button deck-play"
              aria-label={playing ? 'Pause deck' : 'Play deck'}
              title={playing ? 'Pause deck' : 'Play deck'}
              disabled={$session.slides.length < 2}
              onclick={() => (playing = !playing)}
              >{#if playing}<Pause size={19} />{:else}<Play size={19} />{/if}</button
            >
            <div>
              <span>{String(phaseIndex + 1).padStart(2, '0')}</span><small
                >{playing ? 'Playing · Space to pause' : 'Play deck or use ← →'}</small
              >
            </div>
            <button
              class="icon-button"
              aria-label="Next phase"
              disabled={phaseIndex === $session.slides.length - 1}
              onclick={() => changePhase(1)}><ChevronRight size={22} /></button
            >
          </div>
        {:else}
          <Toolbar />
        {/if}

        <div class="zoom-control" aria-label="Board zoom">
          <button aria-label="Zoom out" disabled={zoom <= 80} onclick={() => (zoom = Math.max(80, zoom - 10))}
            ><Minus size={15} /></button
          >
          <button class="zoom-value" title="Reset zoom" onclick={() => (zoom = 100)}>{zoom}%</button>
          <button aria-label="Zoom in" disabled={zoom >= 140} onclick={() => (zoom = Math.min(140, zoom + 10))}
            ><Plus size={15} /></button
          >
        </div>
      </section>
    </main>

    {#if !presentation && !inspectorCollapsed}
      <Inspector slide={currentSlide} open={inspectorOpen} onclose={closeInspector} />
    {/if}
  </div>

  {#if phasesOpen || inspectorOpen}
    <button
      class="panel-backdrop"
      aria-label="Close side panel"
      onclick={() => {
        phasesOpen = false;
        inspectorOpen = false;
      }}
    ></button>
  {/if}
</div>

{#if $notice}
  <div class="toast" role="status"><span class="live-dot"></span>{$notice}</div>
{/if}

{#if showHelp}
  <div class="modal-layer">
    <button class="modal-backdrop" aria-label="Close help" onclick={() => (showHelp = false)}></button>
    <div class="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div class="modal-heading">
        <div>
          <span class="section-label">QUICK GUIDE</span>
          <h2 id="help-title">Coach at full speed.</h2>
        </div>
        <button class="icon-button" aria-label="Close help" onclick={() => (showHelp = false)}><X size={18} /></button>
      </div>
      <p class="help-intro">
        Build the session one phase at a time. Every board is independent, and your work autosaves in this browser.
      </p>
      <div class="shortcut-grid">
        <span>Select & drag</span><kbd>V</kbd><span>Curved run</span><kbd>R</kbd>
        <span>Pass</span><kbd>P</kbd><span>Straight line</span><kbd>L</kbd>
        <span>Freehand</span><kbd>D</kbd><span>Zone</span><kbd>Z</kbd>
        <span>Erase</span><kbd>E</kbd><span>Undo</span><kbd>⌘ / Ctrl Z</kbd>
      </div>
      <div class="help-tip">
        <Keyboard size={18} />
        <p>
          Select a player and use the arrow keys for precise one-metre adjustments. In Present mode, use left and right
          arrows to change phases, or press Space to play the deck with smooth transitions.
        </p>
      </div>
      <div class="help-footer">
        <button class="text-button" onclick={restoreExamples}><RotateCcw size={14} /> Restore example plan</button
        ><button class="button primary" onclick={() => (showHelp = false)}>Got it</button>
      </div>
    </div>
  </div>
{/if}
