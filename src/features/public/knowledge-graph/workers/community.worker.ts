/**
 * Worker wrapper around `computeLayout`.
 *
 * All this does is move buffers across the boundary. The algorithm lives in
 * `../lib/community`, because the snapshot generator bakes a layout with the
 * same code and two implementations of a partition would drift apart without
 * anyone noticing until the homepage and the explorer disagreed about which
 * tumours belong together.
 */
import { computeLayout, type CommunityRequest } from "../lib/community";

self.onmessage = (ev: MessageEvent<CommunityRequest>) => {
  const res = computeLayout(ev.data);
  (self as unknown as Worker).postMessage(res, [
    res.communities.buffer,
    res.order.buffer,
    res.family.buffer,
    res.offsets.buffer,
  ]);
};
