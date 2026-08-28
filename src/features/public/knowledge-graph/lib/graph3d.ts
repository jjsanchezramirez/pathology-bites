/**
 * 3D knowledge-graph renderer.
 *
 * sigma.js got this page as far as a readable 2D cloud, but it is strictly 2D
 * and no amount of coaxing turns it into something you can spin. This replaces
 * it outright:
 *
 *   three.js         rendering -- one draw call for all 8,930 nodes and one for
 *                    all 26,552 edges, via Points and LineSegments
 *   d3-force-3d      layout, in three dimensions, seeded from organ-system
 *                    clusters with chapter sub-clustering
 *   OrbitControls    drag orbits the cloud like a globe, wheel dollies,
 *                    right-drag pans
 *
 * Everything that reads or writes the scene goes through buffer attributes.
 * That is the whole performance story: hiding a node, highlighting a
 * neighbourhood and dragging the magnet through the field are all a handful of
 * float writes plus `needsUpdate`, with no re-indexing and no per-object
 * overhead. The 2D version's worst bug was the opposite of this -- it wrote
 * node coordinates into the graph model, and the renderer re-indexed itself
 * once per node per frame.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  LineSegments,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface N3 {
  id: string;
  label: string;
  color: string;
  size: number;
  community: number;
  /** "entity" | "marker" | "alteration" | "gene". Entities are what the cloud is
   *  actually about, so both the magnet and the labels privilege them. */
  kind?: string;
  organ?: string;
  chapter?: string;
}
export interface E3 {
  s: number;
  t: number;
  /**
   * The colour this edge shows when it is highlighted -- its polarity, or its
   * class where polarity does not apply. Unhighlighted it is drawn in the flat
   * haze instead: tens of thousands of coloured lines stacked on top of each
   * other sum to a grey slab, so the hue is spent only where one line is
   * actually being read.
   */
  color: string;
}

/**
 * A side-by-side reading of two entities, drawn as a Venn in space.
 *
 * The sets come from the graph model rather than the detail payload, so the
 * lobes hold everything the two nodes actually touch -- markers, alterations,
 * genes, relatives -- not just what the panel happens to tabulate.
 */
export interface CompareSpec {
  a: string;
  b: string;
  aOnly: Set<string>;
  bOnly: Set<string>;
  both: Set<string>;
  colorA: string;
  colorB: string;
  colorBoth: string;
}

/**
 * The shape of the cloud, as four numbers you can drag.
 *
 * None of these touch the PARTITION -- which nodes are grouped with which is
 * Leiden's answer and costs a second to recompute. These are pure geometry:
 * where the groups sit and how big and how round they are. That makes them
 * cheap enough to apply on every tick of a slider, which is the only way a
 * shape control is worth having.
 */
export interface LayoutParams {
  /** How far apart the cluster centres sit. Blob size does NOT scale with it,
   *  which is the whole point -- scaling both together changes nothing. */
  separation: number;
  /** How big each cluster is. Low is tight knots in a lot of void; high merges
   *  them back into one surface. */
  clump: number;
  /** 0 = every cluster a smooth round ball, 1 = the irregular silhouette its
   *  own force layout produced. */
  shape: number;
  /** 0 = every cluster on one shell (hollow globe), 1 = spread through the
   *  interior (solid ball). */
  depth: number;
}

/**
 * Measured against the real partition rather than chosen by feel.
 *
 * At separation 1 / clump 1 the mean gap between neighbouring clusters is +30
 * units and only 7% of them touch -- which is what "very disperse" looks like:
 * five hundred separate specks, each holding a median of eight nodes, spread
 * evenly over a sphere. No Leiden setting fixes it, because the partition is
 * not wrong; the graph really is that granular. Resolution moves the community
 * count by 3% across its whole range and hub damping by 4%.
 *
 * So the clumping is geometric. Pulling the centres 20% in and swelling the
 * blobs 15% takes the mean gap to roughly -14, so about three quarters of
 * clusters overlap a neighbour and the globe reads as continuous mass with
 * structure in it, rather than as scattered dust.
 */
export const DEFAULT_LAYOUT: LayoutParams = {
  separation: 0.8,
  clump: 1.15,
  shape: 1,
  depth: 0.28,
};

export interface Graph3DOptions {
  container: HTMLElement;
  labelCanvas: HTMLCanvasElement;
  /**
   * How much room to leave around the cloud when framing it, as a multiple of
   * its radius. 1 puts the outermost node exactly on the top and bottom edges;
   * below 1 the cloud runs off them, which is what you want when it is a
   * backdrop rather than a picture. Framing is vertical -- a wide container
   * gets a wide margin for free.
   */
  framing?: number;
  /** Clear colour behind the cloud, or "transparent" to let the page show
   *  through. Depth cueing is done with alpha rather than by mixing toward
   *  this colour, so far nodes fade into whatever is actually behind them. */
  background: string;
  labelInk: string;
  labelHalo: string;
  edgeColor: string;
  onHover: (id: string | null, x: number, y: number) => void;
  onClick: (id: string) => void;
  /** A click that landed on nothing -- empty space outside the cloud. */
  onBackground: () => void;
  onDoubleClick: (id: string) => void;
  onSettling: (settling: boolean) => void;
}

/* ── tuning ─────────────────────────────────────────────────────────────── */

/** Radius of the sphere the community anchors sit on. */
/* What sets how much black sits between constellations is the RATIO of this to
 * `spread` below, not either alone -- the clusters are scaled from it, so
 * shrinking the globe alone just shrinks everything together. */
const SEED_RADIUS = 1000;
const MAX_LABELS = 18;
/** Labels while a node is selected. Its neighbourhood, not a wall of names. */
const SELECTED_LABELS = 22;
/** How long names take to fade up once the cloud has settled. */
const LABEL_WAKE_MS = 900;
/**
 * How long the cloud takes to form, in milliseconds.
 *
 * Timed rather than counted in frames. A frame count makes the animation run at
 * whatever speed the machine happens to render at -- on a slow GPU the same 90
 * frames stretched this to three-quarters of a minute.
 */
const FORMATION_MS = 2600;
/**
 * Fraction of the formation any one node spends in flight.
 *
 * The rest of the window is stagger. At 1 every node moves at once, which is
 * a zoom rather than a bloom; low enough and the clusters arrive in a legible
 * sequence around the globe while each individual flight still feels quick.
 */
const FORMATION_RISE = 0.4;
/** How far in the cloud is collapsed before it opens, as a fraction of its size. */
const COLLAPSE = 0.06;
/**
 * How long the cloud takes to draw itself in before it opens.
 *
 * The bloom used to start from a collapse that happened between two frames,
 * which is a cut, not a movement -- the cloud simply was not there and then
 * exploded. Gathering inward first, quickly and accelerating, gives the
 * explosion something to be the release of.
 */
const GATHER_MS = 420;
/**
 * How long the cloud takes to arrive, in milliseconds.
 *
 * Distinct from the formation above, and earlier: this is the nodes appearing
 * at all, which happens the moment the node payload lands and long before
 * anything is known about how they group.
 *
 * Longer than the gap it has to cover, deliberately. With the payloads now
 * arriving about three tenths of a second apart, the arrival is still running
 * when the edges land, the stars start growing and the layout forms -- so the
 * stages overlap into one continuous build instead of taking turns. Every one
 * of them composes: emergence scales alpha and size in the shader, growth
 * moves the base sizes, formation moves the positions.
 */
const EMERGE_MS = 2200;
/** Fraction of that window any single node spends fading in. */
const EMERGE_RISE = 0.14;
/** How long the stars take to grow into their real sizes once degrees are known. */
const SIZE_MS = 900;
/** How far below the labelling threshold a name starts ghosting in, in pixels. */
const LABEL_FADE = 1.2;
/** How long the edge haze takes to fade up once the edges land. */
const EDGE_REVEAL_MS = 1000;
/** Screen-pixel radius of the magnet's influence. */
const MAGNET_RADIUS_PX = 120;
const MAGNET_RADIUS_SQ = MAGNET_RADIUS_PX * MAGNET_RADIUS_PX;
const MAGNET_PULL = 0.85;
/** Peak sideways nudge, as a fraction of the radius. A reading aid, not a shove. */
const MAGNET_PUSH = 0.16;
const MAGNET_EASE = 0.2;
/** A new nearest node must beat the incumbent by this much to steal the pull. */
const MAGNET_HYSTERESIS = 0.75;
/**
 * How much harder a non-entity has to try to win the magnet.
 *
 * Markers, alterations and genes outnumber tumours roughly two to one and the
 * markers sit at the busiest places on screen, so a cursor moved across the
 * cloud spends most of its time holding a stain nobody asked about. A marker
 * now has to be well over twice as close as a tumour to take the pull, which
 * makes sweeping the cloud feel like it is looking for diseases -- which is
 * what the cloud is about.
 */
const MAGNET_ENTITY_BIAS = 2.6;
/*
 * Being part of the selection is deliberately NOT a bias multiplier.
 *
 * A multiplier is the wrong shape: however large you make it, a big unrelated
 * node close to the cursor eventually beats a small associated one further
 * away. When you have selected something, the associated set IS what you are
 * reading and everything else has already receded to near-invisible, so
 * membership is a tier -- decided before size, kind or distance are looked at
 * at all, which only order things within a tier. See `updateMagnet`.
 */
/*
 * Highlighted nodes used to be grabbable from 2.2x the ordinary radius. That is
 * gone, and it was actively harmful once the pull learned to decay: a picked
 * node at 250px would win the tier, be too far to be pulled at all, and leave
 * every node actually near the cursor being pushed aside by a magnet holding
 * nothing. Preference between tiers is what makes travel work; extra reach only
 * made the field behave oddly at the edges.
 */
/**
 * How hard a node's own size pulls, as an exponent on it.
 *
 * Size already means degree on this cloud -- a bright star is a thing hundreds
 * of tumours touch, a speck is a marker named once -- so the big ones are the
 * landmarks you are usually reaching for. Square-rooted because the raw range
 * is wide enough (about 0.3 to 12) to swamp distance entirely if taken
 * straight; at a half power it is a ~6x swing, comparable to the entity and
 * selection biases rather than overwhelming them.
 */
const MAGNET_SIZE_POWER = 0.5;
/**
 * How much harder a node pulls while its name is on screen.
 *
 * A labelled node is one the cloud has already decided is worth pointing out,
 * and it is the one the eye is on -- so the cursor should agree. This is the
 * mild version of the label hit-testing that was tried and pulled: the name is
 * not a target, it just makes its own dot more attractive.
 *
 * At 6 it outweighs the entity bias (2.6) outright and most of the size range
 * (up to ~3.5), so a named marker beats an unnamed tumour of the same size, and
 * loses to an unnamed hub only when that hub is markedly closer. Short of a
 * hard rule, which would stop the cursor ever reaching anything unnamed.
 */
const MAGNET_LABEL_BOOST = 6;
/**
 * Where pulling back starts to cost something, as a multiple of the resting
 * distance. Home already frames the whole cloud, so anything past this is
 * further out than there is any reason to be.
 */
const ZOOM_SOFT = 1.55;
/**
 * The scale of the resistance, as a multiple of the resting distance.
 *
 * The curve is logarithmic, NOT asymptotic. An asymptote was the last thing
 * wrong here: past about ten notches the view stopped changing at all while
 * the wheel kept turning, so it read as jammed and then popped for no visible
 * reason. A log keeps giving ground forever -- less and less of it -- so there
 * is always feedback that the pull is doing something, right up to the release.
 */
const ZOOM_BAND = 0.5;
/** Raw distance, as a multiple of the soft limit, that lets go. */
const ZOOM_SNAP = 3;
/*
 * There is no relax. Resistance here means "harder to keep going", not "pulled
 * back": nothing is reclaimed, and letting go of the wheel leaves the view
 * exactly where it was. Springing back was making the band feel like it was
 * arguing rather than resisting.
 */
/** How long after a bounce before another can trigger. */
const BOUNCE_COOLDOWN_MS = 2500;
/** Per-frame approach to the home framing during a reset. */
const RESET_EASE = 0.09;
/** Standby drift. Slow enough to read as alive rather than as animation. */
const STANDBY_SPEED = 0.14;
/** How fast it turns while it is opening. */
const SPIN_OPEN = 1.1;
/**
 * How quickly the spin approaches whatever it should be, per frame.
 *
 * OrbitControls defaults autoRotateSpeed to 2.0, and the standby setter was
 * skipped for the whole opening -- so it spun at 2.0 and then dropped fourteen
 * times over in a single frame the instant the formation ended. This eases it
 * instead: a time constant of about a second and a half, so the cloud coasts
 * down rather than being caught.
 */
const SPIN_EASE = 0.011;
/** How long after the last input the drift resumes. */
const STANDBY_RESUME_MS = 4000;
/** Camera elevation above the equator, so the drift traces a tilt. */
const STANDBY_TILT = 0.22;
/**
 * Standby breath: a half-percent scale cycle, once every nine seconds.
 *
 * Far below conscious notice -- nobody will ever say the cloud is pulsing --
 * but it is the difference between a still render and something at rest. Done
 * in the shaders, so it costs one uniform per frame and no geometry.
 */
const BREATH_AMOUNT = 0.005;
const BREATH_MS = 9000;
/**
 * How much of a breath is worth re-projecting for. The cycle is half a percent
 * of scale over nine seconds, so a single frame of it moves an outlying node by
 * a fraction of a pixel -- far below anything the labels or the magnet could
 * act on, and not worth 8,930 matrix multiplies to chase.
 */
const BREATH_EPSILON = 2e-4;

/* ── frame budget ──────────────────────────────────────────────────────────
 *
 * Standby is the state this thing spends nearly all of its life in: settled,
 * unattended, turning slowly. It is also the state it used to render at a full
 * sixty frames a second, for a drift of 0.14 and a half-percent breath. Both
 * survive being shown at thirty; neither is legible enough to notice.
 */
const STANDBY_FRAME_MS = 33;
/** Once degraded. Still smooth for a drift this slow. */
const STANDBY_FRAME_MS_TIER1 = 50;
/**
 * Reduced motion. Nothing moves by itself, so a frame is only worth drawing
 * when something has changed -- but tracking every source of change is a bug
 * farm, and a second's latency on an unattended backdrop costs nothing.
 */
const STANDBY_FRAME_MS_STILL = 1000;
/** Names are read, not animated. Twenty a second is more than enough. */
const LABEL_FRAME_MS = 50;
/** Frames per self-tuning verdict, and the per-frame budget it judges against. */
const TUNE_SAMPLES = 90;
const TUNE_BUDGET_MS = 12;
/**
 * How a selection arrives and leaves.
 *
 * Straight assignment made selecting feel like a light switch: the whole cloud
 * changed state between two frames, which reads as a redraw rather than as a
 * response. Everything now travels to its new alpha and size instead, and the
 * connected edges are dealt outward from the selected node in distance order,
 * so the relationship is drawn rather than revealed.
 */
const FADE_MS = 380;
/** How much of the fade window is spent dealing the edges outward. */
const FADE_STAGGER = 0.55;
/** How long the camera takes to settle on a new framing. */
const TRAVEL_MS = 520;
/**
 * How far the framing is allowed to depart from the resting one.
 *
 * The cloud has a home: centred, at the distance the whole thing fits. Every
 * selection is a small departure from it and every deselection returns to it,
 * which is what stops the view wandering off somewhere odd over a few clicks.
 */
const ZOOM_MIN = 0.82;
const ZOOM_MAX = 1.15;
/** Default room around the whole cloud. See `Graph3DOptions.framing`. */
const DEFAULT_FRAMING = 1.35;
/** Margin around the neighbourhood when framing a selection. */
const FRAME_MARGIN = 1.25;
/**
 * How present the rest of the cloud stays while something is selected.
 *
 * Pulled up twice from the 0.05 it started at. Too faint and the selection
 * floats in a void with nothing to be part of -- the point of highlighting a
 * neighbourhood inside a graph is that you can still see the graph. Size does
 * the receding instead: the unrelated nodes stay legible but shrink, so they
 * read as background rather than as erased.
 */
const DIMMED_ALPHA = 0.2;
const DIMMED_SIZE = 2.6;

/* Depth cueing. Far nodes wash toward the background, which is what stops a
 * 3D cloud reading as a flat spatter of dots when it is not moving. */
const NODE_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAlpha;
  attribute float aEmerge;
  uniform float uPixelRatio;
  uniform float uBreath;
  uniform float uNear;
  uniform float uFar;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    /* Arrival is done here rather than on the CPU: a node flies in along its
     * own radius while it fades and swells, so the cloud draws itself inward
     * instead of switching on. Costs one attribute and no per-frame geometry
     * work at all. */
    vec3 pos = position * mix(1.3, 1.0, aEmerge) * uBreath;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float depth = clamp((-mv.z - uNear) / max(uFar - uNear, 1.0), 0.0, 1.0);
    // Far side pushed much further back than it used to be. At 0.42 the globe
    // read as a flat spatter when it was not moving; this is what makes the
    // near hemisphere sit in front of the far one while standing still.
    vAlpha = aAlpha * aEmerge * mix(1.0, 0.22, depth);
    gl_PointSize = aSize * uPixelRatio * (2400.0 / max(-mv.z, 1.0))
      * mix(1.0, 0.62, depth) * mix(0.2, 1.0, aEmerge);
    gl_Position = projectionMatrix * mv;
  }
`;

const NODE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    // Feathered rim, so points read as soft discs rather than aliased squares.
    float a = smoothstep(0.5, 0.44, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

const EDGE_VERT = /* glsl */ `
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uNear;
  uniform float uFar;
  uniform float uReveal;
  uniform float uBreath;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    // Must match the node shader exactly: these vertices are node positions,
    // and a line whose ends breathe differently from its dots comes adrift.
    vec4 mv = modelViewMatrix * vec4(position * uBreath, 1.0);
    float depth = clamp((-mv.z - uNear) / max(uFar - uNear, 1.0), 0.0, 1.0);
    vAlpha = aAlpha * uReveal * mix(1.0, 0.08, depth);
    vColor = aColor;
    gl_Position = projectionMatrix * mv;
  }
`;

const EDGE_FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    if (vAlpha < 0.004) discard;
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

/** Deterministic pseudo-random triple from an integer. Same input, same cloud. */
function hash3(i: number): [number, number, number] {
  const f = (k: number) => {
    const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return [f(1), f(2), f(3)];
}

/** Evenly-spread directions on a sphere. */
function fibonacciSphere(i: number, n: number): [number, number, number] {
  const k = i + 0.5;
  const phi = Math.acos(1 - (2 * k) / n);
  const theta = Math.PI * (1 + Math.sqrt(5)) * k;
  return [Math.cos(theta) * Math.sin(phi), Math.sin(theta) * Math.sin(phi), Math.cos(phi)];
}

/**
 * A direction on the sphere for one community, given how far through the
 * size-ordered list it sits.
 *
 * Equal spacing is wrong here. The communities run from 1,290 members down to
 * 1, so giving each the same patch of sphere leaves the big ones overlapping
 * their neighbours into a single dark continent while hundreds of singletons
 * become lonely dust. Stepping by AREA instead -- z linear in the cumulative
 * size fraction, which is exactly equal-area on a sphere -- gives every
 * community room in proportion to what has to fit inside it.
 */
function areaWeightedDirection(
  cumulative: number,
  fraction: number,
  index: number
): [number, number, number] {
  const zz = 1 - 2 * (cumulative + fraction / 2);
  const rr = Math.sqrt(Math.max(0, 1 - zz * zz));
  const theta = Math.PI * (1 + Math.sqrt(5)) * index;
  return [Math.cos(theta) * rr, Math.sin(theta) * rr, zz];
}

export class Graph3D {
  private opts: Graph3DOptions;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera: PerspectiveCamera;
  private controls: OrbitControls;
  private raf = 0;
  private disposed = false;

  private nodes: N3[] = [];
  private edges: E3[] = [];
  private indexOf = new Map<string, number>();

  /** Where the layout says each node lives. The render buffer may differ by the
   *  magnet's displacement; this is the truth everything else is measured from. */
  private rest = new Float32Array(0);
  /** Where the layout wants each node. `rest` eases toward this during formation. */
  private target = new Float32Array(0);
  private forming = 0;
  private formingStart = 0;
  private formingFrom = new Float32Array(0);
  /** Where each node's Louvain community sits on the seed sphere. A weak pull
   *  toward this is what stops the force layout dissolving the communities the
   *  seeding just created. */
  private anchor = new Float32Array(0);
  private points: Points | null = null;
  private lines: LineSegments | null = null;
  private nodeAlpha = new Float32Array(0);
  private nodeSize = new Float32Array(0);
  /** Per node: how far into its arrival it is, 0 to 1. */
  private nodeEmerge = new Float32Array(0);
  /** Per node: where in the arrival window it starts, 0 to 1. */
  private emergeOrder = new Float32Array(0);
  private emergeStart = 0;
  /** Eased growth into the real, degree-derived sizes. */
  private sizeFrom: Float32Array | null = null;
  private sizeTo: Float32Array | null = null;
  private sizeStart = 0;
  /** Fade-up of the whole edge haze, so 26,000 lines do not appear on one frame. */
  private revealStart = 0;

  private advanceReveal() {
    if (!this.revealStart || !this.lines) return;
    const p = Math.min(1, (performance.now() - this.revealStart) / EDGE_REVEAL_MS);
    (this.lines.material as ShaderMaterial).uniforms.uReveal.value = 1 - Math.pow(1 - p, 3);
    if (p >= 1) this.revealStart = 0;
  }
  private baseSize = new Float32Array(0);
  private edgeAlpha = new Float32Array(0);
  /** Live per-vertex edge colour, and the per-edge hue to copy in when picked out. */
  private edgeColor = new Float32Array(0);
  private edgeTrueColor = new Float32Array(0);
  /* Where every channel is heading, where it started, and when each element is
   * allowed to begin. The live buffers ease between them; see advanceFade. */
  private nodeAlphaTo = new Float32Array(0);
  private nodeAlphaFrom = new Float32Array(0);
  private nodeSizeTo = new Float32Array(0);
  private nodeSizeFrom = new Float32Array(0);
  private nodeDelay = new Float32Array(0);
  private edgeAlphaTo = new Float32Array(0);
  private edgeAlphaFrom = new Float32Array(0);
  private edgeDelay = new Float32Array(0);
  private fadeStart = 0;

  private hiddenNodes = new Set<string>();
  private hiddenEdges = new Set<number>();
  private selected: string | null = null;
  private neighbours: Set<string> | null = null;
  private focusIds: Set<string> | null = null;
  /** The live colour buffer, and the palette to restore when compare mode ends. */
  private nodeColors = new Float32Array(0);
  private trueColors: Float32Array | null = null;
  private compareA: string | null = null;
  private compareB: string | null = null;

  private magnetOn = true;
  private pointer: { x: number; y: number } | null = null;
  private held: string | null = null;
  private displaced = new Map<number, { dx: number; dy: number; dz: number }>();

  /** Screen projections, refreshed once per frame and reused by hover, labels
   *  and the magnet rather than recomputed three times. */
  private proj = new Float32Array(0);
  private radius = 1;

  /* ── frame budget ────────────────────────────────────────────────────────
   *
   * The loop used to be unconditional -- re-armed at the top of every frame,
   * with nothing anywhere that could stop it. A landing-page hero is one
   * viewport tall, so within seconds of arriving every visitor has scrolled it
   * off screen and is then paying sixty frames a second for a canvas nobody
   * can see, for the rest of the session. That, not the 80KB download, is what
   * was felt as this page making the machine slow.
   *
   * Three gates now, in order of what they save: asleep when off screen or in
   * a background tab, half rate when nothing is being driven, and a
   * self-tuning step down when the machine still cannot keep up.
   */
  private onScreen = true;
  private pageVisible = true;
  private io: IntersectionObserver | null = null;
  private awake = true;
  private lastRender = 0;
  private lastLabels = 0;
  /** What the labels on screen were drawn for; see `drawLabelsThrottled`. */
  private labelFor = "";
  /** 0 full, 1 pixel ratio 1 and slower labels, 2 no labels at all. */
  private tier = 0;
  private dprCap = 1.5;
  private frames: number[] = [];
  private reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  private onVisibility = () => {
    this.pageVisible = document.visibilityState === "visible";
    this.sync();
  };

  /**
   * The one place the device pixel ratio is decided.
   *
   * Capped at 1.5 rather than 2: this is a cloud of soft dots and hairlines
   * behind body copy, and the top half of a retina ratio is spent on detail
   * none of it has. `degrade` lowers the cap again at runtime, which is why
   * every reader goes through here -- the label canvas has to move with the
   * scene or the names slide off their dots.
   */
  private dpr() {
    return Math.min(window.devicePixelRatio || 1, this.dprCap);
  }

  /**
   * Runs the loop iff it can be seen. Cancelling the frame outright is the
   * point: a `requestAnimationFrame` that returns early still costs a callback
   * sixty times a second, and background tabs are throttled unevenly by the
   * browser rather than stopped.
   *
   * Only rendering sleeps. Every animation here is driven by wall time, so a
   * cloud that was mid-formation when it went to sleep is simply settled when
   * it wakes -- which is what you want from something you scrolled away from.
   */
  private sync() {
    const want = this.onScreen && this.pageVisible && !this.disposed;
    if (want === this.awake) return;
    this.awake = want;
    if (want) {
      this.lastRender = 0;
      this.raf = requestAnimationFrame(this.loop);
    } else {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private watchVisibility() {
    document.addEventListener("visibilitychange", this.onVisibility);
    /* A margin, so it is already running by the time it arrives. Waking on the
     * exact boundary shows a frame or two of a frozen cloud sliding up the
     * screen before it starts turning again. */
    this.io = new IntersectionObserver(
      (entries) => {
        this.onScreen = entries[entries.length - 1].isIntersecting;
        this.sync();
      },
      { rootMargin: "200px" }
    );
    this.io.observe(this.opts.container);
  }

  constructor(opts: Graph3DOptions) {
    this.opts = opts;
    const { container } = opts;

    const transparent = opts.background === "transparent";
    /* No MSAA. The dots are round because the point shader masks them, not
     * because the sampler smooths them, so antialiasing buys nothing on the
     * 8,930 things you actually look at and pays for it on all 26,552 lines --
     * on a hero-sized canvas that is the single largest fragment cost here.
     *
     * `low-power` is the important one on laptops. A WebGL context with no
     * preference stated is enough to hand a dual-GPU MacBook to its discrete
     * chip and keep it there, which is felt as the whole machine getting hot
     * and slow rather than as this canvas being expensive. */
    this.renderer = new WebGLRenderer({
      antialias: false,
      alpha: transparent,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(this.dpr());
    if (transparent) this.renderer.setClearColor(new Color("#000000"), 0);
    else this.renderer.setClearColor(new Color(opts.background), 1);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";

    this.camera = new PerspectiveCamera(55, 1, 1, 20000);
    this.camera.position.set(0, 0, 1200);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    // Damping is what makes it feel like spinning a globe rather than dragging
    // a picture: the cloud keeps a little momentum when you let go.
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.85;
    this.controls.zoomSpeed = 0.9;
    this.controls.panSpeed = 0.7;
    this.controls.screenSpacePanning = true;

    this.bindPointer();
    this.watchVisibility();
    this.resize();
    this.loop();
  }

  /* ── data ── */

  private buildNodes(nodes: N3[]) {
    this.nodes = nodes;
    this.indexOf = new Map(nodes.map((n, i) => [n.id, i]));

    const n = nodes.length;
    this.rest = new Float32Array(n * 3);
    this.target = new Float32Array(n * 3);
    this.anchor = new Float32Array(n * 3);
    this.nodeAlpha = new Float32Array(n).fill(1);
    this.nodeAlphaTo = new Float32Array(n).fill(1);
    this.nodeAlphaFrom = new Float32Array(n).fill(1);
    this.nodeSizeTo = new Float32Array(n);
    this.nodeSizeFrom = new Float32Array(n);
    this.nodeDelay = new Float32Array(n);
    this.labelled = new Uint8Array(n);
    this.labelledPrev = new Uint8Array(n);
    this.formOrder = new Float32Array(n);
    this.baseSize = new Float32Array(n);
    this.nodeSize = new Float32Array(n);
    this.proj = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.baseSize[i] = nodes[i].size;
      this.nodeSize[i] = nodes[i].size;
    }

    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute("aSize", new BufferAttribute(this.nodeSize, 1));
    geo.setAttribute("aAlpha", new BufferAttribute(this.nodeAlpha, 1));
    const colors = new Float32Array(n * 3);
    const c = new Color();
    for (let i = 0; i < n; i++) {
      c.set(nodes[i].color);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("aColor", new BufferAttribute(colors, 3));
    this.nodeEmerge = new Float32Array(n).fill(1);
    this.emergeOrder = new Float32Array(n);
    this.emergeStart = 0;
    geo.setAttribute("aEmerge", new BufferAttribute(this.nodeEmerge, 1));
    // Compare mode repaints this in place and needs the originals to restore.
    this.nodeColors = colors;
    this.trueColors = null;
    this.compareA = null;
    this.compareB = null;

    const mat = new ShaderMaterial({
      vertexShader: NODE_VERT,
      fragmentShader: NODE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: {
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uNear: { value: 400 },
        uFar: { value: 2600 },
        uBreath: { value: 1 },
      },
    });
    this.points = new Points(geo, mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  private buildEdges(edges: E3[]) {
    this.edges = edges;
    const egeo = new BufferGeometry();
    egeo.setAttribute("position", new BufferAttribute(new Float32Array(edges.length * 6), 3));
    this.edgeAlpha = new Float32Array(edges.length * 2);
    this.edgeAlphaTo = new Float32Array(edges.length);
    this.edgeAlphaFrom = new Float32Array(edges.length);
    this.edgeDelay = new Float32Array(edges.length);
    egeo.setAttribute("aAlpha", new BufferAttribute(this.edgeAlpha, 1));

    /* Two colours per edge: the one it wears when picked out, parsed once
     * here, and the flat haze it wears the rest of the time. `applyVisibility`
     * copies whichever applies into the live buffer. */
    this.edgeTrueColor = new Float32Array(edges.length * 3);
    this.edgeColor = new Float32Array(edges.length * 6);
    const ec = new Color();
    const haze = new Color(this.opts.edgeColor);
    for (let k = 0; k < edges.length; k++) {
      ec.set(edges[k].color);
      this.edgeTrueColor[k * 3] = ec.r;
      this.edgeTrueColor[k * 3 + 1] = ec.g;
      this.edgeTrueColor[k * 3 + 2] = ec.b;
      for (let v = 0; v < 2; v++) {
        this.edgeColor[k * 6 + v * 3] = haze.r;
        this.edgeColor[k * 6 + v * 3 + 1] = haze.g;
        this.edgeColor[k * 6 + v * 3 + 2] = haze.b;
      }
    }
    egeo.setAttribute("aColor", new BufferAttribute(this.edgeColor, 3));
    const emat = new ShaderMaterial({
      vertexShader: EDGE_VERT,
      fragmentShader: EDGE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: {
        uNear: { value: 400 },
        uFar: { value: 2600 },
        uReveal: { value: 0 },
        uBreath: { value: 1 },
      },
    });
    this.lines = new LineSegments(egeo, emat);
    this.revealStart = performance.now();
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);
  }

  /**
   * Computes the target layout: every community gets a patch of the sphere in
   * proportion to how many members it has to fit, and its members fill that
   * patch on a golden-angle spiral, best-connected first.
   *
   * Equal spacing would be wrong. The communities run from over a thousand
   * members down to one, so giving each the same patch leaves the big ones
   * overlapping into a single dark continent while hundreds of singletons
   * become lonely dust.
   */
  private seed() {
    const byComm = new Map<number, number[]>();
    this.nodes.forEach((n, i) => {
      const c = n.community ?? 0;
      let arr = byComm.get(c);
      if (!arr) byComm.set(c, (arr = []));
      arr.push(i);
    });
    // Seating order comes from the worker, which chains communities by how much
    // edge weight they share, so neighbouring constellations are related rather
    // than merely similar in size. Size order is the pre-grouping fallback.
    const byId = new Map(byComm);
    const comms: [number, number[]][] = this.clusterOrder
      ? [...this.clusterOrder].filter((c) => byId.has(c)).map((c) => [c, byId.get(c)!])
      : [...byComm.entries()].sort((a, b) => b[1].length - a[1].length);
    /* Blob size is measured from the BASE radius and the cluster centres from
     * the scaled one. Scaling both together is the trap this file warns about
     * up top: it resizes the whole globe and changes nothing you can see. Kept
     * apart, `separation` genuinely opens the gaps between constellations. */
    const R = SEED_RADIUS;
    const centreR = SEED_RADIUS * this.layout.separation;

    /* ── the dust does not get a seat ──
     *
     * At the default resolution this graph has around 1,250 communities and
     * roughly 1,150 of them hold fewer than twenty nodes -- hundreds are a
     * single node. Allocating area by share of ALL nodes hands every one of
     * those specks its own patch of sphere, which is both why the globe is
     * sprayed with dust and why the real clusters are smaller than they need
     * to be. Below the threshold a community is parked outside the globe and
     * its share is redistributed to the clusters you can actually see.
     */
    const drawn = comms.filter(([, members]) => members.length >= this.minCluster);
    const parked = comms.filter(([, members]) => members.length < this.minCluster);
    const total = drawn.reduce((n, [, members]) => n + members.length, 0) || 1;
    let cumulative = 0;

    drawn.forEach(([_comm, members], ci) => {
      const fraction = members.length / total;
      const [ux, uy, uz] = areaWeightedDirection(cumulative, fraction, ci);
      cumulative += fraction;
      // At clump = 1 the constellations very nearly touch. Below that the globe
      // is mostly void with knots in it; above, they merge back into one
      // surface and the whole point is lost.
      const spread = (16 + R * Math.sqrt(fraction) * 0.95) * this.layout.clump;

      // A little deterministic variety per cluster: squashed a bit on each
      // axis and sitting at its own depth in the shell. Perfect balls all at
      // one radius read as a manufactured lattice; this reads as a galaxy,
      // and being hash-derived it is stable across reloads.
      /* Depth variety, so the shell has thickness rather than reading as a
       * single manufactured surface. Per CLUSTER, not per family: keying it on
       * the family put the largest family -- roughly a third of the graph -- at
       * one radius, which turned it into a dense band across one hemisphere.
       * Adjacency already comes from the seating order; depth does not need to
       * carry it too. */
      const h = hash3(ci);
      const sx = 0.75 + h[0] * 0.55;
      const sy = 0.75 + h[1] * 0.55;
      const sz = 0.75 + h[2] * 0.55;
      /* Cube-rooted so that at depth = 1 the clusters fill the ball evenly by
       * VOLUME rather than piling up near the middle. At 0 they all sit at the
       * same radius and the cloud is a hollow shell. */
      const solid = Math.cbrt(0.06 + 0.94 * h[0]);
      const shell = centreR * (1 - this.layout.depth * (1 - solid));
      const cx = ux * shell;
      const cy = uy * shell;
      const cz = uz * shell;

      /* Two positions per node, blended by `shape`. The BALL is a golden-angle
       * packing -- smooth, round, and telling you nothing except how many
       * members there are. The SHAPED one is the cluster's own force layout
       * from the worker, which is irregular and lobed and puts related
       * entities next to each other. Being able to slide between them is the
       * difference between "these are groups" and "this is what this group
       * looks like". */
      const shaped = this.clusterOffsets;
      const mix = shaped ? this.layout.shape : 0;

      // Best-connected first, so the hubs land at the core of their own
      // cluster and the periphery is dust.
      members.sort((x, y) => this.baseSize[y] - this.baseSize[x]);

      const seat = drawn.length > 1 ? ci / (drawn.length - 1) : 0;

      members.forEach((i, mi) => {
        this.formOrder[i] = Math.min(1, seat * 0.86 + hash3(i)[1] * 0.14);
        this.anchor[i * 3] = cx;
        this.anchor[i * 3 + 1] = cy;
        this.anchor[i * 3 + 2] = cz;

        const t = (mi + 0.5) / members.length;
        const a1 = mi * 2.399963229728653;
        const r = Math.cbrt(t);
        const zz = 1 - 2 * t;
        const rr = Math.sqrt(Math.max(0, 1 - zz * zz));
        const bx = Math.cos(a1) * rr * r * sx;
        const by = Math.sin(a1) * rr * r * sy;
        const bz = zz * r * sz;

        const fx = shaped ? shaped[i * 3] : bx;
        const fy = shaped ? shaped[i * 3 + 1] : by;
        const fz = shaped ? shaped[i * 3 + 2] : bz;

        this.target[i * 3] = cx + (bx + (fx - bx) * mix) * spread;
        this.target[i * 3 + 1] = cy + (by + (fy - by) * mix) * spread;
        this.target[i * 3 + 2] = cz + (bz + (fz - bz) * mix) * spread;
      });
    });

    /* Parked well outside the globe rather than left where they were. The page
     * hides them, and `fit` ignores anything at zero alpha, so they cost
     * nothing -- but they are placed rather than stale, so lowering the
     * threshold flies them back in instead of teleporting them. */
    parked.forEach(([, members], pi) => {
      const [ux, uy, uz] = fibonacciSphere(pi, Math.max(1, parked.length));
      const far = centreR * 2.6;
      for (const i of members) {
        this.formOrder[i] = 1;
        this.anchor[i * 3] = ux * far;
        this.anchor[i * 3 + 1] = uy * far;
        this.anchor[i * 3 + 2] = uz * far;
        this.target[i * 3] = ux * far;
        this.target[i * 3 + 1] = uy * far;
        this.target[i * 3 + 2] = uz * far;
      }
    });
  }

  /**
   * Computes the target layout and starts the cloud moving toward it.
   *
   * There is deliberately no force pass here. Three separate attempts at one
   * (d3-force-3d, twice by me and once with a collide force and an organ nudge)
   * all did the same two things: cost the better part of twenty seconds of
   * frozen main thread, and dissolve the communities back into a single grey
   * ball. The cause is a property of the data, not the tuning -- this graph is
   * close to a bipartite mesh of tumours against markers, and a handful of
   * universal markers (CK7, CD34, S100) touch hundreds of things across every
   * organ system. Those act as guy-ropes, and d3-force has neither LinLog
   * attraction nor dissuade-hubs, the two settings that let the old 2D layout
   * separate anything at all. The link force always wins.
   *
   * So the structure is placed rather than discovered, from a partition that
   * was computed properly. It is deterministic, it is instant, and it is the
   * version that actually looks like a globe of star clusters.
   */
  private startLayout(animate = false) {
    this.seed();
    if (animate) {
      /* The first opening starts from a collapsed core rather than from
       * wherever the nodes happened to be, so the cloud blooms outward instead
       * of rearranging itself. Every later relayout keeps its current
       * positions -- an established cloud collapsing and re-exploding every
       * time a slider moves would be theatre. */
      if (!this.hasOpened) {
        // Draw in first, then release. `advanceGather` re-enters here once the
        // cloud has arrived at the core, with hasOpened set so it goes straight
        // to the bloom.
        this.hasOpened = true;
        this.beginGather();
        return;
      }
      this.beginFormation();
    }
    else {
      this.rest.set(this.target);
      this.pushPositions();
      this.fit();
    }
  }

  /**
   * Starts the cloud easing from wherever it is into the computed layout.
   *
   * This is the "forming" animation, and it is not decoration: the two states
   * it interpolates between are both real. Before communities are known every
   * node genuinely is an undifferentiated speck in a shell, because that is all
   * the data supports; afterwards it genuinely belongs to a cluster. The
   * transition shows the partition being applied rather than pretending work is
   * happening behind a spinner.
   */
  private beginFormation() {
    this.formingStart = performance.now();
    this.formingFrom = this.rest.slice();
    this.forming = 0.0001;
  }

  private hasOpened = false;

  /** Where node `i` sits when the cloud is drawn in to its core. */
  private collapsedAt(i: number, axis: number) {
    const jitter = 1 + (hash3(i * 3)[0] - 0.5) * 0.5;
    return this.target[i * 3 + axis] * COLLAPSE * jitter;
  }

  /** Eases the cloud inward, accelerating, before the bloom releases it. */
  private beginGather() {
    this.gatherFrom = this.rest.slice();
    this.gatherStart = performance.now();
    this.settledAt = 0;
    this.opts.onSettling(true);
  }

  private advanceGather() {
    if (!this.gatherStart) return;
    const p = Math.min(1, (performance.now() - this.gatherStart) / GATHER_MS);
    // Ease IN: slow to leave, quick to arrive. The opposite curve to the bloom,
    // which is what makes the pair read as anticipation and release.
    const t = p * p * p;
    for (let i = 0; i < this.nodes.length; i++) {
      for (let a = 0; a < 3; a++) {
        const k = i * 3 + a;
        this.rest[k] = this.gatherFrom[k] + (this.collapsedAt(i, a) - this.gatherFrom[k]) * t;
      }
    }
    this.pushPositions();
    if (p >= 1) {
      this.gatherStart = 0;
      this.gatherFrom = new Float32Array(0);
      this.beginFormation();
    }
  }

  private gatherFrom = new Float32Array(0);
  private gatherStart = 0;
  /**
   * Per node: when in the opening its cluster takes flight, 0 to 1.
   *
   * Taken from the cluster's seat on the sphere, which the seating order walks
   * pole to pole -- so the bloom sweeps across the globe rather than popping
   * at random. A little per-node jitter on top, or each cluster arrives as one
   * rigid object.
   */
  private formOrder = new Float32Array(0);

  /** Ease-out cubic against the clock: fast commitment, soft landing. */
  private advanceFormation() {
    if (!this.forming) return;
    const p = Math.min(1, (performance.now() - this.formingStart) / FORMATION_MS);
    const span = 1 - FORMATION_RISE;
    /* Per node, not global. Each one waits for its cluster's turn and then
     * takes FORMATION_RISE of the window to fly, so the globe assembles
     * constellation by constellation rather than swelling all at once. */
    for (let i = 0; i < this.nodes.length; i++) {
      const local = Math.min(
        1,
        Math.max(0, (p - this.formOrder[i] * span) / FORMATION_RISE)
      );
      const t = 1 - Math.pow(1 - local, 3);
      for (let k = i * 3; k < i * 3 + 3; k++) {
        this.rest[k] = this.formingFrom[k] + (this.target[k] - this.formingFrom[k]) * t;
      }
    }
    this.pushPositions();
    // Track the growing cloud rather than framing it once at the start, or the
    // formation happens mostly off-screen.
    if (p < 1) this.fit(true);
    else {
      this.rest.set(this.target);
      this.pushPositions();
      this.fit();
      this.forming = 0;
      this.formingFrom = new Float32Array(0);
      this.settledAt = performance.now();
      this.opts.onSettling(false);
    }
  }

  /**
   * Stage one: nodes only, scattered. Called as soon as the node half of the
   * payload lands, which is about a fifth of the bytes -- so there is a cloud
   * on screen long before there is a graph.
   */
  setNodes(nodes: N3[]) {
    this.buildNodes(nodes);
    const R = SEED_RADIUS;
    for (let i = 0; i < nodes.length; i++) {
      const h = hash3(i);
      const zz = 1 - 2 * h[0];
      const rr = Math.sqrt(Math.max(0, 1 - zz * zz));
      const a = h[1] * Math.PI * 2;
      const rad = R * (0.55 + h[2] * 0.5);
      this.rest[i * 3] = Math.cos(a) * rr * rad;
      this.rest[i * 3 + 1] = Math.sin(a) * rr * rad;
      this.rest[i * 3 + 2] = zz * rad;
    }
    this.target.set(this.rest);
    this.applyVisibility();
    this.pushPositions();
    this.fit();
    this.beginEmergence();
    /* The cloud turns by itself until it has finished forming. The gaps between
     * the load's stages are seconds long -- three of them, waiting on a 4MB
     * payload and then on Leiden -- and a still picture during those reads as a
     * hang. A slow orbit makes the whole load one continuous thing. */
    this.controls.autoRotate = true;
  }

  /**
   * Starts the arrival: a wave sweeping through space, with a little fizz.
   *
   * Ordering by position rather than at random is what makes it read as one
   * moving front instead of television static -- the cloud is written across
   * the screen rather than sprayed onto it. The jitter stops the front being a
   * hard plane, which looks mechanical. Deterministic, so a reload plays the
   * same entrance rather than a different one each time.
   */
  private beginEmergence() {
    const n = this.nodes.length;
    if (!n) return;
    // A tilted axis, so the wave crosses the cloud diagonally rather than
    // along a screen axis, where it would read as a wipe.
    const ax = 0.78;
    const ay = 0.31;
    const az = 0.54;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < n; i++) {
      const along = this.rest[i * 3] * ax + this.rest[i * 3 + 1] * ay + this.rest[i * 3 + 2] * az;
      const raw = along + hash3(i)[0] * SEED_RADIUS * 0.44;
      this.emergeOrder[i] = raw;
      this.nodeEmerge[i] = 0;
      if (raw < lo) lo = raw;
      if (raw > hi) hi = raw;
    }
    /* Normalised across the actual spread rather than an assumed one. A dot
     * product against a shell clusters near the middle and never reaches its
     * own extremes, so a fixed mapping wastes the ends of the window: the
     * screen sits empty for the first ~150ms and the last third is a handful of
     * stragglers. Stretching the observed range means the wave starts on the
     * first frame and is still arriving at the last. */
    const range = hi - lo || 1;
    for (let i = 0; i < n; i++) this.emergeOrder[i] = (this.emergeOrder[i] - lo) / range;
    this.emergeStart = performance.now();
    if (this.points) {
      (this.points.geometry.getAttribute("aEmerge") as BufferAttribute).needsUpdate = true;
    }
  }

  /** One attribute write per frame for the whole arrival; no geometry work. */
  private advanceEmergence() {
    if (!this.emergeStart || !this.points) return;
    const t = (performance.now() - this.emergeStart) / EMERGE_MS;
    const span = 1 - EMERGE_RISE;
    for (let i = 0; i < this.nodes.length; i++) {
      const p = Math.min(1, Math.max(0, (t - this.emergeOrder[i] * span) / EMERGE_RISE));
      // Ease-out cubic, matching the formation that follows it.
      this.nodeEmerge[i] = 1 - Math.pow(1 - p, 3);
    }
    (this.points.geometry.getAttribute("aEmerge") as BufferAttribute).needsUpdate = true;
    if (t >= 1) {
      this.nodeEmerge.fill(1);
      this.emergeStart = 0;
    }
  }

  /**
   * Degrees only exist once the edges have landed, so the real star sizes
   * arrive a beat after the stars do.
   */
  setSizes(sizes: Float32Array) {
    /* Eased rather than assigned. Every node is the same size until the edges
     * land, and writing the real ones straight in makes the whole cloud jump
     * and every label appear on the same frame -- the second of the three
     * bangs the load used to be. Grown instead, the hubs swell over most of a
     * second and their names cross the labelling threshold at their own
     * moments, which is also most of the wait for Leiden covered. */
    this.sizeFrom = this.baseSize.slice();
    this.sizeTo = new Float32Array(this.nodes.length);
    for (let i = 0; i < this.nodes.length; i++) {
      this.sizeTo[i] = i < sizes.length ? sizes[i] : this.baseSize[i];
      this.nodes[i].size = this.sizeTo[i];
    }
    this.sizeStart = performance.now();
  }

  private advanceSizes() {
    if (!this.sizeStart || !this.sizeFrom || !this.sizeTo) return;
    const p = Math.min(1, (performance.now() - this.sizeStart) / SIZE_MS);
    const t = 1 - Math.pow(1 - p, 3);
    for (let i = 0; i < this.baseSize.length; i++) {
      this.baseSize[i] = this.sizeFrom[i] + (this.sizeTo[i] - this.sizeFrom[i]) * t;
    }
    this.applyNodeVisibility();
    if (p >= 1) {
      this.baseSize.set(this.sizeTo);
      this.sizeStart = 0;
      this.sizeFrom = null;
      this.sizeTo = null;
      this.applyNodeVisibility();
    }
  }

  /** Stage two: the edges arrive and get their own buffer. */
  setEdges(edges: E3[]) {
    this.buildEdges(edges);
    this.applyVisibility();
    this.pushPositions();
  }

  /** Stage three: communities are known, so the cloud can form. */
  applyCommunities(
    communities: Int32Array,
    order: Int32Array,
    family: Int32Array,
    offsets: Float32Array
  ) {
    for (let i = 0; i < this.nodes.length; i++) {
      this.nodes[i].community = communities[i] ?? 0;
    }
    this.clusterOrder = order;
    this.clusterFamily = family;
    this.clusterOffsets = offsets;
    this.opts.onSettling(true);
    this.startLayout(true);
  }

  /** Seating order for the communities, chained by shared edge weight. */
  private clusterOrder: Int32Array | null = null;
  /** Family of each seated community, parallel to `clusterOrder`. */
  private clusterFamily: Int32Array | null = null;
  /** Per-node position inside its own cluster, as a unit ball. */
  private clusterOffsets: Float32Array | null = null;

  relayout() {
    if (!this.nodes.length) return;
    this.startLayout(true);
  }

  /* ── writing to the GPU ── */

  /** Copies rest positions (plus any magnet displacement) into the buffers. */
  private pushPositions() {
    this.posEpoch++;
    if (!this.points) return;
    const pos = this.points.geometry.getAttribute("position") as BufferAttribute;
    const arr = pos.array as Float32Array;
    arr.set(this.rest);
    for (const [i, d] of this.displaced) {
      arr[i * 3] += d.dx;
      arr[i * 3 + 1] += d.dy;
      arr[i * 3 + 2] += d.dz;
    }
    pos.needsUpdate = true;

    if (!this.lines) {
      this.updateDepthRange();
      return;
    }
    const epos = this.lines.geometry.getAttribute("position") as BufferAttribute;
    const earr = epos.array as Float32Array;
    for (let k = 0; k < this.edges.length; k++) {
      const a = this.edges[k].s * 3;
      const b = this.edges[k].t * 3;
      earr[k * 6] = arr[a];
      earr[k * 6 + 1] = arr[a + 1];
      earr[k * 6 + 2] = arr[a + 2];
      earr[k * 6 + 3] = arr[b];
      earr[k * 6 + 4] = arr[b + 1];
      earr[k * 6 + 5] = arr[b + 2];
    }
    epos.needsUpdate = true;

    // Depth cueing needs to know how deep the cloud actually is.
    let max = 1;
    for (let i = 0; i < this.rest.length; i += 3) {
      const d = Math.hypot(this.rest[i], this.rest[i + 1], this.rest[i + 2]);
      if (d > max) max = d;
    }
    this.radius = max;
    this.updateDepthUniforms();
  }

  /**
   * The range the depth-cueing shaders fade across, refreshed every frame.
   *
   * This used to be written only when node POSITIONS changed, and measured from
   * the world origin rather than from the cloud. Zooming out therefore left it
   * frozen: every node slid past the stale `uFar`, `depth` clamped to 1, and
   * the entire cloud faded to the far-side alpha -- it looked like the graph
   * dissolving as you pulled back. It depends on where the camera is, so it has
   * to be recomputed when the camera moves, which is potentially every frame.
   */
  private updateDepthUniforms() {
    const mats = [this.points?.material, this.lines?.material].filter(
      Boolean
    ) as ShaderMaterial[];
    if (!mats.length) return;
    const away = this.camera.position.distanceTo(this.controls.target);
    const near = Math.max(1, away - this.radius);
    const far = away + this.radius;
    for (const m of mats) {
      m.uniforms.uNear.value = near;
      m.uniforms.uFar.value = far;
    }
  }

  /** Recomputes the near/far range the depth-cueing shaders fade across. */
  private updateDepthRange() {
    let max = 1;
    for (let i = 0; i < this.rest.length; i += 3) {
      const d = Math.hypot(this.rest[i], this.rest[i + 1], this.rest[i + 2]);
      if (d > max) max = d;
    }
    this.radius = max;
    this.updateDepthUniforms();
  }

  setVisible(hiddenNodes: Set<string>, hiddenEdges: Set<number>) {
    this.hiddenNodes = hiddenNodes;
    this.hiddenEdges = hiddenEdges;
    this.applyVisibility();
  }

  /**
   * What the highlight actually did, for checking from the console when the
   * screen and the code disagree. Debug page; not called by anything.
   */
  highlightState() {
    let dim = 0;
    let full = 0;
    let hidden = 0;
    for (let i = 0; i < this.nodes.length; i++) {
      const a = this.nodeAlpha[i];
      if (a === 0) hidden++;
      else if (a < 0.5) dim++;
      else full++;
    }
    return {
      selected: this.selected,
      neighbours: this.neighbours ? this.neighbours.size : null,
      focusIds: this.focusIds ? this.focusIds.size : null,
      nodes: { full, dim, hidden },
    };
  }

  /**
   * Nodes that must stay findable while something is selected.
   *
   * The way back, and the way up: the node you arrived from, and the parent
   * this one is a subtype of. Both are already in the neighbourhood -- edges
   * are undirected, so wherever you came from is adjacent to where you are --
   * but being adjacent is not the same as being findable among forty other
   * adjacent dots. These are always named and always a little larger, which
   * also makes them more magnetic, since the magnet already favours anything
   * wearing a label.
   */
  setWaypoints(ids: Iterable<string>) {
    this.waypoints = new Set(ids);
    this.applyVisibility(true);
  }

  private waypoints = new Set<string>();

  setHighlight(selected: string | null, neighbours: Set<string> | null) {
    this.selected = selected;
    this.neighbours = neighbours;
    this.applyVisibility(true);
    this.easeToSelection();
  }

  /**
   * Focus swaps in a local layout: the node at the centre, its neighbours on
   * concentric spherical shells by hop distance. The global coordinates are
   * kept aside and restored on the way out.
   *
   * Deliberately not a force layout. A solver over a dozen nodes either
   * collapses them together or wanders, and neither beats shells you can read
   * at a glance -- and the shells make hop distance visible, which is the only
   * thing the depth control is for.
   */
  setFocus(ids: Set<string> | null, hops?: Map<string, number>) {
    if (ids && hops) {
      if (!this.globalRest) this.globalRest = this.rest.slice();
      const byHop = new Map<number, string[]>();
      for (const [id, d] of hops) {
        let a = byHop.get(d);
        if (!a) byHop.set(d, (a = []));
        a.push(id);
      }
      for (const [d, members] of byHop) {
        const shell = d === 0 ? 0 : 130 * d + Math.min(260, members.length * 1.6);
        members.forEach((id, mi) => {
          const i = this.indexOf.get(id);
          if (i === undefined) return;
          if (members.length === 1 || d === 0) {
            this.rest[i * 3] = 0;
            this.rest[i * 3 + 1] = 0;
            this.rest[i * 3 + 2] = 0;
            return;
          }
          const [ux, uy, uz] = fibonacciSphere(mi, members.length);
          this.rest[i * 3] = ux * shell;
          this.rest[i * 3 + 1] = uy * shell;
          this.rest[i * 3 + 2] = uz * shell;
        });
      }
    } else if (this.globalRest) {
      this.rest.set(this.globalRest);
      this.globalRest = null;
    }
    this.focusIds = ids;
    this.displaced.clear();
    this.applyVisibility();
    this.pushPositions();
    this.fit();
  }

  private layout: LayoutParams = { ...DEFAULT_LAYOUT };
  /** Communities smaller than this are parked out of sight and, crucially, take
   *  no share of the sphere. See `seed`. */
  private minCluster = 1;

  setMinCluster(n: number) {
    if (n === this.minCluster) return;
    this.minCluster = n;
    if (!this.nodes.length || !this.clusterOrder) return;
    this.seed();
    this.applySeed();
  }

  /**
   * Reshapes the cloud in place.
   *
   * Re-seeds and snaps rather than easing, because this is called from a
   * slider drag and an eased transition per tick reads as lag. The camera is
   * deliberately left alone -- refitting on every tick would be unwatchable.
   */
  setLayout(next: Partial<LayoutParams>) {
    this.layout = { ...this.layout, ...next };
    // Before the partition lands there is nothing to shape -- every node is in
    // community 0 and seeding would collapse the loading shell into one ball.
    if (!this.nodes.length || !this.clusterOrder) return;
    this.seed();
    // A local layout (focus, compare) owns `rest`; reshape the global one it is
    // holding aside so the change is there when it is put back.
    if (this.globalRest) {
      this.globalRest.set(this.target);
      return;
    }
    this.applySeed();
  }

  /**
   * Eases every channel toward what `applyVisibility` last asked for.
   *
   * One clock, per-element delays. A node or edge with delay 0 starts
   * immediately and one with delay 1 starts FADE_STAGGER of the way through,
   * so the neighbourhood is dealt outward from the selection while the rest of
   * the cloud recedes underneath it.
   */
  /**
   * Drifts the view onto whatever was just selected.
   *
   * Walking the graph is the interaction now -- select, step to a neighbour,
   * step again -- and without this the cloud stays put while the thing you are
   * reading wanders toward the edge of the screen. Only the orbit TARGET moves,
   * not the distance or the angle, so it reads as turning to look rather than
   * as being flown somewhere.
   */
  /**
   * Turns the globe so the selection faces you, rather than flying to it.
   *
   * The orbit target stays on the cloud's centre throughout. Moving the camera
   * onto the line through the centre and the node puts that node between the
   * viewer and the middle of the cloud, which lands it dead centre on screen
   * while everything else stays where it was -- a rotation, not a trip. Flying
   * the target onto the node instead, which is what this did before, meant the
   * view crept somewhere new with every click and the cloud drifted out of
   * frame after a few.
   *
   * The distance is chosen to fit the whole neighbourhood, then clamped near
   * the resting distance. Selecting a hub whose neighbours span the globe
   * therefore barely zooms at all, which is correct: they all have to be
   * visible, and they are everywhere.
   */
  private easeToSelection() {
    if (this.focusIds || !this.homeDistance) {
      this.travelUntil = 0;
      return;
    }
    const from = this.camera.position.clone();
    const dir = from.clone().sub(this.controls.target).normalize();

    if (!this.selected) {
      // Deselecting returns home: same angle, centred again, resting distance.
      this.travelCamTo.copy(this.homeCentre).addScaledVector(dir, this.homeDistance);
    } else {
      const i = this.indexOf.get(this.selected);
      if (i === undefined) return;
      const node = new Vector3(this.rest[i * 3], this.rest[i * 3 + 1], this.rest[i * 3 + 2]);

      let radius = node.distanceTo(this.homeCentre);
      if (this.neighbours) {
        for (const id of this.neighbours) {
          const j = this.indexOf.get(id);
          if (j === undefined) continue;
          radius = Math.max(
            radius,
            Math.hypot(
              this.rest[j * 3] - this.homeCentre.x,
              this.rest[j * 3 + 1] - this.homeCentre.y,
              this.rest[j * 3 + 2] - this.homeCentre.z
            )
          );
        }
      }
      const needed = (radius * FRAME_MARGIN) / Math.tan((this.camera.fov * Math.PI) / 360);
      const distance = Math.min(
        this.homeDistance * ZOOM_MAX,
        Math.max(this.homeDistance * ZOOM_MIN, needed)
      );
      const facing = node.clone().sub(this.homeCentre);
      // A node sitting at the very centre has no direction to face; leave the
      // angle alone and just settle the distance.
      if (facing.lengthSq() < 1) facing.copy(dir);
      this.travelCamTo.copy(this.homeCentre).addScaledVector(facing.normalize(), distance);
    }

    this.travelCamFrom.copy(from);
    this.travelTargetFrom.copy(this.controls.target);
    this.travelStart = performance.now();
    this.travelUntil = this.travelStart + TRAVEL_MS;
  }

  private advanceTravel() {
    if (!this.travelUntil) return;
    const p = Math.min(1, (performance.now() - this.travelStart) / TRAVEL_MS);
    const t = 1 - Math.pow(1 - p, 3);
    this.controls.target.lerpVectors(this.travelTargetFrom, this.homeCentre, t);
    this.camera.position.lerpVectors(this.travelCamFrom, this.travelCamTo, t);
    if (p >= 1) this.travelUntil = 0;
  }

  private travelCamTo = new Vector3();
  private travelCamFrom = new Vector3();
  private travelTargetFrom = new Vector3();
  private travelStart = 0;
  private travelUntil = 0;
  /** The resting framing: where the whole cloud sits, and how far back it fits. */
  private homeCentre = new Vector3();
  private homeDistance = 0;

  private advanceFade() {
    if (!this.fadeStart || !this.points) return;
    const p = Math.min(1, (performance.now() - this.fadeStart) / FADE_MS);
    const span = 1 - FADE_STAGGER;

    for (let i = 0; i < this.nodes.length; i++) {
      const local = Math.min(1, Math.max(0, (p - this.nodeDelay[i] * FADE_STAGGER) / span));
      const t = 1 - Math.pow(1 - local, 3);
      this.nodeAlpha[i] = this.nodeAlphaFrom[i] + (this.nodeAlphaTo[i] - this.nodeAlphaFrom[i]) * t;
      this.nodeSize[i] = this.nodeSizeFrom[i] + (this.nodeSizeTo[i] - this.nodeSizeFrom[i]) * t;
    }
    (this.points.geometry.getAttribute("aAlpha") as BufferAttribute).needsUpdate = true;
    (this.points.geometry.getAttribute("aSize") as BufferAttribute).needsUpdate = true;

    if (this.lines) {
      for (let k = 0; k < this.edges.length; k++) {
        const local = Math.min(1, Math.max(0, (p - this.edgeDelay[k] * FADE_STAGGER) / span));
        const t = 1 - Math.pow(1 - local, 3);
        const a = this.edgeAlphaFrom[k] + (this.edgeAlphaTo[k] - this.edgeAlphaFrom[k]) * t;
        this.edgeAlpha[k * 2] = a;
        this.edgeAlpha[k * 2 + 1] = a;
      }
      (this.lines.geometry.getAttribute("aAlpha") as BufferAttribute).needsUpdate = true;
    }
    if (p >= 1) this.fadeStart = 0;
  }

  /**
   * Resistance past the resting framing, and a bounce past that.
   *
   * Zooming out from a globe has a natural end: once the whole thing is in
   * frame there is nothing further to see, and every pixel after that just
   * makes it smaller. Rather than a hard stop -- which reads as the scroll
   * being broken -- the last stretch is elastic: the excess distance is
   * reclaimed a seventh at a time, so pulling back feels heavy and creeps in
   * when you let go.
   *
   * Push through the elastic anyway and it lets go entirely, and the cloud
   * collapses and blooms again. That is the same opening it arrived with, which
   * makes the far edge of the zoom feel like a deliberate boundary rather than
   * a limit someone forgot to set.
   */
  private updateZoomBounds() {
    if (!this.homeDistance || this.travelUntil || this.focusIds) {
      this.zoomRaw = 0;
      return;
    }
    /* Through the reset, the framing is held rather than left alone. This used
     * to bail out while the cloud gathered and bloomed -- three seconds during
     * which the wheel, which the reader is usually still spinning at the moment
     * it triggers, was completely unopposed. The view sailed outward and the
     * implosion happened somewhere in the distance, which is what made the
     * whole thing look like it zoomed out before it did anything else. */
    if (this.forming || this.gatherStart) {
      this.zoomRaw = 0;
      const dir = this.camera.position.clone().sub(this.controls.target);
      if (dir.lengthSq() > 1e-6) {
        /* Eased, not snapped. Setting the distance outright at the moment the
         * trigger fired made the cloud jump from far-away-small to normal size
         * and only THEN implode -- an extra beat that read as the reset
         * changing its mind. Gliding in over the gather instead means the
         * camera's approach and the cloud's collapse are one movement: the
         * apparent size barely changes while the cloud draws itself in, and the
         * explosion is the only thing that reads as an event.
         *
         * It doubles as the constraint on the wheel: every frame pulls back
         * toward home, so input during the reset goes nowhere. */
        const want = this.homeCentre
          .clone()
          .addScaledVector(dir.normalize(), this.homeDistance);
        this.controls.target.lerp(this.homeCentre, RESET_EASE);
        this.camera.position.lerp(want, RESET_EASE);
      }
      return;
    }
    const now = performance.now();
    const offset = this.camera.position.clone().sub(this.controls.target);
    const d = offset.length();
    const soft = this.homeDistance * ZOOM_SOFT;

    /* The raw distance is tracked separately from the shown one, because the
     * camera is written every frame with a compressed value and OrbitControls
     * would otherwise take that compressed value as the base for the next
     * dolly -- so the overshoot would be forgotten as fast as it accumulated,
     * and there would be no way to know how hard you were pulling. */
    if (!this.zoomRaw) {
      if (d <= soft) return;
      this.zoomRaw = d;
      this.zoomShown = d;
      this.lastZoomInput = now;
    } else {
      /* By RATIO, not by difference. OrbitControls dollies multiplicatively --
       * a wheel notch is a fixed percentage of whatever it is currently showing
       * -- and the shown distance is compressed. Adding the absolute delta to
       * the raw distance therefore fed a shrinking number into it: as `shown`
       * approached its asymptote each notch contributed less and less to `raw`,
       * so resistance saturated into a wall and the snap sat unreachably far
       * away. The ratio is what the user actually asked for, and it is
       * independent of what they are being shown. */
      const ratio = this.zoomShown > 0 ? d / this.zoomShown : 1;
      if (Math.abs(ratio - 1) > 1e-4) this.lastZoomInput = now;
      this.zoomRaw *= ratio;
    }
    if (this.zoomRaw <= soft) {
      this.zoomRaw = 0;
      return;
    }

    const band = this.homeDistance * ZOOM_BAND;
    const excess = this.zoomRaw - soft;

    if (this.zoomRaw > soft * ZOOM_SNAP && now - this.bouncedAt > BOUNCE_COOLDOWN_MS) {
      this.bouncedAt = now;
      this.zoomRaw = 0;
      // Quiet the names and replay the arrival. `hasOpened` is what gates the
      // collapse, so clearing it is the whole trigger.
      this.settledAt = 0;
      this.hasOpened = false;
      /* The camera is deliberately NOT moved here. It eases home over the
       * gather instead, in the branch above -- moving it now is exactly the
       * jump that made the reset look like it grew before it collapsed. */
      this.startLayout(true);
      return;
    }

    /* Logarithmic. The derivative at zero excess is exactly 1, so resistance
     * begins at nothing and grows smoothly from the boundary; and because it
     * never flattens, every further turn of the wheel still visibly buys
     * something -- just less than the last one did. */
    const shown = soft + band * Math.log1p(excess / band);
    this.zoomShown = shown;
    this.camera.position.copy(this.controls.target).addScaledVector(offset.normalize(), shown);
  }

  private bouncedAt = 0;
  /** What the user has actually asked for, and what they were shown. */
  private zoomRaw = 0;
  private zoomShown = 0;
  private lastZoomInput = 0;

  /** Moves the cloud onto whatever `seed` just computed. */
  private applySeed() {
    // Mid-formation, re-seeding is enough: the animation is already easing
    // toward `target` and will simply land on the new one.
    if (this.forming) return;
    this.rest.set(this.target);
    this.displaced.clear();
    this.pushPositions();
    /* Reshaping changes how big the cloud IS, so without this it walks out of
     * frame and the slider reads as broken. Eased in the render loop rather
     * than snapped here: a hard refit per tick fights a drag, and one soft step
     * per tick is too little to converge after a single click. */
    this.refitUntil = performance.now() + 700;
  }

  private refitUntil = 0;
  /** When the cloud last stopped moving; labels wake from this. */
  private tilted = false;
  /** The live breath scale, mirrored from the shader uniform. */
  private breath = 1;
  /** Reused so label measurement does not allocate a vector per frame. */
  private scratch = new Vector3();
  /** 1 where the node's name was drawn this frame. Read by the magnet. */
  private labelled = new Uint8Array(0);
  /** The same, one frame back. Names already on screen keep their place. */
  private labelledPrev = new Uint8Array(0);
  private settledAt = 0;
  /** When the pointer last did anything; standby resumes after a pause. */
  private lastInput = 0;

  /**
   * Standby is the resting state, not the absence of one.
   *
   * A cloud that stops dead the moment you let go reads as switched off. It
   * turns instead -- slowly enough that you notice it only if you look, and
   * around a tilted axis so the motion is a drift rather than a spin. Any input
   * stops it at once; it comes back a few seconds after you stop.
   */
  /** Gathering, blooming or still arriving: the cloud is not yours yet. */
  private isAnimating() {
    return !!(this.gatherStart || this.forming || this.emergeStart);
  }

  private updateStandby() {
    const now = performance.now();
    if (this.points && this.lines) {
      // Breathes whatever else is happening: suspending it during a formation
      // or a focus would show up as the cloud holding its breath.
      const phase = Math.sin((now / BREATH_MS) * Math.PI * 2);
      /* Held at rest under `prefers-reduced-motion`. Sustained idle movement
       * is exactly what the preference is about, and stilling the breath is
       * also what lets the frame gate below stop re-rendering entirely. */
      const scale = this.reduced ? 1 : 1 + phase * BREATH_AMOUNT;
      (this.points.material as ShaderMaterial).uniforms.uBreath.value = scale;
      (this.lines.material as ShaderMaterial).uniforms.uBreath.value = scale;
      // `project` has to apply the same scale. It reads the raw positions, and
      // the shader draws them scaled -- so without this every screen coordinate
      // the page computes (labels, hover, the magnet) sits a little away from
      // the dot it belongs to, and slides on the breath's nine-second cycle.
      this.breath = scale;
    }
    /* The spin is eased every frame, including through the opening, which is
     * the whole point: the speed it should be turning at changes abruptly, and
     * what you see should not. */
    const animating = this.isAnimating();
    const want = animating ? SPIN_OPEN : STANDBY_SPEED;
    this.spin += (want - this.spin) * SPIN_EASE;
    this.controls.autoRotateSpeed = this.spin;

    if (this.focusIds) {
      this.controls.autoRotate = false;
      return;
    }
    // While it is opening it turns regardless; there is no input to yield to.
    this.controls.autoRotate =
      !this.reduced && (animating || now - this.lastInput > STANDBY_RESUME_MS);
  }

  private spin = SPIN_OPEN;

  private globalRest: Float32Array | null = null;

  /**
   * Compare mode: two entities, drawn as a Venn diagram in space.
   *
   * A's exclusive neighbours fill a ball on the left, B's a ball on the right,
   * and everything both of them touch sits in a third ball between them. The
   * two entities themselves anchor their own lobes. Colour carries the same
   * three-way split, because position alone stops being readable the moment you
   * spin the thing.
   *
   * This shares `globalRest` with `setFocus` -- both swap in a local layout and
   * put the global one back on the way out -- so the page must never have both
   * on at once. Entering compare clears the focus, and vice versa.
   */
  setCompare(spec: CompareSpec | null) {
    if (!this.points) return;

    if (!spec) {
      if (this.trueColors) {
        this.nodeColors.set(this.trueColors);
        (this.points.geometry.getAttribute("aColor") as BufferAttribute).needsUpdate = true;
        this.trueColors = null;
      }
      if (this.globalRest) {
        this.rest.set(this.globalRest);
        this.globalRest = null;
      }
      this.compareA = null;
      this.compareB = null;
      this.focusIds = null;
      this.displaced.clear();
      this.applyVisibility();
      this.pushPositions();
      this.fit();
      return;
    }

    if (!this.globalRest) this.globalRest = this.rest.slice();
    if (!this.trueColors) this.trueColors = this.nodeColors.slice();
    // Every re-spec repaints from the true palette, or a previous comparison's
    // tints would survive into the next one.
    else this.nodeColors.set(this.trueColors);

    /* Ball radius from member count, cube-rooted: the members fill a VOLUME, so
     * a lobe with eight times the members should be twice as wide, not eight. */
    const ball = (n: number) => 40 + 34 * Math.cbrt(Math.max(1, n));
    const rA = ball(spec.aOnly.size);
    const rB = ball(spec.bOnly.size);
    const rS = ball(spec.both.size);
    // Lobe centres on the x axis, far enough apart that the three balls read as
    // three groups rather than one smear.
    const D = rS + Math.max(rA, rB) * 0.95 + 130;

    /* Members sit in a SHELL rather than filling the ball, so the entity at the
     * centre stays visibly the hub of its own lobe instead of being buried by
     * its own markers. */
    const place = (ids: Set<string>, cx: number, radius: number) => {
      const list = [...ids];
      list.forEach((id, k) => {
        const i = this.indexOf.get(id);
        if (i === undefined) return;
        const [ux, uy, uz] = fibonacciSphere(k, list.length);
        const r = radius * (0.5 + 0.5 * Math.cbrt((k + 1) / list.length));
        this.rest[i * 3] = cx + ux * r;
        this.rest[i * 3 + 1] = uy * r;
        this.rest[i * 3 + 2] = uz * r;
      });
    };
    place(spec.aOnly, -D, rA);
    place(spec.bOnly, D, rB);
    place(spec.both, 0, rS);
    for (const [id, cx] of [
      [spec.a, -D],
      [spec.b, D],
    ] as [string, number][]) {
      const i = this.indexOf.get(id);
      if (i === undefined) continue;
      this.rest[i * 3] = cx;
      this.rest[i * 3 + 1] = 0;
      this.rest[i * 3 + 2] = 0;
    }

    const c = new Color();
    const tint = (ids: Iterable<string>, hex: string) => {
      c.set(hex);
      for (const id of ids) {
        const i = this.indexOf.get(id);
        if (i === undefined) continue;
        this.nodeColors[i * 3] = c.r;
        this.nodeColors[i * 3 + 1] = c.g;
        this.nodeColors[i * 3 + 2] = c.b;
      }
    };
    tint(spec.aOnly, spec.colorA);
    tint(spec.bOnly, spec.colorB);
    tint(spec.both, spec.colorBoth);
    tint([spec.a], spec.colorA);
    tint([spec.b], spec.colorB);
    (this.points.geometry.getAttribute("aColor") as BufferAttribute).needsUpdate = true;

    this.compareA = spec.a;
    this.compareB = spec.b;
    this.focusIds = new Set([...spec.aOnly, ...spec.bOnly, ...spec.both, spec.a, spec.b]);
    this.displaced.clear();
    this.applyVisibility();

    /* Look straight down the z axis so the Venn's axis lies across the screen.
     * Keeping whatever direction the user last orbited to would show the three
     * balls edge-on as often as not, which is exactly the one view in which the
     * whole arrangement means nothing. */
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, 0, (D + Math.max(rA, rB)) * 1.9);
    this.controls.update();
    this.pushPositions();
    this.fit();
  }

  /** Visibility, dimming and size emphasis are all just alpha and size writes. */
  private applyVisibility(animate = false) {
    this.applyNodeVisibility(animate);
    this.applyEdgeVisibility(animate);
    if (animate) this.fadeStart = performance.now();
  }

  /** Separate from the edge pass because the size animation runs this every
   *  frame, and re-walking 26,000 edges for a change no edge can see is waste. */
  private applyNodeVisibility(animate = false) {
    if (!this.points) return;
    const focused = this.focusIds;
    /* Distance from the selected node, in screen space, normalised across the
     * neighbourhood. This is what deals the highlight outward rather than
     * switching it on: the nearest neighbours light first. */
    const anchor = this.selected ? this.indexOf.get(this.selected) : undefined;
    let reach = 1;
    if (animate && anchor !== undefined && this.neighbours) {
      for (const id of this.neighbours) {
        const j = this.indexOf.get(id);
        if (j === undefined) continue;
        reach = Math.max(
          reach,
          Math.hypot(
            this.proj[j * 3] - this.proj[anchor * 3],
            this.proj[j * 3 + 1] - this.proj[anchor * 3 + 1]
          )
        );
      }
    }
    for (let i = 0; i < this.nodes.length; i++) {
      const id = this.nodes[i].id;
      let a = 1;
      let s = this.baseSize[i];
      /* Not part of what is selected. Alpha alone was not enough to read as
       * receding -- the cloud is mostly hubs at full size, and a big dot at low
       * opacity still occupies the same space and still reads as present. So
       * the unrelated graph steps back in SIZE as well, which is what actually
       * makes the neighbourhood step forward. */
      const dimmed = !!this.neighbours && !this.neighbours.has(id);
      if (this.hiddenNodes.has(id) || (focused && !focused.has(id))) a = 0;
      else if (dimmed) a = DIMMED_ALPHA;
      if (focused && focused.has(id)) s = Math.max(s, 7);
      /* A neighbour that is a one-degree marker is a speck at its true size,
       * and a highlight you have to hunt for is not a highlight. Floored so
       * every associated node is findable without inflating the hubs. */
      if (this.neighbours && this.neighbours.has(id)) s = Math.max(s, 5.5);
      if (dimmed) s = Math.min(s, DIMMED_SIZE);
      if (this.waypoints.has(id) && !dimmed) s = Math.max(s, 8);
      if (id === this.compareA || id === this.compareB) s = Math.max(s, 15);
      if (id === this.selected) s = Math.max(s * 1.6, 12);
      if (animate) {
        this.nodeAlphaFrom[i] = this.nodeAlpha[i];
        this.nodeSizeFrom[i] = this.nodeSize[i];
        this.nodeAlphaTo[i] = a;
        this.nodeSizeTo[i] = s;
        this.nodeDelay[i] =
          anchor === undefined
            ? 0
            : Math.min(
                1,
                Math.hypot(
                  this.proj[i * 3] - this.proj[anchor * 3],
                  this.proj[i * 3 + 1] - this.proj[anchor * 3 + 1]
                ) / reach
              );
      } else {
        this.nodeAlpha[i] = a;
        this.nodeSize[i] = s;
        this.nodeAlphaTo[i] = a;
        this.nodeSizeTo[i] = s;
      }
    }
    if (!animate) {
      (this.points.geometry.getAttribute("aAlpha") as BufferAttribute).needsUpdate = true;
      (this.points.geometry.getAttribute("aSize") as BufferAttribute).needsUpdate = true;
    }
  }

  private applyEdgeVisibility(animate = false) {
    const focused = this.focusIds;
    if (!this.lines) return;
    const anchor = this.selected ? this.indexOf.get(this.selected) : undefined;
    let reach = 1;
    if (animate && anchor !== undefined) {
      for (let k = 0; k < this.edges.length; k++) {
        const e = this.edges[k];
        if (e.s !== anchor && e.t !== anchor) continue;
        const far = e.s === anchor ? e.t : e.s;
        reach = Math.max(
          reach,
          Math.hypot(
            this.proj[far * 3] - this.proj[anchor * 3],
            this.proj[far * 3 + 1] - this.proj[anchor * 3 + 1]
          )
        );
      }
    }
    /* ── which lines to actually draw ──
     *
     * This used to give an edge touching the selected node 0.022 and every
     * other edge 0.02 -- a ten-percent difference on a value already at the
     * threshold of visible, which is to say clicking a node highlighted
     * nothing. The gap has to be enormous, because the thing a highlighted
     * line competes against is not one other line but twenty thousand of them
     * summing to a wash. So the ones you asked for go nearly opaque and take
     * their real colour, and everything else drops far enough to read as
     * background rather than as data.
     */
    const haze = new Color(this.opts.edgeColor);
    for (let k = 0; k < this.edges.length; k++) {
      const e = this.edges[k];
      const sid = this.nodes[e.s].id;
      const tid = this.nodes[e.t].id;
      const touches = this.selected !== null && (sid === this.selected || tid === this.selected);

      let a: number;
      if (this.hiddenEdges.has(k) || this.nodeAlpha[e.s] === 0 || this.nodeAlpha[e.t] === 0) {
        a = 0;
      } else if (touches) {
        a = 0.92;
      } else if (focused) {
        a = 0.45;
      } else if (this.neighbours) {
        // Something is selected and this is not part of it: get out of the way.
        a = 0.006;
      } else {
        a = 0.022;
      }
      if (animate) {
        this.edgeAlphaFrom[k] = this.edgeAlpha[k * 2];
        this.edgeAlphaTo[k] = a;
        // Edges touching the selection are dealt outward by length; everything
        // else simply fades, with no stagger to draw attention to it.
        if (anchor !== undefined && (e.s === anchor || e.t === anchor)) {
          const far = e.s === anchor ? e.t : e.s;
          this.edgeDelay[k] = Math.min(
            1,
            Math.hypot(
              this.proj[far * 3] - this.proj[anchor * 3],
              this.proj[far * 3 + 1] - this.proj[anchor * 3 + 1]
            ) / reach
          );
        } else this.edgeDelay[k] = 0;
      } else {
        this.edgeAlpha[k * 2] = a;
        this.edgeAlpha[k * 2 + 1] = a;
        this.edgeAlphaTo[k] = a;
      }

      // Hue only where a single line is being read: touching the selection, or
      // inside a focused neighbourhood. Everywhere else, flat haze.
      const lit = a > 0 && (touches || !!focused);
      const r = lit ? this.edgeTrueColor[k * 3] : haze.r;
      const g = lit ? this.edgeTrueColor[k * 3 + 1] : haze.g;
      const b = lit ? this.edgeTrueColor[k * 3 + 2] : haze.b;
      for (let v = 0; v < 2; v++) {
        this.edgeColor[k * 6 + v * 3] = r;
        this.edgeColor[k * 6 + v * 3 + 1] = g;
        this.edgeColor[k * 6 + v * 3 + 2] = b;
      }
    }
    if (!animate) {
      (this.lines.geometry.getAttribute("aAlpha") as BufferAttribute).needsUpdate = true;
    }
    (this.lines.geometry.getAttribute("aColor") as BufferAttribute).needsUpdate = true;
  }

  /* ── camera ── */

  fit(soft = false) {
    let max = 1;
    const focused = this.focusIds;
    const centre = new Vector3();
    let count = 0;
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodeAlpha[i] === 0) continue;
      centre.x += this.rest[i * 3];
      centre.y += this.rest[i * 3 + 1];
      centre.z += this.rest[i * 3 + 2];
      count++;
    }
    if (!count) return;
    centre.divideScalar(count);
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodeAlpha[i] === 0) continue;
      const d = Math.hypot(
        this.rest[i * 3] - centre.x,
        this.rest[i * 3 + 1] - centre.y,
        this.rest[i * 3 + 2] - centre.z
      );
      if (d > max) max = d;
    }
    const dist = (max * (this.opts.framing ?? DEFAULT_FRAMING)) / Math.tan((this.camera.fov * Math.PI) / 360);
    /* The framing of the whole cloud, kept as home. Only recorded when nothing
     * is selected and no focus is up, so a selection's tighter framing never
     * becomes the thing deselecting returns to. */
    if (!focused && !this.selected) {
      this.homeCentre.copy(centre);
      this.homeDistance = dist;
    }
    if (soft) {
      // Ease the camera instead of snapping it, so the formation is watched
      // rather than chased.
      this.controls.target.lerp(centre, 0.08);
      const want = centre
        .clone()
        .addScaledVector(this.camera.position.clone().sub(this.controls.target).normalize(), dist);
      this.camera.position.lerp(want, 0.08);
      this.controls.update();
      return;
    }
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    if (!isFinite(dir.x) || dir.lengthSq() < 0.5) dir.set(0, 0, 1);
    /* Lifted off the equator once, at the first fit. autoRotate preserves the
     * polar angle, so sitting slightly above it turns the drift from a flat
     * carousel into an angled one -- which is the difference between the cloud
     * looking like a globe and looking like a turntable. */
    if (!this.tilted) {
      dir.y += STANDBY_TILT;
      dir.normalize();
      this.tilted = true;
    }
    this.controls.target.copy(centre);
    this.camera.position.copy(centre).addScaledVector(dir, dist);
    this.controls.update();
    if (focused) this.opts.onSettling(false);
  }

  zoomBy(factor: number) {
    const dir = this.camera.position.clone().sub(this.controls.target);
    this.camera.position.copy(this.controls.target).addScaledVector(dir, 1 / factor);
    this.controls.update();
  }

  setMagnet(on: boolean) {
    this.magnetOn = on;
    if (!on) {
      this.displaced.clear();
      this.held = null;
    }
  }

  resize() {
    const { container, labelCanvas } = this.opts;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.posEpoch++;
    const dpr = this.dpr();
    labelCanvas.width = Math.round(w * dpr);
    labelCanvas.height = Math.round(h * dpr);
    labelCanvas.style.width = `${w}px`;
    labelCanvas.style.height = `${h}px`;
    if (this.points) {
      (this.points.material as ShaderMaterial).uniforms.uPixelRatio.value =
        this.renderer.getPixelRatio();
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.io?.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /* ── pointer ── */

  private bindPointer() {
    const el = this.renderer.domElement;
    let downAt = 0;
    let downPos = { x: 0, y: 0 };
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      this.pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
      this.lastInput = performance.now();
    });
    el.addEventListener("pointerleave", () => {
      this.pointer = null;
      this.opts.onHover(null, 0, 0);
    });
    el.addEventListener("pointerdown", (e) => {
      // The moment it is being driven, it stops driving itself.
      this.controls.autoRotate = false;
      this.lastInput = performance.now();
      downAt = performance.now();
      downPos = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener("pointerup", (e) => {
      // Orbit drags and clicks arrive through the same button, so a click is
      // defined as a press that neither travelled nor lingered.
      const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (moved > 4 || performance.now() - downAt > 400) return;
      if (this.isAnimating()) return;
      const hit = this.hovered;
      if (hit) this.opts.onClick(hit);
      else this.opts.onBackground();
    });
    el.addEventListener("dblclick", () => {
      if (this.hovered) this.opts.onDoubleClick(this.hovered);
    });
  }

  private hovered: string | null = null;

  /** Projects every visible node to screen once per frame. Hover, labels and
   *  the magnet all read this rather than each doing their own pass. */
  private project() {
    const w = this.opts.container.clientWidth || 1;
    const h = this.opts.container.clientHeight || 1;
    const v = new Vector3();
    const pos = (this.points!.geometry.getAttribute("position") as BufferAttribute)
      .array as Float32Array;
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodeAlpha[i] === 0) {
        this.proj[i * 3 + 2] = 2;
        continue;
      }
      v.set(
        pos[i * 3] * this.breath,
        pos[i * 3 + 1] * this.breath,
        pos[i * 3 + 2] * this.breath
      ).project(this.camera);
      this.proj[i * 3] = ((v.x + 1) / 2) * w;
      this.proj[i * 3 + 1] = ((1 - v.y) / 2) * h;
      this.proj[i * 3 + 2] = v.z;
    }
  }

  private updateHover() {
    if (!this.pointer) {
      if (this.hovered) {
        this.hovered = null;
        this.opts.onHover(null, 0, 0);
      }
      return;
    }
    /* Hover has to agree with the magnet, or the node being yanked toward the
     * cursor is not the node a click lands on. Highlighted nodes therefore get
     * a wider hit radius and count as somewhat nearer than they are -- but the
     * comparison is still on real distance, so something you are pointing
     * straight at always wins. Squared throughout to skip the roots; the
     * factors are squared to match (0.6 -> 0.36). */
    /* With something selected, only its neighbourhood answers the cursor.
     * Everything else has already receded to near-invisible, and letting it
     * still be clickable made the cloud feel like a field of hidden targets.
     * Now there are exactly two moves: step to something this node is actually
     * connected to, or click the empty space and start again. Unrelated nodes
     * return no hover at all, so a click on one falls through to the background
     * handler and deselects -- the two behaviours are the same mechanism. */
    const picked = this.neighbours;
    let best: string | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const z = this.proj[i * 3 + 2];
      if (z > 1) continue;
      const isPicked =
        !!picked && (picked.has(this.nodes[i].id) || this.waypoints.has(this.nodes[i].id));
      if (picked && !isPicked) continue;
      const dx = this.proj[i * 3] - this.pointer.x;
      const dy = this.proj[i * 3 + 1] - this.pointer.y;
      const d = dx * dx + dy * dy;
      // A wider target when the field is this sparse: the only things left to
      // aim at are the handful still lit.
      if (d > (picked ? 34 * 34 : 18 * 18)) continue;
      if (d < bestScore) {
        bestScore = d;
        best = this.nodes[i].id;
      }
    }
    if (best !== this.hovered) {
      this.hovered = best;
      this.opts.onHover(best, this.pointer.x, this.pointer.y);
    }
  }

  /**
   * Magnet. Candidates are chosen in screen space from the projection we
   * already have, then displaced in 3D relative to the cursor's view ray: the
   * nearest node slides along the ray's perpendicular toward it, everything
   * else eases outward. Doing the displacement in 3D rather than on screen is
   * what keeps it correct while the cloud is rotating.
   */
  private updateMagnet() {
    if (!this.magnetOn || !this.pointer) {
      if (!this.displaced.size) return;
      for (const [i, d] of this.displaced) {
        d.dx *= 1 - MAGNET_EASE;
        d.dy *= 1 - MAGNET_EASE;
        d.dz *= 1 - MAGNET_EASE;
        if (Math.abs(d.dx) + Math.abs(d.dy) + Math.abs(d.dz) < 0.05) this.displaced.delete(i);
      }
      this.held = null;
      this.pushPositions();
      return;
    }

    const near: { i: number; d: number }[] = [];
    let nearest = -1;
    /* No tiering any more: with a selection up, the unrelated nodes are already
     * skipped outright above, so everything still in contention is related. */
    let nearestScore = Infinity;
    let heldScore = Infinity;
    const heldIdx = this.held ? (this.indexOf.get(this.held) ?? -1) : -1;

    const picked = this.neighbours;
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.proj[i * 3 + 2] > 1) continue;
      /* The selected node is exempt. It is already the thing you have, so
       * pulling the cursor back to it fights every attempt to move off it --
       * and it is the one node you never need help finding, since it is the
       * biggest and brightest on screen. Skipped outright, so it is neither
       * grabbed nor shoved: a fixed point the field parts around. */
      if (this.nodes[i].id === this.selected) continue;
      const isPicked =
        !!picked && (picked.has(this.nodes[i].id) || this.waypoints.has(this.nodes[i].id));
      // Unselectable now means unmagnetic: a field parting around things that
      // cannot be clicked is the cloud promising something it will not honour.
      if (picked && !isPicked) continue;
      const dx = this.proj[i * 3] - this.pointer.x;
      const dy = this.proj[i * 3 + 1] - this.pointer.y;
      /* Squared until it is known to be a keeper. `Math.hypot` is variadic and
       * overflow-guarded, which costs several times a plain multiply-add, and
       * this runs 8,930 times a frame to reject all but a handful. The
       * displacement maths below still wants the true distance. */
      const d2 = dx * dx + dy * dy;
      if (d2 > MAGNET_RADIUS_SQ) continue;
      const d = Math.sqrt(d2);
      near.push({ i, d });
      /* Only the CHOICE of what to hold is biased. Every displacement below is
       * computed from the true distance, so nothing is dragged further than it
       * really is -- a node wins the grab, it does not warp space.
       *
       * The two biases multiply, which gives the order you want without any
       * special-casing: a highlighted tumour beats a highlighted stain beats an
       * unrelated tumour beats unrelated dust. */
      /* Drawn size rather than degree-derived size, so what pulls hardest is
       * what LOOKS biggest -- including the boosts a selection or a focus
       * applies. Reaching for the largest thing near the cursor and getting it
       * is the whole expectation being met here. */
      const bulk = Math.pow(Math.max(0.35, this.nodeSize[i]), MAGNET_SIZE_POWER);
      let score = (d / bulk) * (this.nodes[i].kind === "entity" ? 1 : MAGNET_ENTITY_BIAS);
      if (this.labelled[i]) score /= MAGNET_LABEL_BOOST;
      if (i === heldIdx) heldScore = score;
      if (score < nearestScore) {
        nearestScore = score;
        nearest = i;
      }
    }
    if (heldIdx >= 0 && heldScore < Infinity && nearestScore > heldScore * MAGNET_HYSTERESIS)
      nearest = heldIdx;
    this.held = nearest >= 0 ? this.nodes[nearest].id : null;

    // The cursor's ray through the scene, and how many world units a pixel is
    // worth at the depth we care about.
    const w = this.opts.container.clientWidth || 1;
    const h = this.opts.container.clientHeight || 1;
    const ndc = new Vector3((this.pointer.x / w) * 2 - 1, 1 - (this.pointer.y / h) * 2, 0.5);
    ndc.unproject(this.camera);
    const origin = this.camera.position.clone();
    const dir = ndc.sub(origin).normalize();

    const target = new Map<number, { dx: number; dy: number; dz: number }>();
    const p = new Vector3();
    for (const { i, d } of near) {
      p.set(this.rest[i * 3], this.rest[i * 3 + 1], this.rest[i * 3 + 2]);
      const t = p.clone().sub(origin).dot(dir);
      const onRay = origin.clone().addScaledVector(dir, t);
      const off = p.clone().sub(onRay);
      const len = off.length() || 1;
      if (i === nearest) {
        /* Decayed by distance, which is the whole difference between a magnet
         * and a tractor beam. Undecayed, this dragged the held node 85% of the
         * way to the cursor however far off it was -- a hundred pixels of
         * travel with every one of its edges stretching after it. The
         * displacement now peaks around 25px, at roughly half the radius, and
         * falls to nothing at the rim. */
        const grab = MAGNET_PULL * Math.max(0, 1 - d / MAGNET_RADIUS_PX);
        off.multiplyScalar(-grab);
        target.set(i, { dx: off.x, dy: off.y, dz: off.z });
      } else {
        const falloff = Math.max(0, 1 - d / MAGNET_RADIUS_PX);
        const push = len * MAGNET_PUSH * falloff * falloff * 2;
        off.multiplyScalar(push / len);
        target.set(i, { dx: off.x, dy: off.y, dz: off.z });
      }
    }

    let changed = false;
    const ids = new Set<number>([...this.displaced.keys(), ...target.keys()]);
    for (const i of ids) {
      const cur = this.displaced.get(i) ?? { dx: 0, dy: 0, dz: 0 };
      const want = target.get(i) ?? { dx: 0, dy: 0, dz: 0 };
      const dx = cur.dx + (want.dx - cur.dx) * MAGNET_EASE;
      const dy = cur.dy + (want.dy - cur.dy) * MAGNET_EASE;
      const dz = cur.dz + (want.dz - cur.dz) * MAGNET_EASE;
      if (Math.abs(dx - cur.dx) + Math.abs(dy - cur.dy) + Math.abs(dz - cur.dz) > 0.01)
        changed = true;
      if (!target.has(i) && Math.abs(dx) + Math.abs(dy) + Math.abs(dz) < 0.05) {
        this.displaced.delete(i);
        changed = true;
      } else {
        this.displaced.set(i, { dx, dy, dz });
      }
    }
    if (changed) this.pushPositions();
  }

  /**
   * Labels on a 2D overlay rather than as sprites: 8,930 sprites would be 8,930
   * more objects to sort and draw, and text drawn into the 3D scene fights the
   * depth buffer. Drawn nearest-first with greedy overlap rejection, so the
   * names that survive are the ones in front.
   */
  private drawLabels() {
    const cv = this.opts.labelCanvas;
    // Last frame's set becomes the incumbent, and this frame's is rebuilt.
    const swap = this.labelledPrev;
    this.labelledPrev = this.labelled;
    this.labelled = swap;
    this.labelled.fill(0);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    /* Silent through the opening. A name is a thing you read, and there is no
     * reading anything that is still flying; thirty labels chasing their nodes
     * across the screen is the single busiest thing the old opening did. They
     * fade up once everything has landed. */
    const wake = this.settledAt
      ? Math.min(1, (performance.now() - this.settledAt) / LABEL_WAKE_MS)
      : 0;
    if (wake <= 0.01) {
      const dpr0 = this.dpr();
      ctx.setTransform(dpr0, 0, 0, dpr0, 0, 0);
      ctx.clearRect(0, 0, cv.width / dpr0, cv.height / dpr0);
      return;
    }
    const dpr = this.dpr();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = cv.width / dpr;
    const h = cv.height / dpr;
    ctx.clearRect(0, 0, w, h);

    const focused = this.focusIds;
    /* When something is selected, the names on screen are ITS names and nothing
     * else. The default cloud labels whichever hubs happen to be big enough,
     * which is the right answer when you are browsing and exactly the wrong one
     * when you have asked a question -- the answer then has to compete for
     * space with a hundred labels that have nothing to do with it. */
    const picked = this.neighbours;
    const cands: { i: number; z: number; alpha: number }[] = [];
    for (let i = 0; i < this.nodes.length; i++) {
      // `project` parks anything at zero alpha at z = 2, so this also skips
      // every hidden node.
      const z = this.proj[i * 3 + 2];
      if (z > 1) continue;
      const id = this.nodes[i].id;
      let alpha = 1;
      if (picked) {
        // Hovering still names anything, so the rest of the cloud stays
        // interrogable while a selection is up.
        if (!picked.has(id) && id !== this.hovered && !this.waypoints.has(id)) continue;
      } else if (!focused && id !== this.hovered) {
        /* Browsing the whole cloud, a node has to be big enough to be worth
         * naming -- but the bar is far lower for a tumour than for a stain.
         * Markers are the busiest nodes in the graph, so an even bar hands
         * almost every label to CK7 and S100 and names hardly any diseases.
         *
         * Faded in across the approach to the bar rather than switched on at
         * it. While the stars are growing into their real sizes this is what
         * turns "every name at once" into names surfacing one by one as their
         * star grows into its own. */
        const floor = this.nodes[i].kind === "entity" ? 3.2 : 7;
        alpha = Math.min(1, Math.max(0, (this.baseSize[i] - floor + LABEL_FADE) / LABEL_FADE));
        if (alpha <= 0.02) continue;
      }
      const x = this.proj[i * 3];
      const y = this.proj[i * 3 + 1];
      if (x < -60 || x > w + 60 || y < -20 || y > h + 20) continue;
      cands.push({ i, z, alpha });
    }
    /* Entities first, then front to back within each group. The overlap
     * rejection below is winner-takes-the-space, so whatever sorts first gets
     * the screen -- which makes this sort, not the size floor above, the thing
     * that decides the cloud reads as a map of diseases rather than of stains. */
    /* Selection first, then whatever is under the cursor, then everything
     * else. Both of those are answers to something the reader actually did, and
     * neither may lose a space contest to a passing hub.
     *
     * The hovered one matters here for a reason that is not obvious: hovering
     * switches its label to bold 12px, which is WIDER than the 11px it was
     * drawn at a frame earlier. Left in its old place in the queue it would
     * find the space around it already claimed and be dropped -- so the name
     * vanished at the exact moment you pointed at it. */
    const rankOf = (i: number) => {
      const id = this.nodes[i].id;
      /* Incumbency outranks everything. The set of names on screen is what the
       * magnet privileges, so a set that reshuffles is a set of moving targets
       * -- the cursor is drawn to a node that stops being labelled a frame
       * later. Holding the names put holds the magnetism put.
       *
       * The selection, the hover and the waypoints do not need to be ahead of
       * it: they are drawn in a pass of their own below, before any of this is
       * consulted, so they cannot be crowded out by an incumbent. */
      if (this.labelledPrev[i]) return 0;
      if (id === this.selected) return 1;
      if (id === this.hovered) return 2;
      // The way back and the way up, before anything the cloud volunteered.
      if (this.waypoints.has(id)) return 3;
      /* Then whatever was already named. Placement is greedy over a depth sort,
       * so without this a name loses its spot the instant a slightly nearer
       * node drifts past it -- and a cloud that is always turning means that is
       * constant. Incumbency makes the set of names on screen change when the
       * view changes, not every frame. */
      return 4;
    };
    cands.sort((a, b) => {
      const sa = rankOf(a.i);
      const sb = rankOf(b.i);
      if (sa !== sb) return sa - sb;
      const ea = this.nodes[a.i].kind === "entity" ? 0 : 1;
      const eb = this.nodes[b.i].kind === "entity" ? 0 : 1;
      return ea - eb || a.z - b.z;
    });

    ctx.textBaseline = "middle";
    const claimed: number[] = [];
    let drawn = 0;
    /* A selection is a deliberate question, so its answer gets a bigger budget
     * than the browsing cloud does. Overlap rejection below is what actually
     * keeps it legible; this is only a guard on how much text to lay out. */
    const cap = picked ? SELECTED_LABELS : MAX_LABELS;
    /* Lowering the bar for entity labels took the candidate pool from ~140 to
     * ~970, and this runs every frame against a claimed-box list -- so the pool
     * is trimmed before the quadratic part. The sort above already put the best
     * ones first, so this costs nothing that would have been drawn. */
    /* Two passes. The first is everything that must be named whatever else is
     * on screen -- the selection, whatever is under the cursor, the way back
     * and the way up. Those ignore both the budget and the overlap test, which
     * is what lets incumbency take the top of the ranking without ever starving
     * them. The second pass is the ranked list, filling what is left. */
    const mustName = (i: number) => {
      const id = this.nodes[i].id;
      return id === this.selected || id === this.hovered || this.waypoints.has(id);
    };
    const guaranteed = cands.filter((c) => mustName(c.i));
    const ranked = cands.filter((c) => !mustName(c.i));
    const pool = [
      ...guaranteed,
      ...(ranked.length > cap * 5 ? ranked.slice(0, cap * 5) : ranked),
    ];
    for (const { i, alpha } of pool) {
      if (drawn >= cap && !mustName(i)) break;
      const id = this.nodes[i].id;
      const isSelected = id === this.selected;
      const isHovered = id === this.hovered;
      /* Three weights, in order of how much you asked for them: the selection,
       * whatever is under the cursor, and everything the cloud volunteered. */
      const weight = isSelected ? "600 13px" : isHovered ? "600 12px" : "11px";
      ctx.font = `${weight} ui-sans-serif, system-ui, sans-serif`;
      /* The selected node's name is never abbreviated. It is the one thing on
       * screen you actually asked to read, and "Pancreatic mixed neuroendocr…"
       * is not a diagnosis. */
      const text =
        isSelected || this.nodes[i].label.length <= 34
          ? this.nodes[i].label
          : `${this.nodes[i].label.slice(0, 31)}…`;

      /* Offset by the dot's ACTUAL drawn radius, which depends on how far away
       * it is -- the shader sizes points as aSize * 2400 / viewDistance. The
       * offset used to be a function of aSize alone, so labels sat right on top
       * of their dots when zoomed in and floated away from them when zoomed
       * out. */
      const away = Math.max(1, this.camera.position.distanceTo(this.scratch.set(
        this.rest[i * 3],
        this.rest[i * 3 + 1],
        this.rest[i * 3 + 2]
      )));
      const radiusPx = (this.nodeSize[i] * 2400) / away / 2;

      /* A node held by the magnet has been dragged toward the cursor, and its
       * label is drawn from a projection taken before that happened -- one
       * frame stale, which reads as the name lagging behind its own dot. The
       * held node's label is anchored to the cursor instead, which is where the
       * node itself is heading. */
      const onCursor = this.magnetOn && this.pointer && id === this.held;
      const x = (onCursor ? this.pointer!.x : this.proj[i * 3]) + radiusPx + 5;
      const y = onCursor ? this.pointer!.y : this.proj[i * 3 + 1];
      const tw = ctx.measureText(text).width;
      const box = [x - 2, y - 7, x + tw + 2, y + 7];
      let clash = false;
      // Selection, hover and the waypoints claim their space; everything else
      // works around them.
      if (!isSelected && !isHovered && !this.waypoints.has(id))
        for (let k = 0; k < claimed.length; k += 4) {
          if (
            box[0] < claimed[k + 2] &&
            box[2] > claimed[k] &&
            box[1] < claimed[k + 3] &&
            box[3] > claimed[k + 1]
          ) {
            clash = true;
            break;
          }
        }
      if (clash) continue;
      claimed.push(box[0], box[1], box[2], box[3]);
      this.labelled[i] = 1;
      ctx.globalAlpha = isHovered ? wake : alpha * wake;
      /* Stroked, not shadowed. `shadowBlur` is a separate gaussian pass per
       * fillText -- the most expensive thing the 2D context offers -- and it
       * ran on every name on every frame. A round-joined stroke in the halo
       * colour under the fill reads the same at these sizes for a fraction of
       * the cost. A wider one under the emphasised names, so they still lift
       * off the cloud rather than just getting heavier against it. */
      ctx.strokeStyle = this.opts.labelHalo;
      ctx.lineWidth = isSelected || isHovered ? 4 : 3;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = this.opts.labelInk;
      ctx.fillText(text, x, y);
      ctx.globalAlpha = 1;
      drawn++;
    }
  }

  /** Bumped by everything that moves a node. Read by `projectIfMoved`. */
  private posEpoch = 0;
  /** The camera, breath and positions the cached projection was taken at. */
  private projAt = {
    x: NaN,
    y: NaN,
    z: NaN,
    qx: 0,
    qy: 0,
    qz: 0,
    qw: 0,
    zoom: 0,
    breath: 0,
    epoch: -1,
  };

  /**
   * Projects only when the projection could have changed.
   *
   * `project` is 8,930 matrix multiplies and it used to run unconditionally,
   * including on the frames where nothing had moved at all. Positions change
   * through `pushPositions` and the formation writes, which bump the epoch; the
   * camera and the breath are compared directly.
   *
   * Worth being honest about the size of this one: while the cloud is drifting
   * the camera really does move every frame, so this changes nothing there. It
   * pays when the drift is off -- a focus, a fresh interaction, reduced motion
   * -- which is also when the cloud is most likely to be sitting in front of
   * someone doing something else.
   */
  private projectIfMoved(animating: boolean) {
    const c = this.camera;
    const q = c.quaternion;
    const a = this.projAt;
    if (
      !animating &&
      a.epoch === this.posEpoch &&
      a.x === c.position.x &&
      a.y === c.position.y &&
      a.z === c.position.z &&
      a.qx === q.x &&
      a.qy === q.y &&
      a.qz === q.z &&
      a.qw === q.w &&
      a.zoom === c.zoom &&
      Math.abs(a.breath - this.breath) < BREATH_EPSILON
    )
      return;
    a.epoch = this.posEpoch;
    a.x = c.position.x;
    a.y = c.position.y;
    a.z = c.position.z;
    a.qx = q.x;
    a.qy = q.y;
    a.qz = q.z;
    a.qw = q.w;
    a.zoom = c.zoom;
    a.breath = this.breath;
    this.project();
  }

  /**
   * Names are the most expensive thing per frame after the scene itself -- a
   * full candidate pass, a sort, a quadratic overlap test and a stroked draw --
   * and they are the least urgent thing on screen: text you are reading does
   * not need recomputing sixty times a second.
   *
   * Throttled, except when the answer would visibly change. The exception is
   * not optional: hovering re-weights a label to bold 12px, and a hover whose
   * name only appears 50ms later is the same flicker the ranking rules
   * upstream exist to prevent.
   */
  private drawLabelsThrottled(now: number) {
    if (this.tier >= 2) return;
    const sig = `${this.selected}|${this.hovered}|${this.waypoints.size}|${this.focusIds ? 1 : 0}`;
    const gap = this.tier ? LABEL_FRAME_MS * 2 : LABEL_FRAME_MS;
    if (sig === this.labelFor && now - this.lastLabels < gap) return;
    this.labelFor = sig;
    this.lastLabels = now;
    this.drawLabels();
  }

  /**
   * Measures the work this class does, not the gap between frames. Timing the
   * gap would read the frame gate's own 30fps as a struggling machine and
   * degrade a cloud that is running perfectly.
   *
   * Only sampled once settled -- the formation is legitimately heavy and is
   * over in 2.6 seconds, so judging on it would degrade every machine.
   */
  private sampleFrame(ms: number) {
    if (this.tier >= 2 || this.isAnimating() || !this.settledAt) return;
    this.frames.push(ms);
    if (this.frames.length < TUNE_SAMPLES) return;
    const sorted = [...this.frames].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    this.frames.length = 0;
    if (median > TUNE_BUDGET_MS) this.degrade();
  }

  /** Two steps, cheapest visual loss first: resolution, then names. Sampling
   *  carries on afterwards, so a machine still over budget takes the second
   *  step a few seconds later. */
  private degrade() {
    if (this.tier === 0) {
      this.tier = 1;
      this.dprCap = 1;
      this.renderer.setPixelRatio(this.dpr());
      this.resize();
      return;
    }
    this.tier = 2;
    const cv = this.opts.labelCanvas;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    // Reset the transform first: the context is left scaled by the pixel ratio.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (this.disposed || !this.points) return;

    const now = performance.now();
    this.advanceGather();
    this.advanceFormation();
    this.advanceFade();
    this.advanceTravel();
    this.updateStandby();
    this.advanceEmergence();
    this.advanceSizes();
    this.advanceReveal();
    if (!this.travelUntil && now < this.refitUntil) this.fit(true);
    /* Ahead of the frame gate on purpose. Damping and auto-rotation integrate
     * per call, so stepping them only on rendered frames would halve the spin
     * rather than halve its cost -- and they are a few trigonometric operations
     * against the eight thousand below. */
    this.controls.update();
    this.updateZoomBounds();
    this.updateDepthUniforms();

    /* Inert while it animates. Nothing to point at until it has arrived, a
     * magnet tearing holes in the wave undoes the effect, and a click landing
     * mid-bloom selects whatever happened to be under the cursor at the time.
     * OrbitControls is switched off with it, so the cloud cannot be dragged or
     * zoomed out of its own opening -- `enabled` gates the input handlers only,
     * so the drift keeps running. */
    const animating = this.isAnimating();
    this.controls.enabled = !animating;

    /* Full rate while it is opening or being driven, half rate once it has been
     * left alone. The threshold is the one that already governs the drift, so
     * the cloud drops to thirty frames at the same moment it starts turning by
     * itself -- one state change, not two that can disagree. */
    const idleGap = this.reduced
      ? STANDBY_FRAME_MS_STILL
      : this.tier
        ? STANDBY_FRAME_MS_TIER1
        : STANDBY_FRAME_MS;
    const busy = animating || now - this.lastInput < STANDBY_RESUME_MS;
    if (!busy && now - this.lastRender < idleGap) return;
    this.lastRender = now;

    const started = performance.now();
    this.projectIfMoved(animating);
    if (animating) {
      if (this.hovered) {
        this.hovered = null;
        this.opts.onHover(null, 0, 0);
      }
    } else {
      this.updateHover();
      this.updateMagnet();
    }
    this.renderer.render(this.scene, this.camera);
    this.drawLabelsThrottled(now);
    this.sampleFrame(performance.now() - started);
  };
}
