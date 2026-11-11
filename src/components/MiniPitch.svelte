<script lang="ts">
  import type { Slide } from '../lib/types';
  import { linePath, playerColor, runPath, zoneBounds } from '../lib/utils/board';

  let { slide }: { slide: Slide } = $props();
</script>

<svg class="mini-pitch" viewBox="0 0 105 68" aria-hidden="true">
  <rect width="105" height="68" fill="#0b6b25" />
  <g fill="none" stroke="#e0e0e0" stroke-opacity="0.38" stroke-width="0.45">
    <rect x="2" y="2" width="101" height="64" />
    <path d="M52.5 2V66" />
    <circle cx="52.5" cy="34" r="9.15" />
    <rect x="2" y="13.84" width="16.5" height="40.32" />
    <rect x="86.5" y="13.84" width="16.5" height="40.32" />
  </g>
  {#each slide.annotations as item (item.id)}
    {#if item.type === 'zone'}
      {@const box = zoneBounds(item.points)}
      <rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        fill={item.color}
        fill-opacity="0.13"
        stroke={item.color}
        stroke-width="0.65"
        stroke-dasharray="2 1"
      />
    {:else}
      <path
        d={item.type === 'run' ? runPath(item.points) : linePath(item.points)}
        fill="none"
        stroke={item.color}
        stroke-width="0.85"
        stroke-dasharray={item.type === 'run' ? '2 1' : undefined}
      />
    {/if}
  {/each}
  {#each slide.players as player (player.id)}
    <circle cx={player.x} cy={player.y} r="1.65" fill={playerColor(player)} stroke="#2b2b2b" stroke-width="0.35" />
  {/each}
  <circle cx={slide.ball.x} cy={slide.ball.y} r="0.8" fill="#e0e0e0" />
</svg>
