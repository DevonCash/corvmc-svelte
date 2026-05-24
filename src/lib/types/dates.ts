export type ISODateString = string & { readonly __brand: 'ISODateString' };

export function toISO(d: Date): ISODateString {
	return d.toISOString() as ISODateString;
}
