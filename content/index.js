// The manifest: every act's rooms get merged into one lookup table here,
// so the engine never needs to know which act a room belongs to. Adding
// Act 2 later means adding one <script> tag in index.html plus one
// spread line here — nothing else changes.

window.Codey = window.Codey || {};

window.Codey.rooms = {
  ...window.Codey.content.act1.rooms,
};

window.Codey.startRoomId = window.Codey.content.act1.startRoomId;
