// Turns raw typed text into { verb, argument }. This is the whole parser:
// lowercase it, split on whitespace, look the first word up in a table of
// synonyms, treat everything after that as one argument string. Real
// parsers (and Act 3's real code) do more, but this is the actual shape
// underneath most of them - a word that says *what* to do, and the rest
// of the sentence saying *what to do it to*.

window.Codey = window.Codey || {};

const VERB_ALIASES = {
  look: 'look',
  l: 'look',
  inspect: 'inspect',
  examine: 'inspect',
  go: 'go',
  move: 'go',
  walk: 'go',
  take: 'take',
  get: 'take',
  grab: 'take',
  inventory: 'inventory',
  inv: 'inventory',
  i: 'inventory',
  hide: 'hide',
  wait: 'hide',
  still: 'hide',
  order: 'order',
  sequence: 'order',
  set: 'set',
  approach: 'approach',
  help: 'help',
};

window.Codey.commands = {
  parse(raw) {
    const words = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const verb = words.length > 0 ? VERB_ALIASES[words[0]] || null : null;
    const argument = words.slice(1).join(' ');
    return { verb, argument };
  },
};
