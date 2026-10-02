// The engine: knows how to render a room and move between rooms. It
// doesn't know anything about acts, the Arbiter, or signal fragments —
// all of that lives in content/. This split means we can rewrite the
// entire story without touching this file, and vice versa.
//
// Two room "modes" are supported. Button rooms (no `mode` field, or
// `choices`) work exactly as Act 1 always has: click a button, the whole
// screen redraws. Command rooms (`mode: 'command'`) show a scrolling
// transcript and a text input instead - typing is parsed by
// src/commands.js and acted on here.
//
// #status (inventory + map) is a permanent fixture outside of both
// modes - render functions below only ever touch #main, so the status
// panels never flicker or reset when the player moves between rooms.

(function () {
  const rooms = window.Codey.rooms;
  const items = window.Codey.items;
  const startRoomId = window.Codey.startRoomId;
  const commands = window.Codey.commands;
  const act2Puzzles = window.Codey.act2Puzzles;
  const act2MechanicId = 'codey.act2-puzzles';
  const codeMechanicId = window.Codey.codePuzzle.MECHANIC_ID;
  const mechanics = {
    [act2MechanicId]: { version: 1, reduce: act2Puzzles.reduce },
    [codeMechanicId]: window.Codey.codePuzzle.createRegistration(window.Codey.interpreter),
  };
  const runtimeApi = window.CodeyRuntime || globalThis.CodeyRuntime;
  const runtime = runtimeApi.createRuntime(window.Codey.runtimeContent, { mechanics });
  const saveApi = window.Codey.save;
  let storage = null;
  try {
    storage = window.localStorage;
  } catch (_error) {
    storage = null;
  }
  const saveContext = {
    rooms, items, startRoomId, runtime,
    mechanicIds: Object.keys(mechanics),
    flags: window.Codey.flags,
  };
  const loadedSave = saveApi ? saveApi.load(storage, saveContext) : { status: 'unavailable' };
  const restored = loadedSave.status === 'valid' ? loadedSave : null;
  let saveBlocked = !saveApi || !storage || ['corrupt', 'incompatible', 'unavailable'].includes(loadedSave.status);

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const FALLBACK_ICON = '<circle cx="12" cy="12" r="5" fill="currentColor"/>';

  let runtimeState = restored ? restored.runtimeState : runtime.start().state;
  let adapterState = restored ? restored.adapterState : {
    map: { visited: [], currentRoomId: null },
    codeDraft: null,
  };
  const state = {
    get currentRoomId() { return runtimeState.currentRoomId; },
    get inventory() { return runtimeState.inventory; },
    get flags() { return runtimeState.flags; },
    get visited() { return adapterState.map.visited; },
    get currentMapRoomId() { return adapterState.map.currentRoomId; },
    get codeRunner() { return adapterState.codeDraft; },
    set codeRunner(value) { adapterState.codeDraft = value; },
  };

  function dispatch(action) {
    const transition = runtime.dispatch(runtimeState, action);
    if (transition.result.status === 'accepted') runtimeState = transition.state;
    return transition;
  }

  let logEl = null;
  let activeScene = null;
  let commandHistory = [];
  let historyIndex = -1;
  const saveStatusEl = document.getElementById('save-status');
  const restartButton = document.getElementById('restart-button');
  const recoveryButton = document.getElementById('recovery-button');

  function setSaveStatus(message) {
    if (saveStatusEl) saveStatusEl.textContent = message;
  }

  if (loadedSave.status === 'valid') {
    setSaveStatus(loadedSave.migrated ? 'Older local progress restored and upgraded.' : 'Saved progress restored on this browser.');
  } else if (loadedSave.status === 'corrupt') {
    setSaveStatus('Saved data could not be read. Start a new game to continue.');
    if (recoveryButton) recoveryButton.hidden = false;
  } else if (loadedSave.status === 'incompatible') {
    setSaveStatus('Saved data is from a newer game version. Start a new game to continue.');
    if (recoveryButton) recoveryButton.hidden = false;
  } else if (loadedSave.status === 'unavailable') {
    setSaveStatus('Local save storage is unavailable in this browser.');
  } else {
    setSaveStatus('Progress is saved locally in this browser.');
  }

  function saveGame() {
    if (saveBlocked || !saveApi || !storage) return false;
    const result = saveApi.write(storage, runtimeState, adapterState, saveContext);
    if (!result.ok) {
      if (result.reason === 'invalid-state') setSaveStatus('Progress could not be saved because its state is invalid.');
      else setSaveStatus('Local save storage is unavailable in this browser.');
      return false;
    }
    setSaveStatus('Progress saved locally in this browser.');
    return true;
  }

  function resetProgress() {
    runtimeState = runtime.start().state;
    adapterState = { map: { visited: [], currentRoomId: null }, codeDraft: null };
    activeScene = null;
    logEl = null;
    commandHistory = [];
    historyIndex = -1;
  }

  function restartGame(fromRecovery) {
    if (!fromRecovery && typeof window.confirm === 'function' &&
      !window.confirm('Restart Codey? This will erase your saved progress in this browser.')) return;
    const cleared = saveApi ? saveApi.clear(storage) : false;
    saveBlocked = !cleared;
    resetProgress();
    if (recoveryButton) recoveryButton.hidden = true;
    setSaveStatus(cleared ? 'New game started. Progress saves locally.' : 'New game started, but local saving is unavailable.');
    render();
  }

  if (restartButton) restartButton.addEventListener('click', () => restartGame(false));
  if (recoveryButton) recoveryButton.addEventListener('click', () => restartGame(true));

  function visibleChoices(room) {
    return room.choices.filter((choice) => {
      const requiredItems = choice.requires == null ? [] : (Array.isArray(choice.requires) ? choice.requires : [choice.requires]);
      if (!requiredItems.every((id) => state.inventory.includes(id))) return false;
      const requiredFlags = [
        ...(choice.requiresFlag ? [choice.requiresFlag] : []),
        ...(choice.requiresFlags || []),
      ];
      return requiredFlags.every((flag) => state.flags.includes(flag));
    });
  }

  function itemsHere(room) {
    return (room.items || []).filter((itemId) => !state.inventory.includes(itemId));
  }

  function describeRoom(room) {
    const here = itemsHere(room);
    if (here.length === 0) return room.text;
    const names = here.map((itemId) => items[itemId].name).join(', ');
    return `${room.text}\n\nYou can see: ${names}.`;
  }

  // --- Status panels (inventory + map) ---

  // Not every room is a distinct place - see the comment on
  // gatekeepers-alcove in content/act1.js. Rooms without a mapName are
  // narrative continuations of wherever the player already was, so the
  // map's "current" marker just stays put through them.
  function trackVisit(roomId) {
    const room = rooms[roomId];
    if (!room.mapName) return;
    adapterState.map.currentRoomId = roomId;
    if (!adapterState.map.visited.includes(roomId)) {
      adapterState.map.visited.push(roomId);
    }
  }

  function renderInventoryPanel() {
    const panel = document.getElementById('inventory-panel');
    panel.textContent = '';

    const heading = document.createElement('div');
    heading.className = 'panel-heading';
    heading.textContent = 'Carrying';
    panel.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'inventory-list';

    if (state.inventory.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'panel-empty';
      empty.textContent = 'nothing yet';
      list.appendChild(empty);
    } else {
      state.inventory.forEach((itemId) => {
        const item = items[itemId];
        const entry = document.createElement('span');
        entry.className = 'inventory-item';

        const icon = document.createElement('span');
        icon.className = 'item-icon-wrap';
        icon.innerHTML = `<svg viewBox="0 0 24 24" class="item-icon">${item.icon || FALLBACK_ICON}</svg>`;

        const label = document.createElement('span');
        label.textContent = item.name;

        entry.appendChild(icon);
        entry.appendChild(label);
        list.appendChild(entry);
      });
    }

    panel.appendChild(list);
  }

  // Node/edge diagram of visited rooms, not a literal spatial map - see
  // design/locations.md. Nodes are laid out left to right in discovery
  // order with a connecting line between each consecutive pair. That's
  // a simplification: it shows "what's been found and roughly when,"
  // not the exact paths taken (e.g. backtracking to the Annex and back
  // doesn't re-draw an edge). A true branch-aware layout using each
  // room's actual exits would be the next step up, worth doing once a
  // room has more than one *unexplored* branch worth showing at once.
  function renderMapPanel() {
    const panel = document.getElementById('map-panel');
    panel.textContent = '';

    const heading = document.createElement('div');
    heading.className = 'panel-heading';
    heading.textContent = 'System map';
    panel.appendChild(heading);

    if (state.visited.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'panel-empty';
      empty.textContent = '...';
      panel.appendChild(empty);
      return;
    }

    const nodeHeight = 26;
    const nodeGap = 30;
    const paddingX = 10;
    const charWidth = 7;
    const centerY = nodeHeight / 2 + 2;

    const widths = state.visited.map(
      (roomId) => Math.round(rooms[roomId].mapName.length * charWidth) + paddingX * 2
    );
    const totalWidth = widths.reduce((sum, w) => sum + w, 0) + nodeGap * (state.visited.length - 1);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${totalWidth} ${nodeHeight + 4}`);
    svg.setAttribute('width', totalWidth);
    svg.setAttribute('height', nodeHeight + 4);
    svg.classList.add('map-svg');

    let x = 0;
    let prevRightEdge = null;
    let currentRect = null;
    state.visited.forEach((roomId, index) => {
      const width = widths[index];
      const isCurrent = roomId === state.currentMapRoomId;

      if (prevRightEdge !== null) {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', prevRightEdge);
        line.setAttribute('y1', centerY);
        line.setAttribute('x2', x);
        line.setAttribute('y2', centerY);
        line.setAttribute('class', 'map-edge');
        svg.appendChild(line);
      }

      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', 2);
      rect.setAttribute('width', width);
      rect.setAttribute('height', nodeHeight);
      rect.setAttribute('rx', 4);
      rect.setAttribute('class', isCurrent ? 'map-node map-node-current' : 'map-node');
      svg.appendChild(rect);
      if (isCurrent) currentRect = rect;

      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', x + width / 2);
      text.setAttribute('y', centerY);
      text.setAttribute('class', isCurrent ? 'map-label map-label-current' : 'map-label');
      text.textContent = rooms[roomId].mapName;
      svg.appendChild(text);

      prevRightEdge = x + width;
      x += width + nodeGap;
    });

    panel.appendChild(svg);

    // Once the map outgrows one screen, the current room can scroll out
    // of view - keep it visible without the player having to scroll
    // manually to answer "where am I."
    if (currentRect) {
      currentRect.scrollIntoView({ inline: 'end', block: 'nearest' });
    }
  }

  function renderStatus() {
    renderInventoryPanel();
    renderMapPanel();
  }

  // Dialogue beats retain the last physical scene. Entering a different
  // spatial room clears it unless that room supplies its own illustration.
  function renderCurrentScene(room) {
    if (room.scene) {
      activeScene = room.scene;
    } else if (room.mapName) {
      activeScene = null;
    }
  }

  function refreshCommandScene(room) {
    const main = document.getElementById('main');
    const previous = main.querySelector('.scene-presentation');
    renderCurrentScene(room);

    const next = activeScene && window.Codey.sceneRenderer
      ? window.Codey.sceneRenderer.render(Object.assign({}, activeScene, { hotspots: [] }), null)
      : null;

    if (previous) {
      if (next) previous.replaceWith(next);
      else previous.remove();
    } else if (next) {
      main.insertBefore(next, main.firstChild);
    }
  }

  function appendSceneStage(main, room, interactive) {
    if (!activeScene || !window.Codey.sceneRenderer) return;

    const isCurrentSceneRoom = room.scene === activeScene;
    const scene = interactive && isCurrentSceneRoom
      ? activeScene
      : Object.assign({}, activeScene, { hotspots: [] });
    const stage = window.Codey.sceneRenderer.render(
      scene,
      interactive && isCurrentSceneRoom
        ? (hotspotId) => activateHotspot(room, hotspotId)
        : null
    );
    if (stage) main.appendChild(stage);
  }

  function activateChoice(room, choice) {
    if (!visibleChoices(room).includes(choice)) return;
    const transition = dispatch({ type: 'choose', choiceId: choice.id });
    if (transition.result.status !== 'accepted') return;
    render();
  }

  function activateHotspot(room, hotspotId) {
    if (!room.choices || !room.scene) return;
    const hotspot = (room.scene.hotspots || []).find((entry) => entry.id === hotspotId);
    if (!hotspot) return;
    const choice = room.choices.find((entry) => entry.id === hotspot.choiceId);
    if (choice) activateChoice(room, choice);
  }

  function focusRoomEntry() {
    const main = document.getElementById('main');
    const target = main.querySelector('#story') ||
      main.querySelector('#command-input') ||
      main.querySelector('.code-runner__editor') ||
      main.querySelector('#choices button');
    if (target) target.focus();
  }

  // --- Button mode (Act 1) ---

  function renderChoiceRoom(room) {
    logEl = null;
    const main = document.getElementById('main');
    main.innerHTML = '';

    appendSceneStage(main, room, true);

    const story = document.createElement('div');
    story.id = 'story';
    story.tabIndex = -1;
    const p = document.createElement('p');
    p.textContent = describeRoom(room);
    story.appendChild(p);

    const choicesEl = document.createElement('div');
    choicesEl.id = 'choices';
    visibleChoices(room).forEach((choice) => {
      const button = document.createElement('button');
      button.textContent = choice.label;
      button.addEventListener('click', () => activateChoice(room, choice));
      choicesEl.appendChild(button);
    });

    main.appendChild(story);
    main.appendChild(choicesEl);
  }

  // --- Command mode (Act 2+) ---

  function appendLogLine(text, className) {
    const line = document.createElement('p');
    line.textContent = text;
    if (className) line.className = className;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function findItemByArgument(itemIds, argument) {
    return itemIds.find((itemId) => {
      const name = items[itemId].name.toLowerCase();
      return name === argument || name.endsWith(` ${argument}`) || itemId === argument;
    });
  }

  function moveTo(roomId) {
    if (state.currentRoomId !== roomId) return false;
    const room = rooms[roomId];
    if (room.mode !== 'command') {
      render();
      return true;
    }
    refreshCommandScene(room);
    trackVisit(roomId);
    renderStatus();
    appendLogLine(describeRoom(room));
    return true;
  }

  function handleGo(argument) {
    const room = rooms[state.currentRoomId];
    const exit = room.exits && room.exits[argument];
    if (!exit) {
      appendLogLine(`No exit called "${argument}" here. Try another direction.`);
      return;
    }

    const transition = dispatch({ type: 'exit', direction: argument });
    if (transition.result.status !== 'accepted') {
      appendLogLine(exit.onFail && exit.onFail.text || "That way is blocked. Something is missing.");
      return;
    }
    if (transition.result.code === 'exit-failed-forward' && exit.onFail) appendLogLine(exit.onFail.text);
    moveTo(state.currentRoomId);
  }

  function handleHide() {
    const room = rooms[state.currentRoomId];
    applyPuzzleResult(room, { verb: 'hide' }, dispatch({
      type: 'mechanic', mechanicId: act2MechanicId, payload: { verb: 'hide' },
    }));
  }

  function applyPuzzleResult(room, payload, transition) {
    if (transition.result.status !== 'accepted') {
      appendLogLine('The interaction could not be completed.');
      return;
    }
    appendLogLine(act2Puzzles.formatResult(room, payload, transition.result));
  }

  function handleInspect(argument) {
    const room = rooms[state.currentRoomId];
    const payload = { verb: 'inspect', argument };
    applyPuzzleResult(room, payload, dispatch({ type: 'mechanic', mechanicId: act2MechanicId, payload }));
  }

  function handleOrder(argument) {
    const room = rooms[state.currentRoomId];
    const payload = { verb: 'order', argument };
    applyPuzzleResult(room, payload, dispatch({ type: 'mechanic', mechanicId: act2MechanicId, payload }));
  }

  function handleSet(argument) {
    const room = rooms[state.currentRoomId];
    const payload = { verb: 'set', argument };
    applyPuzzleResult(room, payload, dispatch({ type: 'mechanic', mechanicId: act2MechanicId, payload }));
  }

  function handleApproach(argument) {
    const room = rooms[state.currentRoomId];
    const payload = { verb: 'approach', argument };
    const transition = dispatch({ type: 'mechanic', mechanicId: act2MechanicId, payload });
    applyPuzzleResult(room, payload, transition);
    const direction = transition.result.data && transition.result.data.exitDirection;
    if (transition.result.status === 'accepted' && transition.result.code === 'approach-selected' && direction) {
      const route = dispatch({ type: 'exit', direction });
      if (route.result.status === 'accepted') moveTo(state.currentRoomId);
    }
  }

  function handleTake(argument) {
    const room = rooms[state.currentRoomId];
    const itemId = findItemByArgument(itemsHere(room), argument);
    if (!itemId) {
      appendLogLine(`There's no "${argument}" here to take.`);
      return;
    }
    const transition = dispatch({ type: 'take', itemId });
    if (transition.result.status !== 'accepted') {
      appendLogLine(`There's no "${argument}" here to take.`);
      return;
    }
    renderStatus();
    appendLogLine(`You take the ${items[itemId].name}.`);
  }

  function handleInventory() {
    if (state.inventory.length === 0) {
      appendLogLine("You aren't carrying anything.");
      return;
    }
    const names = state.inventory.map((itemId) => items[itemId].name).join(', ');
    appendLogLine(`You are carrying: ${names}.`);
  }

  function handleCommand(raw) {
    appendLogLine(`> ${raw}`, 'command-echo');
    const { verb, argument } = commands.parse(raw);
    const room = rooms[state.currentRoomId];

    switch (verb) {
      case 'look':
        appendLogLine(describeRoom(room));
        break;
      case 'inspect':
        handleInspect(argument);
        break;
      case 'go':
        handleGo(argument);
        break;
      case 'take':
        handleTake(argument);
        break;
      case 'inventory':
        handleInventory();
        break;
      case 'hide':
        handleHide();
        break;
      case 'order':
        handleOrder(argument);
        break;
      case 'set':
        handleSet(argument);
        break;
      case 'approach':
        handleApproach(argument);
        break;
      case 'help':
        appendLogLine('Try: look, go <direction>, take <item>, inventory, hide, inspect <visible target>, order <step>, set <name> <value>, or approach <choice>. Puzzle verbs work only where the room explains them.');
        break;
      default:
        appendLogLine(`The system doesn't recognize "${raw}".`);
    }
    saveGame();
  }

  function renderCodeRoom(room) {
    const main = document.getElementById('main');
    main.innerHTML = '';

    appendSceneStage(main, room, false);

    const story = document.createElement('div');
    story.id = 'story';
    story.tabIndex = -1;
    const paragraph = document.createElement('p');
    paragraph.textContent = room.text || 'Write a small program, then run it to see what the system does.';
    story.appendChild(paragraph);
    main.appendChild(story);

    if (!window.Codey.codeRunner) {
      const message = document.createElement('p');
      message.textContent = 'The code editor is missing. Try reloading the game.';
      main.appendChild(message);
      return;
    }

    const config = room.code || {};
    const initialRunnerState = state.codeRunner && state.codeRunner.roomId === state.currentRoomId
      ? state.codeRunner
      : null;
    if (!initialRunnerState) state.codeRunner = null;
    window.Codey.codeRunner.mount(main, config, (evaluation) => {
      const solved = dispatch({
        type: 'mechanic',
        mechanicId: codeMechanicId,
        payload: { evaluation },
      });
      if (solved.result.status !== 'accepted' || solved.result.code !== 'code-goal-met') return;
      state.codeRunner = null;
      const route = dispatch({ type: 'exit', direction: 'complete' });
      if (route.result.status === 'accepted') {
        render();
        focusRoomEntry();
      } else {
        saveGame();
      }
    }, {
      initialState: initialRunnerState,
      onStateChange: (runnerState) => {
        adapterState.codeDraft = Object.assign({ roomId: state.currentRoomId }, runnerState);
        saveGame();
      },
    });
  }

  function renderCommandRoom(room) {
    const main = document.getElementById('main');
    main.innerHTML = '';

    appendSceneStage(main, room, false);

    const log = document.createElement('div');
    log.id = 'log';
    logEl = log;

    const form = document.createElement('form');
    form.id = 'command-form';
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'command-input';
    input.autocomplete = 'off';
    input.placeholder = 'Try a command';
    form.appendChild(input);

    // Command history: up/down recalls previously typed commands, same
    // as a real shell. historyIndex counts back from the most recent
    // entry; -1 means "not currently browsing history."
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (commandHistory.length === 0) return;
        historyIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
        input.value = commandHistory[commandHistory.length - 1 - historyIndex];
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (historyIndex <= 0) {
          historyIndex = -1;
          input.value = '';
        } else {
          historyIndex -= 1;
          input.value = commandHistory[commandHistory.length - 1 - historyIndex];
        }
      }
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const raw = input.value;
      input.value = '';
      historyIndex = -1;
      if (raw.trim()) {
        commandHistory.push(raw);
        handleCommand(raw);
      }
    });

    main.appendChild(log);
    main.appendChild(form);

    appendLogLine(describeRoom(room));
    input.focus();
  }

  // --- Dispatch ---

  function render() {
    trackVisit(state.currentRoomId);
    renderStatus();

    const room = rooms[state.currentRoomId];
    renderCurrentScene(room);
    if (room.mode === 'command') {
      renderCommandRoom(room);
    } else if (room.mode === 'code') {
      renderCodeRoom(room);
    } else {
      renderChoiceRoom(room);
    }
    saveGame();
  }

  render();
})();
