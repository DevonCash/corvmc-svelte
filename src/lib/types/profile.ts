import { z } from 'zod';

export type DirectoryVisibility = 'hidden' | 'members' | 'public';

export const directoryContactSchema = z.object({
	email: z.string().optional(),
	phone: z.string().optional(),
	social: z.string().optional(),
	address: z.string().optional(),
	visibility: z.string().optional(),
}).nullable().default(null);

export type DirectoryContact = z.infer<typeof directoryContactSchema>;

export const profileLinkSchema = z.object({
	label: z.string(),
	url: z.string()
});

export const profileLinksSchema = z.array(profileLinkSchema).nullable().default(null);

export type ProfileLink = z.infer<typeof profileLinkSchema>;
