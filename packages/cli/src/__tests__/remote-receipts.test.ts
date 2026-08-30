import { describe, expect, it } from "bun:test";
import {
	remoteReceiptArgs,
	remoteShellCommand,
	runRemoteReceipts,
	validateRemoteTarget,
} from "../receipts/remote";

describe("remote receipts", () => {
	it("accepts only Tailscale MagicDNS targets", () => {
		expect(
			validateRemoteTarget("operator@build-mac.example-tailnet.ts.net."),
		).toBe("operator@build-mac.example-tailnet.ts.net");
		expect(() => validateRemoteTarget("build-mac.local")).toThrow(
			"Tailscale MagicDNS",
		);
		expect(() => validateRemoteTarget("bad user@host.tailnet.ts.net")).toThrow(
			"user is invalid",
		);
	});

	it("forwards only bounded read options", () => {
		expect(
			remoteReceiptArgs([
				"--remote",
				"host.tailnet.ts.net",
				"--all",
				"--pending",
				"--json",
			]),
		).toEqual(["receipts", "--json", "--all", "--pending"]);
		expect(() =>
			remoteReceiptArgs([
				"--remote",
				"host.tailnet.ts.net",
				"--annotate",
				"case.json",
			]),
		).toThrow("does not support --annotate");
		expect(() =>
			remoteReceiptArgs([
				"--remote",
				"host.tailnet.ts.net",
				"--after",
				"$(touch /tmp/nope)",
			]),
		).toThrow("valid receipt id");
	});

	it("quotes every remote command argument", () => {
		expect(remoteShellCommand(["skillkit", "receipts", "--all"])).toBe(
			"export PATH=\"$HOME/.local/bin:$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin\"; exec 'skillkit' 'receipts' '--all'",
		);
	});

	it("checks options and exact version before scanning", async () => {
		const calls: string[][] = [];
		const runner = async (_target: string, args: string[]) => {
			calls.push(args);
			return { stdout: "0.12.0\n", stderr: "" };
		};

		await expect(
			runRemoteReceipts(
				"host.tailnet.ts.net",
				["--remote", "host.tailnet.ts.net", "--all"],
				"0.13.0",
				runner,
			),
		).rejects.toThrow("does not match local 0.13.0");
		expect(calls).toEqual([["skillkit", "version"]]);

		calls.length = 0;
		await expect(
			runRemoteReceipts(
				"host.tailnet.ts.net",
				["--remote", "host.tailnet.ts.net", "--annotate", "case.json"],
				"0.13.0",
				runner,
			),
		).rejects.toThrow("does not support --annotate");
		expect(calls).toEqual([]);
	});
});
