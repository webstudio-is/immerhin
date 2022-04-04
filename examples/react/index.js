import React, { Fragment } from "react";
import { createRoot } from "react-dom/client";
import { createValueContainer, useValue } from "react-nano-state";
import store, { sync } from "immerhin";

const itemsContainer = createValueContainer([]);

store.register("items", itemsContainer);

const List = () => {
  const [items] = useValue(itemsContainer);
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>{item.value}</li>
      ))}
    </ul>
  );
};

const App = () => {
  return (
    <Fragment>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.target);
          event.target.reset();
          const value = data.get("item");
          store.createTransaction([itemsContainer], (items) => {
            items.push({ value });
          });
        }}
      >
        <p>
          Add items, then try redo/redo.
          <br />
          Notice that the 2 lists are synced.
        </p>
        <input type="text" name="item" />
        <button type="submit">Add</button>
        <button
          type="button"
          onClick={() => {
            store.undo();
          }}
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => {
            store.redo();
          }}
        >
          Redo
        </button>
        <button
          type="button"
          onClick={() => {
            console.log(sync());
          }}
        >
          Log changes
        </button>
      </form>

      <div style={{ display: "flex" }}>
        <List />
        <List />
      </div>
    </Fragment>
  );
};

createRoot(document.body.appendChild(document.createElement("div"))).render(
  <App />
);
