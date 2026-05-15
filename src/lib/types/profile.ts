export type DirectoryVisibility = 'hidden' | 'members' | 'public';

export type DirectoryContact = {
	email?: string;
	phone?: string;
	social?: string;
};

export type ProfileLink = {
	label: string;
	url: string;
};
