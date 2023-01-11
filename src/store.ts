import { createDraft, finishDraft, enablePatches, type Patch } from "immer";
import { type ValueContainer } from "./types";
import { type Change, Transaction } from "./transaction";
import {
  type TransactionCallback,
  TransactionsManager,
} from "./transactions-manager";
import { enqueue } from "./sync-queue";

enablePatches();

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
type Any = any;

type UnwrapContainers<Containers extends Array<ValueContainer<unknown>>> = {
  [Index in keyof Containers]: Containers[Index] extends ValueContainer<
    infer Value
  >
    ? Value
    : never;
};

export class Store {
  namespaces: Map<ValueContainer<Any>, string>;
  containers: Map<string, ValueContainer<Any>>;

  transactionManager: TransactionsManager;

  private callbacks: TransactionCallback[] = [];

  constructor() {
    this.namespaces = new Map();
    this.transactionManager = new TransactionsManager(
      (transactionId, changes, source) => {
        enqueue(transactionId, changes);
        for (const callback of this.callbacks) {
          callback(transactionId, changes, source);
        }
      }
    );
  }

  register<Value>(namespace: string, container: ValueContainer<Value>) {
    this.namespaces.set(container, namespace);
    this.containers.set(namespace, container);
  }

  createTransaction<Containers extends Array<ValueContainer<Any>>>(
    containers: [...Containers],
    recipe: (...values: UnwrapContainers<Containers>) => void,
    source?: string
  ): UnwrapContainers<Containers> {
    type Values = UnwrapContainers<Containers>;
    const drafts = [] as unknown as Values;
    for (const container of containers) {
      drafts.push(createDraft(container.value));
    }
    recipe(...drafts);
    const transaction = new Transaction();
    const values = [] as unknown as Values;
    drafts.forEach((draft, index) => {
      const namespace = this.namespaces.get(containers[index]);
      if (namespace === undefined) {
        throw new Error(
          "Container used for transaction is not registered in sync engine"
        );
      }
      const value = finishDraft(
        draft,
        (patches: Array<Patch>, revisePatches: Array<Patch>) => {
          transaction.add({
            namespace,
            patches,
            revisePatches,
            container: containers[index],
          });
        }
      );
      values.push(value);
    });
    this.transactionManager.add(transaction, source);
    return values;
  }

  createTransactionFromChanges(changes: Array<Change>, source?: string) {
    const transaction = new Transaction();
    for (const change of changes) {
      const container = this.containers.get(change.namespace);
      if (container) {
        transaction.add({
          ...change,
          container,
        });
      }
    }
    this.transactionManager.add(transaction, source);
  }

  subscribe(callback: TransactionCallback) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((item) => callback !== item);
    };
  }

  undo() {
    this.transactionManager.undo();
  }

  redo() {
    this.transactionManager.redo();
  }
}
