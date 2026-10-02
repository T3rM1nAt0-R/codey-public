/*
 * CodeyRuntime is the browser-free, deterministic state transition core.
 * Load it as a classic script. Content and registered mechanic functions
 * are supplied by the host; this file never discovers globals or I/O.
 */
(function (root) {
  'use strict';

  const RUNTIME_API_VERSION = 1;
  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const isRecord = (value) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || (Object.getPrototypeOf(prototype) === null &&
      typeof prototype.constructor === 'function' && prototype.constructor.name === 'Object');
  };

  function isJsonValue(value, seen = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value !== 'object' || seen.has(value)) return false;
    if (!Array.isArray(value) && !isRecord(value)) return false;
    seen.add(value);
    const valid = Array.isArray(value)
      ? Array.from({ length: value.length }, (_entry, index) =>
        hasOwn(value, index) && isJsonValue(value[index], seen)).every(Boolean)
      : Object.keys(value).every((key) => isJsonValue(value[key], seen));
    seen.delete(value);
    return valid;
  }

  function copy(value, seen = new Map()) {
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    if (Array.isArray(value)) {
      const result = new Array(value.length);
      seen.set(value, result);
      for (let index = 0; index < value.length; index += 1) {
        if (hasOwn(value, index)) result[index] = copy(value[index], seen);
      }
      return result;
    }
    if (isRecord(value)) {
      const result = {};
      seen.set(value, result);
      for (const key of Object.keys(value)) {
        Object.defineProperty(result, key, { value: copy(value[key], seen), enumerable: true, writable: true, configurable: true });
      }
      return result;
    }
    return value;
  }

  function freeze(value) {
    if (value && typeof value === 'object') {
      Object.freeze(value);
      for (const key of Object.keys(value)) freeze(value[key]);
    }
    return value;
  }

  function optionalString(value) { return value === undefined || typeof value === 'string'; }
  function stringList(value) { return value === undefined || (Array.isArray(value) && value.every((entry) => typeof entry === 'string')); }
  function itemRequirement(value) {
    return value === undefined || typeof value === 'string' ||
      (Array.isArray(value) && value.every((entry) => typeof entry === 'string'));
  }

  function assertContent(content) {
    if (!isRecord(content) || !isJsonValue(content)) throw new TypeError('Content must be plain JSON data.');
    if (typeof content.contentId !== 'string' || !content.contentId.trim()) {
      throw new TypeError('Content must declare a non-empty contentId.');
    }
    if (!Number.isSafeInteger(content.schemaVersion) || content.schemaVersion < 1) {
      throw new TypeError('Content schemaVersion must be a positive safe integer.');
    }
    if (!isRecord(content.rooms) || !isRecord(content.items) || !isRecord(content.flags) ||
      typeof content.startRoomId !== 'string' || !hasOwn(content.rooms, content.startRoomId)) {
      throw new TypeError('Content must declare rooms, items and an existing startRoomId.');
    }
    for (const [roomId, room] of Object.entries(content.rooms)) {
      if (!roomId || !isRecord(room)) throw new TypeError(`Room "${roomId}" must be a data record.`);
      if ((room.choices !== undefined && !Array.isArray(room.choices)) ||
        (room.exits !== undefined && !isRecord(room.exits)) ||
        (room.items !== undefined && !Array.isArray(room.items))) {
        throw new TypeError(`Room "${roomId}" has malformed transition data.`);
      }
      for (const choice of room.choices || []) {
        if (!isRecord(choice) || typeof choice.id !== 'string' || !choice.id ||
          typeof choice.next !== 'string' || !hasOwn(content.rooms, choice.next) ||
          !itemRequirement(choice.requires) || !optionalString(choice.requiresFlag) ||
          !stringList(choice.requiresFlags) || !optionalString(choice.setFlag) || !stringList(choice.setFlags)) {
          throw new TypeError(`Room "${roomId}" has a malformed choice or unknown destination.`);
        }
        if (choice.item !== undefined && (typeof choice.item !== 'string' || !choice.item || !hasOwn(content.items, choice.item))) {
          throw new TypeError(`Room "${roomId}" grants unknown item "${choice.item}".`);
        }
        const requiredFlags = [choice.requiresFlag, ...(choice.requiresFlags || []), choice.setFlag, ...(choice.setFlags || [])].filter(Boolean);
        if (requiredFlags.some((id) => !hasOwn(content.flags, id))) {
          throw new TypeError(`Room "${roomId}" choice "${choice.id}" references an undeclared flag.`);
        }
        const requiredItems = choice.requires == null ? [] : (Array.isArray(choice.requires) ? choice.requires : [choice.requires]);
        if (requiredItems.some((id) => typeof id !== 'string' || !hasOwn(content.items, id))) {
          throw new TypeError(`Room "${roomId}" choice "${choice.id}" requires an unknown item.`);
        }
      }
      for (const [direction, rawExit] of Object.entries(room.exits || {})) {
        const exit = typeof rawExit === 'string' ? { to: rawExit } : rawExit;
        if (!isRecord(exit) || typeof exit.to !== 'string' || !hasOwn(content.rooms, exit.to) ||
          !itemRequirement(exit.requires) || !optionalString(exit.requiresFlag) ||
          !stringList(exit.requiresFlags) || (exit.onFail !== undefined && !isRecord(exit.onFail))) {
          throw new TypeError(`Room "${roomId}" has an invalid exit "${direction}".`);
        }
        const requiredFlags = [exit.requiresFlag, ...(exit.requiresFlags || [])].filter(Boolean);
        if (requiredFlags.some((id) => !hasOwn(content.flags, id))) {
          throw new TypeError(`Room "${roomId}" exit "${direction}" references an undeclared flag.`);
        }
        const requiredItems = exit.requires == null ? [] : (Array.isArray(exit.requires) ? exit.requires : [exit.requires]);
        if (requiredItems.some((id) => typeof id !== 'string' || !hasOwn(content.items, id))) {
          throw new TypeError(`Room "${roomId}" exit "${direction}" requires an unknown item.`);
        }
        if (exit.onFail && exit.onFail.to && !hasOwn(content.rooms, exit.onFail.to)) {
          throw new TypeError(`Room "${roomId}" exit "${direction}" has an unknown failure destination.`);
        }
      }
      for (const itemId of room.items || []) {
        if (typeof itemId !== 'string' || !hasOwn(content.items, itemId)) {
          throw new TypeError(`Room "${roomId}" offers an unknown item.`);
        }
      }
    }
  }

  function validateState(state, content, knownFlags) {
    if (!isRecord(state) || !isJsonValue(state) ||
      state.contentId !== content.contentId || state.contentSchemaVersion !== content.schemaVersion ||
      state.runtimeApiVersion !== RUNTIME_API_VERSION ||
      typeof state.currentRoomId !== 'string' || !hasOwn(content.rooms, state.currentRoomId) ||
      !Array.isArray(state.inventory) || !Array.isArray(state.flags) ||
      !Array.isArray(state.visited) || !isRecord(state.mechanics)) return false;
    if (!state.inventory.every((id) => typeof id === 'string' && hasOwn(content.items, id)) ||
      new Set(state.inventory).size !== state.inventory.length ||
      !state.flags.every((flag) => typeof flag === 'string' && knownFlags.has(flag)) ||
      new Set(state.flags).size !== state.flags.length ||
      !state.visited.every((roomId) => typeof roomId === 'string' && hasOwn(content.rooms, roomId)) ||
      new Set(state.visited).size !== state.visited.length ||
      !state.visited.includes(state.currentRoomId)) return false;
    for (const entry of Object.values(state.mechanics)) {
      if (!isRecord(entry) || !Number.isSafeInteger(entry.version) || entry.version < 1 || !isJsonValue(entry.data)) return false;
    }
    return true;
  }

  function rejected(state, code) {
    return { state: copy(state), result: { status: 'rejected', code }, events: [] };
  }

  function createRuntime(content, options = {}) {
    assertContent(content);
    const mechanics = options.mechanics || {};
    if (!isRecord(mechanics)) throw new TypeError('Mechanic registrations must be a record.');
    for (const [id, registration] of Object.entries(mechanics)) {
      if (!id || !isRecord(registration) || !Number.isSafeInteger(registration.version) ||
        registration.version < 1 || typeof registration.reduce !== 'function' ||
        (registration.migrate !== undefined && typeof registration.migrate !== 'function')) {
        throw new TypeError(`Mechanic registration "${id}" is invalid.`);
      }
    }
    const pack = freeze(copy(content));
    const knownFlags = new Set(Object.keys(pack.flags));

    function enter(state, roomId, events) {
      state.currentRoomId = roomId;
      if (!state.visited.includes(roomId)) state.visited.push(roomId);
      events.push({ type: 'room-entered', roomId });
      if (pack.rooms[roomId].ending === true) events.push({ type: 'ending-reached', roomId });
    }

    function start() {
      const state = {
        contentId: pack.contentId,
        contentSchemaVersion: pack.schemaVersion,
        runtimeApiVersion: RUNTIME_API_VERSION,
        currentRoomId: pack.startRoomId,
        inventory: [],
        flags: [],
        visited: [],
        mechanics: {},
      };
      const events = [];
      enter(state, pack.startRoomId, events);
      return { state, result: { status: 'accepted', code: 'game-started' }, events };
    }

    function dispatch(inputState, action) {
      if (!validateState(inputState, pack, knownFlags)) return rejected(inputState, 'invalid-state');
      if (!isRecord(action) || !isJsonValue(action) || typeof action.type !== 'string') {
        return rejected(inputState, 'invalid-action');
      }
      const next = copy(inputState);
      const events = [];
      const room = pack.rooms[next.currentRoomId];

      if (action.type === 'choose') {
        if (typeof action.choiceId !== 'string') return rejected(inputState, 'invalid-action');
        const choice = (room.choices || []).find((entry) => entry.id === action.choiceId);
        if (!choice) return rejected(inputState, 'choice-not-found');
        const requiredItems = choice.requires == null ? [] : (Array.isArray(choice.requires) ? choice.requires : [choice.requires]);
        const requiredFlags = [choice.requiresFlag, ...(choice.requiresFlags || [])].filter(Boolean);
        if (!requiredItems.every((id) => next.inventory.includes(id)) ||
          !requiredFlags.every((id) => next.flags.includes(id))) return rejected(inputState, 'requirements-not-met');
        if (choice.item && !next.inventory.includes(choice.item)) {
          next.inventory.push(choice.item);
          events.push({ type: 'item-granted', itemId: choice.item });
        }
        for (const flagId of [...(choice.setFlag ? [choice.setFlag] : []), ...(choice.setFlags || [])]) {
          if (!next.flags.includes(flagId)) {
            next.flags.push(flagId);
            events.push({ type: 'flag-set', flagId });
          }
        }
        enter(next, choice.next, events);
        return { state: next, result: { status: 'accepted', code: 'choice-selected', choiceId: choice.id }, events };
      }

      if (action.type === 'exit') {
        if (typeof action.direction !== 'string') return rejected(inputState, 'invalid-action');
        const rawExit = room.exits && hasOwn(room.exits, action.direction) ? room.exits[action.direction] : null;
        if (!rawExit) return rejected(inputState, 'exit-not-found');
        const exit = typeof rawExit === 'string' ? { to: rawExit } : rawExit;
        const requiredItems = exit.requires == null ? [] : (Array.isArray(exit.requires) ? exit.requires : [exit.requires]);
        const requiredFlags = [exit.requiresFlag, ...(exit.requiresFlags || [])].filter(Boolean);
        if (!requiredItems.every((id) => next.inventory.includes(id)) ||
          !requiredFlags.every((id) => next.flags.includes(id))) {
          if (exit.onFail && exit.onFail.to) {
            enter(next, exit.onFail.to, events);
            return { state: next, result: { status: 'accepted', code: 'exit-failed-forward', direction: action.direction }, events };
          }
          return rejected(inputState, 'requirements-not-met');
        }
        enter(next, exit.to, events);
        return { state: next, result: { status: 'accepted', code: 'exit-traversed', direction: action.direction }, events };
      }

      if (action.type === 'take') {
        const itemId = action.itemId;
        if (typeof itemId !== 'string' || !(room.items || []).includes(itemId)) return rejected(inputState, 'item-not-available');
        if (!next.inventory.includes(itemId)) {
          next.inventory.push(itemId);
          events.push({ type: 'item-granted', itemId });
        }
        return { state: next, result: { status: 'accepted', code: 'item-taken', itemId }, events };
      }

      if (action.type === 'mechanic') {
        const mechanicId = action.mechanicId;
        if (typeof mechanicId !== 'string' || !hasOwn(mechanics, mechanicId)) return rejected(inputState, 'mechanic-not-registered');
        const registration = mechanics[mechanicId];
        const previous = next.mechanics[mechanicId];
        let extensionState = {};
        if (previous) {
          if (previous.version > registration.version) return rejected(inputState, 'mechanic-state-incompatible');
          if (previous.version === registration.version) extensionState = copy(previous.data);
          else {
            if (typeof registration.migrate !== 'function') return rejected(inputState, 'mechanic-state-incompatible');
            try {
              const migrated = registration.migrate(freeze({ fromVersion: previous.version, data: freeze(copy(previous.data)) }));
              if (!isJsonValue(migrated)) return rejected(inputState, 'mechanic-state-incompatible');
              extensionState = copy(migrated);
            } catch (_error) {
              return rejected(inputState, 'mechanic-state-incompatible');
            }
          }
        }
        let output;
        try {
          const snapshot = freeze(copy({
            currentRoomId: next.currentRoomId,
            inventory: next.inventory,
            flags: next.flags,
            visited: next.visited,
            mechanics: next.mechanics,
          }));
          const context = freeze(copy({
            roomId: next.currentRoomId,
            room,
            content: pack,
          }));
          output = registration.reduce(freeze({
            state: snapshot,
            extensionState: freeze(copy(extensionState)),
            payload: freeze(copy(action.payload === undefined ? null : action.payload)),
            room: context.room,
            content: context.content,
            context,
          }));
        } catch (_error) {
          return rejected(inputState, 'mechanic-failed');
        }
        if (!isRecord(output) || !isJsonValue({ extensionState: output.extensionState, result: output.result, effects: output.effects, events: output.events }) ||
          !isRecord(output.result) || !['accepted', 'rejected'].includes(output.result.status) ||
          typeof output.result.code !== 'string' || !output.result.code ||
          !Array.isArray(output.effects) || !Array.isArray(output.events)) {
          return rejected(inputState, 'mechanic-failed');
        }
        if (output.result.status === 'rejected') {
          return { state: copy(inputState), result: copy(output.result), events: [] };
        }
        const localEvents = [];
        for (const effect of output.effects) {
          if (!isRecord(effect)) return rejected(inputState, 'invalid-mechanic-effect');
          if (effect.type === 'grant-item' && typeof effect.itemId === 'string' && hasOwn(pack.items, effect.itemId)) {
            if (!next.inventory.includes(effect.itemId)) {
              next.inventory.push(effect.itemId);
              localEvents.push({ type: 'item-granted', itemId: effect.itemId });
            }
          } else if (effect.type === 'set-flag' && typeof effect.flagId === 'string' && knownFlags.has(effect.flagId)) {
            if (!next.flags.includes(effect.flagId)) {
              next.flags.push(effect.flagId);
              localEvents.push({ type: 'flag-set', flagId: effect.flagId });
            }
          } else {
            return rejected(inputState, 'invalid-mechanic-effect');
          }
        }
        for (const event of output.events) {
          if (!isRecord(event) || typeof event.type !== 'string' || !event.type.startsWith(`mechanic.${mechanicId}.`)) {
            return rejected(inputState, 'mechanic-failed');
          }
          localEvents.push(copy(event));
        }
        next.mechanics[mechanicId] = { version: registration.version, data: copy(output.extensionState) };
        events.push(...localEvents);
        return { state: next, result: copy(output.result), events };
      }

      return rejected(inputState, 'unknown-action');
    }

    return Object.freeze({ runtimeApiVersion: RUNTIME_API_VERSION, start, dispatch });
  }

  root.CodeyRuntime = Object.freeze({ RUNTIME_API_VERSION, createRuntime });
})(globalThis);
