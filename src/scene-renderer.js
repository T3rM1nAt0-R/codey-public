// Renders the visual stage for rooms that have scene metadata.
// Keep this as a classic script: the game must continue to open from index.html.
(function () {
  window.Codey = window.Codey || {};

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

  function render(scene, onHotspot) {
    if (!scene || typeof scene.src !== 'string' || !scene.src.trim()) return null;

    const stage = document.createElement('section');
    stage.className = 'room-stage';
    stage.id = 'room-stage';
    stage.setAttribute('role', 'group');
    stage.setAttribute('aria-label', scene.name ? `Room scene: ${scene.name}` : 'Room scene');

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
      button.style.left = `${hotspot.x}%`;
      button.style.top = `${hotspot.y}%`;
      button.style.width = `${hotspot.width}%`;
      button.style.height = `${hotspot.height}%`;
      button.addEventListener('click', () => {
        if (typeof onHotspot === 'function') onHotspot(hotspot.id);
      });
      stage.appendChild(button);
    });

    return stage;
  }

  window.Codey.sceneRenderer = { render };
})();
