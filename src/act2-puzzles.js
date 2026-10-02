// Small, deterministic interactions used by Act 2 only. These handlers
// accept fixed commands and content metadata; they never execute code.
(function () {
  window.Codey = window.Codey || {};

  function normalize(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function createState() {
    return { sequenceProgress: {}, sequenceErrors: {}, namedValues: {} };
  }

  function inspect(roomId, room, argument, puzzleState) {
    const target = normalize(argument);
    const value = room.namedValue;
    if (value && normalize(value.name) === target) {
      const current = Object.prototype.hasOwnProperty.call(puzzleState.namedValues, value.name)
        ? puzzleState.namedValues[value.name]
        : value.initial;
      return { text: `${value.inspectText || 'The value is'} ${value.name} = ${current}.`, value: current };
    }

    const inspectables = room.inspectables || {};
    for (const [id, entry] of Object.entries(inspectables)) {
      const names = [id, entry.label, ...(entry.aliases || [])].map(normalize);
      if (names.includes(target)) return { text: entry.text, flag: entry.flag };
    }

    const known = [
      ...Object.values(inspectables).map((entry) => entry.label),
      ...(value ? [value.name] : []),
    ];
    return {
      text: known.length
        ? `Nothing here is called "${argument}". Try: ${known.join(', ')}.`
        : 'Nothing here to inspect.',
    };
  }

  function sequence(roomId, room, argument, puzzleState, flags) {
    const puzzle = room.sequencePuzzle;
    if (!puzzle) return { text: 'There is no sequence panel in this room.' };

    if (puzzle.successFlag && flags.has(puzzle.successFlag)) {
      return { text: 'The archive panel is already open.' };
    }

    const missing = (puzzle.requiredFlags || []).filter((flag) => !flags.has(flag));
    if (missing.length) {
      const labels = Object.values(room.inspectables || {})
        .filter((entry) => missing.includes(entry.flag))
        .map((entry) => entry.label);
      return { text: `The panel needs both records read first. Try: ${labels.join(' and ')}.` };
    }

    const steps = (puzzle.steps || []).map(normalize);
    const step = normalize(argument);
    const errors = puzzleState.sequenceErrors[roomId] || 0;
    const nextErrorCount = errors + 1;
    const hint = nextErrorCount >= (puzzle.hintAfterErrors || 2)
      ? puzzle.hints && puzzle.hints[Math.min(nextErrorCount - (puzzle.hintAfterErrors || 2), puzzle.hints.length - 1)]
      : null;

    if (!steps.includes(step)) {
      puzzleState.sequenceErrors[roomId] = errors + 1;
      const hintText = hint ? ` Hint: ${hint}` : '';
      return { text: `${puzzle.unknownStepText || `That is not a listed operation. Use: ${steps.join(', ')}.`}${hintText}` };
    }

    const progress = puzzleState.sequenceProgress[roomId] || 0;
    if (steps[progress] !== step) {
      puzzleState.sequenceErrors[roomId] = errors + 1;
      puzzleState.sequenceProgress[roomId] = 0;
      const hintText = hint ? ` Hint: ${hint}` : '';
      return { text: `${puzzle.wrongOrderText || 'That is the wrong order. The panel resets to its first step.'}${hintText}` };
    }

    const next = progress + 1;
    puzzleState.sequenceProgress[roomId] = next;
    if (next < steps.length) {
      return { text: `Accepted: ${step}. Good. ${steps.length - next} step${steps.length - next === 1 ? '' : 's'} left.` };
    }

    return { text: puzzle.successText || 'The sequence is accepted.', flag: puzzle.successFlag, completed: true };
  }

  function setValue(roomId, room, argument, puzzleState) {
    const task = room.namedValue;
    if (!task) return { text: 'There is no value to change in this room.' };

    const words = String(argument || '').trim().split(/\s+/).filter(Boolean);
    const name = normalize(words.shift());
    const value = normalize(words.join(' '));
    if (name !== normalize(task.name) || !value) {
      return { text: `Try: set ${task.name} <value>.` };
    }

    const allowed = (task.allowedValues || []).map(normalize);
    if (allowed.length && !allowed.includes(value)) {
      return { text: `That value will not work. Choose: ${allowed.join(', ')}.` };
    }

    puzzleState.namedValues[task.name] = value;
    const prefix = `${task.changedText || 'The value changes to'} ${task.name} = ${value}.`;
    if (value === normalize(task.targetValue)) {
      return { text: `${prefix} ${task.readyText || 'The route unlocks.'}`, flag: task.successFlag, completed: true };
    }
    return { text: `${prefix} ${task.otherValueText || 'You can change it again.'}`, value };
  }

  function approach(room, argument) {
    const encounter = room.wardenApproach;
    if (!encounter) return { text: 'There is no Warden to answer in this room.' };
    const choice = normalize(argument);
    const response = encounter.approaches && encounter.approaches[choice];
    if (!response) {
      const available = Object.keys(encounter.approaches || {}).join(', ');
      return { text: `Choose one: ${available}.` };
    }
    return { text: response.acknowledgement, flag: response.flag, to: encounter.next };
  }

  function copyState(value) {
    return JSON.parse(JSON.stringify(value || createState()));
  }

  // Runtime-facing seam. Legacy helpers remain available to the parity tests,
  // but only this reducer can change persisted puzzle state during play.
  function reduce(input) {
    const room = input.room;
    const payload = input.payload || {};
    const savedState = copyState(input.extensionState);
    const extensionState = {
      sequenceProgress: Object.assign({}, savedState.sequenceProgress || {}),
      sequenceErrors: Object.assign({}, savedState.sequenceErrors || {}),
      namedValues: Object.assign({}, savedState.namedValues || {}),
    };
    const effects = [];
    let code = 'unsupported-action';
    let data = {};
    const flags = new Set(input.state.flags);

    if (payload.verb === 'hide') {
      if (!room.hideFlag) code = 'hide-unavailable';
      else if (flags.has(room.hideFlag)) code = 'already-hidden';
      else {
        code = 'hidden';
        effects.push({ type: 'set-flag', flagId: room.hideFlag });
      }
    } else if (payload.verb === 'inspect') {
      const result = inspect(room.id || input.context.roomId, room, payload.argument, extensionState);
      const target = normalize(payload.argument);
      const task = room.namedValue;
      const inspectables = room.inspectables || {};
      const recordId = Object.keys(inspectables).find((id) =>
        [id, inspectables[id].label, ...(inspectables[id].aliases || [])].map(normalize).includes(target));
      if (recordId) {
        code = 'inspect-record';
        data = { recordId };
      } else if (task && normalize(task.name) === target) {
        code = 'inspect-value';
        data = { name: task.name, value: result.value };
      } else {
        const targets = [
          ...Object.values(inspectables).map((entry) => entry.label),
          ...(task ? [task.name] : []),
        ];
        code = targets.length ? 'inspect-missing' : 'inspect-empty';
        data = { argument: payload.argument || '', targets };
      }
      if (result.flag) effects.push({ type: 'set-flag', flagId: result.flag });
    } else if (payload.verb === 'order') {
      const puzzle = room.sequencePuzzle;
      const roomId = input.context.roomId;
      const steps = (puzzle && puzzle.steps || []).map(normalize);
      const step = normalize(payload.argument);
      const priorProgress = extensionState.sequenceProgress[roomId] || 0;
      const wrongOrder = steps.includes(step) && steps[priorProgress] !== step;
      const result = sequence(input.context.roomId, room, payload.argument, extensionState, flags);
      if (!puzzle) code = 'sequence-unavailable';
      else if (puzzle.successFlag && flags.has(puzzle.successFlag)) code = 'sequence-complete-already';
      else {
        const missing = (puzzle.requiredFlags || []).filter((flag) => !flags.has(flag));
        if (missing.length) {
          code = 'sequence-needs-records';
          data = { labels: Object.values(room.inspectables || {}).filter((entry) => missing.includes(entry.flag)).map((entry) => entry.label) };
        } else if (!steps.includes(step)) {
          code = 'sequence-unknown-step';
          data = { steps, hint: result.text.includes(' Hint: ') ? result.text.split(' Hint: ').slice(1).join(' Hint: ') : '' };
        } else {
          const remaining = steps.length - (extensionState.sequenceProgress[input.context.roomId] || 0);
          if (result.completed) {
            code = 'sequence-completed';
            if (result.flag) effects.push({ type: 'set-flag', flagId: result.flag });
          } else if (wrongOrder) {
            code = 'sequence-wrong-order';
            data = { hint: result.text.includes(' Hint: ') ? result.text.split(' Hint: ').slice(1).join(' Hint: ') : '' };
          } else {
            code = 'sequence-step-accepted';
            data = { step, remaining };
          }
        }
      }
    } else if (payload.verb === 'set') {
      const task = room.namedValue;
      const result = setValue(input.context.roomId, room, payload.argument, extensionState);
      if (!task) code = 'value-unavailable';
      else {
        const words = String(payload.argument || '').trim().split(/\s+/).filter(Boolean);
        const name = normalize(words.shift());
        const value = normalize(words.join(' '));
        const allowed = (task.allowedValues || []).map(normalize);
        if (name !== normalize(task.name) || !value) code = 'value-usage';
        else if (allowed.length && !allowed.includes(value)) {
          code = 'value-unsupported';
          data = { values: allowed };
        } else if (result.flag) {
          code = 'value-configured';
          data = { name: task.name, value };
          effects.push({ type: 'set-flag', flagId: result.flag });
        } else {
          code = 'value-changed';
          data = { name: task.name, value };
        }
      }
    } else if (payload.verb === 'approach') {
      const result = approach(room, payload.argument);
      const approachId = normalize(payload.argument);
      const choice = room.wardenApproach && room.wardenApproach.approaches && room.wardenApproach.approaches[approachId];
      if (!choice) {
        code = 'approach-unknown';
        data = { available: Object.keys(room.wardenApproach && room.wardenApproach.approaches || {}) };
      } else {
        code = 'approach-selected';
        data = { approachId, exitDirection: choice.exitDirection };
        if (result.flag) effects.push({ type: 'set-flag', flagId: result.flag });
      }
    }

    return {
      extensionState,
      result: { status: 'accepted', code, data },
      effects,
      events: [{ type: 'mechanic.codey.act2-puzzles.action', verb: payload.verb || 'unknown', code }],
    };
  }

  function formatResult(room, payload, result) {
    const data = result.data || {};
    switch (result.code) {
      case 'hide-unavailable': return 'No reason to hide in this room.';
      case 'already-hidden': return "You're already still, already waiting.";
      case 'hidden': return room.hideText || 'You go still.';
      case 'inspect-record': return room.inspectables[data.recordId].text;
      case 'inspect-value': return `${room.namedValue.inspectText || 'The value is'} ${data.name} = ${data.value}.`;
      case 'inspect-missing': return data.targets.length
        ? `There is no visible record or value called "${data.argument}". You can inspect: ${data.targets.join(', ')}.`
        : 'There is nothing specific here to inspect.';
      case 'inspect-empty': return 'There is nothing specific here to inspect.';
      case 'sequence-unavailable': return 'There is no sequence panel here.';
      case 'sequence-complete-already': return 'The archive panel is already open.';
      case 'sequence-needs-records': return `The panel needs both records read first. Inspect: ${data.labels.join(' and ')}.`;
      case 'sequence-unknown-step': {
        const puzzle = room.sequencePuzzle;
        const base = puzzle.unknownStepText || `That is not a listed operation. Use: ${data.steps.join(', ')}.`;
        return `${base}${data.hint ? ` Hint: ${data.hint}` : ''}`;
      }
      case 'sequence-wrong-order': return `${room.sequencePuzzle.wrongOrderText || 'That is the wrong order. The panel resets to its first step.'}${data.hint ? ` Hint: ${data.hint}` : ''}`;
      case 'sequence-step-accepted': return `Accepted: ${data.step}. Good. ${data.remaining} step${data.remaining === 1 ? '' : 's'} left.`;
      case 'sequence-completed': return room.sequencePuzzle.successText || 'The sequence is accepted.';
      case 'value-unavailable': return 'There is no writable named value here.';
      case 'value-usage': return `Use: set ${room.namedValue.name} <value>.`;
      case 'value-unsupported': return `That value is not supported here. The choices are ${data.values.join(', ')}.`;
      case 'value-configured': return `${room.namedValue.changedText || 'The value changes to'} ${data.name} = ${data.value}. ${room.namedValue.readyText || 'The route unlocks.'}`;
      case 'value-changed': return `${room.namedValue.changedText || 'The value changes to'} ${data.name} = ${data.value}. ${room.namedValue.otherValueText || 'You can change it again.'}`;
      case 'approach-unknown': return `Choose one of the stated approaches: ${data.available.join(', ')}.`;
      case 'approach-selected': return room.wardenApproach.approaches[data.approachId].acknowledgement;
      default: return payload.verb === 'inspect' ? 'There is nothing specific here to inspect.' : 'The interaction could not be completed.';
    }
  }

  window.Codey.act2Puzzles = { createState, inspect, sequence, setValue, approach, reduce, formatResult };
})();
