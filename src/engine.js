// The engine: knows how to render a room and move between rooms. It
// doesn't know anything about acts, the Arbiter, or signal fragments —
// all of that lives in content/. This split means we can rewrite the
// entire story without touching this file, and vice versa.

(function () {
  const rooms = window.Codey.rooms;
  const startRoomId = window.Codey.startRoomId;
  const inventory = window.Codey.inventory;

  const state = {
    currentRoomId: startRoomId,
    inventory: inventory.create(),
  };

  function visibleChoices(room) {
    return room.choices.filter(
      (choice) => !choice.requires || inventory.has(state.inventory, choice.requires)
    );
  }

  function render() {
    const room = rooms[state.currentRoomId];

    const storyEl = document.getElementById('story');
    storyEl.textContent = '';
    const p = document.createElement('p');
    p.textContent = room.text;
    storyEl.appendChild(p);

    const choicesEl = document.getElementById('choices');
    choicesEl.textContent = '';
    visibleChoices(room).forEach((choice) => {
      const button = document.createElement('button');
      button.textContent = choice.label;
      button.addEventListener('click', () => {
        if (choice.item) {
          inventory.add(state.inventory, choice.item);
        }
        state.currentRoomId = choice.next;
        render();
      });
      choicesEl.appendChild(button);
    });
  }

  function init() {
    const game = document.getElementById('game');
    const story = document.createElement('div');
    story.id = 'story';
    const choices = document.createElement('div');
    choices.id = 'choices';
    game.appendChild(story);
    game.appendChild(choices);
    render();
  }

  init();
})();
