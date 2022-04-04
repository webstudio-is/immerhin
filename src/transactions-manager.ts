import { enqueue } from "./sync-queue";
import { type Transaction } from "./transaction";

export class TransactionsManager {
  max = 100;
  currentStack: Array<Transaction> = [];
  undoneStack: Array<Transaction> = [];

  undo() {
    const transaction = this.currentStack.pop();
    if (transaction === undefined) return;
    transaction.applyRevisePatches();
    enqueue(transaction.id, transaction.getReviseChanges());
    this.undoneStack.push(transaction);
  }

  redo() {
    const transaction = this.undoneStack.pop();
    if (transaction === undefined) return;
    transaction.applyPatches();
    this.currentStack.push(transaction);
    enqueue(transaction.id, transaction.getChanges());
  }

  add(transaction: Transaction) {
    transaction.applyPatches();
    this.currentStack.push(transaction);
    enqueue(transaction.id, transaction.getChanges());
    if (this.currentStack.length > this.max) {
      this.currentStack.shift();
    }
    // After we add a change, we can't redo something we have undone before.
    // It would make undo unpredictable, because there are new changes.
    this.undoneStack.splice(0);
  }
}
