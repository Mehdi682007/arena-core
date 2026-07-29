import { Injectable } from '@nestjs/common';
@Injectable()
export class RuntimeState {
  #shuttingDown = false;
  public beginShutdown(): void {
    this.#shuttingDown = true;
  }
  public get shuttingDown(): boolean {
    return this.#shuttingDown;
  }
}
