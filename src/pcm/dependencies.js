import {getRepositoryBases} from './config.js';
import {fetchFirstText, isJavaScriptText} from './network.js';

const SERVICE_LOADS_KEY = '__PCMServiceLoads__';

export class DependencyLoader {
  constructor({global = window, documentRef = document, runtime = null} = {}) {
    this.global = global;
    this.document = documentRef;
    this.runtime = runtime;
    this.loads = global[SERVICE_LOADS_KEY] ??= new Map();
  }

  ensure({name, relativePath, ready}) {
    if (ready()) return Promise.resolve(true);
    if (this.loads.has(name)) return this.loads.get(name);
    const promise = this.load(relativePath)
      .then(() => {
        if (!ready()) throw new Error(`${name} loaded without exposing its expected API`);
        return true;
      })
      .catch(error => {
        this.loads.delete(name);
        this.runtime?.log('WARN', `Dependency failed: ${name}`, {error: String(error?.message || error)});
        throw error;
      });
    this.loads.set(name, promise);
    return promise;
  }

  async load(relativePath) {
    const bases = getRepositoryBases(this.global).plugins;
    const result = await fetchFirstText(bases.map(base => base + relativePath), {cache: 'no-store'}, isJavaScriptText);
    const script = this.document.createElement('script');
    script.dataset.pcmDependency = relativePath;
    script.textContent = `${result.text}\n//# sourceURL=${result.url}`;
    this.document.head.appendChild(script);
    return result.url;
  }

  async ensureCore() {
    const jobs = [];
    jobs.push(this.ensure({
      name: 'bcmodsdk',
      relativePath: 'expand/bcmodsdk.js',
      ready: () => Boolean(this.global.bcModSdk?.registerMod),
    }));
    jobs.push(this.ensure({
      name: 'i18n',
      relativePath: 'expand/BC_i18n.js',
      ready: () => typeof this.global.Liko?.__Sys_i18n__?.ensure === 'function',
    }));
    await Promise.allSettled(jobs);

    const optional = [
      ['toast', 'expand/BC_toast_system.user.js', () => Boolean(this.global.Liko?.__Sys_Toast__)],
      ['color', 'expand/BC_ThemeColorCheck.js', () => Boolean(this.global.Liko?.__Sys_ColorAPI__)],
      ['chat-buttons', 'expand/BC_ChatRoomButtons.js', () => Boolean(this.global.Liko?.__Sys_ChatRoomButtons__)],
    ];
    await Promise.allSettled(optional.map(([name, relativePath, ready]) => this.ensure({name, relativePath, ready})));
  }
}
