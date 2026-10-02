// Code-room goal checks are a named game mechanic. The editor remains in the
// browser adapter; this handler only validates a deterministic evaluation.
(function () {
  window.Codey = window.Codey || {};
  const MECHANIC_ID = 'codey.code-puzzle';

  function createRegistration(interpreter) {
    return {
      version: 1,
      reduce(input) {
        const room = input.room;
        const code = room.code || {};
        const evaluation = input.payload && input.payload.evaluation;
        if (!evaluation || !interpreter.matchesGoal(evaluation, code.goal)) {
          return {
            extensionState: input.extensionState,
            result: { status: 'rejected', code: 'code-goal-not-met' },
            effects: [],
            events: [],
          };
        }
        return {
          extensionState: input.extensionState,
          result: { status: 'accepted', code: 'code-goal-met' },
          effects: code.successFlag ? [{ type: 'set-flag', flagId: code.successFlag }] : [],
          events: [{ type: `mechanic.${MECHANIC_ID}.goal-met`, roomId: input.context.roomId }],
        };
      },
    };
  }

  window.Codey.codePuzzle = { MECHANIC_ID, createRegistration };
})();
