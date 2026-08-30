import { readFileSync } from "node:fs";
import pkg from "../../package.json";
import { getDb } from "../db/schema";
import { runRemoteReceipts } from "../receipts/remote";
import {
	annotateUsageReceipts,
	getUsageReceiptPage,
	iterateUsageReceipts,
	type ReceiptAnnotation,
	syncUsageReceipts,
} from "../receipts/store";
import { bold, cyan, dim } from "../tui/colors";

function parseLimit(args: string[]): number {
	const index = args.indexOf("--limit");
	if (index === -1) return 100;
	const value = Number(args[index + 1]);
	if (!Number.isInteger(value) || value < 1) {
		throw new Error("--limit requires a positive integer");
	}
	return value;
}

function parseAnnotations(path: string): ReceiptAnnotation[] {
	const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
	if (Array.isArray(parsed)) return parsed as ReceiptAnnotation[];
	return [parsed as ReceiptAnnotation];
}

function optionValue(args: string[], name: string): string | undefined {
	const index = args.indexOf(name);
	if (index === -1) return undefined;
	const value = args[index + 1];
	if (!value) throw new Error(`${name} requires a value`);
	return value;
}

export async function runReceiptsCommand(): Promise<void> {
	const args = process.argv.slice(3);
	const remote = optionValue(args, "--remote");
	if (remote) {
		await runRemoteReceipts(remote, args, pkg.version);
		return;
	}
	const db = getDb();
	const created = syncUsageReceipts(db);
	const annotateIndex = args.indexOf("--annotate");
	if (annotateIndex !== -1) {
		const path = args[annotateIndex + 1];
		if (!path) throw new Error("--annotate requires a JSON file");
		const annotations = parseAnnotations(path);
		annotateUsageReceipts(db, annotations);
		console.log(`Annotated ${annotations.length} usage receipt(s).`);
		return;
	}

	const limit = parseLimit(args);
	const all = args.includes("--all");
	const after = optionValue(args, "--after");
	const options = { pending: args.includes("--pending"), limit, after };
	const page = all ? null : getUsageReceiptPage(db, options);
	const receipts =
		page?.receipts ?? iterateUsageReceipts(db, { ...options, all });
	if (args.includes("--json")) {
		process.stdout.write(
			`{"schema_version":1,"visibility":"private","created_receipts":${created},"receipts":[`,
		);
		let shown = 0;
		for (const receipt of receipts) {
			const json = {
				...receipt,
				source_invocation_ids: JSON.parse(receipt.source_invocation_ids),
				evidence_handles: JSON.parse(receipt.evidence_handles),
			};
			process.stdout.write(`${shown > 0 ? "," : ""}${JSON.stringify(json)}`);
			shown++;
		}
		const nextCursor = page?.nextCursor ?? null;
		process.stdout.write(`],"next_cursor":${JSON.stringify(nextCursor)}}\n`);
		return;
	}

	const visible = [...receipts];
	console.log(`\n  ${bold("Usage receipts")} ${dim("private by default")}`);
	console.log(
		`  ${bold(visible.length.toLocaleString())} ${dim("shown")} ${cyan("·")} ${bold(created.toLocaleString())} ${dim("new")}`,
	);
	for (const receipt of visible) {
		console.log(
			`  ${cyan(receipt.skill_name)} ${dim(receipt.agent)} ${dim(receipt.outcome)} ${dim(receipt.receipt_id)}`,
		);
	}
	console.log();
}
