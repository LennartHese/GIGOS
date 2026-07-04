// Central mutable game state. `state`/`scene` are read and reassigned from
// every scene and system in the game (every enterX()/exitX(), every
// openY()/closeY()), so they live on one shared object rather than as
// module-level bindings — an imported `let` binding can't be reassigned
// from outside its own module, but a property of an imported object can.
export const G = {
  state: 'title',   // title | play | dialog | ...
  scene: 'town',     // town | efes | eiche | chb | cafe | wohnung | ...
};
