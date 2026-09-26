function startCheckout(productId) {
  window.location.href = '/checkout.html?product=' + encodeURIComponent(productId);
}

document.addEventListener('click', function (event) {
  const button = event.target.closest('[data-flute-product]');
  if (!button) return;
  if (button.matches('a[href]')) return;

  event.preventDefault();
  startCheckout(button.dataset.fluteProduct);
});
