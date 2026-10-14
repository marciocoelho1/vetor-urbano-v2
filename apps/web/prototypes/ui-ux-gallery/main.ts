// Throwaway: six consultation alternatives on /?variant=1…6.
// This development entry is never imported by the production application.
import { bootstrapApplication } from '@angular/platform-browser';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { UiUxGallery } from './ui-ux-gallery';

document.documentElement.dataset['theme'] = 'light';
document.title = 'Vetor Urbano — galeria de propostas';
bootstrapApplication(UiUxGallery, {
  providers: [provideBrowserGlobalErrorListeners()],
}).catch((error) => console.error(error));
