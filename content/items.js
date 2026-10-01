// The item registry: the one place an item id gets a display name and
// an icon. Rooms only ever reference items by id (see content/act2.js)
// — this is what turns 'directory-key' into "directory key" (and a
// little key glyph) for the player.
//
// `icon` is raw inline SVG markup (paths/shapes only, no <svg> wrapper —
// the engine supplies that with a shared viewBox). It's just text, so
// no image files or art pipeline needed - and if you ever wanted to
// swap in real hand-drawn icons later, exporting SVG paths from a
// design tool and pasting them in here is literally all that'd change.
// An item with no icon falls back to a plain dot (see FALLBACK_ICON in
// src/engine.js).

window.Codey = window.Codey || {};
window.Codey.content = window.Codey.content || {};

window.Codey.content.items = {
  'signal-fragment': {
    name: 'signal fragment',
    // A pulse/oscilloscope trace - echoes how the room text describes
    // it: "flickering," "pulsing weakly."
    icon:
      '<path d="M2 12h4l2-7 4 14 3-9 2 2h5" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  'directory-key': {
    name: 'directory key',
    // A minimal key: a ring (the bow) plus a diagonal shaft with two
    // teeth marks near the end.
    icon:
      '<circle cx="8" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/>' +
      '<path d="M11 11l9 9M17 17l2-2M14 14l2-2" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round"/>',
  },
};
