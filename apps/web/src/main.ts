import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AccountPage } from './app/accounts/account-page';
import { App } from './app/app';

bootstrapApplication(
  ['127.0.0.1', 'localhost'].includes(location.hostname) &&
    new URLSearchParams(location.search).get('conta') === 'local'
    ? AccountPage
    : App,
  appConfig,
).catch((err) => console.error(err));
