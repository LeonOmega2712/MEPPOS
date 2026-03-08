import { Injectable } from '@angular/core';

const MINIMUM_DISPLAY_MS = 1200;
const MAXIMUM_DISPLAY_MS = 5000;

@Injectable({ providedIn: 'root' })
export class SplashService {
  private dismissed = false;
  private contentReadyResolve!: () => void;

  private readonly contentReady$ = new Promise<void>((resolve) => {
    this.contentReadyResolve = resolve;
  });

  private readonly minimumDelay$ = new Promise<void>((resolve) => {
    setTimeout(resolve, MINIMUM_DISPLAY_MS);
  });

  private readonly maxTimeout$ = new Promise<void>((resolve) => {
    setTimeout(resolve, MAXIMUM_DISPLAY_MS);
  });

  constructor() {
    this.waitAndDismiss();
  }

  contentReady(): void {
    this.contentReadyResolve();
  }

  private async waitAndDismiss(): Promise<void> {
    await Promise.race([
      Promise.all([this.minimumDelay$, this.contentReady$]),
      this.maxTimeout$,
    ]);
    this.dismiss();
  }

  private dismiss(): void {
    if (this.dismissed) return;
    this.dismissed = true;

    const splash = document.getElementById('splash-screen');
    if (!splash) return;

    splash.classList.add('splash-exit');

    const cleanup = () => splash.remove();
    splash.addEventListener('transitionend', cleanup, { once: true });
    setTimeout(cleanup, 500);
  }
}
