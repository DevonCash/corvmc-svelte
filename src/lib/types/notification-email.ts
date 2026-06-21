// Model for the generic `notification` Postmark template.
// One template renders every transactional notification; listeners supply
// the copy (subject, heading, body, details, CTA) as this model. The email
// body/subject therefore live in app code, not in Postmark.

export interface NotificationEmailDetail {
	label: string;
	value: string;
}

export interface NotificationEmailCta {
	url: string;
	label: string;
}

export interface NotificationEmailModel {
	/** Email subject line (rendered by the template's `{{subject}}`) */
	subject: string;
	/** Hidden preview text shown in the inbox list */
	preview_text?: string;
	/** Bold lead line at the top of the body */
	heading: string;
	/** Optional greeting line, e.g. "Hi Ada," */
	greeting?: string;
	/** Body paragraphs, rendered in order (inline HTML allowed) */
	paragraphs?: { text: string }[];
	/** Optional "Label: value" rows */
	details?: NotificationEmailDetail[];
	/** Optional call-to-action button */
	cta?: NotificationEmailCta;
	/** Optional small footnote below the body */
	footnote?: string;
}
