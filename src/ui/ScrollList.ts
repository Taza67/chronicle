import Phaser from "phaser";
import { H, W } from "./theme.ts";

/** Vertically scrollable container (touch drag + wheel) clipped to a viewport. */
export class ScrollList extends Phaser.GameObjects.Container {
	private contentH = 0;
	private startY = 0;
	private startScroll = 0;
	private dragging = false;
	private vel = 0;
	private readonly top: number;
	private readonly viewH: number;

	constructor(scene: Phaser.Scene, top: number, bottom: number) {
		super(scene, 0, top);
		this.top = top;
		this.viewH = bottom - top;
		const mg = scene.make.graphics({ x: 0, y: 0 });
		mg.fillStyle(0xffffff);
		mg.fillRect(0, top, W, this.viewH);
		this.setMask(mg.createGeometryMask());
		scene.add.existing(this);
		scene.input.on(
			Phaser.Input.Events.POINTER_DOWN,
			(p: Phaser.Input.Pointer) => {
				if (p.y < top || p.y > bottom) return;
				this.dragging = true;
				this.startY = p.y;
				this.startScroll = this.y;
				this.vel = 0;
			},
		);
		scene.input.on(
			Phaser.Input.Events.POINTER_MOVE,
			(p: Phaser.Input.Pointer) => {
				if (!this.dragging) return;
				const ny = this.startScroll + (p.y - this.startY);
				this.vel = ny - this.y;
				this.y = ny;
			},
		);
		scene.input.on(Phaser.Input.Events.POINTER_UP, () => {
			this.dragging = false;
		});
		scene.input.on(
			Phaser.Input.Events.POINTER_WHEEL,
			(_p: unknown, _o: unknown, _dx: number, dy: number) => {
				this.y -= dy;
				this.clamp();
			},
		);
		scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
	}

	setContentHeight(h: number) {
		this.contentH = h;
	}

	private clamp() {
		const min = Math.min(this.top, this.top + this.viewH - this.contentH - 20);
		this.y = Phaser.Math.Clamp(this.y, min, this.top);
	}

	private tick() {
		if (!this.dragging && Math.abs(this.vel) > 0.5) {
			this.y += this.vel;
			this.vel *= 0.92;
		}
		if (!this.dragging) this.clamp();
	}

	/** Did the pointer travel far enough to count as a scroll rather than a tap? */
	static isTap(p: Phaser.Input.Pointer) {
		return Math.abs(p.y - p.downY) < 12 && p.y > 0 && p.y < H;
	}
}
