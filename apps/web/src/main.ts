import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AccountPage } from './app/accounts/account-page';
import { App } from './app/app';

const entryUrl = new URL(location.href);
if (
  entryUrl.protocol === 'http:' &&
  entryUrl.hostname === 'localhost' &&
  entryUrl.port === '4201'
) {
  // A API local usa 127.0.0.1; SameSite=Strict exige o mesmo host antes do login.
  entryUrl.hostname = '127.0.0.1';
  location.replace(entryUrl.href);
} else {
  bootstrapApplication(
    ['127.0.0.1', 'localhost'].includes(location.hostname) &&
      new URLSearchParams(location.search).get('conta') === 'local'
      ? AccountPage
      : App,
    appConfig,
  ).catch((err) => console.error(err));
}
