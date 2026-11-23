(function () {
  function pacificDate(now) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }

  var today = pacificDate(new Date());
  document.querySelectorAll('[data-sale-ends]').forEach(function (node) {
    var ends = node.getAttribute('data-sale-ends');
    if (!ends || today <= ends) return;
    node.textContent = node.getAttribute('data-sale-list') || '';
    node.removeAttribute('data-sale-ends');
    node.classList.remove('seminar-price--sale', 'seminar-card__price--sale', 'live-event-card__sale');
  });
})();
