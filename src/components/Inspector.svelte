<script lang="ts">
  import { Info, MousePointer2, Trash2, UserPlus, Users, X } from '@lucide/svelte';
  import { CATEGORY_LABELS, type Category, type Team, type Slide } from '../lib/types';
  import {
    addPlayer,
    removeAnnotation,
    removePlayer,
    selectedAnnotationId,
    selectedPlayerId,
    session,
    updateSession,
    updateSlide,
  } from '../lib/stores/tactics';
  import { playerColor, playerTextColor } from '../lib/utils/board';

  let { slide, open = false, onclose }: { slide: Slide; open?: boolean; onclose: () => void } = $props();
  let selectedPlayer = $derived(slide.players.find((player) => player.id === $selectedPlayerId));
  let selectedAnnotation = $derived(slide.annotations.find((item) => item.id === $selectedAnnotationId));
  const colors = ['#ecff0f', '#e0e0e0', '#f44336', '#00aaff'];
  const playerColors = ['#ef3327', '#f1f2ed', '#f4c430', '#22c7d6', '#ecff0f', '#2b2b2b'];

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) onclose();
  }
</script>

<svelte:window onkeydown={keydown} />

<aside class:open class="inspector" aria-label="Phase and selection settings">
  <div class="inspector-heading">
    <div>
      <span class="section-label">WORKSPACE</span>
      <h2>Inspector</h2>
    </div>
    <button class="icon-button inspector-close" aria-label="Close inspector" onclick={onclose}><X size={18} /></button>
  </div>

  <div class="inspector-scroll">
    {#if selectedPlayer}
      <section class="inspector-section selection-section">
        <div class="section-title-row">
          <span class="section-label">SELECTED PLAYER</span><span
            class:away={selectedPlayer.team === 'away'}
            class="team-badge">{selectedPlayer.team === 'home' ? 'HOME' : 'OPP'}</span
          >
        </div>
        <div class="player-edit-heading">
          <span
            class="player-preview"
            style:background={playerColor(selectedPlayer)}
            style:color={playerTextColor(selectedPlayer)}>{selectedPlayer.number}</span
          >
          <div>
            <strong>{selectedPlayer.name || selectedPlayer.role}</strong><small>Drag on pitch or use arrow keys</small>
          </div>
        </div>
        <label class="field-label" for="player-name">Display name</label>
        <input
          id="player-name"
          class="text-input"
          placeholder={selectedPlayer.role}
          value={selectedPlayer.name ?? ''}
          onchange={(event) =>
            updateSlide(slide.id, (value) => {
              const player = value.players.find((item) => item.id === selectedPlayer.id);
              if (player) player.name = event.currentTarget.value.trim().slice(0, 18);
            })}
        />
        <div class="two-fields">
          <label
            ><span class="field-label">Number</span><input
              class="text-input"
              type="number"
              min="1"
              max="99"
              value={selectedPlayer.number}
              onchange={(event) =>
                updateSlide(slide.id, (value) => {
                  const player = value.players.find((item) => item.id === selectedPlayer.id);
                  if (player) player.number = Math.max(1, Math.min(99, Number(event.currentTarget.value)));
                })}
            /></label
          >
          <label
            ><span class="field-label">Role</span><input
              class="text-input"
              value={selectedPlayer.role}
              onchange={(event) =>
                updateSlide(slide.id, (value) => {
                  const player = value.players.find((item) => item.id === selectedPlayer.id);
                  if (player) player.role = event.currentTarget.value.toUpperCase().slice(0, 10);
                })}
            /></label
          >
        </div>
        <span class="field-label">Marker colour</span>
        <div class="color-swatches player-color-swatches">
          {#each playerColors as color (color)}
            <button
              class:active={playerColor(selectedPlayer) === color}
              style:background={color}
              aria-label={`Set player colour to ${color}`}
              onclick={() =>
                updateSlide(slide.id, (value) => {
                  const player = value.players.find((item) => item.id === selectedPlayer.id);
                  if (player) player.color = color;
                })}
            ></button>
          {/each}
          <label class="custom-color" title="Choose a custom colour">
            <input
              type="color"
              aria-label="Choose a custom player colour"
              value={playerColor(selectedPlayer)}
              oninput={(event) =>
                updateSlide(
                  slide.id,
                  (value) => {
                    const player = value.players.find((item) => item.id === selectedPlayer.id);
                    if (player) player.color = event.currentTarget.value;
                  },
                  false,
                )}
            />
            <span>Custom</span>
          </label>
        </div>
        <label class="field-label" for="player-team">Team</label>
        <select
          id="player-team"
          class="text-input"
          value={selectedPlayer.team}
          onchange={(event) =>
            updateSlide(slide.id, (value) => {
              const player = value.players.find((item) => item.id === selectedPlayer.id);
              if (player) {
                player.team = event.currentTarget.value as Team;
                player.color = undefined;
              }
            })}
        >
          <option value="home">Home · Red</option><option value="away">Opposition · White</option>
        </select>
        <button class="danger-button" onclick={() => removePlayer(slide.id, selectedPlayer.id)}
          ><Trash2 size={15} /> Remove player <kbd>Del</kbd></button
        >
      </section>
    {:else if selectedAnnotation}
      <section class="inspector-section selection-section">
        <span class="section-label">SELECTED ANNOTATION</span>
        <h3 class="selection-title">
          {selectedAnnotation.type === 'draw'
            ? 'Freehand line'
            : selectedAnnotation.type[0].toUpperCase() + selectedAnnotation.type.slice(1)}
        </h3>
        <span class="field-label">Colour</span>
        <div class="color-swatches">
          {#each colors as color (color)}
            <button
              class:active={selectedAnnotation.color === color}
              style:background={color}
              aria-label={`Set annotation colour to ${color}`}
              onclick={() =>
                updateSlide(slide.id, (value) => {
                  const item = value.annotations.find((entry) => entry.id === selectedAnnotation.id);
                  if (item) item.color = color;
                })}
            ></button>
          {/each}
        </div>
        <button class="danger-button" onclick={() => removeAnnotation(slide.id, selectedAnnotation.id)}
          ><Trash2 size={15} /> Remove annotation <kbd>Del</kbd></button
        >
      </section>
    {:else}
      <section class="inspector-section">
        <span class="section-label">PLAYERS</span>
        <div class="player-count">
          <Users size={18} /><span><strong>{slide.players.length}</strong> on the pitch</span>
        </div>
        <div class="add-player-grid">
          <button class="button secondary" onclick={() => addPlayer('home')}><UserPlus size={15} /> Home</button>
          <button class="button secondary" onclick={() => addPlayer('away')}><UserPlus size={15} /> Opposition</button>
        </div>
        <p class="field-help"><MousePointer2 size={13} /> Choose Select, then drag any player or the ball.</p>
      </section>
    {/if}

    <section class="inspector-section">
      <span class="section-label">PHASE DETAILS</span>
      <label class="field-label" for="inspector-title">Title</label>
      <input
        id="inspector-title"
        class="text-input"
        value={slide.title}
        onchange={(event) =>
          updateSlide(slide.id, (value) => {
            value.title = event.currentTarget.value;
          })}
      />
      <label class="field-label" for="inspector-category">Category</label>
      <select
        id="inspector-category"
        class="text-input"
        value={slide.category}
        onchange={(event) =>
          updateSlide(slide.id, (value) => {
            value.category = event.currentTarget.value as Category;
          })}
      >
        {#each Object.entries(CATEGORY_LABELS) as [value, label] (value)}<option {value}>{label}</option>{/each}
      </select>
      <label class="field-label" for="phase-notes">Coaching notes</label>
      <textarea
        id="phase-notes"
        class="text-input notes-input"
        rows="5"
        placeholder="Key principles, triggers, coaching points…"
        value={slide.notes}
        oninput={(event) =>
          updateSlide(
            slide.id,
            (value) => {
              value.notes = event.currentTarget.value;
            },
            false,
          )}></textarea>
    </section>

    <section class="inspector-section board-options">
      <span class="section-label">BOARD VIEW</span>
      <label class="toggle-row">
        <span><strong>Player names</strong><small>Show names or roles above markers</small></span>
        <input
          type="checkbox"
          checked={$session.showRoles}
          onchange={(event) =>
            updateSession((value) => {
              value.showRoles = event.currentTarget.checked;
            })}
        />
      </label>
      <label class="toggle-row">
        <span><strong>Five corridors</strong><small>Show the five attacking lanes</small></span>
        <input
          type="checkbox"
          checked={$session.showCorridors}
          onchange={(event) =>
            updateSession((value) => {
              value.showCorridors = event.currentTarget.checked;
            })}
        />
      </label>
      <label class="toggle-row">
        <span><strong>Smooth transitions</strong><small>Animate players between phases</small></span>
        <input
          type="checkbox"
          checked={$session.smoothTransitions}
          onchange={(event) =>
            updateSession((value) => {
              value.smoothTransitions = event.currentTarget.checked;
            })}
        />
      </label>
      <div class="board-facts"><span>Dimensions</span><strong>105 × 68 m</strong></div>
      <div class="board-facts"><span>Annotations</span><strong>{slide.annotations.length}</strong></div>
    </section>

    <div class="shortcut-note">
      <Info size={15} />
      <p>Press <kbd>V</kbd> for Select, <kbd>R</kbd> for Run, and <kbd>⌘/Ctrl Z</kbd> to undo.</p>
    </div>
  </div>
</aside>
