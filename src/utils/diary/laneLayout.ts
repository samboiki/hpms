/**
 * Side-by-side layout for bookings that overlap in one diary column. Without it a double booking
 * ("Book anyway") draws one card on top of the other and the first patient disappears from view.
 * Bookings that overlap share the column's width; a booking that overlaps nothing keeps it all.
 */

export interface LaneItem {
  id: string;
  /** Minutes since midnight */
  start: number;
  end: number;
}

export interface LanePlacement {
  /** 0-based position from the left */
  lane: number;
  /** How many lanes its overlapping group uses (its width is 1 / lanes) */
  lanes: number;
}

/**
 * Places each booking in the first free lane of its overlapping group. Groups are the runs of
 * bookings that overlap one another directly or through a chain; each group gets its own width.
 */
export function layoutLanes(items: LaneItem[]): Map<string, LanePlacement> {
  const placements = new Map<string, LanePlacement>();
  const sorted = [...items]
    .map((item) => ({ ...item, end: Math.max(item.end, item.start + 1) }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  let group: Array<{ id: string; lane: number }> = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;

  const closeGroup = () => {
    for (const member of group) placements.set(member.id, { lane: member.lane, lanes: laneEnds.length });
    group = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (item.start >= groupEnd) {
      closeGroup();
      groupEnd = -Infinity;
    }
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    group.push({ id: item.id, lane });
    groupEnd = Math.max(groupEnd, item.end);
  }
  closeGroup();
  return placements;
}
