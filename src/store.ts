import { createDraft, finishDraft, enablePatches, type Patch } from "immer";
import { type ValueContainer } from "./types";
import { Transaction } from "./transaction";
import { TransactionsManager } from "./transactions-manager";

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
  registry: Map<ValueContainer<Any>, string>;

  transactionManager: TransactionsManager;

  constructor() {
    this.registry = new Map();
    this.transactionManager = new TransactionsManager();
  }

  register<Value>(namespace: string, container: ValueContainer<Value>) {
    this.registry.set(container, namespace);
  }

  createTransaction<Containers extends Array<ValueContainer<Any>>>(
    containers: [...Containers],
    recipe: (...values: UnwrapContainers<Containers>) => void
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
      const namespace = this.registry.get(containers[index]);
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
    this.transactionManager.add(transaction);
    return values;
  }

  undo() {
    this.transactionManager.undo();
  }

  redo() {
    this.transactionManager.redo();
  }
}
