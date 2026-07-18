import { dim } from "./colors";

export interface ProgressReporter {
	update(done: number, total: number): void;
	finish(): void;
}

export function createProgress(
	label: string,
	enabled: boolean,
): ProgressReporter {
	let lastRender = 0;
	let rendered = false;
	return {
		update(done: number, total: number): void {
			if (!enabled || total === 0) return;
			const now = Date.now();
			if (now - lastRender < 40 && done < total) return;
			lastRender = now;
			rendered = true;
			process.stdout.write(
				`\r\x1b[2K  ${dim(`Indexing ${label}`)} ${done}/${total}`,
			);
		},
		finish(): void {
			if (enabled && rendered) process.stdout.write("\r\x1b[2K");
		},
	};
}
