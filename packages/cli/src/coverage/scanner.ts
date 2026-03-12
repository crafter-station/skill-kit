import type { Database } from "bun:sqlite";
import type { TraceRow } from "../trace/store";
import type { ReferenceFile, SkillStructure } from "./parser";

export interface CoverageResult {
	skill: SkillStructure;
	tracesAnalyzed: number;
	referenceUsage: FileUsage[];
	scriptUsage: FileUsage[];
	activeLines: number;
	deadLines: number;
	utilizationPct: number;
}

export interface FileUsage {
	file: ReferenceFile;
	readCount: number;
	traceCount: number;
	totalTraces: number;
	isActive: boolean;
}

export function analyzeCoverage(
	skill: SkillStructure,
	db: Database,
): CoverageResult {
	const traces = db
		.query<TraceRow, [string]>(
			"SELECT * FROM skill_traces WHERE skill_name = ? ORDER BY timestamp DESC LIMIT 50",
		)
		.all(skill.name);

	const allFilesRead = new Map<string, number>();

	for (const trace of traces) {
		const filesRead: string[] = trace.files_read ? JSON.parse(trace.files_read) : [];
		for (const fp of filesRead) {
			allFilesRead.set(fp, (allFilesRead.get(fp) ?? 0) + 1);
		}
	}

	const referenceUsage = analyzeFileUsage(skill.referenceFiles, allFilesRead, traces.length);
	const scriptUsage = analyzeFileUsage(skill.scriptFiles, allFilesRead, traces.length);

	const activeRefLines = referenceUsage
		.filter((u) => u.isActive)
		.reduce((sum, u) => sum + u.file.lineCount, 0);
	const activeScriptLines = scriptUsage
		.filter((u) => u.isActive)
		.reduce((sum, u) => sum + u.file.lineCount, 0);

	const totalRefLines = skill.referenceFiles.reduce((s, f) => s + f.lineCount, 0);
	const totalScriptLines = skill.scriptFiles.reduce((s, f) => s + f.lineCount, 0);
	const totalAuxLines = totalRefLines + totalScriptLines;

	const activeLines = skill.totalLines + activeRefLines + activeScriptLines;
	const totalLines = skill.totalLines + totalAuxLines;
	const deadLines = totalLines - activeLines;

	return {
		skill,
		tracesAnalyzed: traces.length,
		referenceUsage,
		scriptUsage,
		activeLines,
		deadLines,
		utilizationPct: totalLines > 0 ? (activeLines / totalLines) * 100 : 100,
	};
}

function analyzeFileUsage(
	files: ReferenceFile[],
	allFilesRead: Map<string, number>,
	totalTraces: number,
): FileUsage[] {
	return files.map((file) => {
		let readCount = 0;
		let traceCount = 0;

		for (const [readPath, count] of allFilesRead) {
			if (
				readPath.includes(file.relativePath) ||
				file.relativePath.includes(readPath.split("/").pop() ?? "") ||
				readPath.endsWith(file.relativePath)
			) {
				readCount += count;
				traceCount++;
			}
		}

		return {
			file,
			readCount,
			traceCount,
			totalTraces,
			isActive: readCount > 0 || file.referencedInSkill,
		};
	});
}
