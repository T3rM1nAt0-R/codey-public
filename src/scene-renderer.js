// Renders the visual stage for rooms that have scene metadata.
// Keep this as a classic script: the game must continue to open from index.html.
(function () {
  window.Codey = window.Codey || {};

  const STORAGE_KEY = 'codey.scene-treatment';
  const VALID_TREATMENTS = ['original', 'warm', 'cool', 'high-contrast'];

  function normalizeTreatment(value) {
    return VALID_TREATMENTS.includes(value) ? value : 'original';
  }

  function preferenceStorage() {
    try {
      return window.localStorage;
    } catch (_error) {
      return null;
    }
  }

  function getPreference(storage) {
    if (!storage || typeof storage.getItem !== 'function') return 'original';
    try {
      return normalizeTreatment(storage.getItem(STORAGE_KEY));
    } catch (_error) {
      return 'original';
    }
  }

  function setPreference(storage, value) {
    const treatment = normalizeTreatment(value);
    if (!storage) return false;
    try {
      if (treatment === 'original') {
        if (typeof storage.removeItem !== 'function') return false;
        storage.removeItem(STORAGE_KEY);
      } else {
        if (typeof storage.setItem !== 'function') return false;
        storage.setItem(STORAGE_KEY, treatment);
      }
      return true;
    } catch (_error) {
      return false;
    }
  }

  function resetPreference(storage) {
    if (!storage || typeof storage.removeItem !== 'function') return false;
    try {
      storage.removeItem(STORAGE_KEY);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function applyTreatment(image, value) {
    if (!image) return 'original';
    const treatment = normalizeTreatment(value);
    image.dataset.sceneTreatment = treatment;
    return treatment;
  }

  function browserPreference() {
    return getPreference(preferenceStorage());
  }

  function saveBrowserPreference(value) {
    return setPreference(preferenceStorage(), value);
  }

  function resetBrowserPreference() {
    return resetPreference(preferenceStorage());
  }

  window.Codey.sceneTreatments = {
    STORAGE_KEY,
    TREATMENTS: VALID_TREATMENTS,
    normalize: normalizeTreatment,
    getPreference: browserPreference,
    setPreference: saveBrowserPreference,
    resetPreference: resetBrowserPreference,
    apply: applyTreatment,
    getPreferenceFrom: getPreference,
    setPreferenceIn: setPreference,
    resetPreferenceIn: resetPreference,
  };

  const TREATMENTS = [
    { value: 'original', label: 'Original' },
    { value: 'warm', label: 'Warm' },
    { value: 'cool', label: 'Cool' },
    { value: 'high-contrast', label: 'High contrast' },
  ];

  function validHotspot(hotspot) {
    if (!hotspot || typeof hotspot.id !== 'string' || !hotspot.id.trim()) return false;
    if (typeof hotspot.label !== 'string' || !hotspot.label.trim()) return false;
    if (typeof hotspot.choiceId !== 'string' || !hotspot.choiceId.trim()) return false;

    return ['x', 'y', 'width', 'height'].every((key) => {
      const value = hotspot[key];
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
    }) &&
      hotspot.width > 0 &&
      hotspot.height > 0 &&
      hotspot.x + hotspot.width <= 100 &&
      hotspot.y + hotspot.height <= 100;
  }

  function createTreatmentControls(image, preference) {
    const treatments = window.Codey.sceneTreatments;
    if (!treatments) return null;

    const disclosure = document.createElement('details');
    disclosure.className = 'scene-treatment-disclosure';
    const summary = document.createElement('summary');
    summary.textContent = 'Scene look: ' + TREATMENTS.find((item) => item.value === treatments.normalize(preference)).label;
    disclosure.appendChild(summary);

    const fieldset = document.createElement('fieldset');
    fieldset.className = 'scene-treatment-controls';
    const legend = document.createElement('legend');
    legend.textContent = 'Choose a scene look';
    fieldset.appendChild(legend);

    const options = document.createElement('div');
    options.className = 'scene-treatment-controls__options';
    const selected = treatments.normalize(preference);
    treatments.apply(image, selected);

    TREATMENTS.forEach((treatment) => {
      const label = document.createElement('label');
      label.className = 'scene-treatment-controls__option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'scene-treatment';
      input.value = treatment.value;
      input.checked = treatment.value === selected;
      input.addEventListener('change', () => {
        if (!input.checked) return;
        treatments.apply(image, treatment.value);
        summary.textContent = 'Scene look: ' + treatment.label;
        const stored = treatments.setPreference(treatment.value);
        status.textContent = stored
          ? treatment.label + ' scene look selected and saved on this device.'
          : treatment.label + ' scene look selected for this session. This browser could not save the preference.';
        resetButton.disabled = treatment.value === 'original';
      });
      const text = document.createElement('span');
      text.textContent = treatment.label;
      label.appendChild(input);
      label.appendChild(text);
      options.appendChild(label);
    });
    fieldset.appendChild(options);

    const actions = document.createElement('div');
    actions.className = 'scene-treatment-controls__actions';
    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'scene-treatment-controls__reset';
    resetButton.textContent = 'Reset to Original';
    resetButton.disabled = selected === 'original';
    resetButton.addEventListener('click', () => {
      const stored = treatments.resetPreference();
      treatments.apply(image, 'original');
      summary.textContent = 'Scene look: Original';
      const originalInput = options.querySelector('input[value="original"]');
      if (originalInput) originalInput.checked = true;
      resetButton.disabled = true;
      status.textContent = stored
        ? 'Scene look reset to Original.'
        : 'Scene look reset to Original for this session. This browser could not save the preference.';
    });
    actions.appendChild(resetButton);
    const status = document.createElement('span');
    status.className = 'scene-treatment-controls__status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    actions.appendChild(status);
    fieldset.appendChild(actions);
    disclosure.appendChild(fieldset);
    return disclosure;
  }

  function render(scene, onHotspot) {
    if (!scene || typeof scene.src !== 'string' || !scene.src.trim()) return null;

    const presentation = document.createElement('div');
    presentation.className = 'scene-presentation';

    const stage = document.createElement('section');
    stage.className = 'room-stage';
    stage.id = 'room-stage';
    stage.setAttribute('role', 'group');
    stage.setAttribute('aria-label', scene.name ? 'Room scene: ' + scene.name : 'Room scene');

    const image = document.createElement('img');
    image.className = 'room-stage__image';
    image.src = scene.src;
    image.alt = typeof scene.alt === 'string' ? scene.alt : '';
    image.draggable = false;
    stage.appendChild(image);

    (scene.hotspots || []).filter(validHotspot).forEach((hotspot) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'room-hotspot';
      button.dataset.hotspotId = hotspot.id;
      button.setAttribute('aria-label', hotspot.label);
      button.title = hotspot.label;
      button.style.left = hotspot.x + '%';
      button.style.top = hotspot.y + '%';
      button.style.width = hotspot.width + '%';
      button.style.height = hotspot.height + '%';
      button.addEventListener('click', () => {
        if (typeof onHotspot === 'function') onHotspot(hotspot.id);
      });
      stage.appendChild(button);
    });

    presentation.appendChild(stage);
    const treatments = window.Codey.sceneTreatments;
    const preferred = treatments ? treatments.getPreference() : 'original';
    const controls = createTreatmentControls(image, preferred);
    if (controls) presentation.appendChild(controls);
    return presentation;
  }

  window.Codey.sceneRenderer = { render };
})();
