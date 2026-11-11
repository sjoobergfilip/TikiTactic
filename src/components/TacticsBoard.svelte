<script lang="ts">
  import { onMount } from 'svelte';
  import type { Annotation, AnnotationType, Player, Point, Slide } from '../lib/types';
  import {
    activeTool,
    checkpoint,
    clearSelection,
    removeAnnotation,
    selectedAnnotationId,
    selectedPlayerId,
    session,
    updateSlide,
  } from '../lib/stores/tactics';
  import {
    clampPoint,
    distance,
    linePath,
    playerColor,
    playerTextColor,
    runPath,
    zoneBounds,
  } from '../lib/utils/board';

  interface Props {
    slide: Slide;
    zoom: number;
    onsvg: (svg: SVGSVGElement | null) => void;
  }

  type Interaction = {
    kind: 'player' | 'ball' | 'annotation';
    id?: string;
    pointerId: number;
    moved: boolean;
  };

  let { slide, zoom, onsvg }: Props = $props();
  let svg: SVGSVGElement;
  let interaction = $state<Interaction | null>(null);
  let playerOverrides = $state<Record<string, Point>>({});
  let ballOverride = $state<Point | null>(null);
  let isAnimating = $state(false);
  let animationFrame = 0;
  let previousSlide: Slide | null = null;

  onMount(() => {
    onsvg(svg);
    return () => {
      cancelAnimationFrame(animationFrame);
      onsvg(null);
    };
  });

  $effect(() => {
    const next = slide;
    const previous = previousSlide;
    if (previous?.id === next.id) {
      previousSlide = next;
      return;
    }
    previousSlide = next;
    if (previous && $session.smoothTransitions) startTransition(previous, next);
    else stopTransition();
  });

  function stopTransition() {
    cancelAnimationFrame(animationFrame);
    playerOverrides = {};
    ballOverride = null;
    isAnimating = false;
  }

  function startTransition(from: Slide, to: Slide) {
    stopTransition();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const starts: Record<string, Point> = {};
    for (const player of to.players) {
      const match =
        from.players.find((candidate) => candidate.team === player.team && candidate.number === player.number) ??
        from.players.find(
          (candidate) =>
            candidate.team === player.team && (candidate.name || candidate.role) === (player.name || player.role),
        );
      starts[player.id] = match ? { x: match.x, y: match.y } : { x: player.x, y: player.y };
    }
    playerOverrides = starts;
    ballOverride = { ...from.ball };
    isAnimating = true;
    let startedAt = 0;
    const duration = 900;
    const interpolate = (a: number, b: number, progress: number) => a + (b - a) * progress;

    const frame = (time: number) => {
      if (!startedAt) startedAt = time;
      const raw = Math.min(1, (time - startedAt) / duration);
      const eased = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      playerOverrides = Object.fromEntries(
        to.players.map((player) => {
          const start = starts[player.id];
          return [player.id, { x: interpolate(start.x, player.x, eased), y: interpolate(start.y, player.y, eased) }];
        }),
      );
      ballOverride = { x: interpolate(from.ball.x, to.ball.x, eased), y: interpolate(from.ball.y, to.ball.y, eased) };
      if (raw < 1) animationFrame = requestAnimationFrame(frame);
      else stopTransition();
    };
    animationFrame = requestAnimationFrame(frame);
  }

  function playerPosition(player: Player): Point {
    return playerOverrides[player.id] ?? player;
  }

  function currentBallPosition(): Point {
    return ballOverride ?? slide.ball;
  }

  function pointFromEvent(event: PointerEvent, shouldClamp = true): Point {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const local = point.matrixTransform(matrix.inverse());
    const raw = { x: local.x, y: local.y };
    return shouldClamp ? clampPoint(raw) : raw;
  }

  function capture(event: PointerEvent) {
    svg.setPointerCapture(event.pointerId);
  }

  function startPlayer(event: PointerEvent, player: Player) {
    if ($activeTool !== 'select' || isAnimating) return;
    event.stopPropagation();
    event.preventDefault();
    checkpoint();
    selectedPlayerId.set(player.id);
    selectedAnnotationId.set(null);
    interaction = { kind: 'player', id: player.id, pointerId: event.pointerId, moved: false };
    capture(event);
  }

  function startBall(event: PointerEvent) {
    if ($activeTool !== 'select' || isAnimating) return;
    event.stopPropagation();
    event.preventDefault();
    checkpoint();
    clearSelection();
    interaction = { kind: 'ball', pointerId: event.pointerId, moved: false };
    capture(event);
  }

  function startDrawing(event: PointerEvent) {
    if (event.button !== 0 || isAnimating) return;
    if ($activeTool === 'select') {
      clearSelection();
      return;
    }
    if ($activeTool === 'erase') return;
    const raw = pointFromEvent(event, false);
    if (raw.x < 0 || raw.x > 105 || raw.y < 0 || raw.y > 68) return;
    event.preventDefault();
    const start = clampPoint(raw);
    const type = $activeTool as AnnotationType;
    const id = crypto.randomUUID();
    const color = type === 'run' ? '#ef3327' : type === 'pass' || type === 'line' ? '#f1f2ed' : '#ecff0f';
    checkpoint();
    updateSlide(
      slide.id,
      (value) => {
        value.annotations.push({ id, type, color, points: [start, start] });
      },
      false,
    );
    selectedAnnotationId.set(id);
    selectedPlayerId.set(null);
    interaction = { kind: 'annotation', id, pointerId: event.pointerId, moved: false };
    capture(event);
  }

  function movePointer(event: PointerEvent) {
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    const point = pointFromEvent(event);
    interaction.moved = true;
    if (interaction.kind === 'player') {
      const playerId = interaction.id;
      updateSlide(
        slide.id,
        (value) => {
          const player = value.players.find((item) => item.id === playerId);
          if (player) Object.assign(player, point);
        },
        false,
      );
    } else if (interaction.kind === 'ball') {
      updateSlide(
        slide.id,
        (value) => {
          value.ball = point;
        },
        false,
      );
    } else {
      const annotationId = interaction.id;
      updateSlide(
        slide.id,
        (value) => {
          const item = value.annotations.find((entry) => entry.id === annotationId);
          if (!item) return;
          if (item.type === 'draw') {
            const last = item.points[item.points.length - 1];
            if (distance(last, point) > 0.65) item.points.push(point);
          } else {
            item.points = [item.points[0], point];
          }
        },
        false,
      );
    }
  }

  function endPointer(event: PointerEvent) {
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    if (interaction.kind === 'annotation') {
      const id = interaction.id;
      const item = slide.annotations.find((entry) => entry.id === id);
      if (item && item.points.length >= 2 && distance(item.points[0], item.points[item.points.length - 1]) < 0.8) {
        updateSlide(
          slide.id,
          (value) => {
            value.annotations = value.annotations.filter((entry) => entry.id !== id);
          },
          false,
        );
        selectedAnnotationId.set(null);
      }
    }
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    interaction = null;
  }

  function annotationDown(event: PointerEvent, item: Annotation) {
    if ($activeTool === 'erase') {
      event.stopPropagation();
      removeAnnotation(slide.id, item.id);
    } else if ($activeTool === 'select') {
      event.stopPropagation();
      selectedAnnotationId.set(item.id);
      selectedPlayerId.set(null);
    }
  }

  function annotationKey(event: KeyboardEvent, item: Annotation) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectedAnnotationId.set(item.id);
      selectedPlayerId.set(null);
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      removeAnnotation(slide.id, item.id);
    }
  }

  function playerKey(event: KeyboardEvent, player: Player) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectedPlayerId.set(player.id);
      selectedAnnotationId.set(null);
      return;
    }
    const moves: Record<string, Point> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    updateSlide(slide.id, (value) => {
      const target = value.players.find((item) => item.id === player.id);
      if (target) Object.assign(target, clampPoint({ x: target.x + move.x, y: target.y + move.y }));
    });
  }
</script>

<div class="pitch-viewport">
  <div class="pitch-canvas" style:width={`${zoom}%`}>
    <svg
      bind:this={svg}
      class="tactics-pitch tool-{$activeTool}"
      class:dragging={interaction !== null}
      class:animating={isAnimating}
      viewBox="-9 -7 123 82"
      role="img"
      aria-label={`${slide.title} tactics board. Drag players or use the drawing tools.`}
      onpointerdown={startDrawing}
      onpointermove={movePointer}
      onpointerup={endPointer}
      onpointercancel={endPointer}
    >
      <defs>
        <marker
          id="arrow-head"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
        >
          <path d="M0 0L8 4L0 8Z" fill="context-stroke" />
        </marker>
        <pattern id="pitch-stripes" width="15" height="68" patternUnits="userSpaceOnUse">
          <rect width="7.5" height="68" fill="#0b6b25" />
          <rect x="7.5" width="7.5" height="68" fill="#086020" />
        </pattern>
        <pattern id="stand-seats" width="3.4" height="3.4" patternUnits="userSpaceOnUse">
          <rect width="3.4" height="3.4" fill="#151a18" />
          <circle cx="0.9" cy="0.9" r="0.22" fill="#69716c" fill-opacity="0.55" />
          <circle cx="2.7" cy="2.5" r="0.16" fill="#d5d9d4" fill-opacity="0.28" />
        </pattern>
        <linearGradient id="stadium-depth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#3c5147" />
          <stop offset="0.42" stop-color="#182a22" />
          <stop offset="1" stop-color="#08140f" />
        </linearGradient>
        <linearGradient id="track-depth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#737e77" />
          <stop offset="0.5" stop-color="#505b54" />
          <stop offset="1" stop-color="#323c36" />
        </linearGradient>
        <radialGradient id="pitch-light" cx="0.48" cy="0.38" r="0.75">
          <stop offset="0" stop-color="#d8ffd8" stop-opacity="0.09" />
          <stop offset="0.7" stop-color="#062d16" stop-opacity="0.02" />
          <stop offset="1" stop-color="#031c10" stop-opacity="0.2" />
        </radialGradient>
      </defs>

      <rect x="-9" y="-7" width="123" height="82" rx="4" fill="url(#stand-seats)" />
      <path d="M-8-6H113L108-2H-4Z" fill="url(#stadium-depth)" />
      <path d="M-8-3L-4 1V72L-8 74Z" fill="url(#stadium-depth)" />
      <path d="M113-3L109 1V72L113 74Z" fill="url(#stadium-depth)" />
      <path d="M-7 73H112L108 75H-4Z" fill="#08140f" />
      <g fill="none" stroke="#a7b6ac" stroke-opacity="0.24" stroke-width="0.18">
        <path d="M-6-4.8H111M-5-3.8H110M-7-1V72M-5.8 0V72M112-1V72M110.8 0V72" />
      </g>
      <g fill="#ecff0f" fill-opacity="0.72">
        <circle cx="-5.8" cy="-5.3" r="0.35" /><circle cx="110.5" cy="-5.3" r="0.35" />
      </g>
      <rect x="-6.4" y="-4.6" width="117.8" height="77.2" rx="3" fill="url(#track-depth)" />
      <path d="M-5-4H111L108-2.8H-3Z" fill="#ffffff" fill-opacity="0.12" />
      <rect x="-3.8" y="-2.9" width="111.6" height="73.8" rx="1.4" fill="#e7e9e3" />
      <rect
        x="-2.7"
        y="-1.8"
        width="109.4"
        height="71.6"
        rx="0.8"
        fill="none"
        stroke="#d44338"
        stroke-width="0.35"
        stroke-dasharray="3 2"
      />
      <rect x="0.4" y="0.8" width="105" height="68" fill="#021a0e" fill-opacity="0.34" />
      <rect width="105" height="68" fill="url(#pitch-stripes)" />
      <rect width="105" height="68" fill="url(#pitch-light)" />

      {#if $session.showCorridors}
        <g class="corridor-overlay" pointer-events="none">
          <rect x="2" y="2" width="101" height="12.8" fill="#ffffff" fill-opacity="0.035" />
          <rect x="2" y="27.6" width="101" height="12.8" fill="#ffffff" fill-opacity="0.035" />
          <rect x="2" y="53.2" width="101" height="12.8" fill="#ffffff" fill-opacity="0.035" />
          <path
            d="M2 14.8H103M2 27.6H103M2 40.4H103M2 53.2H103"
            fill="none"
            stroke="#f1f2ed"
            stroke-opacity="0.62"
            stroke-width="0.25"
            stroke-dasharray="1.5 1"
          />
          <g fill="#ffffff" fill-opacity="0.55" font-family="Arial, sans-serif" font-size="1.6" font-weight="700">
            <text x="4" y="9.4">1</text><text x="4" y="22.2">2</text><text x="4" y="35">3</text><text x="4" y="47.8"
              >4</text
            ><text x="4" y="60.6">5</text>
          </g>
        </g>
      {/if}

      <g class="pitch-markings" fill="none" stroke="#f1f2ed" stroke-opacity="0.85" stroke-width="0.25">
        <rect x="2" y="2" width="101" height="64" />
        <path d="M52.5 2V66" />
        <circle cx="52.5" cy="34" r="9.15" />
        <circle cx="52.5" cy="34" r="0.35" fill="#f1f2ed" />
        <rect x="2" y="13.84" width="16.5" height="40.32" />
        <rect x="86.5" y="13.84" width="16.5" height="40.32" />
        <rect x="2" y="24.84" width="5.5" height="18.32" />
        <rect x="99.5" y="24.84" width="5.5" height="18.32" />
        <path d="M18.5 26.64A9.15 9.15 0 0 1 18.5 41.36" />
        <path d="M86.5 26.64A9.15 9.15 0 0 0 86.5 41.36" />
        <circle cx="13" cy="34" r="0.3" fill="#f1f2ed" />
        <circle cx="92" cy="34" r="0.3" fill="#f1f2ed" />
        <path d="M2 5A3 3 0 0 0 5 2M100 2A3 3 0 0 0 103 5M103 63A3 3 0 0 0 100 66M5 66A3 3 0 0 0 2 63" />
        <path d="M1.2 30.2H0V37.8H1.2M103.8 30.2H105V37.8H103.8" stroke-width="0.5" />
      </g>

      <g class="annotations" class:animating={isAnimating}>
        {#each slide.annotations as item (item.id)}
          {#if item.type === 'zone'}
            {@const box = zoneBounds(item.points)}
            <rect
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              fill={item.color}
              fill-opacity={$selectedAnnotationId === item.id ? 0.22 : 0.12}
              stroke={item.color}
              stroke-width={$selectedAnnotationId === item.id ? 0.42 : 0.3}
              stroke-dasharray="1.4 0.9"
              class="annotation zone-annotation"
              role="button"
              tabindex="0"
              aria-label={`${item.type} annotation`}
              onpointerdown={(event) => annotationDown(event, item)}
              onkeydown={(event) => annotationKey(event, item)}
            />
          {:else}
            {@const path = item.type === 'run' ? runPath(item.points) : linePath(item.points)}
            <path
              d={path}
              fill="none"
              stroke={item.color}
              stroke-width={$selectedAnnotationId === item.id ? 0.72 : 0.58}
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-dasharray={item.type === 'run' ? '2.2 1.45' : undefined}
              marker-end={item.type === 'run' || item.type === 'pass' ? 'url(#arrow-head)' : undefined}
              class="annotation"
            />
            <path
              d={path}
              fill="none"
              stroke="transparent"
              stroke-width="3"
              class="annotation-hit"
              role="button"
              tabindex="0"
              aria-label={`${item.type} annotation`}
              onpointerdown={(event) => annotationDown(event, item)}
              onkeydown={(event) => annotationKey(event, item)}
            />
          {/if}
        {/each}
      </g>

      <g class="players">
        {#each slide.players as player (player.id)}
          {@const position = playerPosition(player)}
          <g
            transform={`translate(${position.x} ${position.y})`}
            class="player {player.team}"
            class:selected={$selectedPlayerId === player.id}
            role="button"
            tabindex="0"
            aria-label={`${player.team === 'home' ? 'Home' : 'Opposition'} player ${player.name || player.role}, number ${player.number}`}
            onpointerdown={(event) => startPlayer(event, player)}
            onkeydown={(event) => playerKey(event, player)}
          >
            {#if $selectedPlayerId === player.id}
              <circle r="2.85" fill="none" stroke="#ecff0f" stroke-width="0.35" stroke-dasharray="1 0.6" />
            {/if}
            <ellipse cy="1.7" rx="2.1" ry="0.65" fill="#062d16" fill-opacity="0.48" />
            <circle r="2.25" fill={playerColor(player)} stroke="#14231c" stroke-opacity="0.5" stroke-width="0.25" />
            <ellipse cx="-0.5" cy="-0.85" rx="1.05" ry="0.5" fill="#ffffff" fill-opacity="0.22" />
            <circle r="2.25" fill="none" stroke="#ffffff" stroke-opacity="0.2" stroke-width="0.16" />
            <text
              text-anchor="middle"
              dominant-baseline="central"
              y="0.08"
              font-family="Arial, sans-serif"
              font-size="1.8"
              font-weight="700"
              fill={playerTextColor(player)}>{player.number}</text
            >
            {#if $session.showRoles}
              <text
                class="player-role"
                text-anchor="middle"
                y="-3.65"
                font-family="Arial, sans-serif"
                font-size="1.4"
                font-weight="700"
                letter-spacing="0.04"
                fill="#ffffff">{(player.name || player.role).toUpperCase()}</text
              >
            {/if}
          </g>
        {/each}
      </g>

      <g
        transform={`translate(${currentBallPosition().x} ${currentBallPosition().y})`}
        class="ball"
        role="button"
        tabindex="0"
        aria-label="Ball. Drag to move."
        onpointerdown={startBall}
      >
        <circle r="1.5" fill="transparent" />
        <circle cy="0.18" r="1.03" fill="#10241e" fill-opacity="0.4" />
        <circle r="1.03" fill="#f4f4ef" stroke="#2b2b2b" stroke-width="0.16" />
        <path d="M0-.42L.4-.13L.25.36H-.25L-.4-.13Z" fill="#2b2b2b" />
      </g>
    </svg>
  </div>
</div>
