import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class VerificationSelection {
  readonly id = signal<string | null>(null, { equal: () => false });
  open(id: string): void {
    this.id.set(id);
  }
}
