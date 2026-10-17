/**
 * Vouchsafe 첫 화면 3D 장면 — 장단 리듬 축.
 * 주인공은 Vouchsafe 마크의 막대 넷(흙빛 · 세이지 · 황토 · 종이색)을 둥근 기둥으로 세운 것. 사물놀이 악기가 넷이듯 기둥도 넷이다.
 * 기둥은 늘 장단에 맞춰 치고(칠 때마다 바닥에 물결), 스크롤할수록 장단이 빨라진다: 진양조 → 중모리 → 자진모리 → 휘모리.
 *
 *  0.00 한 줄로 서서 진양조로 느리게 친다
 *  0.15 박자가 어긋나고 붉게 깜빡인다(검증 없는 직거래 · 선금 먼저)
 *  0.33 금빛 구슬(대금)이 내려오고, 기둥 넷이 둥글게 둘러싸 가운데에 묶는다(에스크로)
 *  0.52 자격 · 이력 · 신원 기둥이 한 박씩 불이 들어온다(검증)
 *  0.70 마지막 기둥(승인)이 들어오고 넷이 함께 치면 구슬이 빛줄기를 그리며 빠져나간다(정산)
 *  0.87 다시 한 줄로 서서 Vouchsafe 마크가 되고, 카메라가 물러난다
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const smooth = (n: number) => {
  n = clamp(n);
  return n * n * (3 - 2 * n);
};
const span = (p: number, a: number, b: number) => smooth((p - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const JANGDAN_COLOR = {
  clay: '#e0703a',
  sage: '#a9c79a',
  gold: '#e8b057',
  paper: '#f4ece0',
  warn: '#ef6b55',
  ink: '#1c1410',
};

/** 진행도에 따른 장단 이름 */
export function jangdanName(p: number): string {
  if (p < 0.33) return '진양조';
  if (p < 0.52) return '중모리';
  if (p < 0.7) return '자진모리';
  if (p < 0.87) return '휘모리';
  return '한 장단';
}

type Disposable = { dispose?: () => void };

// 막대 넷: 마크의 높이 비율(0.35 · 0.55 · 0.8 · 1)과 색, 검증 단계 이름
const PILLARS = [
  { color: JANGDAN_COLOR.clay, h: 0.35, name: '자격' },
  { color: JANGDAN_COLOR.sage, h: 0.55, name: '이력' },
  { color: JANGDAN_COLOR.gold, h: 0.8, name: '신원' },
  { color: JANGDAN_COLOR.paper, h: 1, name: '승인' },
];
// 한 장단 안에서 기둥이 치는 자리 — 간격이 점점 좁아진다(진양조에서 휘모리로 몰아치는 장단의 짜임)
const HIT_AT = [0, 0.3, 0.52, 0.68];

export class JangdanScene {
  progress = 0;
  paused = false;
  /** 장면을 화면 어느 쪽에 둘지: -0.19 오른쪽(글이 왼쪽), 0 가운데, 0.19 왼쪽(글이 오른쪽) */
  shift = -0.19;
  private curShift = -0.19;
  private w = 1;
  private h = 1;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  private own: Disposable[] = [];
  private raf = 0;
  private t = 0;
  private beat = 0;
  private last = performance.now();
  private narrow = false;
  private ro: ResizeObserver | null = null;
  private pointer = { x: 0, y: 0 };
  private reduced: boolean;
  private tick: (now: number) => void;
  private onMove = (e: PointerEvent) => {
    this.pointer.x = e.clientX / window.innerWidth - 0.5;
    this.pointer.y = e.clientY / window.innerHeight - 0.5;
  };

  constructor(private el: HTMLElement) {
    this.reduced = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const keep = <T extends Disposable>(r: T): T => {
      this.own.push(r);
      return r;
    };
    const c = (hex: string) => new THREE.Color(hex);
    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }));
    renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    const scene = this.scene;
    const pmrem = keep(new THREE.PMREMGenerator(renderer));
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.fog = new THREE.Fog(c(JANGDAN_COLOR.ink), 15, 32);
    scene.add(new THREE.HemisphereLight('#f6e6d0', '#160f0b', 0.85));
    const key = new THREE.DirectionalLight('#fff0da', 2.1);
    key.position.set(5, 10, 7);
    scene.add(key);
    const rim = new THREE.DirectionalLight(JANGDAN_COLOR.clay, 1.3);
    rim.position.set(-8, 4, -6);
    scene.add(rim);

    // ---------- 바닥: 둥근 빛 웅덩이
    const floorTex = (() => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 512;
      const g = cv.getContext('2d')!;
      const grd = g.createRadialGradient(256, 256, 0, 256, 256, 256);
      grd.addColorStop(0, 'rgba(232,176,87,0.26)');
      grd.addColorStop(0.5, 'rgba(224,112,58,0.07)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 512, 512);
      const tex = keep(new THREE.CanvasTexture(cv));
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();
    const floor = new THREE.Mesh(keep(new THREE.CircleGeometry(13, 96)), keep(new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false })));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // 칠 때마다 퍼지는 물결(여러 개를 돌려 쓴다)
    const rippleGeo = keep(new THREE.RingGeometry(0.97, 1, 128));
    const ripples = Array.from({ length: 28 }, () => {
      const m = new THREE.Mesh(rippleGeo, keep(new THREE.MeshBasicMaterial({ color: c('#ffffff'), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })));
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.012;
      m.visible = false;
      scene.add(m);
      return { m, age: 99, life: 1.6, size: 4 };
    });
    let rippleNext = 0;
    const spawnRipple = (x: number, z: number, color: string, size = 4, life = 1.6) => {
      const r = ripples[rippleNext++ % ripples.length];
      r.m.position.x = x;
      r.m.position.z = z;
      (r.m.material as THREE.MeshBasicMaterial).color.set(color);
      r.age = 0;
      r.life = life;
      r.size = size;
      r.m.visible = true;
    };

    // ---------- 글자(테두리 없이 글자만)
    const label = (text: string, color: string, size = 1) => {
      const cv = document.createElement('canvas');
      cv.width = 512;
      cv.height = 128;
      const g = cv.getContext('2d')!;
      g.font = '600 64px "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0,0,0,0.7)';
      g.shadowBlur = 18;
      g.fillStyle = color;
      g.fillText(text, 256, 66);
      const tex = keep(new THREE.CanvasTexture(cv));
      tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 })));
      sp.scale.set(2 * size, 0.5 * size, 1);
      sp.visible = false;
      scene.add(sp);
      return sp;
    };

    // ---------- 기둥 넷: 둥근 몸통 + 둥근 위아래(알약 모양). 높이는 위쪽 구를 옮기고 몸통을 늘려 바꾼다
    const R = 0.36;
    const bodyGeo = keep(new THREE.CylinderGeometry(R, R, 1, 48, 1, true));
    bodyGeo.translate(0, 0.5, 0);
    const capGeo = keep(new THREE.SphereGeometry(R, 48, 24));
    const MAXH = 3.4;
    const pillars = PILLARS.map((spec, i) => {
      const g = new THREE.Group();
      scene.add(g);
      const mat = keep(
        new THREE.MeshPhysicalMaterial({ color: c(spec.color), roughness: 0.2, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08, emissive: c(spec.color), emissiveIntensity: 0.1 }),
      );
      const body = new THREE.Mesh(bodyGeo, mat);
      body.position.y = R;
      g.add(body);
      const bottom = new THREE.Mesh(capGeo, mat);
      bottom.position.y = R;
      g.add(bottom);
      const top = new THREE.Mesh(capGeo, mat);
      g.add(top);
      const light = new THREE.PointLight(c(spec.color), 0, 5, 2);
      g.add(light);
      const tag = label(spec.name, spec.color, 0.75);
      return { spec, i, g, mat, body, top, light, tag, env: 0, lastHit: -1, x: 0, z: 0 };
    });

    // ---------- 대금: 금빛 구슬과 둘레를 도는 작은 빛
    const goldMat = keep(
      new THREE.MeshPhysicalMaterial({ color: c(JANGDAN_COLOR.gold), metalness: 1, roughness: 0.14, clearcoat: 1, emissive: c(JANGDAN_COLOR.gold), emissiveIntensity: 0.35 }),
    );
    const orb = new THREE.Mesh(keep(new THREE.SphereGeometry(0.46, 64, 40)), goldMat);
    scene.add(orb);
    const orbLight = new THREE.PointLight(c(JANGDAN_COLOR.gold), 0, 6, 2);
    orb.add(orbLight);
    const SPARK = 40;
    const sparkPos = new Float32Array(SPARK * 3);
    const sparkGeo = keep(new THREE.BufferGeometry());
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = keep(new THREE.PointsMaterial({ color: c(JANGDAN_COLOR.gold), size: 0.06, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(new THREE.Points(sparkGeo, sparkMat));
    // 빠져나가는 길(빛줄기)
    const exitCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.45, 0),
      new THREE.Vector3(0.6, 3.6, 0.6),
      new THREE.Vector3(3.2, 4.4, 1.4),
      new THREE.Vector3(7.5, 3.2, 2.2),
    ]);
    const trailGeo = keep(new THREE.TubeGeometry(exitCurve, 160, 0.03, 10, false));
    const trailMat = keep(new THREE.MeshBasicMaterial({ color: c(JANGDAN_COLOR.gold), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    const trail = new THREE.Mesh(trailGeo, trailMat);
    scene.add(trail);
    const trailTotal = trailGeo.index ? trailGeo.index.count : 0;

    // ---------- 떠다니는 먼지(박에 맞춰 살짝 튄다)
    const DUST = 160;
    const dustPos = new Float32Array(DUST * 3);
    const dustGeo = keep(new THREE.BufferGeometry());
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dust = Array.from({ length: DUST }, (_, i) => ({ a: rand(i + 1) * Math.PI * 2, r: 2 + rand(i + 50) * 10, y: rand(i + 300) * 7, s: 0.05 + rand(i + 900) * 0.15 }));
    const dustMat = keep(new THREE.PointsMaterial({ color: c(JANGDAN_COLOR.gold), size: 0.04, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(new THREE.Points(dustGeo, dustMat));

    // ---------- 카메라 길(하나로 이어진 곡선)
    const camPos = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 3.0, 13.5),
      new THREE.Vector3(-2.4, 2.6, 12),
      new THREE.Vector3(0.4, 7.6, 12),
      new THREE.Vector3(6.6, 4.6, 10.8),
      new THREE.Vector3(3.0, 3.6, 12.6),
      new THREE.Vector3(0, 4.2, 16),
    ]);
    const camLook = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.3, 0),
      new THREE.Vector3(-0.4, 1.3, 0),
      new THREE.Vector3(0, 2.6, 0),
      new THREE.Vector3(0, 1.3, 0),
      new THREE.Vector3(0.9, 2.1, 0.3),
      new THREE.Vector3(0, 2.9, 0),
    ]);

    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      this.narrow = w / h < 0.9;
      renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.fov = this.narrow ? 52 : 36;
      this.w = w;
      this.h = h;
      this.applyShift();
    };
    resize();
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    this.ro?.observe(el);
    window.addEventListener('pointermove', this.onMove, { passive: true });

    const v = new THREE.Vector3();
    const look = new THREE.Vector3();
    const warn = c(JANGDAN_COLOR.warn);
    const tmp = new THREE.Color();

    this.tick = (now: number) => {
      this.raf = requestAnimationFrame(this.tick);
      const dt = clamp((now - this.last) / 1000, 0, 0.05);
      this.last = now;
      const moving = !this.paused && !this.reduced && !document.hidden;
      if (moving) this.t += dt;
      const t = this.t;
      const p = this.progress;

      const danger = span(p, 0.13, 0.19) * (1 - span(p, 0.29, 0.34));
      const circle = span(p, 0.33, 0.43) * (1 - span(p, 0.86, 0.93)); // 한 줄 → 둥글게 → 다시 한 줄
      const descend = span(p, 0.33, 0.45);
      const lit = [span(p, 0.53, 0.57), span(p, 0.58, 0.62), span(p, 0.63, 0.67), span(p, 0.71, 0.75)];
      const together = span(p, 0.74, 0.78) * (1 - span(p, 0.86, 0.9));
      const exit = span(p, 0.77, 0.86);
      const finale = span(p, 0.87, 0.97);

      // 장단 빠르기(한 장단에 걸리는 시간): 진양조 4초 → 휘모리 0.9초
      const tempo = lerp(lerp(lerp(0.25, 0.45, span(p, 0.3, 0.4)), 0.75, span(p, 0.5, 0.58)), 1.1, span(p, 0.68, 0.76));
      const beatSpeed = finale > 0 ? lerp(tempo, 0.3, finale) : tempo;
      if (moving) this.beat += dt * beatSpeed;
      const cycle = Math.floor(this.beat);
      const inCycle = this.beat - cycle;

      // 자리: 한 줄(마크) ↔ 둥글게(구슬을 둘러쌈)
      pillars.forEach((pl) => {
        const rowX = (pl.i - 1.5) * 1.05;
        const ang = (pl.i / 4) * Math.PI * 2 + Math.PI / 4 + t * 0.15 * circle;
        const cx = Math.cos(ang) * 2.7;
        const cz = Math.sin(ang) * 2.7;
        pl.x = lerp(rowX, cx, circle);
        pl.z = lerp(0, cz, circle);
        // 박자: 제 자리에 오면 친다. 어긋날 때는 자리가 흔들린다
        const off = danger > 0.05 ? rand(cycle * 7 + pl.i) * 0.5 * danger : 0;
        const at = (HIT_AT[pl.i] + off) % 1;
        const hitIndex = cycle * 4 + pl.i + (inCycle >= at ? 1 : 0);
        if (moving && hitIndex !== pl.lastHit && inCycle >= at && pl.lastHit !== -1) {
          pl.env = 1;
          const strong = Math.max(lit[pl.i], together);
          spawnRipple(pl.x, pl.z, danger > 0.3 ? JANGDAN_COLOR.warn : pl.spec.color, 2.5 + 3 * strong + 2 * finale, 1.4 + 0.6 * strong);
        }
        pl.lastHit = hitIndex;
        pl.env *= Math.exp(-dt * (4 + 4 * tempo));
        const jx = danger * (rand(cycle * 13 + pl.i * 3) - 0.5) * 0.5;
        pl.g.position.set(pl.x + jx, 0, pl.z);
        // 높이: 마크 비율. 칠 때 솟았다 가라앉는다
        const base = pl.spec.h * MAXH * lerp(1, 0.75, circle) + 0.2;
        const bounce = 1 + 0.16 * pl.env * (1 + together);
        const len = Math.max(0.05, base * bounce - 2 * R);
        pl.body.scale.y = len;
        pl.top.position.y = R + len;
        // 빛: 검증된 기둥은 밝게, 어긋날 때는 붉게
        const on = Math.max(lit[pl.i], finale);
        pl.mat.emissive.set(pl.spec.color);
        if (danger > 0.02) pl.mat.emissive.lerp(warn, danger * (0.4 + 0.6 * pl.env));
        pl.mat.emissiveIntensity = 0.06 + 0.3 * on + 0.9 * pl.env * (0.4 + 0.6 * Math.max(on, danger));
        tmp.set(pl.spec.color).multiplyScalar(0.55 + 0.45 * Math.max(on, 1 - circle));
        pl.mat.color.copy(tmp);
        pl.light.position.y = R + len + 0.4;
        pl.light.intensity = (2 + 6 * pl.env) * on;
        // 이름표(검증 단계): 둥글게 섰을 때만
        const tagOn = clamp(span(p, 0.47, 0.52) * (1 - span(p, 0.84, 0.88)));
        pl.tag.position.set(pl.x, R + len + 0.75, pl.z);
        const tm = pl.tag.material as THREE.SpriteMaterial;
        tm.opacity = tagOn * (0.45 + 0.55 * lit[pl.i]);
        pl.tag.visible = tm.opacity > 0.02;
      });

      // 물결
      ripples.forEach((r) => {
        if (!r.m.visible) return;
        if (moving) r.age += dt;
        const k = r.age / r.life;
        if (k >= 1) {
          r.m.visible = false;
          return;
        }
        r.m.scale.setScalar(0.4 + r.size * smooth(k));
        (r.m.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
      });

      // 대금 구슬: 위에서 내려와 가운데 묶이고, 넷이 함께 친 뒤 빛줄기를 따라 빠져나간다
      if (exit <= 0) {
        v.set(0, lerp(7.5, 1.45, descend), 0);
      } else {
        exitCurve.getPoint(exit, v);
      }
      v.y += Math.sin(t * 1.4) * 0.07 * (1 - exit);
      orb.position.copy(v);
      orb.rotation.y = t * 0.6;
      const hold = descend * (1 - exit);
      orb.visible = descend > 0.01 && exit < 0.995;
      orb.scale.setScalar((1 + 0.08 * Math.max(...pillars.map((pl) => pl.env)) * hold) * (1 - smooth((exit - 0.75) / 0.25)));
      goldMat.emissiveIntensity = 0.35 + 0.5 * together + 0.3 * exit;
      orbLight.intensity = 6 * descend + 6 * together;
      {
        const pos = sparkGeo.attributes.position as THREE.BufferAttribute;
        for (let k = 0; k < SPARK; k++) {
          const a = t * (0.8 + rand(k) * 0.8) + k;
          const rr = 0.7 + rand(k + 40) * 0.35;
          pos.setXYZ(k, v.x + Math.cos(a) * rr, v.y + Math.sin(a * 1.3) * 0.35, v.z + Math.sin(a) * rr);
        }
        pos.needsUpdate = true;
        sparkMat.opacity = 0.75 * hold;
      }
      trail.geometry.setDrawRange(0, Math.floor((trailTotal * exit) / 6) * 6);
      trailMat.opacity = 0.8 * (exit > 0 ? 1 : 0) * (1 - finale);
      trail.visible = exit > 0.005 && finale < 0.99;

      // 먼지: 박마다 살짝 튄다
      {
        const kick = Math.max(...pillars.map((pl) => pl.env));
        const pos = dustGeo.attributes.position as THREE.BufferAttribute;
        dust.forEach((d, k) => {
          const a = d.a + t * d.s * 0.3;
          const r = d.r * (1 + 0.03 * kick);
          pos.setXYZ(k, Math.cos(a) * r, (d.y + t * d.s) % 7, Math.sin(a) * r - 1);
        });
        pos.needsUpdate = true;
        dustMat.opacity = 0.35 + 0.25 * kick;
      }

      // 장면 자리(글이 어느 쪽에 있는지에 따라 부드럽게 옮긴다)
      if (Math.abs(this.shift - this.curShift) > 0.0005) {
        this.curShift += (this.shift - this.curShift) * (1 - Math.exp(-dt * 3));
        this.applyShift();
      }
      // 카메라
      camPos.getPoint(clamp(p), v);
      camLook.getPoint(clamp(p), look);
      if (this.narrow) {
        v.sub(look).multiplyScalar(1.45).add(look);
        look.y -= 1.9;
      }
      v.x += this.pointer.x * 0.8;
      v.y += -this.pointer.y * 0.5;
      this.camera.position.copy(v);
      this.camera.lookAt(look);
      renderer.render(scene, this.camera);
    };
  }

  private applyShift() {
    if (this.narrow) this.camera.clearViewOffset();
    else this.camera.setViewOffset(this.w, this.h, this.w * this.curShift, 0, this.w, this.h);
    this.camera.updateProjectionMatrix();
  }

  start() {
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onMove);
    this.ro?.disconnect();
    this.own.forEach((r) => r.dispose?.());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
