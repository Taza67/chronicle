import { defineConfig } from "vite";

// itch.io serves the zip from an arbitrary path → relative asset URLs.
export default defineConfig({
	base: "./",
	build: {
		target: "es2020",
		assetsInlineLimit: 0,
		rollupOptions: {
			output: {
				manualChunks: (id) =>
					id.includes("node_modules/phaser") ? "phaser" : undefined,
			},
		},
	},
	server: { host: true, port: 5173 },
});
