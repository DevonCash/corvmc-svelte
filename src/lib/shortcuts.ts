export interface ParsedShortcut {
	mod: boolean;
	ctrl: boolean;
	shift: boolean;
	alt: boolean;
	key: string;
}

export function parseShortcut(shortcut: string): ParsedShortcut {
	const parts = shortcut.toLowerCase().split('+');
	const key = parts.pop()!;
	return {
		mod: parts.includes('mod'),
		ctrl: parts.includes('ctrl'),
		shift: parts.includes('shift'),
		alt: parts.includes('alt'),
		key
	};
}

export function matchesShortcut(e: KeyboardEvent, parsed: ParsedShortcut): boolean {
	if (parsed.mod && !(e.metaKey || e.ctrlKey)) return false;
	if (parsed.ctrl && !e.ctrlKey) return false;
	if (parsed.shift && !e.shiftKey) return false;
	if (parsed.alt && !e.altKey) return false;
	return e.key.toLowerCase() === parsed.key;
}

export function isModifierKey(e: KeyboardEvent, parsed: ParsedShortcut): boolean {
	if (parsed.mod) return e.key === 'Meta' || e.key === 'Control';
	if (parsed.ctrl) return e.key === 'Control';
	if (parsed.alt) return e.key === 'Alt';
	return false;
}

export function shortcutLabel(parsed: ParsedShortcut): string {
	return parsed.key.toUpperCase();
}
