// Decorative motion outside the vote. Loaded after the page is interactive, every loop pauses
// when it scrolls out of view, and reduced-motion visitors get the finished still frames.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, MotionPathPlugin);

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function playWhenVisible(el: Element, tl: gsap.core.Timeline): void {
  tl.pause();
  ScrollTrigger.create({
    trigger: el,
    start: 'top 92%',
    end: 'bottom 8%',
    onToggle: (self) => (self.isActive ? tl.play() : tl.pause()),
  });
}

function route(): void {
  const root = document.querySelector<HTMLElement>('[data-route]');
  if (!root) return;
  const line = root.querySelector<SVGPathElement>('[data-route-line]');
  const runner = root.querySelector('[data-route-runner]');
  const sneaker = root.querySelector('.route__sneaker');
  const steam = root.querySelectorAll('.route__coffee .steam');
  if (!line || !runner) return;
  if (reduce()) {
    gsap.set(runner, { motionPath: { path: line, align: line, alignOrigin: [0.5, 0.5], start: 1, end: 1 } });
    return;
  }
  const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.4 });
  tl.set(line, { drawSVG: '0%', opacity: 1 })
    .to(sneaker, { rotation: -10, y: -3, duration: 0.16, yoyo: true, repeat: 5, transformOrigin: '30% 100%', ease: 'sine.inOut' })
    .to(line, { drawSVG: '100%', duration: 2.4, ease: 'power1.inOut' }, 0.15)
    .to(runner, { motionPath: { path: line, align: line, alignOrigin: [0.5, 0.5] }, duration: 2.4, ease: 'power1.inOut', immediateRender: true }, 0.15)
    .fromTo(steam, { y: 3, opacity: 0 }, { y: -2, opacity: 1, duration: 0.6, stagger: 0.18, ease: 'sine.out' })
    .to(runner, { scale: 1.5, duration: 0.16, yoyo: true, repeat: 3 }, '<')
    .to([line, steam], { opacity: 0, duration: 0.5 }, '+=1.2');
  playWhenVisible(root, tl);
}

function sceneDeck(svg: SVGSVGElement): void {
  const front = svg.querySelector('[data-card="0"]');
  const mid = svg.querySelector('[data-card="1"]');
  const back = svg.querySelector('[data-card="2"]');
  const pop = svg.querySelector('[data-pop]');
  gsap.set(pop, { svgOrigin: '214 34' });
  gsap.set(mid, { rotation: 5, svgOrigin: '140 100' });
  gsap.set(back, { rotation: -6, svgOrigin: '140 100' });
  if (reduce()) return;
  gsap.set(front, { svgOrigin: '140 100' });
  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4 });
  // a love: off to the right with a heart
  tl.to(front, { x: 150, rotation: 16, opacity: 0, duration: 0.5, ease: 'power2.in' }, 0.7)
    .fromTo(pop, { scale: 0, opacity: 0, y: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(3)' }, 0.95)
    .to(pop, { y: -12, opacity: 0, duration: 0.5 }, 1.6)
    .to(mid, { rotation: 0, duration: 0.4, ease: 'power2.out' }, 1.0)
    .set(front, { x: 0, rotation: 0, scale: 0.9 }, 1.7)
    .to(front, { opacity: 1, scale: 1, duration: 0.35 }, 1.7)
    .to(mid, { rotation: 5, duration: 0.3 }, 1.7)
    // a pass: off to the left, no heart
    .to(front, { x: -150, rotation: -16, opacity: 0, duration: 0.5, ease: 'power2.in' }, 2.8)
    .to(back, { rotation: 0, duration: 0.4 }, 3.0)
    .set(front, { x: 0, rotation: 0, scale: 0.9 }, 3.6)
    .to(front, { opacity: 1, scale: 1, duration: 0.35 }, 3.6)
    .to(back, { rotation: -6, duration: 0.3 }, 3.6);
  playWhenVisible(svg, tl);
}

function sceneBars(svg: SVGSVGElement): void {
  const bars = svg.querySelectorAll('[data-bar]');
  const hearts = svg.querySelectorAll('[data-bar-heart]');
  const made = svg.querySelector('[data-made]');
  if (reduce()) return;
  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8 });
  // Set origins once, up front: changing an SVG origin mid-tween shifts the element.
  gsap.set([bars, hearts], { transformOrigin: '50% 100%' });
  tl.fromTo(bars, { scaleY: 0 }, { scaleY: 1, duration: 0.7, stagger: 0.12, ease: 'power3.out' })
    .fromTo(hearts, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, stagger: 0.12, ease: 'back.out(3)' }, 0.35)
    .fromTo(made, { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'back.out(2)' }, '+=0.1')
    .to(hearts[3], { scale: 1.3, duration: 0.18, yoyo: true, repeat: 3 }, '<')
    .to([bars, hearts, made], { opacity: 0, duration: 0.4 }, '+=1.6')
    .set([bars, hearts, made], { opacity: 1 });
  playWhenVisible(svg, tl);
}

function sceneNotify(svg: SVGSVGElement): void {
  const phone = svg.querySelector('[data-phone]');
  const bubble = svg.querySelector('[data-bubble]');
  const waves = svg.querySelectorAll('[data-waves] path');
  if (reduce()) return;
  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6 });
  tl.set(bubble, { y: -36, opacity: 0 })
    .set(waves, { opacity: 0 })
    .to(phone, { x: 3, duration: 0.05, yoyo: true, repeat: 7, ease: 'none' }, 0.5)
    .to(waves, { opacity: 1, duration: 0.15, yoyo: true, repeat: 3, stagger: 0.05 }, 0.5)
    .to(bubble, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(2)' }, 0.75)
    .to(bubble, { y: -20, opacity: 0, duration: 0.4, ease: 'power2.in' }, '+=1.8');
  playWhenVisible(svg, tl);
}

function pack(): void {
  const root = document.querySelector<HTMLElement>('[data-pack]');
  if (!root) return;
  const items = Array.from(root.querySelectorAll<SVGGElement>('[data-pack-item]'));
  const labels = new Map(Array.from(root.querySelectorAll<HTMLElement>('[data-pack-label]')).map((l) => [l.dataset.packLabel, l]));
  const cord = root.querySelector('[data-pack-cord]');
  const replay = root.querySelector<HTMLButtonElement>('[data-pack-replay]');
  if (reduce()) {
    labels.forEach((l) => l.classList.add('is-in'));
    return;
  }
  gsap.set(items, { transformOrigin: '50% 50%' });
  const tl = gsap.timeline({
    paused: true,
    onComplete: () => {
      if (replay) replay.hidden = false;
    },
  });
  items.forEach((item, i) => {
    const fromRight = i % 2 === 1;
    tl.from(
      item,
      {
        x: fromRight ? '+=220' : '-=220',
        y: '-=140',
        rotation: fromRight ? 50 : -50,
        opacity: 0,
        duration: 0.75,
        ease: 'back.out(1.3)',
      },
      i * 0.38,
    ).add(() => labels.get(item.dataset.packItem)?.classList.add('is-in'), i * 0.38 + 0.55);
  });
  if (cord) tl.fromTo(cord, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.6, ease: 'power2.inOut' }, '>-0.2');
  ScrollTrigger.create({ trigger: root, start: 'top 72%', once: true, onEnter: () => tl.play(0) });
  replay?.addEventListener('click', () => {
    labels.forEach((l) => l.classList.remove('is-in'));
    replay.hidden = true;
    tl.restart();
  });
}

export function initMotion(): void {
  // Don't recalculate on every mobile address-bar resize; do recalculate when the vote changes the page height.
  ScrollTrigger.config({ ignoreMobileResize: true });
  addEventListener('cori:layout', () => requestAnimationFrame(() => ScrollTrigger.refresh()));
  route();
  document.querySelectorAll<SVGSVGElement>('[data-scene="deck"]').forEach(sceneDeck);
  document.querySelectorAll<SVGSVGElement>('[data-scene="bars"]').forEach(sceneBars);
  document.querySelectorAll<SVGSVGElement>('[data-scene="notify"]').forEach(sceneNotify);
  pack();
}
