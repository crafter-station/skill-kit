import type { Database } from "bun:sqlite";
import type { ProgressReporter } from "../tui/progress";
import type { Invocation } from "./index";
import type { ScanCache } from "./scan-cache";

export type SessionFormat =
	| "jsonl-files"
	| "json-files"
	| "sqlite"
	| "vscode-state"
	| "none";

export interface ConnectorProbe {
	installed: boolean;
	sessionsFound: number;
	notes?: string;
}

export interface Connector {
	id: string;
	displayName: string;
	sessionFormat: SessionFormat;
	sessionSource: string;
	count(): number;
	scan(
		db: Database,
		trackedSet: Set<string>,
		knownSkills: Set<string>,
		cache: ScanCache,
		progress: ProgressReporter,
	): Promise<number> | number;
	probe?(): ConnectorProbe;
}

export function defineConnector(connector: Connector): Connector {
	return connector;
}
