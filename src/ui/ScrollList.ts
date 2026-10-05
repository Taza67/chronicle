import Phaser from "phaser";
import { COL_X, H, W } from "./theme.ts";

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
		// Anchored at the content column origin — children position in
		// column coordinates, the container shifts them under the mask.
		super(scene, COL_X, top);
		this.top = top;
		this.viewH = bottom - top;
		const mg = scene.make.graphics({ x: 0, y: 0 });
		mg.fillStyle(0xffffff);
		mg.fillRect(COL_X, top, W, this.viewH);
		this.setMask(mg.createGeometryMask());
		scene.add.existing(this);
		const onDown = (p: Phaser.Input.Pointer) => {
			if (p.y < top || p.y > bottom) return;
			this.dragging = true;
			this.startY = p.y;
			this.startScroll = this.y;
			this.vel = 0;
		};
		const onMove = (p: Phaser.Input.Pointer) => {
			if (!this.dragging) return;
			const ny = this.startScroll + (p.y - this.startY);
			this.vel = ny - this.y;
			this.y = ny;
		};
		const onUp = () => {
			this.dragging = false;
		};
		const onWheel = (_p: unknown, _o: unknown, _dx: number, dy: number) => {
			this.y -= dy;
			this.clamp();
		};
		scene.input.on(Phaser.Input.Events.POINTER_DOWN, onDown);
		scene.input.on(Phaser.Input.Events.POINTER_MOVE, onMove);
		scene.input.on(Phaser.Input.Events.POINTER_UP, onUp);
		scene.input.on(Phaser.Input.Events.POINTER_WHEEL, onWheel);
		scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
		this.once(Phaser.GameObjects.Events.DESTROY, () => {
			scene.input.off(Phaser.Input.Events.POINTER_DOWN, onDown);
			scene.input.off(Phaser.Input.Events.POINTER_MOVE, onMove);
			scene.input.off(Phaser.Input.Events.POINTER_UP, onUp);
			scene.input.off(Phaser.Input.Events.POINTER_WHEEL, onWheel);
			scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
		});
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
