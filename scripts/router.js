export class Router {
  constructor() {
    this.routes = {};
    window.addEventListener('hashchange', () => this.dispatch());
  }

  on(pattern, handler) {
    this.routes[pattern] = handler;
  }

  navigate(path) {
    if (window.location.hash === '#' + path) {
      this.dispatch();
    } else {
      window.location.hash = path;
    }
  }

  current() {
    return window.location.hash.slice(1) || '/';
  }

  dispatch() {
    const hash = this.current();
    if (hash.startsWith('/entry/')) {
      const id = decodeURIComponent(hash.slice(7));
      if (this.routes['/entry/:id']) return this.routes['/entry/:id'](id);
    }
    if (hash.startsWith('/cat/')) {
      const type = decodeURIComponent(hash.slice(5));
      if (this.routes['/cat/:type']) return this.routes['/cat/:type'](type);
    }
    if (this.routes[hash]) return this.routes[hash]();
    if (this.routes['/']) return this.routes['/']();
  }

  start() { this.dispatch(); }
}
