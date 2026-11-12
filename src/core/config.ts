// All tuning values for Lantern Run. Units: pixels, seconds, or counts.
// Values must match .kiro/specs/lantern-run/design.md section 4.
// Upgrades change the base values below through `Modifiers` (see upgrades.ts).

// Map
export const TILE_SIZE = 32;
export const MAP_COLS = 30;
export const MAP_ROWS = 17;
export const WALL_DENSITY = 0.18;

// Run structure
export const ROOM_COUNT = 4;
export const BOSS_ROOM_INDEX = 4;
export const ROOM_CANDY_GOALS: readonly number[] = [5, 8, 10, 10];
export const ROOM_GHOST_COUNTS: readonly number[] = [2, 3, 4, 2];
/** Distance from the door center at which the player can clear a room. */
export const DOOR_REACH_RADIUS = 24;

// Movement and collision
export const PLAYER_SPEED = 120;
export const PLAYER_RADIUS = 10;
export const GHOST_RADIUS = 10;
/** Collision sweeps move at most this many pixels per sub-step. */
export const COLLISION_SUBSTEP_PX = 4;

// Flame
export const FLAME_START = 100;
export const FLAME_MAX = 100;
export const FLAME_MIN = 0;
export const FLAME_DECAY_PER_SEC = 1.5;
export const FLAME_LOW_THRESHOLD = 25;

// Candy
export const CANDY_PICKUP_RADIUS = 24;
export const CANDY_FLAME_RESTORE = 15;
export const CANDY_SPARE_COUNT = 3;
export const CANDY_MIN_TILE_DIST = 3;

// Regular ghosts
export const PATROL_SPEED = 40;
export const CHASE_SPEED = 50;
export const CHASE_TRIGGER_RADIUS = 160;
export const BLINK_INTERVAL_SEC = 3;
export const BLINK_RANGE = 200;
export const GHOST_CONTACT_RADIUS = 20;
export const GHOST_CONTACT_DAMAGE = 25;
export const GHOST_HIT_IMMUNITY_SEC = 1;
export const GHOST_MIN_TILE_DIST = 6;
export const PATROL_WAYPOINT_MIN = 2;
export const PATROL_WAYPOINT_MAX = 4;

// Blow ability
export const BLOW_RADIUS = 120;
export const BLOW_PUSH_DISTANCE = 160;
export const BLOW_COOLDOWN_SEC = 5;
/** Step size used when pushing a ghost so it stops at walls. */
export const BLOW_PUSH_STEP_PX = 2;

// Pumpkin King (boss, room 4 only)
export const BOSS_SPEED = 55;
export const BOSS_RADIUS = 14;
export const BOSS_CONTACT_RADIUS = 26;
export const BOSS_CONTACT_DAMAGE = 35;
export const BOSS_HIT_IMMUNITY_SEC = 1;
export const BOSS_MIN_TILE_DIST = 8;

// Upgrade values (applied on top of the base values above)
export const SWIFT_FEET_SPEED = 138;
export const BRIGHT_WICK_RESTORE = 20;
export const THICK_WAX_DECAY_PER_SEC = 1.125;
export const QUICK_BREATH_RADIUS = 150;
export const QUICK_BREATH_COOLDOWN_SEC = 3.5;
export const IRON_PUMPKIN_DAMAGE = 15;

// Scoring
export const SCORE_PER_CANDY = 1;
export const SCORE_PER_ROOM_CLEAR = 10;
export const SCORE_PER_BOSS_CLEAR = 50;
export const BEST_SCORE_KEY = 'lanternRun.bestScore';
