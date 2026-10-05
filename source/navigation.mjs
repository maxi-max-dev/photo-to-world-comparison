import { Vector3, Euler, Box3 } from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';

const radius = .14;
// Movement follows the floor plane; looking up/down never changes walking height.
export class WalkMotor {
  constructor(camera, octree, bounds) {
    this.camera = camera;
    this.octree = octree;
    this.bounds = bounds;
    this.euler = new Euler(0, 0, 0, 'YXZ');
    this.body = new Capsule(new Vector3(), new Vector3(), radius);
    this.start = camera.position.clone();
    this.obstacles = [];
  }
  look(dx, dy) {
    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= dx;
    this.euler.x = Math.max(-1.35, Math.min(1.35, this.euler.x - dy));
    this.euler.z = 0;
    this.camera.quaternion.setFromEuler(this.euler);
  }
  move(forward, right, distance) {
    if (!forward && !right) return false;
    this.euler.setFromQuaternion(this.camera.quaternion);
    const delta = new Vector3(
      -Math.sin(this.euler.y) * forward + Math.cos(this.euler.y) * right, 0,
      -Math.cos(this.euler.y) * forward - Math.sin(this.euler.y) * right
    ).normalize().multiplyScalar(distance);
    const steps = Math.max(1, Math.ceil(delta.length() / .035));
    delta.divideScalar(steps);
    const before = this.camera.position.clone();
    for (let i = 0; i < steps; i++) {
      const p = this.camera.position.clone().add(delta);
      for (let pass = 0; pass < 4; pass++) {
        this.body.start.set(p.x, p.y - 1.1, p.z);
        this.body.end.copy(p);
        const hit = this.octree.capsuleIntersect(this.body);
        if (!hit) break;
        // A seat or low surface may produce an upward contact normal. At fixed
        // eye height we stop, rather than silently stepping inside the object.
        if (Math.abs(hit.normal.y) > .7) { p.copy(this.camera.position); break; }
        p.x += hit.normal.x * (hit.depth + .001);
        p.z += hit.normal.z * (hit.depth + .001);
      }
      // Extra GLBs move independently from the background collision mesh.
      for (const object of this.obstacles) {
        if (!object.visible) continue;
        const box = new Box3().setFromObject(object);
        if (box.max.y < p.y - 1.1 || box.min.y > p.y + radius) continue;
        const x = Math.max(box.min.x, Math.min(box.max.x, p.x));
        const z = Math.max(box.min.z, Math.min(box.max.z, p.z));
        const dx = p.x - x, dz = p.z - z, length = Math.hypot(dx, dz);
        if (length > 0 && length < radius) { p.x += dx / length * (radius - length); p.z += dz / length * (radius - length); }
        else if (length === 0) { p.x = this.camera.position.x; p.z = this.camera.position.z; }
      }
      p.x = Math.max(this.bounds.min.x + radius, Math.min(this.bounds.max.x - radius, p.x));
      p.z = Math.max(this.bounds.min.z + radius, Math.min(this.bounds.max.z - radius, p.z));
      this.camera.position.copy(p);
    }
    return this.camera.position.distanceTo(before) > .001;
  }
}
