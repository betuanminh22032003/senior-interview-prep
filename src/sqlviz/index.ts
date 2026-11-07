import './viz.css';
import type { ComponentType } from 'react';
import { Cardinality } from './Cardinality';
import { IndexOrder } from './IndexOrder';
import { Pool } from './Pool';
import { RequestTimeline } from './RequestTimeline';
import { Sargable } from './Sargable';
import { SeekScan } from './SeekScan';
import { Waits } from './Waits';
import { WriteCost } from './WriteCost';

/** Widgets referenced by "**Viz:** key" in content/book/*.md. */
export const VIZ: Record<string, ComponentType> = {
  'request-timeline': RequestTimeline,
  waits: Waits,
  'seek-scan': SeekScan,
  'index-order': IndexOrder,
  'write-cost': WriteCost,
  sargable: Sargable,
  cardinality: Cardinality,
  pool: Pool,
};
