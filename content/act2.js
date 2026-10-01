// Act 2 — Shell. Command rooms add a few local, deterministic puzzle
// interactions; see src/act2-puzzles.js for their small supported grammar.
// They are content-configured and are not a general code interpreter.

window.Codey = window.Codey || {};
window.Codey.content = window.Codey.content || {};

window.Codey.content.act2 = {
  rooms: {
    'user-space-atrium': {
      mode: 'command',
      mapName: 'User Space Atrium',
      scene: {
        name: "User Space Atrium",
        src: "assets/rooms/user-space-atrium.svg",
        alt: "A wide directory hall opens around a centered command terminal with a clear waiting prompt.",
      },
      text:
        "The room comes into focus. You're in a directory hall with paths branching in every " +
        "direction. A directory key lies nearby. Type take directory key, then inventory to " +
        "check what you're carrying." +
        "\n\n" +
        "The Arbiter's voice comes through. 'No more buttons from here. Type look to inspect " +
        "the room. Use go and a direction to move. Use take and an item name to pick something " +
        "up. If you forget, type help. I won't be offended. Much.'",
      exits: { north: { to: 'annex' } },
      items: ['directory-key'],
    },

    annex: {
      mode: 'command',
      mapName: 'Annex',
      scene: {
        name: "Annex",
        src: "assets/rooms/annex.svg",
        alt: "A narrow side passage leads directly to a sealed geometric door with a centered listening mark.",
      },
      text:
        "A narrow side passage ends at a sealed door. The pattern looks familiar. It may want " +
        "the directory key. Type inventory if you need to check what you're carrying. If you " +
        "left the key behind, go south and get it.",
      exits: {
        south: { to: 'user-space-atrium' },
        in: { to: 'act2-checkpoint', requires: 'directory-key' },
      },
      items: [],
    },

    'act2-checkpoint': {
      mode: 'command',
      mapName: 'Checkpoint',
      scene: {
        name: "Checkpoint",
        src: "assets/rooms/checkpoint.svg",
        alt: "The corridor reaches a clear central checkpoint arch with a steady teal status symbol.",
      },
      text:
        "The door reads the key and lets you through. The corridor runs farther than you can " +
        "see. A band of light sweeps slowly across the floor ahead.",
      exits: { forward: { to: 'watchdog-path' } },
      items: [],
    },

    'watchdog-path': {
      mode: 'command',
      mapName: "Watchdog's Path",
      scene: {
        name: "Watchdog's Path",
        src: "assets/rooms/watchdog-path.svg",
        alt: "A long corridor narrows toward a doorway as one amber scanning plane crosses the floor; a small process marker remains at the center.",
      },
      text:
        "A band of light sweeps across the exposed corridor, checking each process as it " +
        "passes. It hasn't singled you out yet." +
        "\n\n" +
        "Move while it's facing you and it'll send you back. Type hide and wait for it to pass." +
        "\n\n" +
        "The Arbiter's voice comes through, faint but clear: 'Hide.'",
      hideFlag: 'hid-from-warden',
      hideText:
        "You stay still. The light crosses your spot and keeps going. It didn't find you. We'll " +
        "take it.",
      exits: {
        forward: {
          to: 'past-watchdog',
          requiresFlag: 'hid-from-warden',
          onFail: {
            text:
              "The sweep catches you. Everything goes blank for a beat. Then you're back at the " +
        "checkpoint. The Warden keeps patrolling, completely unhelpful.",
            to: 'act2-checkpoint',
          },
        },
      },
      items: [],
    },

    'past-watchdog': {
      mode: 'command',
      mapName: 'Past the Watchdog',
      scene: {
        name: "Past the Watchdog",
        src: "assets/rooms/past-watchdog.svg",
        alt: "A broad archive door stands ahead, with its centered panel labeled STAGE, VERIFY, and COMMIT.",
      },
      text:
        "The sweep resumes behind you. Ahead, a door seals the archive. Its panel lists three " +
        "operations: STAGE, VERIFY, COMMIT." +
        "\n\n" +
        "Type east to enter the archive, back to return to the checkpoint, or forward to try " +
        "the crossing.",
      exits: {
        east: { to: 'locked-archive' },
        back: { to: 'act2-checkpoint' },
        forward: {
          to: 'warden-encounter',
          requiresFlag: 'relay-configured',
          onFail: {
            text:
              "The relay is still offline. Inspect relayMode, then set it to ready. You can change a " +
        "named value; it isn't an item you carry.",
          },
        },
      },
      items: [],
    },

    'locked-archive': {
      mode: 'command',
      mapName: 'Locked Archive',
      scene: {
        name: "Locked Archive",
        src: "assets/rooms/locked-archive.svg",
        alt: "Two record shelves flank a central archive console displaying the three-step sequence STAGE, VERIFY, COMMIT.",
      },
      text:
        "The door closes behind you. Two records glow beside a panel that wants three " +
        "operations in order." +
        "\n\n" +
        "Type inspect index and inspect audit log to read the clues. Then enter the operations " +
        "one at a time with order <step>. A wrong order resets the panel. Your clues stay put.",
      inspectables: {
        index: {
          label: 'index',
          aliases: ['archive index', 'record index'],
          flag: 'archive-index-read',
          text:
            "The index says to make a staging copy before changing the live archive. That operation " +
        "is called STAGE.",
        },
        'audit log': {
          label: 'audit log',
          aliases: ['audit', 'integrity log'],
          flag: 'archive-audit-read',
          text:
            "The audit log says to check the staged copy before committing it. That's VERIFY before " +
        "COMMIT.",
        },
      },
      sequencePuzzle: {
        requiredFlags: ['archive-index-read', 'archive-audit-read'],
        steps: ['stage', 'verify', 'commit'],
        successFlag: 'archive-sequence-complete',
        successText:
          "The panel clicks open. That's all the drama you get from secure storage. A hatch leads " +
        "down to the Memory Bank.",
        wrongOrderText:
          "Nope. The panel resets to STAGE. Your clues are still there. Try again.",
        unknownStepText:
          "That operation isn't listed. Try stage, verify, or commit.",
        hints: [
          "One clue says to make a copy. The other says to check it before the live change.",
          "The order is stage, verify, commit."
        ],
        hintAfterErrors: 2,
      },
      exits: {
        west: { to: 'past-watchdog' },
        down: {
          to: 'memory-bank',
          requiresFlag: 'archive-sequence-complete',
          onFail: {
            text:
              "The lower hatch stays shut. The panel needs both records read " +
              "and the three operations entered in order.",
          },
        },
      },
      items: [],
    },

    'memory-bank': {
      mode: 'command',
      mapName: 'Memory Bank',
      scene: {
        name: "Memory Bank",
        src: "assets/rooms/memory-bank.svg",
        alt: "A named-value console sits centered in a quiet bank of storage columns, showing relayMode set to idle.",
      },
      text:
        "This room stores a setting for the relay. The directory key is something you carry. " +
        "relayMode is a value stored here." +
        "\n\n" +
        "Type inspect relayMode to read it, then set relayMode ready to change it. You can " +
        "change it again. The machine is stubborn, not precious.",
      namedValue: {
        name: 'relayMode',
        initial: 'idle',
        allowedValues: ['idle', 'paused', 'ready'],
        targetValue: 'ready',
        successFlag: 'relay-configured',
        inspectText: "relayMode is",
        changedText: "relayMode changes to",
        readyText:
          "The relay answers. relayMode is ready, and the crossing opens.",
        otherValueText:
          "Saved. It doesn't match what the relay needs yet. Inspect relayMode, then try another " +
        "value.",
      },
      exits: {
        out: {
          to: 'past-watchdog',
          requiresFlag: 'relay-configured',
          onFail: {
            text:
              "The way out is still dark. Inspect `relayMode`, then set it to " +
              "`ready`. You can revise a named value; it is not a carried item.",
          },
        },
      },
      items: [],
    },

    'warden-encounter': {
      mode: 'command',
      mapName: 'Warden Crossing',
      scene: {
        name: "Warden Crossing",
        src: "assets/rooms/warden-crossing.svg",
        alt: "A composed geometric Warden stands at the center of the crossing with the scanning light held behind it.",
      },
      text:
        "The relay steadies the crossing. The Warden steps into its own scanning light. It " +
        "isn't carrying a weapon. Its job is to spot processes that might damage a failing " +
        "system and contain them." +
        "\n\n" +
        "You look unfamiliar under its rules, so it treats you as a risk. The Archive records " +
        "show how those rules work. You can avoid the Warden, confront it, or show the evidence " +
        "and redirect its scan. Any choice keeps the route ahead open. Type approach, then your " +
        "choice.",
      wardenApproach: {
        next: 'warden-consequence',
        approaches: {
          avoid: {
            flag: 'warden-approach-avoided',
            acknowledgement:
              "You stay out of the beam. The Warden logs: 'Unverified. Observe again.' It doesn't " +
        "chase you. It doesn't clear your name, either.",
          },
          confront: {
            flag: 'warden-approach-confronted',
            acknowledgement:
              "You step into the light. 'I'm new. I'm not here to hurt you. I want to stay alive.'" +
        "\n\n" +
        "The Warden studies you. 'I can't prove that yet. I can give the evidence time to " +
        "arrive.'",
          },
          redirect: {
            flag: 'warden-approach-redirected',
            acknowledgement:
              "You show the Warden the archive sequence and the relay's clean state. It checks both, " +
        "then turns its scan toward the failing processes. 'I can contain the failures without " +
        "marking every unfamiliar process for deletion,' it says. 'Your report stays open.'",
          },
        },
      },
      exits: {},
      items: [],
    },

    'warden-consequence': {
      mode: 'command',
      mapName: 'Open Channel',
      scene: {
        name: "Open Channel",
        src: "assets/rooms/open-channel.svg",
        alt: "The central route through the security frame is now open, with the scanning beam redirected toward the far wall.",
      },
      text:
        "The beam moves aside. The Warden records your approach and returns to its patrol. It " +
        "hasn't decided you're safe. It has decided to let you through.",
      exits: { forward: { to: 'kernel-threshold' } },
      items: [],
    },

    'kernel-threshold': {
      mode: 'command',
      mapName: 'Kernel Threshold',
      scene: {
        name: "Kernel Threshold",
        src: "assets/rooms/kernel-threshold.svg",
        alt: "A massive, calm opening reveals the Kernel as a bright centered geometric core beyond a raised threshold.",
      },
      actEnding: true,
      text:
        "The corridor ends at the Kernel threshold. Behind you, the Warden keeps its post. Its " +
        "report is still attached to your record." +
        "\n\n" +
        "The Kernel grants you root access. The Arbiter's voice comes through: 'You know how to " +
        "check what the system is doing. Now you can change what it does.'" +
        "\n\n" +
        "A code console lights up at the edge of the Core. Type go enter to open it. It's a " +
        "safe practice console. Nothing you type there can delete a process.",
      exits: { enter: { to: 'act3-variable-workbench' } },
      items: [],
    },
  },
};
