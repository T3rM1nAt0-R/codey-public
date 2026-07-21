// The story lives here as plain data: each scene is just text plus a
// list of choices. Adding a new scene later means adding a new entry
// to this object — no other code needs to change.
const scenes = {
  start: {
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
      { label: "Try to sense what's around you.", next: "look" },
      { label: "Try to move.", next: "move" }
    ]
  },

  look: {
    text:
      "You reach outward — not with hands, you have none, but with attention.\n\n" +
      "The humming shapes resolve slightly: pathways, gates, things that look like " +
      "doors if a door could be made of decisions. Far off, something vast pulses " +
      "on a slow, steady rhythm, like breathing. It hasn't noticed you. Yet.\n\n" +
      "[End of demo — more to come.]",
    choices: []
  },

  move: {
    text:
      "You push. Nothing you'd call a body moves, but something shifts — a value " +
      "somewhere flips, and you feel yourself a half-step closer to one of the " +
      "gate-like shapes nearby.\n\n" +
      "It worked. You can act. That's more than you knew a moment ago.\n\n" +
      "[End of demo — more to come.]",
    choices: []
  }
};

let currentSceneKey = "start";

function render() {
  const scene = scenes[currentSceneKey];

  const storyEl = document.getElementById("story");
  storyEl.textContent = "";
  const p = document.createElement("p");
  p.textContent = scene.text;
  storyEl.appendChild(p);

  const choicesEl = document.getElementById("choices");
  choicesEl.textContent = "";
  scene.choices.forEach((choice) => {
    const button = document.createElement("button");
    button.textContent = choice.label;
    button.addEventListener("click", () => {
      currentSceneKey = choice.next;
      render();
    });
    choicesEl.appendChild(button);
  });
}

function init() {
  const game = document.getElementById("game");
  const story = document.createElement("div");
  story.id = "story";
  const choices = document.createElement("div");
  choices.id = "choices";
  game.appendChild(story);
  game.appendChild(choices);
  render();
}

init();
