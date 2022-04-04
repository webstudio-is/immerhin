# Immerhin

The core idea is to use [Immer](https://immerjs.github.io/immer/) as an interface for state mutations and provide a convenient way to group mutations into a single transaction.

Using Immer's patches we sync the state across the application and to the server. This also gives us a way to undo/redo a transaction automatically.

## Features

1. Update application state using [patches](https://immerjs.github.io/immer/patches)
2. Synchronize to the server
3. Get undo/redo on the client that does both updating the client state and syncing to the server
4. Server agnostic
5. State management agnostic (mostly)
6. Sync between iframes (not implemented yet)
7. Sync between tabs (not implemented yet)
8. Conflict resolution (not implemented yet)
9. Server handler (not implemented yet)

## Example

```js
import store, { sync } from "immerhin";

// Create containers for each state. Sync engine only cares that the result has a "value" and a "dispatch(newValue)"
const container1 = createContainer(initialValue);
const container2 = createContainer(initialValue);

// - Explicitely enable containers for transactions
// - Define a namespace for each container, so that server knows which object it has to patch.
store.register("some-name1", container1);
store.register("some-name2", container2);

// Creating the actual transaction that will:
// - generate patches
// - update states
// - inform all subscribers
// - register a transaction for potential undo/redo and sync calls
store.createTransaction(
  [container1, container2, ...rest],
  (value1, value2, ...rest) => {
    mutateValue(value1);
    mutateValue(value2);
    // ...
  }
);

// Setup periodic sync with a fetch, or do this with Websocket
setInterval(async () => {
  const entries = sync();
  await fetch("/patch", { method: "POST", payload: JSON.stringify(entries) });
}, 1000);

// Undo/redo

store.undo();
store.redo();
```

## How it works

### Containers

A Container contains a state value.

A container is an interface that implements a `dispatch(value)` method so that a value can be propagated to all consumers.
A container exposes its current value as `container.value`.
You can use anything to create containers, it could be a Redux store, could be an observable or a minimalistic [nano state](https://github.com/kof/react-nano-state)

You can use the same container instance to subscribe to the changes across the entire application.

Example using nano state:

```js
import { createContainer, useValue } from "react-nano-state";
const myContainer = createContainer(initialValue);

// I can call a dispatch from anywhere
myContainer.dispatch(newValue);

// I can subscribe to updates in React
const Component = () => {
  const [value, setValue] = useValue(myContainer);
};
```

### Container registration

We register containers for two reasons:

1. To define a namespace for each container so that whoever consumes the changes knows which object to apply the patches to.
2. Ensure that the container was intentionally registered to be synced to the server and be part of undo/redo transactions. You may not want this for every container since you can use them for ephemeral states.

Example

```js
store.register("myName", myContainer);
```

### Creating a transaction

A transaction is a set of changes applied to a set of states. When you apply changes to the states inside a transaction, you are essentially telling the engine which changes are associated with the same user action so that undo/redo can use that as a single step to work with.

A call into `store.createTransaction()`does all of this:

- generate patches (using Immer)
- update states and inform all subscribers (by calling `container.dispatch(newValue)`)
- register a transaction for potential undo/redo and calls

Example

```js
store.createTransaction(
  [container1, container2, ...rest],
  (value1, value2, ...rest) => {
    mutateValue(value1);
    mutateValue(value2);
    // ...
  }
);
```

### Undo/redo

Calling undo() and redo() functions will essentially apply the right patch for the value and dispatch the update.

### Sync

The `sync(`) function returns you all changes queued up for a sync since the last call.
With the return from `sync(),` you can do anything you want, for example, send it to your server.

Example

```js
// Setup periodic sync with a fetch, or do this with Websocket
setInterval(async () => {
  const entries = sync();
  await fetch("/patch", { method: "POST", payload: JSON.stringify(entries) });
}, 1000);
```

Example entries:

```json
[
  {
    "transactionId": "6243062b469f516835327f65",
    "changes": [
      {
        "namespace": "root",
        "patches": [
          {
            "op": "replace",
            "path": ["children", 1],
            "value": {
              "component": "Box",
              "id": "6241f55791596f2467df9c2a",
              "style": {},
              "children": []
            }
          },
          {
            "op": "replace",
            "path": ["children", 2],
            "value": {
              "component": "Box",
              "id": "6241f55a91596f2467df9c36",
              "style": {},
              "children": []
            }
          },
          {
            "op": "replace",
            "path": ["children", "length"],
            "value": 3
          }
        ]
      }
    ]
  }
]
```

## Create a new store

If you want to have multiple separate undoable states, create a separate store for each. They add to the same sync queue in the end.

```js
import { Store } from "immerhin";

const store = new Store();
```
