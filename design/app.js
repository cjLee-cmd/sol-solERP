/* Sidebar rail behaviour — the vanilla-DOM equivalent of the DCLogic
   Component in `solERP Hub Wireframes.dc.html`.

   A rail is open when it is pinned OR hovered. Open = its own full width,
   closed = a 48px gutter. Each rail carries its full width in
   `data-rail-full`; `data-rail-pinned` seeds the initial pinned state. */

const COLLAPSED = 48;

document.querySelectorAll('[data-rail]').forEach((rail) => {
  const full = Number(rail.dataset.railFull);
  const pin = rail.querySelector('.sol-pin');
  const state = { pinned: rail.dataset.railPinned === 'true', hover: false };

  const render = () => {
    const open = state.pinned || state.hover;
    rail.style.width = (open ? full : COLLAPSED) + 'px';
    rail.classList.toggle('sol-rail-closed', !open);
    pin.setAttribute('aria-pressed', String(state.pinned));
  };

  rail.addEventListener('mouseenter', () => { state.hover = true; render(); });
  rail.addEventListener('mouseleave', () => { state.hover = false; render(); });
  pin.addEventListener('click', () => { state.pinned = !state.pinned; render(); });

  render();
});
