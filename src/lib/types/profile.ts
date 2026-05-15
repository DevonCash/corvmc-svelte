import { z } from 'zod';

export type DirectoryVisibility = 'hidden' | 'members' | 'public';

export const directoryContactSchema = z.object({
	email: z.string().optional(),
	phone: z.string().optional(),
	social: z.string().optional()
}).default({});

export type DirectoryContact = z.infer<typeof directoryContactSchema>;

export const profileLinkSchema = z.object({
	label: z.string(),
	url: z.string()
});

export const profileLinksSchema = z.array(profileLinkSchema).default([]);

export type ProfileLink = z.infer<typeof profileLinkSchema>;
