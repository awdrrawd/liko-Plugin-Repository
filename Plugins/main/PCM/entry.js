import {PCM_VERSION} from './config.js';

window.Liko ??= {};

const existingBoot = window.Liko.__PCMBoot__;
if (existingBoot?.promise) {
  await existingBoot.promise;
} else if (window.Liko.PCM) {
  console.info(`[PCM] Existing PCM ${window.Liko.PCM} is already running; modular entry skipped.`);
} else {
  const boot = {version: PCM_VERSION, mode: 'module-compat', promise: null};
  window.Liko.__PCMBoot__ = boot;
  boot.promise = (async () => {
    try {
      // Keep the complete, proven 2.2.0 behaviour while the extracted services
      // become the long-term implementation behind the same public API.
      await import('./compat/core.js');
      if (!window.Liko.PCM) throw new Error('PCM compatibility core did not start');
      console.info(`[PCM] Modular ${PCM_VERSION} started with compatibility core.`);
      return window.Liko.PCMApi ?? window.Liko.PCM;
    } catch (error) {
      delete window.Liko.__PCMBoot__;
      console.error('[PCM] Modular startup failed.', error);
      throw error;
    }
  })();
  await boot.promise;
}
