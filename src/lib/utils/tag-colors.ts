export type TagColor = 'orange' | 'teal' | 'red' | 'navy' | 'goldenrod';

export function tagToColor(tag: string): TagColor {
	const t = tag.toLowerCase();
	if (/workshop|class|open house|lesson/.test(t)) return 'orange';
	if (/open mic|jam|club|karaoke/.test(t)) return 'teal';
	if (/showcase|festival|battle/.test(t)) return 'red';
	if (/concert|performance|recital/.test(t)) return 'navy';
	return 'goldenrod';
}

export function tagToTapeColor(tag: string): string {
	const color = tagToColor(tag);
	if (color === 'goldenrod') return '';
	return `polaroid__tape--${color}`;
}

export function tagToStickerColor(tag: string): string {
	const color = tagToColor(tag);
	if (color === 'goldenrod') return '';
	return `sticker--${color}`;
}

export function tagToStubColor(tag: string): string {
	const color = tagToColor(tag);
	if (color === 'goldenrod') return '';
	return `stub--${color}`;
}

export type TapeColor = 'orange' | 'teal' | 'red' | 'navy' | '';

export function tagToTapeVariant(tag: string): TapeColor {
	const color = tagToColor(tag);
	if (color === 'goldenrod') return '';
	return color;
}
