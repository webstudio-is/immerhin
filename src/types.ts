export type ValueContainer<ValueType> = {
  get(): ValueType;
  set(value: ValueType): void;
};
