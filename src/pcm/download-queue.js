export class DownloadQueue {
  constructor(limit = 3) {
    this.limit = limit;
    this.active = 0;
    this.waiting = [];
  }

  run(task, signal) {
    return new Promise((resolve, reject) => {
      const job = {task, resolve, reject, signal};
      const cancel = () => {
        const index = this.waiting.indexOf(job);
        if (index >= 0) this.waiting.splice(index, 1);
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      };
      job.detach = () => signal?.removeEventListener('abort', cancel);
      if (signal?.aborted) { cancel(); return; }
      signal?.addEventListener('abort', cancel, {once: true});
      this.waiting.push(job);
      this.drain();
    });
  }

  drain() {
    while (this.active < this.limit && this.waiting.length) {
      const job = this.waiting.shift();
      job.detach();
      this.active++;
      Promise.resolve().then(job.task).then(job.resolve, job.reject).finally(() => {
        this.active--;
        this.drain();
      });
    }
  }
}

// Shared by local/account/custom loads, retries and native script/module loads.
export const downloads = new DownloadQueue(3);
