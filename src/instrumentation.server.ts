import * as Sentry from '@sentry/sveltekit';

Sentry.init({
	dsn: 'https://3b421fec8a5c7c5236b673d9ac5bdd9f@o4510014650384384.ingest.us.sentry.io/4511504553738240',

	tracesSampleRate: 1.0,

	// Enable logs to be sent to Sentry
	enableLogs: true

	// uncomment the line below to enable Spotlight (https://spotlightjs.com)
	// spotlight: import.meta.env.DEV,
});
