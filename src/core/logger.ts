export interface LogEntry<T = unknown> {
  step: number;
  action: string;
  description?: string;
  data?: T;
}

export class ComputationLogger<T = unknown> {
  private logs: LogEntry<T>[] = [];
  private stepCounter = 0;

  public log(
    action: string,
    options?: Omit<LogEntry<T>, 'step' | 'action'>
  ): void {
    this.logs.push({
      step: ++this.stepCounter,
      action,
      ...options,
    });
  }

  public get history(): LogEntry<T>[] {
    return [...this.logs];
  }

  public clear(): void {
    this.logs = [];
    this.stepCounter = 0;
  }
}
