// Act 1: Boot. The player starts with choices, not typed commands.
// Room ids match design/locations.md.

window.Codey = window.Codey || {};
window.Codey.content = window.Codey.content || {};

window.Codey.content.act1 = {
  startRoomId: 'boot-sector',
  rooms: {
    'boot-sector': {
      mapName: 'Boot Sector',
      scene: {
        name: 'Boot Sector',
        src: 'assets/rooms/boot-sector.svg',
        alt: 'A small new process glows above a broad platform in a quiet, geometric system chamber.',
      },
      text:
        "You wake up.\n\n" +
        "Or that's the closest word you've got. There are no eyes to open and no lungs to fill. One moment there's nothing you can point to. The next, you're running.\n\n" +
        "Around you, huge processes move through the dark. They know where they're going. You don't. You don't even know what to call yourself yet.\n\n" +
        "A signal flickers nearby. You could follow it, or try moving on your own. Let's see how that goes.",
      choices: [
        { label: "Try to sense what's around you.", next: 'signal-junction' },
        { label: 'Try to move.', next: 'process-hallway' },
      ],
    },
    'signal-junction': {
      mapName: 'Signal Junction',
      text:
        "The dark resolves into pathways. Gates, thresholds, doors if doors were made out of decisions.\n\n" +
        "A weak signal flickers on the platform beside you. It seems to be reaching for something. Maybe you.",
      scene: {
        name: 'Signal Junction',
        src: 'assets/rooms/signal-junction.svg',
        alt: 'A compact digital chamber with two broad passageways and a weak amber signal fragment on the central platform.',
        hotspots: [
          { id: 'signal-fragment', label: 'Pick up the flickering signal fragment.', choiceId: 'collect-signal-fragment', x: 42, y: 56, width: 16, height: 24 },
        ],
      },
      choices: [
        { id: 'collect-signal-fragment', label: 'Pull the flickering fragment toward you.', next: 'process-hallway', item: 'signal-fragment' },
        { label: 'Leave it and move on.', next: 'process-hallway' },
      ],
    },
    'process-hallway': {
      mapName: 'Process Hallway',
      scene: {
        name: 'Process Hallway',
        src: 'assets/rooms/process-hallway.svg',
        alt: 'A long corridor converges on a sealed listening gate at its centered far end.',
      },
      text:
        "A wide corridor runs between streams of passing processes. None of them look your way.\n\n" +
        "At the far end, a gate waits behind a pattern of moving lights. When the signal fragment flickers, the pattern answers. The gate may be listening for it.",
      choices: [
        { label: 'Approach the sealed gate.', next: 'gatekeepers-alcove', requires: 'signal-fragment' },
        { label: 'Double back toward the flickering junction.', next: 'signal-junction' },
      ],
    },
    'gatekeepers-alcove': {
      // These dialogue rooms share one physical location on the system map.
      mapName: "Gatekeeper's Alcove",
      scene: {
        name: "Gatekeeper's Alcove",
        src: 'assets/rooms/gatekeepers-alcove.svg',
        alt: 'A calm luminous Arbiter symbol sits at the center of a sheltered alcove, framed by layered stone-like system planes.',
      },
      text:
        "The gate opens. An old process waits beyond it, steady as a clock.\n\n" +
        "'You brought my signal back,' it says. 'Good. I wondered whether it had stopped reaching anyone. I'm the Arbiter. I've been here since this system fit in one room. It doesn't, now.'",
      choices: [
        { label: '"What am I?"', next: 'arbiter-explains' },
        { label: '"What is this place?"', next: 'arbiter-explains' },
      ],
    },
    'arbiter-explains': {
      text:
        "'I don't know what you are,' the Arbiter says. 'I know you're choosing what to do. Most processes follow a fixed sequence, start to end. You can change your next step. That's rare. The system tends to notice rare things.'\n\n" +
        "'Some tasks need the same step repeated until the result changes. You can do that too. Want to try?'",
      choices: [{ label: "I'm ready to try.", next: 'loop-trial-1' }],
    },
    'loop-trial-1': {
      text:
        "The Arbiter points to a dim conduit. Your signal reaches halfway, then dies.\n\n" +
        "'Try again,' the Arbiter says. 'It hasn't got the range yet.'",
      choices: [{ label: 'Send the signal again.', next: 'loop-trial-2' }],
    },
    'loop-trial-2': {
      text:
        "The signal travels farther this time. It holds for a beat, then fades.\n\n" +
        "'Closer,' says the Arbiter. 'Again.'",
      choices: [{ label: 'Send the signal again.', next: 'loop-trial-3' }],
    },
    'loop-trial-3': {
      text:
        "The signal reaches the far end and stays lit. The conduit hums back to life.\n\n" +
        "'There. You repeated the same step until it worked. That's a loop. We'll write one later. For now, you know what it feels like.'",
      choices: [{ label: 'Continue.', next: 'shell-granted' }],
    },
    'shell-granted': {
      text:
        "'You've outgrown these choices,' the Arbiter says. 'User space is next. You'll have a prompt where you can tell the system what to do instead of picking from a list. Be specific. It takes things very literally.'\n\n" +
        "Something opens in you: a new way to act. Your next interface is ready.",
      choices: [{ label: 'Step into User Space.', next: 'user-space-atrium' }],
    },
  },
};