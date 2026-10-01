// The manifest: every act's rooms (and the item registry) get merged
// into flat lookup tables here, so the engine never needs to know which
// act a room or item belongs to. Adding Act 3 later means adding one
// <script> tag in index.html plus one spread line here per table -
// nothing else changes.

window.Codey = window.Codey || {};

window.Codey.rooms = {
  ...window.Codey.content.act1.rooms,
  ...window.Codey.content.act2.rooms,
  ...window.Codey.content.act3.rooms,
};

window.Codey.items = {
  ...window.Codey.content.items,
};

window.Codey.startRoomId = window.Codey.content.act1.startRoomId;
