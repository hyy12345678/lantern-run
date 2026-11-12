# Requirements: Lantern Run

## Introduction
Lantern Run is a 2D top-down browser game. The player is a jack-o'-lantern carrying a
flame through a foggy village. The flame decays over time. Ghosts drain it on contact.
Candy restores it. The player clears three nights by reaching the church door with
enough candy. This document defines the MVP for the Kiroween 2026 submission.

## Glossary
- **Flame**: the lantern's light value, 0 to 100. The player loses when it reaches 0.
- **Candy**: a collectible that restores flame and counts toward the night's goal.
- **Ghost**: an enemy. Three behaviors: patrol, chase, blink.
- **Blow**: the player's ability that pushes nearby ghosts away.
- **Night**: one level. Has a candy goal and a church door at the end of the path.
- **Church door**: the exit. Reaching it with the goal met clears the night.
- **Run**: one full attempt from Night 1 until the flame goes out or Night 3 is cleared.

## Requirements

### Requirement 1: Game flow
**User story:** As a player, I want a clear start, play, and end flow, so that I can
start a run, retry, and see my result.

#### Acceptance criteria
1. WHEN the game loads THEN the system SHALL show a menu with a Start action and a best-score display.
2. WHEN the player starts a run THEN the system SHALL load Night 1 with the flame at 100 and candy at 0.
3. WHEN a night is cleared THEN the system SHALL load the next night, or show the result screen after Night 3.
4. WHEN the flame reaches 0 THEN the system SHALL show a fail screen and offer a retry of the current night.
5. WHEN the run ends THEN the system SHALL show the total score and a Play Again action.

### Requirement 2: Player movement
**User story:** As a player, I want to move smoothly on keyboard or touch, so that I can
dodge ghosts and reach the door.

#### Acceptance criteria
1. WHEN the player presses an arrow key or WASD THEN the system SHALL move the player in that direction at 120 px/s.
2. WHEN the player holds a touch joystick THEN the system SHALL move the player in the joystick direction at the same speed.
3. WHEN the player would move into a wall or obstacle THEN the system SHALL stop the player at the obstacle edge.
4. WHILE diagonal input is pressed THEN the system SHALL normalize the speed so diagonal movement is not faster than straight movement.

### Requirement 3: Flame
**User story:** As a player, I want the flame to decay over time, so that I must keep
moving and collecting candy.

#### Acceptance criteria
1. WHILE a night is running THEN the system SHALL decay the flame by 1.5 points per second.
2. WHEN the flame would fall below 0 or rise above 100 THEN the system SHALL clamp it to the range 0 to 100.
3. WHEN the flame reaches 0 THEN the system SHALL end the current attempt.
4. WHEN the flame is at or below 25 THEN the system SHALL show the low-flame warning style defined in the style guide.

### Requirement 4: Candy
**User story:** As a player, I want to collect candy, so that I can restore flame and
meet the night's goal.

#### Acceptance criteria
1. WHEN the player comes within 24 px of a candy THEN the system SHALL collect it.
2. WHEN candy is collected THEN the system SHALL add 15 flame, capped at 100, and increment the night candy count by 1.
3. WHEN candy is collected THEN the system SHALL remove that candy from the level.
4. WHEN a night starts THEN the system SHALL place candy at positions that are on walkable tiles and reachable from the start.

### Requirement 5: Ghosts
**User story:** As a player, I want ghosts that behave differently, so that each night
feels like a new challenge.

#### Acceptance criteria
1. WHEN a patrol ghost is active THEN the system SHALL move it back and forth along a fixed path at 40 px/s.
2. WHEN a chase ghost is within 160 px of the player THEN the system SHALL move it toward the player at 50 px/s.
3. WHEN a blink ghost's timer expires THEN the system SHALL teleport it to a random walkable tile within 200 px of the player, then wait 3 seconds.
4. WHEN a ghost touches the player THEN the system SHALL subtract 25 flame.
5. WHEN a ghost has damaged the player THEN the system SHALL ignore further contact from that ghost for 1 second.
6. WHEN a ghost would enter a wall THEN the system SHALL keep it on walkable tiles.

### Requirement 6: Blow ability
**User story:** As a player, I want a way to push ghosts away, so that I have a tactical
choice when they close in.

#### Acceptance criteria
1. WHEN the player presses Space or taps the blow button and the ability is ready THEN the system SHALL push every ghost within 120 px of the player 160 px away from the player.
2. WHEN a ghost pushed by the blow would enter a wall THEN the system SHALL stop the ghost at the wall.
3. WHEN the blow is used THEN the system SHALL start a 5-second cooldown.
4. WHILE the cooldown is running THEN the system SHALL show the remaining cooldown on the HUD and ignore blow input.
5. WHEN the blow is used THEN the system SHALL play the blow sound effect and show a visual pulse.

### Requirement 7: Nights and goals
**User story:** As a player, I want three nights with rising difficulty and clear goals,
so that I can see my progress.

#### Acceptance criteria
1. WHEN the game defines the nights THEN the system SHALL define exactly three nights.
2. WHEN a night is loaded THEN the system SHALL show its candy goal on the HUD: Night 1 needs 5, Night 2 needs 8, Night 3 needs 12.
3. WHEN the player reaches the church door with candy count at or above the goal THEN the system SHALL mark the night cleared.
4. WHEN the player reaches the church door with candy count below the goal THEN the system SHALL not clear the night and SHALL show how many more candies are needed.
5. WHEN a night is loaded THEN the system SHALL set the ghost count to 2 on Night 1, 3 on Night 2, and 4 on Night 3.
6. WHEN a night is generated from a seed THEN the system SHALL produce the same layout, candy positions, and ghost placement for that seed.

### Requirement 8: Scoring and best score
**User story:** As a player, I want a score and a saved best score, so that I have a
reason to replay.

#### Acceptance criteria
1. WHEN a candy is collected THEN the system SHALL add 1 point to the run score.
2. WHEN a night is cleared THEN the system SHALL add 10 points to the run score.
3. WHEN a run ends THEN the system SHALL save the run score to localStorage under the key `lanternRun.bestScore` if it is higher than the stored value.
4. IF localStorage is unavailable THEN the system SHALL still run the game and show the best score as unavailable.

### Requirement 9: Controls and pause
**User story:** As a player, I want to pause and mute, so that I can take a break and
control audio.

#### Acceptance criteria
1. WHEN the player presses Escape or P during a night THEN the system SHALL pause the night and show a pause menu.
2. WHEN the game loses focus or the browser tab is hidden THEN the system SHALL pause automatically.
3. WHEN the player toggles mute THEN the system SHALL silence all sound effects and remember the setting for the session.

### Requirement 10: Presentation and delivery
**User story:** As a judge, I want the game to look finished and load from a link, so
that I can evaluate it quickly.

#### Acceptance criteria
1. WHEN the production build is served from any sub-path THEN the system SHALL load all assets correctly.
2. WHEN the game is shown on screens from 360 px to 1920 px wide THEN the system SHALL scale the canvas to fit without cropping HUD text.
3. WHEN a night is running THEN the system SHALL render the HUD, fog, and lantern glow in the palette defined in the style guide.
4. WHEN the game ships THEN every third-party asset SHALL be listed in `public/assets/CREDITS.md` with its source and license.
