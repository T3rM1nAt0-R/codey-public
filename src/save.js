// Codey's adapter-owned save envelope. Shared progression is validated by
// CodeyRuntime; map presentation and editor drafts stay outside runtime state.
(function () {
  window.Codey = window.Codey || {};

  const STORAGE_KEY = 'codey.save';
  const VERSION = 2;
  const ACT2_MECHANIC_ID = 'codey.act2-puzzles';
  const MAX_CODE_LENGTH = 12000;

  function objectRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function stringList(value) {
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
  }

  function validCounters(value) {
    return objectRecord(value) && Object.values(value).every(
      (entry) => Number.isSafeInteger(entry) && entry >= 0
    );
  }

  function validPrimitiveRecord(value) {
    return objectRecord(value) && Object.values(value).every((entry) =>
      typeof entry === 'string' || (typeof entry === 'number' && Number.isFinite(entry)) || typeof entry === 'boolean'
    );
  }

  function cleanPuzzleState(value) {
    if (value === undefined || value === null) {
      return { sequenceProgress: {}, sequenceErrors: {}, namedValues: {} };
    }
    if (!objectRecord(value) || !validCounters(value.sequenceProgress) ||
      !validCounters(value.sequenceErrors) || !validPrimitiveRecord(value.namedValues)) return null;
    return {
      sequenceProgress: Object.fromEntries(Object.entries(value.sequenceProgress)),
      sequenceErrors: Object.fromEntries(Object.entries(value.sequenceErrors)),
      namedValues: Object.fromEntries(Object.entries(value.namedValues)),
    };
  }

  function cleanCodeDraft(draft, runtimeState, context) {
    if (draft === undefined || draft === null) return null;
    if (!objectRecord(draft) || draft.roomId !== runtimeState.currentRoomId ||
      !context.rooms[draft.roomId] || context.rooms[draft.roomId].mode !== 'code' ||
      typeof draft.source !== 'string' || draft.source.length > MAX_CODE_LENGTH ||
      !Number.isSafeInteger(draft.hintIndex) || draft.hintIndex < 0 || draft.hintIndex > 100 ||
      (draft.hintText !== undefined && (typeof draft.hintText !== 'string' || draft.hintText.length > 2000)) ||
      (draft.output !== undefined && (typeof draft.output !== 'string' || draft.output.length > 10000))) return undefined;
    return {
      roomId: draft.roomId,
      source: draft.source,
      hintIndex: draft.hintIndex,
      hintText: draft.hintText || '',
      output: draft.output || '',
    };
  }

  function cleanAdapterState(value, runtimeState, context) {
    if (!objectRecord(value) || !objectRecord(value.map)) return null;
    const map = value.map;
    if (!stringList(map.visited) || map.visited.some((id) =>
      !context.rooms[id] || !context.rooms[id].mapName) || new Set(map.visited).size !== map.visited.length) return null;
    if (map.currentRoomId !== null && (typeof map.currentRoomId !== 'string' ||
      !context.rooms[map.currentRoomId] || !context.rooms[map.currentRoomId].mapName ||
      !map.visited.includes(map.currentRoomId))) return null;
    const codeDraft = cleanCodeDraft(value.codeDraft, runtimeState, context);
    if (codeDraft === undefined) return null;
    return {
      map: { visited: map.visited.slice(), currentRoomId: map.currentRoomId },
      codeDraft,
    };
  }

  function cleanRuntimeState(value, context) {
    if (!objectRecord(value) || !objectRecord(value.mechanics)) return null;
    const knownMechanics = new Set(context.mechanicIds || []);
    if (Object.keys(value.mechanics).some((id) => !knownMechanics.has(id))) return { incompatible: true };
    if (!context.runtime || typeof context.runtime.dispatch !== 'function') return null;
    const validation = context.runtime.dispatch(value, { type: 'save-validation' });
    if (validation.result.code === 'invalid-state') return null;
    if (validation.result.code !== 'unknown-action') return null;
    return JSON.parse(JSON.stringify(value));
  }

  function mapFromLegacy(legacy, rooms) {
    const visited = [...new Set((legacy.visited || []).filter((id) => rooms[id] && rooms[id].mapName))];
    const currentRoomId = typeof legacy.currentMapRoomId === 'string' && rooms[legacy.currentMapRoomId] &&
      rooms[legacy.currentMapRoomId].mapName && visited.includes(legacy.currentMapRoomId)
      ? legacy.currentMapRoomId
      : (visited.length ? visited[visited.length - 1] : null);
    return { visited, currentRoomId };
  }

  function migrateLegacy(data, context, fromVersion) {
    if (!objectRecord(data)) return null;
    const legacy = data.state && objectRecord(data.state) ? data.state : data;
    const currentRoomId = typeof legacy.currentRoomId === 'string' ? legacy.currentRoomId : context.startRoomId;
    const puzzle = cleanPuzzleState(fromVersion === 0 ? legacy.puzzleState : legacy.puzzleState);
    if (!puzzle || !context.rooms[currentRoomId]) return null;
    const inventory = Array.isArray(legacy.inventory) ? legacy.inventory : [];
    const flags = Array.isArray(legacy.flags) ? legacy.flags : [];
    const legacyVisited = Array.isArray(legacy.visited) ? legacy.visited : [];
    const rooms = context.rooms;
    const items = context.items;
    const knownFlags = new Set(Object.keys(context.flags));
    if (!stringList(inventory) || inventory.some((id) => !Object.hasOwn(items, id)) ||
      new Set(inventory).size !== inventory.length || !stringList(flags) ||
      flags.some((id) => !knownFlags.has(id)) || new Set(flags).size !== flags.length ||
      !stringList(legacyVisited) || legacyVisited.some((id) => !Object.hasOwn(rooms, id))) return null;

    const map = mapFromLegacy(legacy, rooms);
    const runtimeState = Object.assign({}, context.runtime.start().state, {
      currentRoomId,
      inventory: inventory.slice(),
      flags: flags.slice(),
      visited: [...new Set([...legacyVisited, currentRoomId])],
      mechanics: { [ACT2_MECHANIC_ID]: { version: 1, data: puzzle } },
    });
    const validRuntime = cleanRuntimeState(runtimeState, context);
    if (!validRuntime || validRuntime.incompatible) return null;
    const adapterState = cleanAdapterState({ map, codeDraft: legacy.codeRunner || null }, runtimeState, context);
    if (!adapterState) return null;
    return { runtimeState: validRuntime, adapterState };
  }

  function cleanEnvelope(data, context) {
    if (!objectRecord(data) || !objectRecord(data.runtimeState)) return { status: 'corrupt' };
    const runtimeState = cleanRuntimeState(data.runtimeState, context);
    if (runtimeState && runtimeState.incompatible) return { status: 'incompatible' };
    if (!runtimeState) return { status: 'corrupt' };
    const adapterState = cleanAdapterState(data.adapterState, runtimeState, context);
    if (!adapterState) return { status: 'corrupt' };
    return { status: 'valid', runtimeState, adapterState, migrated: false };
  }

  function load(storage, context) {
    if (!storage || typeof storage.getItem !== 'function') return { status: 'unavailable' };
    let raw;
    try { raw = storage.getItem(STORAGE_KEY); } catch (_error) { return { status: 'unavailable' }; }
    if (raw === null || raw === undefined || raw === '') return { status: 'empty' };

    let data;
    try { data = JSON.parse(raw); } catch (_error) { return { status: 'corrupt' }; }
    if (!objectRecord(data) || !Number.isSafeInteger(data.version)) return { status: 'corrupt' };
    if (data.version > VERSION) return { status: 'incompatible' };
    if (data.version === VERSION) return cleanEnvelope(data, context);
    if (data.version !== 0 && data.version !== 1) return { status: 'incompatible' };
    const migrated = migrateLegacy(data, context, data.version);
    return migrated
      ? { status: 'valid', ...migrated, migrated: true }
      : { status: 'corrupt' };
  }

  function write(storage, runtimeState, adapterState, context) {
    if (!storage || typeof storage.setItem !== 'function') return { ok: false, reason: 'unavailable' };
    const cleanRuntime = cleanRuntimeState(runtimeState, context);
    if (!cleanRuntime) return { ok: false, reason: 'invalid-state' };
    if (cleanRuntime.incompatible) return { ok: false, reason: 'incompatible-state' };
    const cleanAdapter = cleanAdapterState(adapterState, cleanRuntime, context);
    if (!cleanAdapter) return { ok: false, reason: 'invalid-state' };
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, runtimeState: cleanRuntime, adapterState: cleanAdapter }));
      return { ok: true };
    } catch (_error) {
      return { ok: false, reason: 'unavailable' };
    }
  }

  function clear(storage) {
    if (!storage || typeof storage.removeItem !== 'function') return false;
    try { storage.removeItem(STORAGE_KEY); return true; } catch (_error) { return false; }
  }

  window.Codey.save = { STORAGE_KEY, VERSION, load, write, clear };
})();
