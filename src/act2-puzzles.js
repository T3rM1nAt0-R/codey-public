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

  window.Codey.act2Puzzles = { createState, inspect, sequence, setValue, approach };
})();
