// The whole inventory system: an item is an id the player has or doesn't.
// No quantities, no combining — see design/items.md for why that's
// deliberate, not a placeholder for something bigger.
//
// These functions don't actually know anything about "items" - they just
// operate on whatever array of ids you pass in. So when the engine later
// needs a second yes/no set for story flags (has this happened yet, not
// what's carried), it reuses this same module on state.flags instead of
// writing a near-identical one. Same shape underneath, one tool, twice.
//
// Plain scripts, not ES modules: modules would let us use import/export
// and skip the shared namespace below, but browsers block module loading
// when a page is opened directly from disk (file://) instead of through
// a server — and "double-click index.html, it just works" matters more
// here than the tidier syntax. window.Codey is the one shared object
// every file below adds to, so load order in index.html matters:
// inventory.js and the content/ files must load before engine.js uses them.

window.Codey = window.Codey || {};

window.Codey.inventory = {
  create() {
    return [];
  },
  has(inventory, itemId) {
    return inventory.includes(itemId);
  },
  add(inventory, itemId) {
    if (!this.has(inventory, itemId)) {
      inventory.push(itemId);
    }
  },
};
