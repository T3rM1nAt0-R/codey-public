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

// The runtime requires choice IDs to remain stable even when choices move in
// an array, so keep authored IDs here rather than deriving them at render time.
const choiceIds = {
  'boot-sector': ['sense-surroundings', 'try-moving'],
  'signal-junction': ['collect-signal-fragment', 'leave-fragment'],
  'process-hallway': ['approach-gate', 'return-to-junction'],
  'gatekeepers-alcove': ['ask-what-am-i', 'ask-where-am-i'],
  'arbiter-explains': ['ready-to-try'],
  'loop-trial-1': ['send-signal-again'],
  'loop-trial-2': ['send-signal-again'],
  'loop-trial-3': ['continue-to-shell'],
  'shell-granted': ['enter-user-space'],
  'act3-root-reveal': ['propose-safer-rule'],
  'act3-core-ending': ['warden-waited', 'warden-witnessed', 'warden-redirected'],
};

for (const [roomId, ids] of Object.entries(choiceIds)) {
  const choices = window.Codey.rooms[roomId] && window.Codey.rooms[roomId].choices;
  if (!Array.isArray(choices) || choices.length !== ids.length) {
    throw new TypeError(`Stable choice IDs do not match authored choices in ${roomId}.`);
  }
  choices.forEach((choice, index) => { choice.id = ids[index]; });
}

// These destinations are invoked by accepted mechanic outcomes from the
// adapter, then validated and applied by the core's ordinary exit action.
for (const room of Object.values(window.Codey.rooms)) {
  if (room.code && room.code.next) {
    room.exits = Object.assign({}, room.exits, {
      complete: {
        to: room.code.next,
        ...(room.code.successFlag ? { requiresFlag: room.code.successFlag } : {}),
      },
    });
  }
  if (room.wardenApproach) {
    const routeExits = {};
    for (const [approachId, response] of Object.entries(room.wardenApproach.approaches || {})) {
      const direction = `approach-${approachId}`;
      response.exitDirection = direction;
      routeExits[direction] = { to: room.wardenApproach.next, requiresFlag: response.flag };
    }
    room.exits = Object.assign({}, room.exits, routeExits);
  }
}

// Game flags are content data. Declaring them lets the runtime reject typos
// instead of silently accepting a flag that no room or mechanic can own.
window.Codey.flags = {
  'adaptive-policy-installed': true,
  'archive-audit-read': true,
  'archive-index-read': true,
  'archive-sequence-complete': true,
  'hid-from-warden': true,
  'relay-configured': true,
  'warden-approach-avoided': true,
  'warden-approach-confronted': true,
  'warden-approach-redirected': true,
};

window.Codey.runtimeContent = {
  contentId: 'codey',
  schemaVersion: 1,
  startRoomId: window.Codey.startRoomId,
  rooms: window.Codey.rooms,
  items: window.Codey.items,
  flags: window.Codey.flags,
};
