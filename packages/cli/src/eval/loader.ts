import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

export interface EvalCase {
	id: number;
	prompt: string;
	expected_output: string;
	expectations: string[];
	files: string[];
}

export interface EvalSuite {
	skill_name: string;
	evals: EvalCase[];
}

export function loadEvalSuite(evalsPath: string): EvalSuite {
	if (!existsSync(evalsPath)) {
		throw new Error(`Evals file not found: ${evalsPath}`);
	}

	const raw = readFileSync(evalsPath, "utf-8");
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error(`Invalid JSON in evals file: ${evalsPath}`);
	}

	const suite = parsed as Record<string, unknown>;

	if (typeof suite.skill_name !== "string" || !suite.skill_name) {
		throw new Error("evals.json must have a 'skill_name' string field");
	}

	if (!Array.isArray(suite.evals) || suite.evals.length === 0) {
		throw new Error("evals.json must have a non-empty 'evals' array");
	}

	const evals: EvalCase[] = [];
	for (const e of suite.evals) {
		const entry = e as Record<string, unknown>;
		if (typeof entry.id !== "number") {
			throw new Error(`Each eval must have a numeric 'id' field`);
		}
		if (typeof entry.prompt !== "string" || !entry.prompt) {
			throw new Error(`Eval ${entry.id}: 'prompt' must be a non-empty string`);
		}

		evals.push({
			id: entry.id,
			prompt: entry.prompt,
			expected_output: (entry.expected_output as string) ?? "",
			expectations: Array.isArray(entry.expectations)
				? (entry.expectations as string[])
				: [],
			files: Array.isArray(entry.files) ? (entry.files as string[]) : [],
		});
	}

	return { skill_name: suite.skill_name as string, evals };
}

export function resolveEvalsPath(skillPath: string): string {
	const candidates = [
		join(skillPath, "evals", "evals.json"),
		join(skillPath, "evals.json"),
	];

	for (const c of candidates) {
		if (existsSync(c)) return c;
	}

	throw new Error(
		`No evals.json found. Looked in:\n  ${candidates.join("\n  ")}`,
	);
}

export async function generateEvalSuite(
	skillPath: string,
	model = "claude-haiku-4-5",
): Promise<void> {
	const skillMdPath = join(skillPath, "SKILL.md");
	const skillContent = readFileSync(skillMdPath, "utf-8");

	const nameMatch = skillContent.match(/^name:\s*(.+)$/m);
	const skillName = nameMatch?.[1]?.trim() ?? "unnamed-skill";

	const prompt = `You are generating eval cases for a Claude Code skill.

SKILL.md CONTENT:
${skillContent.slice(0, 4000)}

Generate a JSON eval suite with 5 eval cases:
- 3 POSITIVE cases where the skill SHOULD fire and produce correct output
- 2 NEGATIVE cases where the skill should NOT fire (unrelated prompts)

For positive cases, write expectations like:
- "skill '${skillName}' fired"
- "tool 'X' was called" (based on what the skill does)

For negative cases, write expectations like:
- "no skill should fire"
- "skill '${skillName}' should NOT fire"

Respond with ONLY valid JSON matching this exact schema:
{
  "skill_name": "${skillName}",
  "evals": [
    {
      "id": 1,
      "prompt": "user prompt that should trigger the skill",
      "expected_output": "description of expected result",
      "expectations": ["skill '${skillName}' fired", "specific verifiable outcome"],
      "files": []
    }
  ]
}`;

	const env: Record<string, string> = {};
	for (const [k, v] of Object.entries(process.env)) {
		if (k !== "CLAUDECODE" && v !== undefined) env[k] = v;
	}

	const child = spawn(
		"claude",
		["-p", prompt, "--model", model, "--output-format", "json"],
		{ stdio: ["ignore", "pipe", "ignore"], env },
	);

	let output = "";
	const rl = createInterface({ input: child.stdout! });

	const result = await new Promise<string>((resolve, reject) => {
		let timer: ReturnType<typeof setTimeout>;
		rl.on("line", (line) => {
			output += line;
		});
		child.on("close", () => {
			clearTimeout(timer);
			resolve(output);
		});
		child.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
		timer = setTimeout(() => {
			child.kill("SIGTERM");
			reject(new Error("Eval generation timed out"));
		}, 120_000);
	});

	let parsed: unknown;
	try {
		const outer = JSON.parse(result);
		const inner = typeof outer === "object" && outer !== null && "result" in outer
			? (outer as Record<string, unknown>).result
			: outer;
		if (typeof inner === "string") {
			const jsonMatch = inner.match(/\{[\s\S]*\}/);
			parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(inner);
		} else {
			parsed = inner;
		}
	} catch {
		const jsonMatch = result.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			parsed = JSON.parse(jsonMatch[0]);
		} else {
			throw new Error("Could not parse generated evals JSON");
		}
	}

	const suite = parsed as Record<string, unknown>;
	if (!Array.isArray(suite.evals)) {
		throw new Error("Generated JSON missing 'evals' array");
	}

	const evalsDir = join(skillPath, "evals");
	mkdirSync(evalsDir, { recursive: true });
	writeFileSync(
		join(evalsDir, "evals.json"),
		JSON.stringify(parsed, null, 2),
	);
}
