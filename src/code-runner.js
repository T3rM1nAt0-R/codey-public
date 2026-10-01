// Small accessible UI wrapper around the safe interpreter.
(function () {
  window.Codey = window.Codey || {};

  function textElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function mount(container, config, onSolved, persistence) {
    const settings = config || {};
    const runner = document.createElement('section');
    runner.className = 'code-runner';

    const label = textElement('label', 'code-runner__label', settings.editorLabel || 'Your code');
    label.htmlFor = 'code-editor';
    const editor = document.createElement('textarea');
    editor.id = 'code-editor';
    editor.className = 'code-runner__editor';
    editor.setAttribute('aria-label', label.textContent);
    editor.autocomplete = 'off';
    editor.autocapitalize = 'off';
    editor.spellcheck = false;
    editor.rows = Math.max(6, Math.min(18, Number(settings.rows) || 10));
    const starterCode = typeof settings.starterCode === 'string' ? settings.starterCode : '';
    const persisted = persistence && persistence.initialState;
    editor.value = persisted && typeof persisted.source === 'string' ? persisted.source : starterCode;

    const actions = textElement('div', 'code-runner__actions');
    const runButton = textElement('button', 'code-runner__button', 'Run');
    runButton.type = 'button';
    const resetButton = textElement('button', 'code-runner__button', 'Reset');
    resetButton.type = 'button';
    const hintButton = textElement('button', 'code-runner__button', 'Hint');
    hintButton.type = 'button';
    actions.appendChild(runButton);
    actions.appendChild(resetButton);
    actions.appendChild(hintButton);

    const hint = textElement('p', 'code-runner__hint');
    hint.hidden = true;
    hint.setAttribute('role', 'note');

    const outputLabel = textElement('h2', 'code-runner__output-label', 'Output');
    const output = textElement('pre', 'code-runner__output', 'Run it and see what happens.');
    output.setAttribute('role', 'status');
    output.setAttribute('aria-live', 'polite');
    output.setAttribute('aria-atomic', 'true');
    if (persisted && typeof persisted.output === 'string') output.textContent = persisted.output;
    if (persisted && typeof persisted.hintText === 'string' && persisted.hintText) {
      hint.textContent = persisted.hintText;
      hint.hidden = false;
    }

    runner.appendChild(label);
    runner.appendChild(editor);
    runner.appendChild(actions);
    runner.appendChild(hint);
    runner.appendChild(outputLabel);
    runner.appendChild(output);
    container.appendChild(runner);

    const hints = Array.isArray(settings.hints)
      ? settings.hints.filter((entry) => typeof entry === 'string' && entry.length > 0)
      : typeof settings.hint === 'string' && settings.hint
        ? [settings.hint]
        : [];
    let hintIndex = persisted && Number.isSafeInteger(persisted.hintIndex)
      ? Math.min(persisted.hintIndex, hints.length)
      : 0;
    let solved = false;

    function notifyStateChange() {
      if (persistence && typeof persistence.onStateChange === 'function') {
        persistence.onStateChange({
          source: editor.value,
          hintIndex,
          hintText: hint.hidden ? '' : hint.textContent,
          output: output.textContent,
        });
      }
    }

    editor.addEventListener('input', notifyStateChange);

    hintButton.disabled = hints.length === 0;
    if (hintButton.disabled) hintButton.title = 'No hint for this room.';

    hintButton.addEventListener('click', () => {
      if (hints.length === 0) return;
      const shown = Math.min(hintIndex, hints.length - 1);
      hint.textContent = hints[shown];
      hint.hidden = false;
      hintIndex += 1;
      notifyStateChange();
    });

    resetButton.addEventListener('click', () => {
      editor.value = starterCode;
      output.textContent = 'Starter code restored. Run it when you are ready.';
      hint.textContent = '';
      hint.hidden = true;
      hintIndex = 0;
      solved = false;
      editor.focus();
      notifyStateChange();
    });

    runButton.addEventListener('click', () => {
      const result = window.Codey.interpreter.evaluate(editor.value, {
        variables: settings.variables || {},
        limits: settings.limits,
      });

      const lines = result.output.slice();
      let shouldAdvance = false;
      if (!result.ok) {
        lines.push(`Error: ${result.error}`);
      } else if (settings.goal) {
        if (window.Codey.interpreter.matchesGoal(result, settings.goal)) {
          lines.push(settings.successMessage || 'That works. The system responds.');
          if (!solved && typeof onSolved === 'function') {
            solved = true;
            shouldAdvance = true;
          }
        } else {
          lines.push('It ran. Check the result, then change one thing and try again.');
        }
      } else {
        lines.push('Program ran successfully.');
      }

      output.textContent = lines.join('\n') || 'It ran. Nothing showed up.';
      notifyStateChange();
      // Let the live region publish the solved message before the engine
      // replaces this room's DOM and moves focus into the next room.
      if (shouldAdvance) setTimeout(() => onSolved(result), 0);
    });

    notifyStateChange();
    return { element: runner, editor, output, runButton, resetButton, hintButton };
  }

  window.Codey.codeRunner = { mount };
})();
