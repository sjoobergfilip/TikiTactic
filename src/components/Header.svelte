<script lang="ts">
  import { Check, ChevronDown, Download, FileJson, HelpCircle, Image, Play, Redo2, Undo2, X } from '@lucide/svelte';
  import { future, past, redo, saveStatus, session, undo, updateSession } from '../lib/stores/tactics';

  interface Props {
    presentation: boolean;
    onpresent: () => void;
    onexportpng: () => void;
    onexportjson: () => void;
    onhelp: () => void;
  }

  let { presentation, onpresent, onexportpng, onexportjson, onhelp }: Props = $props();
  let exportOpen = $state(false);

  function exportAndClose(kind: 'png' | 'json') {
    exportOpen = false;
    if (kind === 'png') onexportpng();
    else onexportjson();
  }

  function handleKey(event: KeyboardEvent) {
    if (event.key === 'Escape') exportOpen = false;
  }
</script>

<svelte:window onkeydown={handleKey} />

<header class="app-header">
  <div class="brand" aria-label="TikiTactic">
    <span class="brand-mark"><span></span><span></span><span></span></span>
    <span class="brand-name">TIKITACTIC</span>
  </div>

  <div class="session-name">
    <input
      aria-label="Session title"
      value={$session.title}
      oninput={(event) =>
        updateSession((value) => {
          value.title = event.currentTarget.value;
        }, false)}
    />
    <span class="save-state" aria-live="polite">
      <Check size={12} strokeWidth={2} />
      {$saveStatus === 'saved' ? 'Saved locally' : 'Saving…'}
    </span>
  </div>

  <div class="header-actions">
    <div class="history-actions">
      <button class="icon-button" title="Undo (Ctrl/⌘ Z)" aria-label="Undo" disabled={$past.length === 0} onclick={undo}
        ><Undo2 size={18} /></button
      >
      <button
        class="icon-button"
        title="Redo (Ctrl/⌘ Shift Z)"
        aria-label="Redo"
        disabled={$future.length === 0}
        onclick={redo}><Redo2 size={18} /></button
      >
    </div>
    <button class="button secondary present-button" onclick={onpresent}>
      {#if presentation}<X size={16} />{:else}<Play size={16} />{/if}
      <span>{presentation ? 'Exit' : 'Present'}</span>
    </button>
    <div class="export-wrap">
      <button
        class="button primary"
        aria-expanded={exportOpen}
        aria-haspopup="menu"
        onclick={() => (exportOpen = !exportOpen)}
      >
        <Download size={16} /><span>Export</span><ChevronDown size={14} />
      </button>
      {#if exportOpen}
        <button class="menu-scrim" aria-label="Close export menu" onclick={() => (exportOpen = false)}></button>
        <div class="export-menu" role="menu">
          <span class="menu-label">TAKE IT WITH YOU</span>
          <button role="menuitem" onclick={() => exportAndClose('png')}
            ><Image size={17} /><span><strong>Pitch image</strong><small>High-resolution PNG</small></span></button
          >
          <button role="menuitem" onclick={() => exportAndClose('json')}
            ><FileJson size={17} /><span><strong>Session backup</strong><small>All phases as JSON</small></span></button
          >
        </div>
      {/if}
    </div>
    <button
      class="icon-button help-button"
      title="Keyboard shortcuts"
      aria-label="Help and keyboard shortcuts"
      onclick={onhelp}><HelpCircle size={18} /></button
    >
  </div>
</header>
