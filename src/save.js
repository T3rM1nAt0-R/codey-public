// Versioned, browser-local save data. This module stores only game progress;
// it has no account, server, analytics, or personal-data behavior.
(function () {
  window.Codey = window.Codey || {};

  const STORAGE_KEY = 'codey.save';
  const VERSION = 1;
  const MAX_CODE_LENGTH = 12000;

  function objectRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function stringList(value) {
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
  }

  function primitiveRecord(value) {
    if (!objectRecord(value)) return false;
    return Object.keys(value).every((key) => {
      const entry = value[key];
      return typeof entry === 'string' || (typeof entry === 'number' && Number.isFinite(entry)) || typeof entry === 'boolean';
    });
  }

  function validCounterRecord(value) {
    return objectRecord(value) && Object.values(value).every(
      (entry) => Number.isSafeInteger(entry) && entry >= 0
    );
  }

  function validateState(state, context) {
    if (!objectRecord(state)) return null;
    const rooms = context.rooms || {};
    const items = context.items || {};
    if (typeof state.currentRoomId !== 'string' || !Object.hasOwn(rooms, state.currentRoomId)) return null;
    if (!stringList(state.inventory) || state.inventory.some((id) => !Object.hasOwn(items, id))) return null;
    if (!stringList(state.flags)) return null;
    if (!stringList(state.visited) || state.visited.some((id) => !Object.hasOwn(rooms, id))) return null;
    if (state.currentMapRoomId !== null &&
      (typeof state.currentMapRoomId !== 'string' || !Object.hasOwn(rooms, state.currentMapRoomId))) return null;

    const puzzle = state.puzzleState;
    if (!objectRecord(puzzle) ||
      !validCounterRecord(puzzle.sequenceProgress) ||
      !validCounterRecord(puzzle.sequenceErrors) ||
      !primitiveRecord(puzzle.namedValues)) return null;

    let codeRunner = null;
    if (state.codeRunner !== null && state.codeRunner !== undefined) {
      const savedRunner = state.codeRunner;
      if (!objectRecord(savedRunner) || savedRunner.roomId !== state.currentRoomId ||
        !rooms[savedRunner.roomId] || rooms[savedRunner.roomId].mode !== 'code' ||
        typeof savedRunner.source !== 'string' || savedRunner.source.length > MAX_CODE_LENGTH ||
        !Number.isSafeInteger(savedRunner.hintIndex) || savedRunner.hintIndex < 0 || savedRunner.hintIndex > 100 ||
        (savedRunner.hintText !== undefined && (typeof savedRunner.hintText !== 'string' || savedRunner.hintText.length > 2000)) ||
        (savedRunner.output !== undefined && (typeof savedRunner.output !== 'string' || savedRunner.output.length > 10000))) return null;
      codeRunner = {
        roomId: savedRunner.roomId,
        source: savedRunner.source,
        hintIndex: savedRunner.hintIndex,
        hintText: savedRunner.hintText || '',
        output: savedRunner.output || '',
      };
    }

    return {
      currentRoomId: state.currentRoomId,
      inventory: state.inventory.slice(),
      flags: state.flags.slice(),
      puzzleState: {
        sequenceProgress: Object.fromEntries(Object.entries(puzzle.sequenceProgress)),
        sequenceErrors: Object.fromEntries(Object.entries(puzzle.sequenceErrors)),
        namedValues: Object.fromEntries(Object.entries(puzzle.namedValues)),
      },
      visited: [...new Set(state.visited)],
      currentMapRoomId: state.currentMapRoomId,
      codeRunner,
    };
  }

  // Version 0 was the pre-envelope save shape used by the first save draft:
  // room/inventory/flags/visits only. Add the state introduced by Act 2 and
  // the code editor without discarding the player's valid route.
  function migrateV0(data, context) {
    if (!objectRecord(data)) return null;
    const legacy = data.state && objectRecord(data.state) ? data.state : data;
    const currentRoomId = typeof legacy.currentRoomId === 'string'
      ? legacy.currentRoomId
      : context.startRoomId;
    return validateState({
      currentRoomId,
      inventory: Array.isArray(legacy.inventory) ? legacy.inventory : [],
      flags: Array.isArray(legacy.flags) ? legacy.flags : [],
      puzzleState: {
        sequenceProgress: {},
        sequenceErrors: {},
        namedValues: {},
      },
      visited: Array.isArray(legacy.visited) ? legacy.visited : [],
      currentMapRoomId: typeof legacy.currentMapRoomId === 'string' ? legacy.currentMapRoomId : null,
      codeRunner: null,
    }, context);
  }

  function load(storage, context) {
    if (!storage || typeof storage.getItem !== 'function') return { status: 'unavailable' };
    let raw;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch (_error) {
      return { status: 'unavailable' };
    }
    if (raw === null || raw === undefined || raw === '') return { status: 'empty' };

    let data;
    try {
      data = JSON.parse(raw);
    } catch (_error) {
      return { status: 'corrupt' };
    }
    if (!objectRecord(data) || !Number.isSafeInteger(data.version)) return { status: 'corrupt' };
    if (data.version > VERSION) return { status: 'incompatible' };

    if (data.version === 0) {
      const migrated = migrateV0(data, context);
      return migrated ? { status: 'valid', state: migrated, migrated: true } : { status: 'corrupt' };
    }
    if (data.version !== VERSION) return { status: 'incompatible' };

    const state = validateState(data.state, context);
    return state ? { status: 'valid', state, migrated: false } : { status: 'corrupt' };
  }

  function write(storage, state, context) {
    if (!storage || typeof storage.setItem !== 'function') return { ok: false, reason: 'unavailable' };
    const cleanState = validateState(state, context);
    if (!cleanState) return { ok: false, reason: 'invalid-state' };
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, state: cleanState }));
      return { ok: true };
    } catch (_error) {
      return { ok: false, reason: 'unavailable' };
    }
  }

  function clear(storage) {
    if (!storage || typeof storage.removeItem !== 'function') return false;
    try {
      storage.removeItem(STORAGE_KEY);
      return true;
    } catch (_error) {
      return false;
    }
  }

  window.Codey.save = { STORAGE_KEY, VERSION, load, write, clear };
})();
