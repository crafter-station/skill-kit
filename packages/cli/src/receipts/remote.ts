const SSH_OPTIONS = [
	"-o",
	"BatchMode=yes",
	"-o",
	"ConnectTimeout=8",
	"-o",
	"StrictHostKeyChecking=accept-new",
];

const REMOTE_PATH =
	'export PATH="$HOME/.local/bin:$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"';

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function validateRemoteTarget(target: string): string {
	const parts = target.split("@");
	if (parts.length > 2) throw new Error("--remote target is invalid");
	const host = parts.at(-1)?.replace(/\.$/, "").toLowerCase();
	const user = parts.length === 2 ? parts[0] : undefined;
	if (
		!host ||
		!host.endsWith(".ts.net") ||
		!/^[a-z0-9.-]+$/.test(host) ||
		host.includes("..") ||
		host
			.split(".")
			.some((label) => !label || label.startsWith("-") || label.endsWith("-"))
	) {
		throw new Error("--remote requires a Tailscale MagicDNS *.ts.net target");
	}
	if (user && !/^[a-z_][a-z0-9_-]*$/i.test(user)) {
		throw new Error("--remote user is invalid");
	}
	return user ? `${user}@${host}` : host;
}

export function remoteReceiptArgs(args: string[]): string[] {
	if (args.includes("--annotate")) {
		throw new Error("--remote does not support --annotate");
	}
	const result = ["receipts", "--json"];
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (!arg) continue;
		if (arg === "--remote") {
			index++;
			continue;
		}
		if (arg === "--json") continue;
		if (["--all", "--pending"].includes(arg)) {
			result.push(arg);
			continue;
		}
		if (arg === "--limit") {
			const value = args[++index];
			if (!value || !/^\d+$/.test(value) || Number(value) < 1) {
				throw new Error("--limit requires a positive integer");
			}
			result.push(arg, value);
			continue;
		}
		if (arg === "--after") {
			const value = args[++index];
			if (!value || !/^ur_[a-f0-9]{24}$/.test(value)) {
				throw new Error("--after requires a valid receipt id");
			}
			result.push(arg, value);
			continue;
		}
		throw new Error(`Unsupported remote receipt option: ${arg}`);
	}
	return result;
}

export function remoteShellCommand(args: string[]): string {
	return `${REMOTE_PATH}; exec ${args.map(shellQuote).join(" ")}`;
}

export type RemoteRunner = (
	target: string,
	args: string[],
) => Promise<{ stdout: string; stderr: string }>;

async function runRemote(
	target: string,
	args: string[],
): Promise<{ stdout: string; stderr: string }> {
	const process = Bun.spawn(
		["ssh", ...SSH_OPTIONS, target, remoteShellCommand(args)],
		{
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const stdoutPromise = new Response(process.stdout).text();
	const stderrPromise = new Response(process.stderr).text();
	const [exitCode, stdout, stderr] = await Promise.all([
		process.exited,
		stdoutPromise,
		stderrPromise,
	]);
	if (exitCode !== 0) {
		const reason = stderr.trim().split("\n").at(-1) || `exit ${exitCode}`;
		throw new Error(`Remote Skillkit on ${target} failed: ${reason}`);
	}
	return { stdout, stderr };
}

export async function runRemoteReceipts(
	targetValue: string,
	args: string[],
	expectedVersion: string,
	runner: RemoteRunner = runRemote,
): Promise<void> {
	const target = validateRemoteTarget(targetValue);
	const receiptArgs = remoteReceiptArgs(args);
	const version = await runner(target, ["skillkit", "version"]);
	if (version.stdout.trim() !== expectedVersion) {
		throw new Error(
			`Remote Skillkit version ${version.stdout.trim() || "unknown"} does not match local ${expectedVersion}`,
		);
	}
	const scan = await runner(target, ["skillkit", "scan", "--quiet"]);
	if (scan.stderr.trim()) process.stderr.write(scan.stderr);
	const result = await runner(target, ["skillkit", ...receiptArgs]);
	let parsed: unknown;
	try {
		parsed = JSON.parse(result.stdout);
	} catch {
		throw new Error(`Remote Skillkit on ${target} returned invalid JSON`);
	}
	if (
		!parsed ||
		typeof parsed !== "object" ||
		(parsed as { schema_version?: unknown }).schema_version !== 1 ||
		(parsed as { visibility?: unknown }).visibility !== "private"
	) {
		throw new Error(
			`Remote Skillkit on ${target} returned an invalid receipt export`,
		);
	}
	if (result.stderr.trim()) process.stderr.write(result.stderr);
	process.stdout.write(
		result.stdout.endsWith("\n") ? result.stdout : `${result.stdout}\n`,
	);
}
