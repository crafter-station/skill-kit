const isTTY = process.stdout.isTTY ?? false;

function ansi(code: string, s: string): string {
	if (!isTTY) return s;
	return `${code}${s}\x1b[0m`;
}

export const green = (s: string) => ansi("\x1b[32m", s);
export const red = (s: string) => ansi("\x1b[31m", s);
export const yellow = (s: string) => ansi("\x1b[33m", s);
export const dim = (s: string) => ansi("\x1b[2m", s);
export const bold = (s: string) => ansi("\x1b[1m", s);
export const cyan = (s: string) => ansi("\x1b[36m", s);
export const emerald = (s: string) => ansi("\x1b[38;5;48m", s);
