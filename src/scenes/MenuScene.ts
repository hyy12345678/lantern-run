import Phaser from 'phaser';

// Placeholder title scene. Replaced by the real menu in the spec's tasks.
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2 - 40, 'Lantern Run', {
        fontFamily: 'sans-serif',
        fontSize: '64px',
        color: '#ff8a00',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 30, 'Scaffold ready. Press any key to continue.', {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: '#a58fbf',
      })
      .setOrigin(0.5);
  }
}
