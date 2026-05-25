declare module 'qrcode-svg' {
	interface QRCodeOptions {
		content: string;
		width?: number;
		height?: number;
		padding?: number;
		color?: string;
		background?: string;
		ecl?: 'L' | 'M' | 'Q' | 'H';
		join?: boolean;
	}
	export default class QRCode {
		constructor(options: QRCodeOptions);
		svg(): string;
	}
}
