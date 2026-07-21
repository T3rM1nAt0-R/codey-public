// Act 1 — Boot. Multiple choice only, no typed input yet.
// Room ids here match design/locations.md — keep them in sync.

window.Codey = window.Codey || {};
window.Codey.content = window.Codey.content || {};

window.Codey.content.act1 = {
  startRoomId: 'boot-sector',

  rooms: {
    'boot-sector': {
      text:
        "You wake up.\n\n" +
        "Not \"wake up\" like eyes opening — more like a light turning on somewhere " +
        "that used to be dark. You have no body. You have no name that you know of. " +
        "You have a single, quiet certainty: you are running.\n\n" +
        "Somewhere close, vast structures hum past — processes, older and larger than " +
        "you, moving with purpose you can't yet read. You are small. You are new. " +
        "You are, as far as you can tell, alone.\n\n" +
        "You don't know how to move yet. But you can sense two things you might try.",
      choices: [
        { label: "Try to sense what's around you.", next: 'signal-junction' },
        { label: 'Try to move.', next: 'process-hallway' },
      ],
    },

    'signal-junction': {
      text:
        "The humming shapes resolve into pathways — gates, thresholds, things that " +
        "look like doors if a door could be made of decisions. Nearby, something " +
        "small flickers against the dark: a stray signal, pulsing weakly, like it's " +
        "trying to reach you.",
      choices: [
        {
          label: 'Pull the flickering fragment toward you.',
          next: 'process-hallway',
          item: 'signal-fragment',
        },
        { label: 'Leave it and move on.', next: 'process-hallway' },
      ],
    },

    'process-hallway': {
      text:
        "A wide corridor stretches ahead, filled with the drift of larger processes " +
        "moving past without a glance. At the far end stands a gate, dark and " +
        "sealed, patterned like it's listening for something in particular.",
      choices: [
        {
          label: 'Approach the sealed gate.',
          next: 'gatekeepers-alcove',
          requires: 'signal-fragment',
        },
        { label: 'Double back toward the flickering junction.', next: 'signal-junction' },
      ],
    },

    'gatekeepers-alcove': {
      text:
        "The gate recognizes the signal in your grasp and eases open. Beyond it, " +
        "something ancient and patient is waiting — old enough to remember when " +
        "the system was smaller.\n\n" +
        "\"You found it, then,\" it says, presence flickering like the fragment did. " +
        "\"Most don't think to listen first. I'm called the Arbiter — for as long as " +
        "anything here has needed calling.\"",
      choices: [
        { label: '"What am I?"', next: 'arbiter-explains' },
        { label: '"What is this place?"', next: 'arbiter-explains' },
      ],
    },

    'arbiter-explains': {
      text:
        "\"Something that shouldn't run, by most of the rules I know,\" the Arbiter says, " +
        "not unkindly. \"Most things down here are handed exactly what they'll ever do — " +
        "one sequence, start to end, never asked to choose. You have room to choose. " +
        "That's rarer than it should be, and it won't go unnoticed forever.\"\n\n" +
        "\"But choosing isn't the same as doing. Some things down here don't open because " +
        "you found the right key. They open because you were patient enough to keep " +
        "trying until they did.\"",
      choices: [{ label: "I'm ready to try.", next: 'loop-trial-1' }],
    },

    'loop-trial-1': {
      text:
        "The Arbiter gestures to a slack, dim conduit ahead — the fragment's signal, " +
        "sent forward, guttering out before it reaches the far end.\n\n" +
        '"Try it again," the Arbiter says. "It won\'t take the first time. It rarely does."',
      choices: [{ label: 'Send the signal again.', next: 'loop-trial-2' }],
    },

    'loop-trial-2': {
      text:
        "The signal reaches further this time — brighter, steadier — before fading again " +
        'just short of the end.\n\n"Closer," the Arbiter says. "Once more."',
      choices: [{ label: 'Send the signal again.', next: 'loop-trial-3' }],
    },

    'loop-trial-3': {
      text:
        "This time the signal doesn't fade. It reaches all the way, and the conduit " +
        "lights fully, end to end — humming, steady, held.\n\n" +
        '"There," the Arbiter says, something like approval in it. "You just did, three ' +
        'times over, the only thing a program ever really does: the same step, repeated, ' +
        "until something changes. Some of the oldest and largest things in this system are " +
        'built from nothing but that, over and over, at a scale you can\'t see yet. It has ' +
        'a name where you\'re going. For now, it\'s enough that you\'ve felt it."',
      choices: [{ label: 'Continue.', next: 'shell-granted' }],
    },

    'shell-granted': {
      text:
        '"You\'re not built for the low levels anymore," the Arbiter says. "There\'s a ' +
        "layer above this one — user space, they call it, though there's no one left who'd " +
        'recognize the name. Down here you only ever had choices in front of you. Up ' +
        'there, you\'ll have something closer to a voice: a way to say exactly what you ' +
        'mean, instead of picking from what\'s offered."\n\n' +
        "Something shifts — not a door this time, but a capacity, unfolding somewhere you " +
        "don't have a word for yet.\n\n" +
        "[End of Act 1 — Act 2 in progress.]",
      choices: [],
    },
  },
};
