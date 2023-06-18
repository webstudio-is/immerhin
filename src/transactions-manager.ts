import type { Change, Transaction } from "./transaction";

export type TransactionCallback = (
  transactionId: string,
  changes: Array<Change>,
  source?: string
) => void;

export class TransactionsManager {
  max = 100;
  currentStack: Array<Transaction> = [];
  undoneStack: Array<Transaction> = [];

  constructor(private callback: TransactionCallback) {}

  undo() {
    const transaction = this.currentStack.pop();
    if (transaction === undefined) return;
    transaction.applyRevisePatches();
    this.callback(transaction.id, transaction.getReviseChanges());
    this.undoneStack.push(transaction);
  }

  redo() {
    const transaction = this.undoneStack.pop();
    if (transaction === undefined) return;
    transaction.applyPatches();
    this.currentStack.push(transaction);
    this.callback(transaction.id, transaction.getChanges());
  }

  add(transaction: Transaction, source?: string) {
    // ignore empty transactions
    if (transaction.specs.length === 0) {
      return;
    }
    transaction.applyPatches();
    this.currentStack.push(transaction);
    this.callback(transaction.id, transaction.getChanges(), source);
    if (this.currentStack.length > this.max) {
      this.currentStack.shift();
    }
    // After we add a change, we can't redo something we have undone before.
    // It would make undo unpredictable, because there are new changes.
    this.undoneStack.splice(0);
  }
}
