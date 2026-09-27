import { cloneModel } from '../core/model.js';
import { V2_STORAGE_KEY } from '../core/migrate.js';

const HISTORY_LIMIT = 50;
const DEBOUNCE_MS = 350;

function hasLocalStorage() {
  return typeof localStorage !== 'undefined' && localStorage !== null;
}

export class Store {
  constructor(initialModel, opts = {}) {
    this.persistKey = opts.persistKey || V2_STORAGE_KEY;
    this.debounceMs = opts.debounceMs ?? DEBOUNCE_MS;
    this.onPersistError = opts.onPersistError || (() => {});
    this.onChange = opts.onChange || (() => {});
    this.past = [];
    this.present = cloneModel(initialModel);
    this.future = [];
    this._timer = null;
  }

  get state() {
    return this.present;
  }

  canUndo() {
    return this.past.length > 0;
  }

  canRedo() {
    return this.future.length > 0;
  }

  dispatch(action) {
    const next = action.apply(cloneModel(this.present));
    this.past.push(this.present);
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.present = next;
    this.future = [];
    this._afterChange();
    return this.present;
  }

  setUi(patch) {
    this.present = { ...this.present, ui: { ...this.present.ui, ...patch } };
    this._afterChange();
    return this.present;
  }

  undo({ keepUi = false } = {}) {
    if (!this.canUndo()) return this.present;
    const ui = this.present.ui;
    this.future.unshift(this.present);
    if (this.future.length > HISTORY_LIMIT) this.future.pop();
    this.present = this.past.pop();
    if (keepUi) this.present = { ...this.present, ui };
    this._afterChange();
    return this.present;
  }

  redo({ keepUi = false } = {}) {
    if (!this.canRedo()) return this.present;
    const ui = this.present.ui;
    this.past.push(this.present);
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.present = this.future.shift();
    if (keepUi) this.present = { ...this.present, ui };
    this._afterChange();
    return this.present;
  }

  _afterChange() {
    this.onChange(this.present);
    this._schedulePersist();
  }

  _schedulePersist() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this.persistNow(), this.debounceMs);
  }

  persistNow() {
    if (!hasLocalStorage()) return false;
    try {
      localStorage.setItem(this.persistKey, JSON.stringify(this.present));
      return true;
    } catch (e) {
      this.onPersistError(e);
      return false;
    }
  }

  static restore(persistKey = V2_STORAGE_KEY) {
    if (!hasLocalStorage()) return null;
    try {
      const raw = localStorage.getItem(persistKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
}
