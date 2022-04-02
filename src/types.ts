type Dispatch<ValueType> = (value: ValueType) => void;

export type ValueContainer<ValueType> = {
  value: ValueType;
  dispatch: Dispatch<ValueType>;
  subscribe: (callback: (value: ValueType) => void) => void;
};
