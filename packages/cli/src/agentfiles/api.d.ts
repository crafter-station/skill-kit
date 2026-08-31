export type AgentfilesJsonValue =
	| null
	| boolean
	| number
	| string
	| AgentfilesJsonValue[]
	| { [key: string]: AgentfilesJsonValue };

export interface AgentfilesTrace {
	traceId: string;
	timestamp: string;
	tokens: number;
	cost: number;
	duration: number;
	model: string;
}

export interface AgentfilesConflict {
	skillName: string;
	similarity: number;
}

export interface AgentfilesSnapshot {
	version: 1;
	generatedAt: string;
	dashboard: {
		stats: AgentfilesJsonValue;
		health: AgentfilesJsonValue;
		burn: AgentfilesJsonValue;
		context: AgentfilesJsonValue;
	};
	skills: Record<
		string,
		{
			traces: AgentfilesTrace[];
			conflicts: AgentfilesConflict[];
		}
	>;
}

export const AGENTFILES_SNAPSHOT_PATH: string;
export const AGENTFILES_SNAPSHOT_TEMP_PREFIX: string;
export function parseAgentfilesSnapshot(
	input: string,
): AgentfilesSnapshot | null;
export function loadAgentfilesSnapshot(
	path?: string,
): AgentfilesSnapshot | null;
export function clearAgentfilesSnapshotTemps(
	path?: string,
	minimumAgeMs?: number,
): void;
export function clearAgentfilesSnapshot(path?: string): void;
