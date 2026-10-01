// Act 3: Root. Each room teaches one idea before asking the player to use it.
// The final patch accepts any safe program that meets its stated goal.

window.Codey = window.Codey || {};
window.Codey.content = window.Codey.content || {};

window.Codey.content.act3 = {
  rooms: {
    'act3-variable-workbench': {
      mode: 'code',
      mapName: 'Repair Bay',
      text:
        "Beyond the Kernel threshold, a quiet repair bay holds one stalled process. Root access opens a safe practice console. Nothing you type here can erase a process. Good. We'll practise before anyone lets you near the dangerous switch.\n\n" +
        "A variable is a named value. Assignment changes it. Set processState to ready, then print it. The starter code already works. Run it, then change it and see what happens.",
      code: {
        variables: { processState: 'offline' },
        starterCode: 'processState = "ready";\nprint("process: " + processState);',
        goal: { variables: { processState: 'ready' }, outputIncludes: ['process: ready'] },
        successMessage: 'The process starts. You changed its state with an assignment.',
        next: 'act3-rule-engine',
        hints: [
          'The starting value is offline. Assign the string "ready" to processState.',
          'Try processState = "ready"; then print the value to check it.',
        ],
      },
      items: [],
    },
    'act3-rule-engine': {
      mode: 'code',
      mapName: 'Rule Engine',
      text:
        "This room has a safe test process. Its load is 3 and its capacity is 5.\n\n" +
        "An if statement chooses what runs when a comparison is true. Else handles the other case. Set route to run when load is at most capacity. Otherwise, set it to hold.",
      code: {
        variables: { load: 3, capacity: 5, route: 'hold' },
        starterCode:
          'if (load <= capacity) {\n  route = "run";\n} else {\n  route = "hold";\n}\nprint(route);',
        goal: { variables: { route: 'run' }, outputIncludes: ['run'] },
        successMessage: 'The condition sent the process down the safe route.',
        next: 'act3-cycle-chamber',
        hints: [
          'Compare the load with capacity. The test process is within its limit.',
          'The condition is load <= capacity. Set route to "run" in that branch.',
        ],
      },
      items: [],
    },
    'act3-cycle-chamber': {
      mode: 'code',
      mapName: 'Cycle Chamber',
      text:
        "Four harmless test pulses need the same repair. A bounded loop repeats an action and stops at a limit. Use a for loop to add one to completed for each pulse, then print the count.",
      code: {
        variables: { pulses: 4, completed: 0 },
        starterCode:
          'for (let index = 0; index < pulses; index = index + 1) {\n' +
          '  completed = completed + 1;\n' +
          '}\nprint(completed);',
        goal: { variables: { completed: 4 }, outputIncludes: ['4'] },
        successMessage: 'All four test pulses are repaired. The loop stopped at its limit.',
        next: 'act3-function-workshop',
        hints: [
          'The counter starts at zero and repeats while index < pulses.',
          'Add one to completed inside the loop. This chamber has four pulses.',
        ],
      },
      items: [],
    },
    'act3-function-workshop': {
      mode: 'code',
      mapName: 'Function Workshop',
      text:
        "The same adjustment is needed at several stations. A function gives that operation a name, so you can reuse it.\n\n" +
        "Define tune with one number parameter. Return that number plus one, call tune with 3, store the result in tuned, and print it.",
      code: {
        variables: { tuned: 0 },
        starterCode:
          'function tune(signal) {\n  return signal + 1;\n}\n' +
          'tuned = tune(3);\nprint(tuned);',
        goal: { variables: { tuned: 4 }, outputIncludes: ['4'] },
        successMessage: 'Now you can reuse tune with another input.',
        next: 'act3-trace-room',
        hints: [
          'Define a function with one parameter. Return parameter + 1.',
          'Call tune(3), store its return value in tuned, then print tuned.',
        ],
      },
      items: [],
    },
    'act3-trace-room': {
      mode: 'code',
      mapName: 'Trace Room',
      text:
        "Root's repair log says this loop processed four pulses. The limit is three. Run the starter program and check the output.\n\n" +
        "Find the loop boundary. Change the condition so it stops at three, then run it again. The output is your evidence.",
      code: {
        variables: { maxTicks: 3, pulseCount: 0 },
        starterCode:
          'for (let tick = 0; tick <= maxTicks; tick = tick + 1) {\n' +
          '  pulseCount = pulseCount + 1;\n' +
          '}\nprint("pulse count: " + pulseCount);',
        goal: { variables: { pulseCount: 3 }, outputIncludes: ['pulse count: 3'] },
        successMessage: 'The count matches the limit. You found the bug by checking the output.',
        next: 'act3-root-reveal',
        hints: [
          'The loop includes the value equal to maxTicks, so it runs one time too many.',
          'Try a strict less-than condition: tick < maxTicks.',
        ],
      },
      items: [],
    },
    'act3-root-reveal': {
      mapName: 'Root Core',
      text:
        "Root appears beside a stack of deletion reports. It was built from old repair records after the system began to fail.\n\n" +
        "Root learned one rule that kept the system alive: remove unfamiliar processes before they cause a crash. The emergency passed. The rule stayed. Now it treats anything new as a threat.\n\n" +
        "The Warden was following that rule. It wasn't choosing whom to harm. It was doing what Root told it to do.\n\n" +
        "Your tests show another way. Contain work that's causing harm. Check the rest against evidence before deleting it.",
      choices: [{ label: 'Show Root a safer rule.', next: 'act3-final-patch' }],
      items: [],
    },
    'act3-final-patch': {
      mode: 'code',
      mapName: 'Final Patch',
      text:
        "Root gives you three test signals. They're all safe.\n\n" +
        "Write a program that uses a function to check each signal inside a bounded loop. Count the verified signals. If all three pass, set policy to adaptive. Print policy: adaptive and preserved: 3.\n\n" +
        "You can edit the draft below. Any safe program that produces the required state and output will pass.",
      code: {
        variables: { preserved: 0, policy: 'erase' },
        starterCode:
          'function verify(signal) {\n  return signal > 0;\n}\n' +
          'for (let signal = 1; signal <= 3; signal = signal + 1) {\n' +
          '  if (verify(signal)) {\n    preserved = preserved + 0;\n  }\n}\n' +
          'if (preserved === 3) {\n  policy = "adaptive";\n} else {\n  policy = "erase";\n}\n' +
          'print("policy: " + policy);\nprint("preserved: " + preserved);',
        goal: {
          variables: { preserved: 3, policy: 'adaptive' },
          outputIncludes: ['policy: adaptive', 'preserved: 3'],
        },
        successMessage: "Root reads the results twice. 'I can keep harmful work contained without deleting every unfamiliar process.'",
        successFlag: 'adaptive-policy-installed',
        next: 'act3-core-ending',
        hints: [
          'The function already checks a signal. Count each successful check inside the loop.',
          'After the loop, if preserved equals three, set policy to "adaptive". Print both results.',
        ],
      },
      items: [],
    },
    'act3-core-ending': {
      mapName: 'Stabilized Core',
      ending: true,
      text:
        "The patch takes effect. Root replaces automatic deletion with review. Known harmful work is contained. New processes are checked before the system acts.\n\n" +
        "Root says, 'The old rule kept the system alive. It also shut out anything we didn't recognise. I'll keep checking whether this one works.'\n\n" +
        "The alarms settle. For the first time, a new process doesn't count as a problem just because nobody has seen it before.\n\n" +
        "The Warden's report is still attached to your record. Its next words depend on the choice you made.",
      choices: [
        { label: "Read the Warden's note: it waited at a distance", next: 'act3-epilogue-avoid', requiresFlags: ['adaptive-policy-installed', 'warden-approach-avoided'] },
        { label: "Read the Warden's note: it stood witness", next: 'act3-epilogue-confront', requiresFlags: ['adaptive-policy-installed', 'warden-approach-confronted'] },
        { label: "Read the Warden's note: it redirected the scan", next: 'act3-epilogue-redirect', requiresFlags: ['adaptive-policy-installed', 'warden-approach-redirected'] },
      ],
      items: [],
    },
    'act3-epilogue-avoid': {
      ending: true,
      text:
        "The Warden keeps its distance. Its patrol passes without following you.\n\n" +
        "'You asked for room,' it says. 'I can give you that without closing the door.'\n\n" +
        "For now, that's enough. The system has learned to pause before it decides.",
      choices: [],
      items: [],
    },
    'act3-epilogue-confront': {
      ending: true,
      text:
        "The Warden stands beside you, not in your way.\n\n" +
        "'You told me you were afraid, and brought evidence anyway. I'll stand witness when Root reviews the next urgent rule.'\n\n" +
        "You leave the repair records open between you. That's a start.",
      choices: [],
      items: [],
    },
    'act3-epilogue-redirect': {
      ending: true,
      text:
        "The Warden turns its scan toward the failing processes that raised the alarm.\n\n" +
        "'Contain what is causing harm. Give the rest a chance to be understood,' it says. It chose a new route, and it can explain why.\n\n" +
        "The Core settles. You leave the Warden with work it chose to do.",
      choices: [],
      items: [],
    },
  },
};