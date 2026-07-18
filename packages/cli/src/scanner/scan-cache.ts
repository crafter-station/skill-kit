import type { Database } from "bun:sqlite";
import { statSync } from "node:fs";

export class ScanCache {
	private known = new Map<string, string>();
	private pending: Array<[string, string]> = [];
	private force: boolean;

	constructor(
		private db: Database,
		options: { force?: boolean; salt?: string } = {},
	) {
		this.force = options.force ?? false;
		db.run(
			"CREATE TABLE IF NOT EXISTS scanned_files (path TEXT PRIMARY KEY, fingerprint TEXT NOT NULL)",
		);
		db.run(
			"CREATE TABLE IF NOT EXISTS scan_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
		);

		const salt = options.salt ?? "";
		const stored = db
			.query<{ value: string }, [string]>(
				"SELECT value FROM scan_meta WHERE key = ?",
			)
			.get("skills_salt");

		if (stored?.value !== salt) {
			db.run("DELETE FROM scanned_files");
			db.run(
				"INSERT INTO scan_meta (key, value) VALUES ('skills_salt', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
				[salt],
			);
		} else if (!this.force) {
			const rows = this.db
				.query<{ path: string; fingerprint: string }, []>(
					"SELECT path, fingerprint FROM scanned_files",
				)
				.all();
			for (const row of rows) {
				this.known.set(row.path, row.fingerprint);
			}
		}
	}

	shouldSkip(path: string): boolean {
		let fingerprint: string;
		try {
			const st = statSync(path);
			fingerprint = `${Math.floor(st.mtimeMs)}:${st.size}`;
		} catch {
			return false;
		}
		if (!this.force && this.known.get(path) === fingerprint) return true;
		this.pending.push([path, fingerprint]);
		return false;
	}

	flush(): void {
		if (this.pending.length === 0) return;
		const insert = this.db.prepare(
			"INSERT INTO scanned_files (path, fingerprint) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET fingerprint = excluded.fingerprint",
		);
		const tx = this.db.transaction((rows: Array<[string, string]>) => {
			for (const row of rows) insert.run(row[0], row[1]);
		});
		tx(this.pending);
		this.pending = [];
	}
}
