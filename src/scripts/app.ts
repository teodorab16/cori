import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { CATALOG, CONSENT } from '../config';
import { attribution, initTracking, isOptedOut, sessionId, setOptedOut, track } from './track';
import { retryOutbox, submitSignup, type SignupPayload } from './signup';

gsap.registerPlugin(Draggable, MotionPathPlugin);

type Vote = 'love' | 'pass';
type Method = 'swipe' | 'button' | 'key';

const PAPER = '#f5f3ee';
const INK = '#161514';
const HEART_PATH =
  'M12 20.5c-.4 0-.8-.1-1.1-.4C6.6 16.6 2.5 13.2 2.5 9 2.5 6.2 4.6 4 7.3 4c1.9 0 3.6 1 4.7 2.6C13.1 5 14.8 4 16.7 4c2.7 0 4.8 2.2 4.8 5 0 4.2-4.1 7.6-8.4 11.1-.3.3-.7.4-1.1.4z';
const HEART_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="${HEART_PATH}"></path></svg>`;

const DOMAIN_FIXES: Record<string, string> = {
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.co': 'hotmail.co.uk',
  'yahoo.co': 'yahoo.co.uk',
  'yaho.com': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'icloud.co': 'icloud.com',
  'iclod.com': 'icloud.com',
  'btinternet.co': 'btinternet.com',
};

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function q<T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
}

function qa<T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

function shuffle<T>(items: T[]): T[] {
  const a = items.slice();
  const r = new Uint32Array(1);
  for (let i = a.length - 1; i > 0; i--) {
    crypto.getRandomValues(r);
    const j = r[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A new random order on every page load, and never the same design first twice in a row,
// so whatever was on top last time can't anchor the next look.
function freshOrder(slugs: string[]): string[] {
  const order = shuffle(slugs);
  let lastFirst: string | null = null;
  try {
    lastFirst = localStorage.getItem('cori-last-first');
  } catch {
    /* storage blocked */
  }
  if (order.length > 1 && order[0] === lastFirst) {
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const j = 1 + (r[0] % (order.length - 1));
    [order[0], order[j]] = [order[j], order[0]];
  }
  try {
    localStorage.setItem('cori-last-first', order[0] ?? '');
  } catch {
    /* storage blocked */
  }
  return order;
}

function suggestEmail(value: string): string | null {
  const m = value.trim().toLowerCase().match(/^([^@\s]+)@([^@\s]+)$/);
  if (!m) return null;
  const fix = DOMAIN_FIXES[m[2]];
  return fix ? `${m[1]}@${fix}` : null;
}

function beat(el: Element | null): void {
  if (!el || reduceMotion()) return;
  gsap.fromTo(el, { scale: 1 }, { scale: 1.28, duration: 0.14, yoyo: true, repeat: 1, ease: 'power1.out' });
}

function introHeart(): void {
  const heart = document.querySelector('[data-wordmark="animated"] .wordmark__heart');
  if (!heart || reduceMotion()) return;
  try {
    if (sessionStorage.getItem('cori-intro')) return;
    sessionStorage.setItem('cori-intro', '1');
  } catch {
    /* play it anyway */
  }
  gsap
    .timeline({ delay: 0.2 })
    .fromTo(heart, { y: -42, opacity: 0, scaleX: 0.9, scaleY: 1.1 }, { y: 0, opacity: 1, duration: 0.36, ease: 'power2.in' })
    .to(heart, { scaleX: 1.35, scaleY: 0.65, duration: 0.08, ease: 'power1.out' })
    .to(heart, { scaleX: 1, scaleY: 1, duration: 0.65, ease: 'elastic.out(1, 0.45)' });
}

function initOptOut(): void {
  const btn = document.querySelector<HTMLButtonElement>('[data-optout]');
  if (!btn) return;
  const sync = () => btn.setAttribute('aria-pressed', String(isOptedOut()));
  sync();
  btn.addEventListener('click', () => {
    setOptedOut(!isOptedOut());
    sync();
  });
}

class VoteFlow {
  private readonly root: HTMLElement;
  private readonly deck: HTMLElement;
  private readonly catalog: string;
  private readonly base: string;
  private readonly cards: Map<string, HTMLElement>;
  private readonly order: string[];
  private readonly decisions = new Map<string, Vote>();
  private readonly history: { slug: string; vote: Vote }[] = [];
  private readonly viewed = new Set<string>();
  private readonly shotsSeen = new Set<string>();
  private readonly friendPick: string | null;
  private idx = 0;
  private top: string | null = null;
  private shownAt = 0;
  private formShownAt = 0;
  private busy = false;
  private devMode = false;
  private drag: Draggable | undefined;
  private viewTimer: number | undefined;
  private toastTimer: number | undefined;

  constructor(root: HTMLElement, catalog: string) {
    this.root = root;
    this.catalog = catalog;
    this.base = root.dataset.base || '/';
    this.deck = q('[data-deck]', root);

    const params = new URLSearchParams(location.search);
    const showSketches = root.dataset.showSketches === 'true' || params.has('preview');
    for (const card of qa('.card', this.deck)) {
      if (card.dataset.status === 'sketch' && !showSketches) card.remove();
    }
    const cards = qa('.card', this.deck);
    this.cards = new Map(cards.map((c) => [c.dataset.slug as string, c]));
    this.order = freshOrder([...this.cards.keys()]);

    const friend = params.get('ref') === 'share' ? params.get('d') : null;
    this.friendPick = friend && this.cards.has(friend) ? friend : null;
    if (this.friendPick) q('[data-friend-note]', root).hidden = false;

    document.documentElement.style.setProperty('--tint', PAPER);
    if (document.documentElement.dataset.accent === 'chameleon') document.documentElement.style.setProperty('--heart', INK);
    this.buildProgress();
    this.bindControls();
    this.bindForm();
    this.bindDone();

    track('deck_start', { order: this.order, n: this.order.length, friend: this.friendPick });
    if (this.order.length === 0) {
      this.showForm();
      return;
    }
    this.layout(false);
    this.activateTop();
  }

  // ---------- Deck ----------

  private layout(animate = true): void {
    this.order.forEach((slug, i) => {
      const card = this.cards.get(slug) as HTMLElement;
      const pos = i - this.idx;
      if (pos < 0) {
        card.setAttribute('aria-hidden', 'true');
        card.toggleAttribute('inert', true);
        return;
      }
      delete card.dataset.out;
      const isTop = pos === 0;
      card.style.zIndex = String(100 - pos);
      card.toggleAttribute('inert', !isTop);
      card.setAttribute('aria-hidden', String(!isTop));
      const depth = Math.min(pos, 2);
      const vars = {
        x: 0,
        y: depth * 12,
        scale: 1 - depth * 0.045,
        rotation: isTop ? 0 : pos % 2 ? 2.2 : -2,
        opacity: pos > 2 ? 0 : 1,
      };
      if (animate && !reduceMotion()) gsap.to(card, { ...vars, duration: 0.45, ease: 'power3.out', overwrite: 'auto' });
      else gsap.set(card, vars);
    });
  }

  private activateTop(): void {
    this.drag?.kill();
    this.drag = undefined;
    window.clearTimeout(this.viewTimer);
    this.updateProgress();
    const slug = this.order[this.idx];
    if (!slug) return;
    const card = this.cards.get(slug) as HTMLElement;
    this.setTint(card.dataset.tint || PAPER, card.dataset.heart);
    this.shownAt = performance.now();
    this.announce(`Design ${this.idx + 1} of ${this.order.length}: ${card.dataset.name}.`);
    this.whenLoaded(card, () => {
      this.viewTimer = window.setTimeout(() => {
        if (this.order[this.idx] === slug && !this.viewed.has(slug)) {
          this.viewed.add(slug);
          track('card_view', { design: slug, pos: this.idx + 1 });
        }
      }, 800);
    });
    this.makeDraggable(card);
  }

  private whenLoaded(card: HTMLElement, done: () => void): void {
    const img = card.querySelector<HTMLImageElement>('.card__shot.is-active img');
    if (!img || img.complete) done();
    else img.addEventListener('load', done, { once: true });
  }

  private makeDraggable(card: HTMLElement): void {
    const love = q('.stamp--love', card);
    const pass = q('.stamp--pass', card);
    const media = q('.card__media', card);
    let lastX = 0;
    let lastT = 0;
    let vx = 0;
    const flow = this;

    this.drag = Draggable.create(card, {
      type: 'x',
      dragClickables: true,
      minimumMovement: 6,
      zIndexBoost: false,
      onPress(this: Draggable) {
        lastX = this.x;
        lastT = performance.now();
        vx = 0;
      },
      onDrag(this: Draggable) {
        const now = performance.now();
        const dt = (now - lastT) / 1000 || 0.016;
        vx = (this.x - lastX) / dt;
        lastX = this.x;
        lastT = now;
        const w = card.offsetWidth;
        gsap.set(card, { rotation: (this.x / w) * 7 });
        const p = Math.max(-1, Math.min(1, this.x / (w * 0.28)));
        gsap.set(love, { opacity: Math.max(0, p) });
        gsap.set(pass, { opacity: Math.max(0, -p) });
      },
      onRelease(this: Draggable) {
        const w = card.offsetWidth;
        const x = this.x;
        const flick = Math.abs(vx) > 700 && Math.sign(vx) === Math.sign(x) && Math.abs(x) > 24;
        if (Math.abs(x) > w * 0.28 || flick) {
          flow.vote(x > 0 ? 'love' : 'pass', 'swipe');
        } else {
          gsap.to(card, { x: 0, rotation: 0, duration: 0.55, ease: 'elastic.out(1, 0.6)' });
          gsap.to([love, pass], { opacity: 0, duration: 0.2 });
        }
      },
      onClick(this: Draggable, event: MouseEvent | TouchEvent | PointerEvent) {
        const target = event.target as HTMLElement;
        if (target.closest('button')) return;
        const point = 'changedTouches' in event ? event.changedTouches[0] : event;
        const r = media.getBoundingClientRect();
        if (point.clientY < r.top || point.clientY > r.bottom) return;
        flow.stepShot(card, point.clientX < r.left + r.width * 0.4 ? -1 : 1);
      },
    })[0];
  }

  private stepShot(card: HTMLElement, dir: number): void {
    const shots = qa('.card__shot', card);
    if (shots.length < 2) return;
    const current = shots.findIndex((s) => s.classList.contains('is-active'));
    const next = Math.max(0, Math.min(shots.length - 1, current + dir));
    if (next === current) {
      if (!reduceMotion()) gsap.fromTo(card, { x: 0 }, { x: dir * 8, duration: 0.08, yoyo: true, repeat: 1 });
      return;
    }
    shots.forEach((s, i) => s.classList.toggle('is-active', i === next));
    qa('.card__bar', card).forEach((b, i) => b.classList.toggle('is-active', i === next));
    q('[data-shot-label]', card).textContent = String(next + 1);
    const slug = card.dataset.slug as string;
    const key = `${slug}:${next}`;
    // Photo 0 is the card face, already counted by card_view.
    if (next > 0 && !this.shotsSeen.has(key)) {
      this.shotsSeen.add(key);
      track('image_view', { design: slug, shot: next });
    }
  }

  vote(vote: Vote, method: Method): void {
    const slug = this.order[this.idx];
    if (this.busy || !slug) return;
    this.busy = true;
    window.setTimeout(() => (this.busy = false), 220);

    const card = this.cards.get(slug) as HTMLElement;
    this.drag?.kill();
    this.drag = undefined;
    window.clearTimeout(this.viewTimer);
    if (!this.viewed.has(slug)) {
      this.viewed.add(slug);
      track('card_view', { design: slug, pos: this.idx + 1, early: true });
    }
    this.decisions.set(slug, vote);
    this.history.push({ slug, vote });
    track('vote', { design: slug, pos: this.idx + 1, value: vote, method, ms: Math.round(performance.now() - this.shownAt) });

    const dir = vote === 'love' ? 1 : -1;
    const markOut = () => {
      if (this.order.indexOf(slug) < this.idx) card.dataset.out = '';
    };
    if (vote === 'love') this.flyHeart(card);
    if (reduceMotion()) {
      gsap.to(card, { opacity: 0, duration: 0.15, onComplete: markOut });
    } else {
      gsap.to(q(vote === 'love' ? '.stamp--love' : '.stamp--pass', card), { opacity: 1, duration: 0.12 });
      gsap.to(card, {
        x: dir * (window.innerWidth * 0.7 + card.offsetWidth),
        y: '+=30',
        rotation: dir * 10,
        duration: 0.42,
        ease: 'power2.in',
        overwrite: 'auto',
        onComplete: markOut,
      });
    }

    this.idx += 1;
    this.updateFavCount();
    this.announce(vote === 'love' ? `Loved ${card.dataset.name}.` : `Passed on ${card.dataset.name}.`);
    if (this.idx >= this.order.length) {
      this.hideToast();
      this.updateProgress();
      window.setTimeout(() => this.finishDeck(), reduceMotion() ? 150 : 520);
    } else {
      this.layout(true);
      this.activateTop();
      this.showToast(vote, card.dataset.name || '');
    }
  }

  private undo(): void {
    const last = this.history.pop();
    if (!last || this.idx >= this.order.length) return;
    this.hideToast();
    this.decisions.delete(last.slug);
    this.idx = this.order.indexOf(last.slug);
    const card = this.cards.get(last.slug) as HTMLElement;
    delete card.dataset.out;
    gsap.set(qa('.stamp', card), { opacity: 0 });
    gsap.set(card, { opacity: 1 });
    this.layout(true);
    this.activateTop();
    this.updateFavCount();
    track('undo', { design: last.slug });
    this.announce(`Back to ${card.dataset.name}.`);
  }

  private flyHeart(card: HTMLElement): void {
    const pill = document.querySelector('[data-fav-pill]');
    const heart = document.querySelector('.site-header .wordmark__heart');
    const bump = () => {
      beat(pill);
      beat(heart);
    };
    if (!pill || reduceMotion()) {
      bump();
      return;
    }
    const from = q('.card__media', card).getBoundingClientRect();
    const to = pill.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'flying-heart';
    el.innerHTML = HEART_SVG;
    document.body.append(el);
    const sx = from.left + from.width / 2 - 16;
    const sy = from.top + from.height / 2 - 16;
    const ex = to.left + to.width / 2 - 16;
    const ey = to.top + to.height / 2 - 16;
    gsap.set(el, { x: sx, y: sy, scale: 1.4 });
    gsap.to(el, {
      motionPath: { path: [{ x: sx, y: sy }, { x: (sx + ex) / 2 + 30, y: Math.min(sy, ey) - 70 }, { x: ex, y: ey }], curviness: 1.25 },
      scale: 0.55,
      duration: 0.7,
      ease: 'power1.inOut',
      onComplete: () => {
        el.remove();
        bump();
      },
    });
  }

  private setTint(color: string, heart = INK): void {
    const root = document.documentElement;
    const vars: Record<string, string> = { '--tint': color };
    if (root.dataset.accent === 'chameleon') vars['--heart'] = heart;
    if (reduceMotion()) Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    else gsap.to(root, { ...vars, duration: 0.7, ease: 'power2.out', overwrite: 'auto' });
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  }

  private buildProgress(): void {
    const list = q('[data-progress]');
    list.replaceChildren(
      ...this.order.map((slug) => {
        const li = document.createElement('li');
        li.className = 'progress__dot';
        li.dataset.slug = slug;
        li.style.setProperty('--dot', this.cards.get(slug)?.dataset.swatch || '#ccc');
        return li;
      }),
    );
  }

  private updateProgress(): void {
    for (const li of qa('.progress__dot')) {
      const slug = li.dataset.slug as string;
      const i = this.order.indexOf(slug);
      const decision = this.decisions.get(slug);
      const name = this.cards.get(slug)?.dataset.name;
      li.classList.toggle('is-current', i === this.idx);
      li.classList.toggle('is-loved', decision === 'love');
      li.classList.toggle('is-passed', decision === 'pass');
      li.setAttribute('aria-label', `${name}: ${decision === 'love' ? 'loved' : decision === 'pass' ? 'passed' : i === this.idx ? 'now showing' : 'to come'}`);
    }
  }

  private updateFavCount(): void {
    const count = [...this.decisions.values()].filter((v) => v === 'love').length;
    const pill = document.querySelector<HTMLElement>('[data-fav-pill]');
    const label = document.querySelector('[data-fav-count]');
    if (label) label.textContent = String(count);
    pill?.setAttribute('aria-label', `Designs you love: ${count}`);
  }

  private showToast(vote: Vote, name: string): void {
    const toast = q('[data-toast]', this.root);
    q('[data-toast-text]', toast).textContent = vote === 'love' ? `Loved ${name}` : `Passed on ${name}`;
    toast.hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.hideToast(), 4000);
  }

  private hideToast(): void {
    window.clearTimeout(this.toastTimer);
    q('[data-toast]', this.root).hidden = true;
  }

  private announce(text: string): void {
    q('[data-live]', this.root).textContent = text;
  }

  private bindControls(): void {
    for (const btn of qa<HTMLButtonElement>('[data-vote-btn]', this.root)) {
      btn.addEventListener('click', () => this.vote(btn.dataset.voteBtn as Vote, 'button'));
    }
    document.addEventListener('keydown', (e) => {
      const deckStage = this.root.querySelector<HTMLElement>('[data-stage="deck"]');
      const typing = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]');
      if (!deckStage || deckStage.hidden || typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.vote('love', 'key');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.vote('pass', 'key');
      }
    });
    this.deck.addEventListener('click', (e) => {
      const nav = (e.target as HTMLElement).closest<HTMLElement>('[data-nav]');
      const card = nav?.closest<HTMLElement>('.card');
      if (nav && card) this.stepShot(card, Number(nav.dataset.nav));
    });
    q('[data-undo]', this.root).addEventListener('click', () => this.undo());
    q<HTMLButtonElement>('[data-pick-continue]', this.root).addEventListener('click', () => {
      if (!this.top) return;
      track('top_pick', { design: this.top, from: this.lovedSlugs().length });
      this.showForm();
    });
  }

  // ---------- After the deck ----------

  private lovedSlugs(): string[] {
    return this.order.filter((s) => this.decisions.get(s) === 'love');
  }

  private finishDeck(): void {
    const loved = this.lovedSlugs();
    track('deck_complete', { loves: loved.length });
    this.setTint(PAPER);
    if (loved.length >= 2) {
      this.showPick(loved);
    } else {
      this.top = loved[0] ?? null;
      if (this.top) track('top_pick', { design: this.top, from: 1 });
      this.showForm();
    }
  }

  private thumb(card: HTMLElement): Node {
    const first = card.querySelector('.card__shot[data-shot="0"]');
    const media = first?.querySelector('picture, svg');
    const clone = (media?.cloneNode(true) as Element | undefined) ?? document.createElement('span');
    clone.querySelector('img')?.setAttribute('loading', 'eager');
    clone.querySelector('img')?.setAttribute('alt', '');
    clone.removeAttribute('aria-label');
    clone.setAttribute('aria-hidden', 'true');
    return clone;
  }

  private showPick(loved: string[]): void {
    const grid = q('[data-pick-grid]', this.root);
    qa('.pick', grid).forEach((n) => n.remove());
    for (const slug of shuffle(loved)) {
      const card = this.cards.get(slug) as HTMLElement;
      const label = document.createElement('label');
      label.className = 'pick';
      label.style.setProperty('--panel', card.style.getPropertyValue('--panel'));
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'top';
      input.value = slug;
      const media = document.createElement('span');
      media.className = 'pick__media';
      media.append(this.thumb(card));
      const name = document.createElement('span');
      name.className = 'pick__name';
      name.textContent = card.dataset.name || slug;
      const check = document.createElement('span');
      check.className = 'pick__check';
      check.setAttribute('aria-hidden', 'true');
      check.innerHTML = HEART_SVG;
      label.append(input, media, name, check);
      input.addEventListener('change', () => {
        this.top = slug;
        q<HTMLButtonElement>('[data-pick-continue]', this.root).disabled = false;
        this.setTint(card.dataset.tint || PAPER, card.dataset.heart);
      });
      grid.append(label);
    }
    this.showStage('pick');
  }

  private showForm(): void {
    const fav = q('[data-form-fav]', this.root);
    if (this.top) {
      const card = this.cards.get(this.top) as HTMLElement;
      const thumb = document.createElement('span');
      thumb.className = 'form-fav__thumb';
      thumb.style.setProperty('--panel', card.style.getPropertyValue('--panel'));
      thumb.append(this.thumb(card));
      const text = document.createElement('span');
      text.className = 'form-fav__text';
      const name = document.createElement('b');
      name.textContent = card.dataset.name || this.top;
      text.append('Your favourite', name);
      fav.replaceChildren(thumb, text);
      fav.hidden = false;
      this.setTint(card.dataset.tint || PAPER, card.dataset.heart);
    } else {
      fav.hidden = true;
      q('[data-form-title]', this.root).textContent = 'Nothing caught your eye?';
      q('[data-form-sub]', this.root).textContent =
        'That’s useful too. Leave your email and we’ll show you the next designs first. Nothing to pay.';
    }
    this.formShownAt = performance.now();
    this.showStage('form');
  }

  private showStage(name: string): void {
    for (const s of qa('[data-stage]', this.root)) s.hidden = s.dataset.stage !== name;
    // Only the deck is locked to one screen on phones; the other stages size to their content.
    document.querySelector('[data-first-screen]')?.classList.toggle('is-voting', name === 'deck');
    window.dispatchEvent(new Event('cori:layout'));
    const stage = q(`[data-stage="${name}"]`, this.root);
    if (!reduceMotion()) gsap.from(stage, { y: 18, opacity: 0, duration: 0.45, ease: 'power3.out', clearProps: 'all' });
    stage.querySelector<HTMLElement>('.stage__title')?.focus({ preventScroll: true });
    const r = stage.getBoundingClientRect();
    if (r.top < 70 || r.top > window.innerHeight * 0.55) {
      stage.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    }
  }

  // ---------- Form ----------

  private setError(form: HTMLFormElement, key: string, message: string): void {
    const el = form.querySelector<HTMLElement>(`[data-error="${key}"]`);
    if (el) {
      el.textContent = message;
      el.hidden = !message;
    }
    if (key === 'email') {
      const input = form.querySelector('#email');
      if (message) input?.setAttribute('aria-invalid', 'true');
      else input?.removeAttribute('aria-invalid');
    }
  }

  private bindForm(): void {
    const form = q<HTMLFormElement>('[data-signup]', this.root);
    const email = q<HTMLInputElement>('#email', form);
    const suggest = q('[data-email-suggest]', form);
    const apply = q<HTMLButtonElement>('[data-suggest-apply]', form);
    const outside = q('[data-outside]', form);

    email.addEventListener('blur', () => {
      const s = suggestEmail(email.value);
      apply.textContent = s || '';
      suggest.hidden = !s;
    });
    email.addEventListener('input', () => {
      if (email.hasAttribute('aria-invalid')) this.setError(form, 'email', '');
    });
    apply.addEventListener('click', () => {
      email.value = apply.textContent || email.value;
      suggest.hidden = true;
      email.focus();
    });
    form.addEventListener('change', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.name === 'size') {
        outside.hidden = t.value !== 'unsure';
        this.setError(form, 'size', '');
        track('size_selected', { size: t.value });
      }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.submit(form);
    });
  }

  private async submit(form: HTMLFormElement): Promise<void> {
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const size = String(data.get('size') || '');
    let firstInvalid: HTMLElement | null = null;

    this.setError(form, 'form', '');
    if (!email) {
      this.setError(form, 'email', 'We need an email to tell you when your favourite is ready.');
      firstInvalid = form.querySelector('#email');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      this.setError(form, 'email', 'That email looks a bit off. Typo?');
      firstInvalid = form.querySelector('#email');
    } else {
      this.setError(form, 'email', '');
    }
    if (!size) {
      this.setError(form, 'size', 'Pick a size, or “not sure”, so we know how many to make.');
      firstInvalid ??= form.querySelector('input[name="size"]');
    }
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    const honeypot = String(data.get('company') || '');
    const newsletter = data.get('newsletter') === 'yes';
    const button = q<HTMLButtonElement>('[data-submit]', form);
    button.disabled = true;
    button.textContent = 'Saving…';
    form.setAttribute('aria-busy', 'true');

    const payload: SignupPayload = {
      email,
      size,
      ukSize: size === 'unsure' ? String(data.get('ukSize') || '') || null : null,
      newsletter,
      loved: this.lovedSlugs(),
      passed: this.order.filter((s) => this.decisions.get(s) === 'pass'),
      top: this.top,
      order: this.order,
      session: sessionId(),
      catalog: this.catalog,
      consent: { version: CONSENT.version, launchEmail: CONSENT.launchEmail, newsletter: newsletter ? CONSENT.newsletter : null },
      attribution: attribution(),
      submittedAt: new Date().toISOString(),
      flags: { fast: performance.now() - this.formShownAt < 2500 },
    };

    try {
      if (honeypot) {
        await new Promise((resolve) => setTimeout(resolve, 600)); // bots get a fake success
      } else {
        this.devMode = (await submitSignup(payload)).dev;
        track('signup', { size, newsletter, loves: payload.loved.length, top: this.top });
      }
      this.showDone();
    } catch {
      this.setError(form, 'form', 'We couldn’t save that just now. Your picks are kept on this phone, so please try again.');
      button.disabled = false;
      button.textContent = 'Save my picks';
      form.removeAttribute('aria-busy');
    }
  }

  // ---------- Done ----------

  private nameOf(slug: string | null): string | null {
    return slug ? this.cards.get(slug)?.dataset.name || slug : null;
  }

  private shareUrl(): string {
    const url = new URL(this.base, location.origin);
    url.searchParams.set('ref', 'share');
    if (this.top) url.searchParams.set('d', this.top);
    url.searchParams.set('utm_source', 'share');
    return url.toString();
  }

  private showDone(): void {
    const name = this.nameOf(this.top);
    q('[data-done-title]', this.root).textContent = name ? `You’re on the list for ${name}.` : 'You’re on the list.';
    if (this.devMode) {
      q('[data-done-sub]', this.root).textContent = 'Saved on this device only: development mode, so no email is sent yet.';
    }
    if (this.friendPick) {
      const match = q('[data-match]', this.root);
      const friendName = this.nameOf(this.friendPick);
      match.textContent = this.friendPick === this.top ? `You and your friend picked the same one: ${friendName}.` : `Your friend picked ${friendName}.`;
      match.hidden = false;
    }
    try {
      localStorage.setItem('cori-signed-up', this.top ?? 'none');
    } catch {
      /* storage blocked */
    }
    this.showStage('done');
    void this.celebrate();
  }

  private async celebrate(): Promise<void> {
    if (reduceMotion()) return;
    const { default: confetti } = await import('canvas-confetti');
    const heart = confetti.shapeFromPath({ path: HEART_PATH });
    const card = this.top ? this.cards.get(this.top) : undefined;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--heart').trim() || INK;
    confetti({
      particleCount: 80,
      spread: 75,
      startVelocity: 38,
      origin: { y: 0.55 },
      scalar: 1.1,
      shapes: [heart, 'circle'],
      colors: [accent, card?.dataset.swatch || '#e2ded6', card?.dataset.tint || '#f5f3ee', INK],
      disableForReducedMotion: true,
    });
  }

  private bindDone(): void {
    const shareBtn = q<HTMLButtonElement>('[data-share]', this.root);
    const copyBtn = q<HTMLButtonElement>('[data-copy]', this.root);
    const copy = async () => {
      const url = this.shareUrl();
      try {
        await navigator.clipboard.writeText(url);
        copyBtn.textContent = 'Link copied';
        track('share', { channel: 'copy' });
      } catch {
        window.prompt('Copy this link', url);
      }
    };
    shareBtn.addEventListener('click', async () => {
      const name = this.nameOf(this.top);
      const text = name
        ? `I picked ${name} for cori’s first collection. Which one would you wear?`
        : 'Help cori choose which running vests to make first.';
      if (navigator.share) {
        try {
          await navigator.share({ title: 'cori', text, url: this.shareUrl() });
          track('share', { channel: 'native' });
        } catch {
          /* dismissed */
        }
      } else {
        await copy();
      }
    });
    copyBtn.addEventListener('click', () => void copy());

    const chips = qa<HTMLButtonElement>('[data-answer]', this.root);
    for (const chip of chips) {
      chip.addEventListener('click', () => {
        for (const c of chips) {
          c.setAttribute('aria-pressed', String(c === chip));
          c.disabled = true;
        }
        q('[data-survey-thanks]', this.root).hidden = false;
        track('survey', { q: 'price', answer: chip.dataset.answer });
      });
    }
  }
}

function markAccentLinks(): void {
  const current = document.documentElement.dataset.accent;
  for (const link of document.querySelectorAll<HTMLElement>('[data-accent-link]')) {
    link.setAttribute('aria-current', String(link.dataset.accentLink === current));
  }
}

export function initApp(): void {
  markAccentLinks();
  const vote = document.querySelector<HTMLElement>('[data-vote]');
  const catalog = vote?.dataset.catalog || CATALOG.version;
  initTracking({ catalog });
  track('page_view', { path: location.pathname });
  introHeart();
  initOptOut();
  void retryOutbox();
  if (vote) new VoteFlow(vote, catalog);
  // Decorative motion loads after the vote is ready, so it never delays the first card.
  const later = (cb: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 1500 }) : setTimeout(cb, 300));
  later(() => void import('./motion').then((m) => m.initMotion()));
}
