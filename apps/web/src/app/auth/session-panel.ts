import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Session } from './session';

@Component({
  selector: 'app-session-panel',
  imports: [FormsModule],
  templateUrl: './session-panel.html',
  styleUrl: './session-panel.scss',
})
export class SessionPanel {
  protected readonly session = inject(Session);
  protected email = '';
  protected password = '';
  protected code = '';
  protected async login(): Promise<void> {
    const body = { email: this.email, password: this.password };
    this.password = '';
    await this.session.perform('login', body);
    this.focus();
  }
  protected async verify(): Promise<void> {
    const code = this.code;
    this.code = '';
    await this.session.perform('mfa/verification', { code });
    this.focus();
  }
  protected async enroll(): Promise<void> {
    await this.session.perform('mfa/enrollment', {});
    this.focus();
  }
  private focus(): void {
    setTimeout(() => document.getElementById('access-result')?.focus());
  }
}
