<script lang="ts">
  import { ChevronDown, ChevronUp, Copy, Layers, Plus, Trash2, X } from '@lucide/svelte';
  import MiniPitch from './MiniPitch.svelte';
  import { CATEGORY_LABELS, CATEGORY_SHORT, type Category } from '../lib/types';
  import {
    currentSlideId,
    duplicateSlide,
    moveSlide,
    removeSlide,
    selectSlide,
    session,
    addSlide,
  } from '../lib/stores/tactics';

  type Filter = 'all' | Category;

  let { open = true, onclose }: { open?: boolean; onclose: () => void } = $props();
  let filter = $state<Filter>('all');
  let showAdd = $state(false);
  let newTitle = $state('');
  let newCategory = $state<Category>('buildup');
  let formError = $state('');

  let filteredSlides = $derived($session.slides.filter((slide) => filter === 'all' || slide.category === filter));

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'buildup', label: 'Build-up' },
    { id: 'defence', label: 'Defence' },
    { id: 'setpiece', label: 'Set pieces' },
  ];

  function openAdd() {
    newTitle = '';
    newCategory = 'buildup';
    formError = '';
    showAdd = true;
  }

  function submitSlide(event: SubmitEvent) {
    event.preventDefault();
    if (!newTitle.trim()) {
      formError = 'Give this phase a short title.';
      return;
    }
    addSlide(newTitle, newCategory);
    showAdd = false;
    filter = 'all';
  }

  function confirmRemove(id: string, title: string) {
    if (window.confirm(`Remove “${title}” from this plan?`)) removeSlide(id);
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      showAdd = false;
      if (open && window.innerWidth < 1100) onclose();
    }
  }
</script>

<svelte:window onkeydown={keydown} />

<aside class:open class="slide-rail" aria-label="Training phases">
  <div class="rail-heading">
    <div>
      <span class="section-label">SESSION PLAN</span>
      <h2>Phases <span>{$session.slides.length}</span></h2>
    </div>
    <button class="icon-button rail-close" aria-label="Close phases panel" onclick={onclose}><X size={18} /></button>
  </div>

  <div class="phase-filters" aria-label="Filter phases">
    {#each filters as item (item.id)}
      <button class:active={filter === item.id} onclick={() => (filter = item.id)}>{item.label}</button>
    {/each}
  </div>

  <div class="slide-list">
    {#each filteredSlides as slide (slide.id)}
      {@const actualIndex = $session.slides.findIndex((item) => item.id === slide.id)}
      <article class:active={$currentSlideId === slide.id} class="slide-item">
        <button
          class="slide-select"
          onclick={() => selectSlide(slide.id)}
          aria-current={$currentSlideId === slide.id ? 'step' : undefined}
        >
          <div class="thumbnail-wrap">
            <MiniPitch {slide} />
            <span class="slide-number">{String(actualIndex + 1).padStart(2, '0')}</span>
          </div>
          <div class="slide-copy">
            <span class="slide-category">{CATEGORY_SHORT[slide.category]}</span>
            <strong>{slide.title}</strong>
            <small>{slide.annotations.length} annotations · {slide.players.length} players</small>
          </div>
        </button>
        <div class="slide-actions">
          <button
            title="Move phase up"
            aria-label={`Move ${slide.title} up`}
            disabled={actualIndex === 0}
            onclick={() => moveSlide(slide.id, -1)}><ChevronUp size={14} /></button
          >
          <button
            title="Move phase down"
            aria-label={`Move ${slide.title} down`}
            disabled={actualIndex === $session.slides.length - 1}
            onclick={() => moveSlide(slide.id, 1)}><ChevronDown size={14} /></button
          >
          <button
            title="Duplicate phase"
            aria-label={`Duplicate ${slide.title}`}
            onclick={() => duplicateSlide(slide.id)}><Copy size={14} /></button
          >
          <button
            title="Remove phase"
            aria-label={`Remove ${slide.title}`}
            onclick={() => confirmRemove(slide.id, slide.title)}><Trash2 size={14} /></button
          >
        </div>
      </article>
    {:else}
      <div class="empty-filter">
        <Layers size={22} />
        <p>No phases in this category.</p>
        <button onclick={openAdd}>Add one now</button>
      </div>
    {/each}
  </div>

  <button class="add-phase" onclick={openAdd}><Plus size={17} /> Add phase</button>
  <p class="rail-footnote">Each phase keeps its own players, ball and drawings.</p>
</aside>

{#if showAdd}
  <div class="modal-layer" role="presentation">
    <button class="modal-backdrop" aria-label="Close add phase dialog" onclick={() => (showAdd = false)}></button>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="add-phase-title">
      <div class="modal-heading">
        <div>
          <span class="section-label">SESSION PLAN</span>
          <h2 id="add-phase-title">Add a phase</h2>
        </div>
        <button class="icon-button" aria-label="Close dialog" onclick={() => (showAdd = false)}><X size={18} /></button>
      </div>
      <form onsubmit={submitSlide}>
        <label class="field-label" for="phase-name">Phase title</label>
        <input id="phase-name" class="text-input" placeholder="e.g. High press · 4-1-3-2" bind:value={newTitle} />
        {#if formError}<p class="form-error" role="alert">{formError}</p>{/if}
        <label class="field-label" for="phase-category">Category</label>
        <select id="phase-category" class="text-input" bind:value={newCategory}>
          {#each Object.entries(CATEGORY_LABELS) as [value, label] (value)}
            <option {value}>{label}</option>
          {/each}
        </select>
        <p class="field-help">
          A 4-3-3 starting shape is included. You can move every player once the phase is created.
        </p>
        <div class="modal-actions">
          <button type="button" class="button secondary" onclick={() => (showAdd = false)}>Cancel</button><button
            class="button primary"
            type="submit"><Plus size={16} /> Create phase</button
          >
        </div>
      </form>
    </div>
  </div>
{/if}
