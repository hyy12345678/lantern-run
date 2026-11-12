# Requirements: Lantern Run (roguelike)

## Introduction
Lantern Run is a 2D top-down browser roguelike. The player is a jack-o'-lantern carrying a
flame through a run of four rooms. The flame decays over time. Ghosts drain it on contact.
Candy restores it. Clearing a trial room gives the player a choice of upgrades. The run ends
when the flame goes out or the Pumpkin King is driven back in the fourth room.

This document is the MVP for the Kiroween 2026 submission. It replaces the earlier three-night
structure. Features outside this document are stretch goals listed in `PLAN.md`.

## Decisions made in this version
- A run is four rooms: three trial rooms, then one boss room.
- Flame resets to 100 at the start of each room. Candy and flame do not carry over.
- Losing the flame ends the whole run. There is no retry of a single room.
- Each upgrade can be taken once per run. The choice happens after trial rooms only.
- Boss is defeated by reaching the door with the candy goal met (no separate damage system).

## Glossary
- **Flame**: the lantern's light value, 0 to 100. The player loses the run when it reaches 0.
- **Candy**: a collectible that restores flame and counts toward the room goal.
- **Ghost**: an enemy with one of three behaviors: patrol, chase, blink.
- **Blow**: the player's ability that pushes nearby ghosts away.
- **Room**: one playable level with a candy goal and a door. The run has four rooms.
- **Trial room**: rooms 1 to 3. Each has a theme and regular ghosts.
- **Boss room**: room 4. Contains the Pumpkin King and regular ghosts.
- **Door**: the exit. Reaching it with the candy goal met clears the room.
- **Theme**: visual style of a room (Graveyard, Chapel, Pumpkin Patch, Crypt). Themes change looks only.
- **Upgrade**: a permanent modifier for the rest of the run, chosen from three offers.
- **Run**: one full attempt from room 1 until the flame goes out or the boss room is cleared.

## Requirements

### Requirement 1: Run flow
**User story:** As a player, I want a clear start, progress, and end, so that each run has a
goal and a result.

#### Acceptance criteria
1. WHEN the game loads THEN the system SHALL show a menu with a Start action and the best score.
2. WHEN the player starts a run THEN the system SHALL load room 1 with flame 100, candy 0, no upgrades, and run score 0.
3. WHEN a trial room is cleared THEN the system SHALL show the upgrade choice, then load the next room after the player picks an upgrade.
4. WHEN the boss room is cleared THEN the system SHALL end the run as won and show the result screen.
5. WHEN the flame reaches 0 in any room THEN the system SHALL end the run as lost and show the result screen.
6. WHEN the result screen is shown THEN the system SHALL show rooms cleared (0 to 4), run score, the upgrades taken, and buttons for Play Again and Menu.

### Requirement 2: Player movement
**User story:** As a player, I want to move smoothly on keyboard or touch.

#### Acceptance criteria
1. WHEN the player presses an arrow key or WASD THEN the system SHALL move the player at the base speed of 120 px/s, modified by the Swift Feet upgrade.
2. WHEN the player holds a touch joystick THEN the system SHALL move the player in the joystick direction at the same speed.
3. WHEN the player would move into a wall or obstacle THEN the system SHALL stop the player at the obstacle edge.
4. WHILE diagonal input is pressed THEN the system SHALL normalize the speed so diagonal movement is not faster than straight movement.

### Requirement 3: Flame
**User story:** As a player, I want the flame to decay over time, so that I must keep moving and collecting candy.

#### Acceptance criteria
1. WHILE a room is running THEN the system SHALL decay the flame at the base rate of 1.5 points per second, modified by the Thick Wax upgrade.
2. WHEN the flame would fall below 0 or rise above 100 THEN the system SHALL clamp it to the range 0 to 100.
3. WHEN a room starts THEN the system SHALL set the flame to 100.
4. WHEN the flame is at or below 25 THEN the system SHALL show the low-flame warning style from the style guide.

### Requirement 4: Candy
**User story:** As a player, I want to collect candy, so that I can restore flame and meet the room goal.

#### Acceptance criteria
1. WHEN the player comes within 24 px of a candy THEN the system SHALL collect it.
2. WHEN candy is collected THEN the system SHALL add the restore amount to the flame, capped at 100. The base restore is 15, modified by the Bright Wick upgrade.
3. WHEN candy is collected THEN the system SHALL remove it from the room and increase the room candy count by 1.
4. WHEN a room is generated THEN the system SHALL place candy only on walkable tiles reachable from the start.

### Requirement 5: Ghosts
**User story:** As a player, I want ghosts with different behaviors, so that each room is a new challenge.

#### Acceptance criteria
1. WHEN a patrol ghost is active THEN the system SHALL move it along its fixed loop at 40 px/s.
2. WHEN a chase ghost is within 160 px of the player THEN the system SHALL move it toward the player at 50 px/s.
3. WHEN a blink ghost's timer expires THEN the system SHALL teleport it to a random walkable tile within 200 px of the player, then wait 3 seconds.
4. WHEN a ghost touches the player THEN the system SHALL subtract the ghost damage from the flame. The base damage is 25, modified by the Iron Pumpkin upgrade.
5. WHEN a ghost has damaged the player THEN the system SHALL ignore further contact from that ghost for 1 second.
6. WHEN a ghost would enter a wall THEN the system SHALL keep it on walkable tiles.

### Requirement 6: Blow ability
**User story:** As a player, I want a way to push ghosts away when they close in.

#### Acceptance criteria
1. WHEN the player presses Space or taps the blow button and the ability is ready THEN the system SHALL push every ghost within the blow radius 160 px away from the player. The base radius is 120 px, modified by Quick Breath.
2. WHEN a pushed ghost would enter a wall THEN the system SHALL stop the ghost at the wall.
3. WHEN the blow is used THEN the system SHALL start a cooldown. The base cooldown is 5 seconds, modified by Quick Breath.
4. WHILE the cooldown is running THEN the system SHALL show the remaining cooldown on the HUD and ignore blow input.
5. WHEN the blow is used THEN the system SHALL play the blow sound effect and show a visual pulse.

### Requirement 7: Rooms and goals
**User story:** As a player, I want four rooms with rising difficulty and clear goals.

#### Acceptance criteria
1. WHEN a run is created THEN the system SHALL define exactly four rooms: three trial rooms and one boss room.
2. WHEN a room is loaded THEN the system SHALL show its candy goal on the HUD: room 1 needs 5, room 2 needs 8, room 3 needs 10, boss room needs 10.
3. WHEN the player reaches the door with the candy count at or above the goal THEN the system SHALL clear the room.
4. WHEN the player reaches the door with the candy count below the goal THEN the system SHALL not clear the room and SHALL show how many more candies are needed.
5. WHEN a room is loaded THEN the system SHALL set the regular ghost count to 2 in room 1, 3 in room 2, 4 in room 3, and 2 in the boss room.
6. WHEN a room is generated from the run seed and room index THEN the system SHALL produce the same layout every time.

### Requirement 8: Themes
**User story:** As a player, I want each room to look different, so that the run feels varied.

#### Acceptance criteria
1. WHEN a trial room is generated THEN the system SHALL pick its theme from Graveyard, Chapel, and Pumpkin Patch using the run seed.
2. WHEN the boss room is generated THEN the system SHALL use the Crypt theme.
3. WHEN a theme is applied THEN the system SHALL change the floor, wall, border, and door colors and decorations only. Rules SHALL NOT change between themes.

### Requirement 9: Upgrades
**User story:** As a player, I want to choose upgrades between rooms, so that each run builds differently.

#### Acceptance criteria
1. WHEN the player has the upgrade pool THEN the system SHALL define exactly five upgrades: Bright Wick (candy restore 15 to 20), Swift Feet (speed 120 to 138 px/s), Quick Breath (blow radius 120 to 150 px and cooldown 5 to 3.5 s), Thick Wax (flame decay 1.5 to 1.125 per second), and Iron Pumpkin (ghost damage 25 to 15).
2. WHEN a trial room is cleared THEN the system SHALL offer three distinct upgrades the player does not already have. If fewer than three remain, it SHALL offer all remaining ones. If none remain, it SHALL skip the choice.
3. WHEN the player picks an upgrade THEN the system SHALL apply it for the rest of the run and load the next room.
4. WHEN the same run seed and room index are used THEN the system SHALL offer the same three upgrades.
5. WHEN the boss room is cleared THEN the system SHALL NOT offer upgrades.

### Requirement 10: Pumpkin King (boss)
**User story:** As a player, I want a boss at the end of the run that raises the stakes.

#### Acceptance criteria
1. WHEN the boss room is loaded THEN the system SHALL place the Pumpkin King on a walkable tile at least 8 tiles from the start.
2. WHILE the boss room is running THEN the system SHALL move the Pumpkin King toward the player at 55 px/s, regardless of distance.
3. WHEN the Pumpkin King touches the player THEN the system SHALL subtract 35 flame and ignore further contact from it for 1 second.
4. WHEN the boss room is cleared THEN the system SHALL show a message that the King retreats and end the run as won.

### Requirement 11: Scoring and best score
**User story:** As a player, I want a score and a saved best score, so that I have a reason to replay.

#### Acceptance criteria
1. WHEN a candy is collected THEN the system SHALL add 1 point to the run score.
2. WHEN a trial room is cleared THEN the system SHALL add 10 points to the run score.
3. WHEN the boss room is cleared THEN the system SHALL add 50 points to the run score.
4. WHEN a run ends THEN the system SHALL save the run score to localStorage under `lanternRun.bestScore` if it is higher than the stored value.
5. IF localStorage is unavailable THEN the system SHALL still run the game and show the best score as unavailable.

### Requirement 12: Controls and pause
**User story:** As a player, I want to pause and mute.

#### Acceptance criteria
1. WHEN the player presses Escape or P during a room THEN the system SHALL pause the room and show a pause menu.
2. WHEN the game loses focus or the browser tab is hidden THEN the system SHALL pause automatically.
3. WHEN the player toggles mute THEN the system SHALL silence all sound effects and keep the setting for the session.

### Requirement 13: Presentation and delivery
**User story:** As a judge, I want the game to look finished and load from a link.

#### Acceptance criteria
1. WHEN the production build is served from any sub-path THEN the system SHALL load all assets correctly.
2. WHEN the game is shown on screens from 360 px to 1920 px wide THEN the system SHALL scale the canvas to fit without cropping HUD text.
3. WHEN a room is running THEN the system SHALL show the room number out of 4, the theme name, the candy goal, and the upgrades the player holds.
4. WHEN the player moves from one room to the next THEN the system SHALL show a fade transition of about 400 ms.
5. WHEN the upgrade choice is shown THEN the system SHALL display three cards, each with a drawn icon, name, and one-line description.
6. WHEN the game ships THEN every third-party asset SHALL be listed in `public/assets/CREDITS.md` with its source and license.

## Out of scope for MVP
- Meta progression across runs (unlocks, persistent upgrades).
- Minions spawned by the boss.
- Minimap, endless mode, leaderboard server, accounts.
