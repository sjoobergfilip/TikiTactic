import type { Annotation, Category, Player, Slide, TacticsSession, Team } from './types';

type PlayerSeed = [number, number, number, string];

const buildUpShape: PlayerSeed[] = [
  [1, 7, 34, 'GK'],
  [3, 24, 9, 'LB'],
  [4, 19, 25, 'LCB'],
  [5, 19, 43, 'RCB'],
  [2, 24, 59, 'RB'],
  [6, 37, 34, 'DM'],
  [8, 47, 20, 'LCM'],
  [10, 47, 48, 'RCM'],
  [11, 67, 10, 'LW'],
  [9, 70, 34, 'ST'],
  [7, 67, 58, 'RW'],
];

const midBlockShape: PlayerSeed[] = [
  [1, 7, 34, 'GK'],
  [3, 31, 10, 'LB'],
  [4, 27, 25, 'LCB'],
  [5, 27, 43, 'RCB'],
  [2, 31, 58, 'RB'],
  [6, 43, 17, 'LM'],
  [8, 40, 29, 'LCM'],
  [10, 40, 40, 'RCM'],
  [7, 43, 52, 'RM'],
  [9, 57, 27, 'ST'],
  [11, 57, 42, 'ST'],
];

const restDefenceShape: PlayerSeed[] = [
  [1, 7, 34, 'GK'],
  [3, 54, 8, 'LB'],
  [4, 31, 25, 'LCB'],
  [5, 31, 43, 'RCB'],
  [2, 54, 60, 'RB'],
  [6, 43, 34, 'DM'],
  [8, 47, 20, 'LCM'],
  [10, 47, 48, 'RCM'],
  [11, 76, 10, 'LW'],
  [9, 79, 34, 'ST'],
  [7, 76, 58, 'RW'],
];

const opponentShape: PlayerSeed[] = [
  [1, 98, 34, 'GK'],
  [3, 82, 9, 'RB'],
  [4, 86, 25, 'RCB'],
  [5, 86, 43, 'LCB'],
  [2, 82, 59, 'LB'],
  [6, 71, 34, 'DM'],
  [8, 62, 20, 'RCM'],
  [10, 62, 48, 'LCM'],
  [11, 48, 10, 'RW'],
  [9, 45, 34, 'ST'],
  [7, 48, 58, 'LW'],
];

function players(prefix: string, team: Team, seeds: PlayerSeed[]): Player[] {
  return seeds.map(([number, x, y, role]) => ({ id: `${prefix}-${team}-${number}`, team, number, x, y, role }));
}

function annotation(
  id: string,
  type: Annotation['type'],
  points: { x: number; y: number }[],
  color = '#ef3327',
): Annotation {
  return { id, type, points, color };
}

function baseSlide(id: string, title: string, category: Category, notes: string, shape = buildUpShape): Slide {
  return {
    id,
    title,
    category,
    notes,
    players: [...players(id, 'home', shape), ...players(id, 'away', opponentShape)],
    annotations: [],
    ball: { x: 8.8, y: 34 },
  };
}

export function createInitialSession(): TacticsSession {
  const buildUp = baseSlide(
    'slide-buildup',
    'Build-up · 4-3-3',
    'buildup',
    'Create a free man behind the first line. The six stays connected while the weak-side full-back tucks in.',
  );
  buildUp.annotations = [
    annotation(
      'a-build-1',
      'pass',
      [
        { x: 9, y: 32 },
        { x: 18, y: 26 },
      ],
      '#e0e0e0',
    ),
    annotation('a-build-2', 'run', [
      { x: 37, y: 34 },
      { x: 49, y: 30 },
    ]),
    annotation('a-build-3', 'run', [
      { x: 66, y: 11 },
      { x: 78, y: 17 },
    ]),
    annotation(
      'a-build-4',
      'zone',
      [
        { x: 33, y: 23 },
        { x: 51, y: 45 },
      ],
      '#ecff0f',
    ),
  ];

  const defence = baseSlide(
    'slide-defence',
    'Mid-block · 4-4-2',
    'defence',
    'Protect the centre, curve the first press, and force circulation toward the touchline.',
    midBlockShape,
  );
  defence.ball = { x: 69, y: 34 };
  defence.annotations = [
    annotation('a-def-1', 'run', [
      { x: 57, y: 28 },
      { x: 65, y: 31 },
    ]),
    annotation('a-def-2', 'run', [
      { x: 57, y: 42 },
      { x: 65, y: 38 },
    ]),
    annotation(
      'a-def-3',
      'line',
      [
        { x: 39, y: 14 },
        { x: 39, y: 54 },
      ],
      '#e0e0e0',
    ),
    annotation(
      'a-def-4',
      'zone',
      [
        { x: 34, y: 23 },
        { x: 53, y: 45 },
      ],
      '#f44336',
    ),
  ];

  const corner = baseSlide(
    'slide-corner',
    'Corner · Near post',
    'setpiece',
    'Attack the near-post lane with two blockers. Keep three players ready for the second phase.',
    restDefenceShape,
  );
  const cornerHome = corner.players.filter((player) => player.team === 'home');
  const cornerSpots = [
    [78, 15],
    [88, 27],
    [94, 30],
    [91, 39],
    [84, 48],
    [74, 58],
    [70, 25],
    [68, 43],
    [94, 51],
    [99, 34],
    [55, 34],
  ];
  cornerHome.forEach((player, index) => {
    player.x = cornerSpots[index][0];
    player.y = cornerSpots[index][1];
  });
  corner.ball = { x: 102, y: 65 };
  corner.annotations = [
    annotation(
      'a-corner-1',
      'pass',
      [
        { x: 101, y: 64 },
        { x: 94, y: 31 },
      ],
      '#e0e0e0',
    ),
    annotation('a-corner-2', 'run', [
      { x: 88, y: 27 },
      { x: 95, y: 29 },
    ]),
    annotation('a-corner-3', 'run', [
      { x: 91, y: 39 },
      { x: 97, y: 38 },
    ]),
    annotation('a-corner-4', 'zone', [
      { x: 89, y: 25 },
      { x: 102, y: 42 },
    ]),
  ];

  const rest = baseSlide(
    'slide-rest',
    'Rest defence · 2+3',
    'buildup',
    'Keep the 2+3 behind the ball. Distances should stay short enough to counter-press immediately on turnover.',
    restDefenceShape,
  );
  rest.ball = { x: 78, y: 34 };
  rest.annotations = [
    annotation('a-rest-1', 'zone', [
      { x: 26, y: 15 },
      { x: 52, y: 53 },
    ]),
    annotation(
      'a-rest-2',
      'line',
      [
        { x: 43, y: 19 },
        { x: 43, y: 49 },
      ],
      '#e0e0e0',
    ),
    annotation('a-rest-3', 'run', [
      { x: 54, y: 8 },
      { x: 62, y: 14 },
    ]),
  ];

  return {
    version: 1,
    id: 'session-training',
    title: 'First team · Training plan',
    slides: [buildUp, defence, corner, rest],
    showRoles: true,
    smoothTransitions: true,
    showCorridors: false,
    updatedAt: new Date().toISOString(),
  };
}

export function createSlide(title: string, category: Category): Slide {
  const id = crypto.randomUUID();
  return baseSlide(id, title, category, '', buildUpShape);
}
