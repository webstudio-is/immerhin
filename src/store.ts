import { createDraft, finishDraft, enablePatches, type Patch } from "immer";
import { type ValueContainer } from "./types";
import { type Change, Transaction } from "./transaction";
import {
  type TransactionCallback,
  TransactionsManager,
} from "./transactions-manager";
import { type Queue, enqueue, popAll } from "./sync-queue";

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
  namespaces = new Map<ValueContainer<Any>, string>();
  containers = new Map<string, ValueContainer<Any>>();

  transactionManager: TransactionsManager;

  private callbacks: TransactionCallback[] = [];

  private transactionQueue: Parameters<TransactionCallback>[] = [];
  private syncQueue: Queue = [];

  constructor() {
    this.transactionManager = new TransactionsManager(
      (transactionId, changes, source) => {
        // store transactions until at least one subscription is added
        if (this.callbacks.length === 0) {
          this.transactionQueue.push([transactionId, changes, source]);
        }
        enqueue(this.syncQueue, transactionId, changes);
        for (const callback of this.callbacks) {
          callback(transactionId, changes, source);
        }
      },
    );
  }

  register<Value>(namespace: string, container: ValueContainer<Value>) {
    this.namespaces.set(container, namespace);
    this.containers.set(namespace, container);
  }

  createTransaction<Containers extends Array<ValueContainer<Any>>>(
    containers: [...Containers],
    recipe: (...values: UnwrapContainers<Containers>) => void,
    source?: string,
  ): UnwrapContainers<Containers> {
    type Values = UnwrapContainers<Containers>;
    const drafts = [] as unknown as Values;
    for (const container of containers) {
      drafts.push(createDraft(container.get()));
    }
    recipe(...drafts);
    const transaction = new Transaction();
    const values = [] as unknown as Values;
    drafts.forEach((draft, index) => {
      const namespace = this.namespaces.get(containers[index]);
      if (namespace === undefined) {
        throw new Error(
          "Container used for transaction is not registered in sync engine",
        );
      }
      const value = finishDraft(
        draft,
        (patches: Array<Patch>, revisePatches: Array<Patch>) => {
          // ignore empty changes
          if (patches.length === 0) {
            return;
          }
          transaction.add({
            namespace,
            patches,
            revisePatches,
            container: containers[index],
          });
        },
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

  addTransaction(
    transactionId: string,
    changes: Array<Change>,
    source?: string,
  ) {
    const transaction = new Transaction(transactionId);
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

  revertTransaction(transactionId: string) {
    this.transactionManager.revert(transactionId);
  }

  subscribe(callback: TransactionCallback) {
    // flush transactions from queue
    if (this.callbacks.length === 0) {
      for (const [transactionId, changes, source] of this.transactionQueue) {
        callback(transactionId, changes, source);
      }
      this.transactionQueue = [];
    }
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

  popAll() {
    return popAll(this.syncQueue);
  }
}
