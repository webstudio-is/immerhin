import ObjectId from "bson-objectid";
import { applyPatches, type Patch } from "immer";
import { type ValueContainer } from "./types";

export type Change = {
  namespace: string;
  patches: Array<Patch>;
  revisePatches: Array<Patch>;
};

type TransactionSpec = {
  namespace: string;
  patches: Array<Patch>;
  revisePatches: Array<Patch>;
  container: ValueContainer<Record<string, unknown>>;
};

export class Transaction {
  id: string;
  specs: Array<TransactionSpec> = [];
  constructor() {
    this.id = ObjectId().toString();
  }
  applyPatches() {
    for (const change of this.specs) {
      const value = applyPatches(change.container.value, change.patches);
      change.container.dispatch(value);
    }
  }
  applyRevisePatches() {
    for (const change of this.specs) {
      const value = applyPatches(change.container.value, change.revisePatches);
      change.container.dispatch(value);
    }
  }
  add(change: TransactionSpec) {
    this.specs.push(change);
  }
  getChanges(): Array<Change> {
    return this.specs.map(({ namespace, patches, revisePatches }) => ({
      namespace,
      patches,
      revisePatches,
    }));
  }
  getReviseChanges(): Array<Change> {
    return this.specs.map(({ namespace, patches, revisePatches }) => ({
      namespace,
      patches: revisePatches,
      revisePatches: patches,
    }));
  }
}
