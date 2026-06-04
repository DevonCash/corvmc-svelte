export const BAND_THEMES = [
	'default',
	'punk',
	'jazz',
	'metal',
	'indie',
	'electronic',
	'folk'
] as const;

export type BandTheme = (typeof BAND_THEMES)[number];

export interface MerchItem {
	title: string;
	url: string;
	imageKey?: string;
	price?: string;
}

export type Block =
	| {
			id: string;
			type: 'hero';
			imageKey: string;
			headline?: string;
			subtitle?: string;
			cssClass?: string;
	  }
	| { id: string; type: 'bio'; content: string; cssClass?: string }
	| { id: string; type: 'links'; style: 'buttons' | 'icons' | 'list'; cssClass?: string }
	| { id: string; type: 'members'; showPositions: boolean; cssClass?: string }
	| { id: string; type: 'events'; limit?: number; cssClass?: string }
	| { id: string; type: 'gallery'; imageKeys: string[]; downloadable?: boolean; cssClass?: string }
	| { id: string; type: 'embed'; platform: string; url: string; cssClass?: string }
	| { id: string; type: 'press'; cssClass?: string }
	| { id: string; type: 'achievements'; cssClass?: string }
	| { id: string; type: 'contact'; cssClass?: string }
	| { id: string; type: 'tech_rider'; cssClass?: string }
	| { id: string; type: 'custom_html'; content: string; cssClass?: string }
	| { id: string; type: 'merch'; items: MerchItem[]; cssClass?: string }
	| { id: string; type: 'spacer'; height: 'sm' | 'md' | 'lg'; cssClass?: string };

export interface BandEpk {
	bookingContact?: { name: string; email: string; phone?: string };
	managementContact?: { name: string; email: string; phone?: string };
	prContact?: { name: string; email: string };
	technicalRiderKey?: string;
	stagePlotKey?: string;
	backline?: BacklineItem[];
	pressQuotes?: PressQuote[];
	achievements?: string[];
}

export interface BacklineItem {
	instrument: string;
	details: string;
	provided: boolean;
}

export interface PressQuote {
	quote: string;
	publication: string;
	date?: string;
	url?: string;
}
