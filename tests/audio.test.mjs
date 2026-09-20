import test from 'node:test';
import assert from 'node:assert/strict';
import {installAudioGate} from '../src/lib/audio.ts';

function fixture() {
  class Node {
    constructor(context) { this.context = context; this.links = []; }
    connect(target, ...ports) { this.links.push({target,ports}); return target; }
    disconnect(target) { this.links = this.links.filter(link => link.target !== target); }
  }
  function context() {
    const ctx = {createGain() { const gain = new Node(ctx); gain.gain = {value:1}; return gain; }};
    ctx.destination = new Node(ctx);
    return ctx;
  }
  return {Node, context, gate:installAudioGate(Node.prototype)};
}

test('routes the first and later contexts through a muted gain before speaker connection', () => {
  const {Node,context,gate} = fixture();
  for (let i=0; i<2; i++) {
    const ctx = context(), source = new Node(ctx);
    assert.equal(source.connect(ctx.destination), ctx.destination);
    const gain = source.links[0].target;
    assert.equal(gain.gain.value, 0);
    assert.equal(gain.links[0].target, ctx.destination);
    gate.setMuted(true);
    assert.equal(gain.gain.value, 0);
  }
});

test('mute controls existing and future outputs without changing internal graph connections', () => {
  const {Node,context,gate} = fixture();
  const ctx = context(), source = new Node(ctx), filter = new Node(ctx);
  assert.equal(source.connect(filter, 1, 0), filter);
  assert.deepEqual(source.links[0], {target:filter,ports:[1,0]});
  filter.connect(ctx.destination);
  const gain = filter.links[0].target;
  gate.setMuted(false);
  assert.equal(gain.gain.value, 1);
  const second = context(), next = new Node(second);
  next.connect(second.destination);
  assert.equal(next.links[0].target.gain.value, 1);
  gate.setMuted(true);
  assert.equal(gain.gain.value, 0);
  assert.equal(next.links[0].target.gain.value, 0);
  filter.disconnect(ctx.destination);
  assert.equal(filter.links.length, 0);
});
