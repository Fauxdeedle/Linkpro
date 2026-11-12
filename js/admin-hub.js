(function () {
  const state = {
    sections: [{ id: 'events', label: 'Live Events' }],
    section: 'events',
    view: 'list',
    events: [],
    event: null,
    mode: 'edit',
  };

  const panel = document.getElementById('panel');
  const message = document.getElementById('message');
  const sectionsEl = document.getElementById('sections');
  const primary = document.getElementById('primary-action');

  function setMessage(text) {
    message.hidden = !text;
    message.textContent = text || '';
  }

  async function api(path, options) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      ...options,
    });
    const data = await response.json().catch(function () {
      return {};
    });
    if (!response.ok) {
      const error = new Error(data.error || 'The admin hub could not complete that.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function renderSections() {
    sectionsEl.innerHTML = '';
    state.sections.forEach(function (section) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = section.label;
      if (section.id === state.section) button.setAttribute('aria-current', 'true');
      button.addEventListener('click', function () {
        state.section = section.id;
        state.view = 'list';
        render();
      });
      item.appendChild(button);
      sectionsEl.appendChild(item);
    });
  }

  function field(label, value, name, multiline) {
    const wrap = document.createElement('label');
    wrap.textContent = label;
    const input = document.createElement(multiline ? 'textarea' : 'input');
    input.name = name;
    if (!multiline) input.type = name === 'price' ? 'number' : 'text';
    if (name === 'price') {
      input.min = '1';
      input.step = '1';
      input.inputMode = 'numeric';
    }
    input.value = value || '';
    wrap.appendChild(input);
    return wrap;
  }

  function renderList() {
    primary.innerHTML = '';
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn-primary';
    add.textContent = 'Add new event';
    add.addEventListener('click', function () {
      state.event = { name: '', date: '', price: '', copy: '' };
      state.mode = 'create';
      state.view = 'edit';
      render();
    });
    primary.appendChild(add);

    panel.innerHTML = '';
    if (!state.events.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No live events yet.';
      panel.appendChild(empty);
      return;
    }

    state.events.forEach(function (event) {
      const row = document.createElement('div');
      row.className = 'event-row';
      const name = document.createElement('strong');
      name.textContent = event.name;
      const date = document.createElement('span');
      date.textContent = event.date || 'Date not set';
      const price = document.createElement('span');
      price.textContent = event.priceLabel || 'No price';
      const actions = document.createElement('div');
      actions.className = 'event-row__actions';

      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'btn-text';
      more.textContent = 'See more info';
      more.addEventListener('click', function () {
        openEvent(event.slug);
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn-text';
      remove.textContent = 'Delete';
      remove.addEventListener('click', function () {
        removeEvent(event);
      });

      actions.append(more, remove);
      row.append(name, date, price, actions);
      panel.appendChild(row);
    });
  }

  function renderDetail() {
    primary.innerHTML = '';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'btn-primary';
    edit.textContent = 'Edit event';
    edit.addEventListener('click', function () {
      state.mode = 'edit';
      state.view = 'edit';
      render();
    });
    primary.appendChild(edit);

    panel.innerHTML = '';
    const view = document.createElement('section');
    view.className = 'event-detail';
    const bar = document.createElement('div');
    bar.className = 'event-detail__bar';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn-back';
    back.textContent = 'Back';
    back.addEventListener('click', function () {
      state.view = 'list';
      render();
    });
    bar.appendChild(back);

    const title = document.createElement('h2');
    title.textContent = state.event.name;
    const meta = document.createElement('p');
    meta.className = 'event-detail__meta';
    meta.textContent = [state.event.date, state.event.priceLabel || 'No price']
      .filter(Boolean)
      .join('  ·  ');
    const copy = document.createElement('div');
    copy.className = 'event-copy';
    copy.textContent = state.event.copy || 'No event copy yet.';

    view.append(bar, title, meta, copy);
    panel.appendChild(view);
  }

  function renderEditor() {
    primary.innerHTML = '';
    panel.innerHTML = '';
    const creating = state.mode === 'create';
    const view = document.createElement('section');
    view.className = 'event-detail';
    const bar = document.createElement('div');
    bar.className = 'event-detail__bar';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn-back';
    back.textContent = 'Back';
    back.addEventListener('click', function () {
      if (creating) {
        state.view = 'list';
      } else {
        state.view = 'detail';
      }
      render();
    });
    bar.appendChild(back);

    const form = document.createElement('form');
    form.className = 'event-form';
    form.append(
      field('Event name', state.event.name, 'name'),
      field('Event date', state.event.date, 'date'),
      field('Price', state.event.price === null ? '' : state.event.price, 'price'),
      field('Event info', state.event.copy, 'copy', true)
    );

    const actions = document.createElement('div');
    actions.className = 'event-form__actions';
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'btn-primary';
    save.textContent = creating ? 'Create event' : 'Save';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn-text';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', function () {
      back.click();
    });
    actions.append(save, cancel);
    form.appendChild(actions);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const data = new FormData(form);
      saveEvent({
        name: data.get('name'),
        date: data.get('date'),
        price: data.get('price'),
        copy: data.get('copy'),
      });
    });

    view.append(bar, form);
    panel.appendChild(view);
  }

  function render() {
    renderSections();
    if (state.section !== 'events') {
      primary.innerHTML = '';
      panel.innerHTML = '';
      const waiting = document.createElement('p');
      waiting.textContent = 'This section is not available yet.';
      panel.appendChild(waiting);
      return;
    }
    if (state.view === 'detail') renderDetail();
    else if (state.view === 'edit') renderEditor();
    else renderList();
  }

  async function openEvent(slug) {
    setMessage('');
    try {
      const data = await api('/api/admin/events/' + encodeURIComponent(slug));
      state.event = data.event;
      state.view = 'detail';
      render();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function saveEvent(input) {
    setMessage('');
    const creating = state.mode === 'create';
    try {
      const data = creating
        ? await api('/api/admin/events', { method: 'POST', body: JSON.stringify(input) })
        : await api('/api/admin/events/' + encodeURIComponent(state.event.slug), {
            method: 'PUT',
            body: JSON.stringify(input),
          });
      state.event = data.event;
      state.mode = 'edit';
      state.view = 'detail';
      setMessage(
        data.published
          ? 'Saved. The live site updates when the deploy finishes.'
          : 'Saved.'
      );
      state.events = (await api('/api/admin/events')).events;
      render();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function removeEvent(event) {
    const confirmed = window.confirm(
      'Delete ' +
        event.name +
        '? This removes the page, the catalog card, and checkout for this event. Past purchases stay on the sheet.'
    );
    if (!confirmed) return;
    setMessage('');
    try {
      await api('/api/admin/events/' + encodeURIComponent(event.slug), { method: 'DELETE' });
      state.events = state.events.filter(function (item) {
        return item.slug !== event.slug;
      });
      state.view = 'list';
      setMessage('Event deleted.');
      render();
    } catch (err) {
      setMessage(err.message);
    }
  }

  function renderGate(configured) {
    document.querySelector('.admin__heading').hidden = false;
    sectionsEl.hidden = true;
    primary.innerHTML = '';
    panel.innerHTML = '';
    const gate = document.createElement('form');
    gate.className = 'gate event-form';
    const copy = document.createElement('p');
    copy.textContent = configured
      ? 'Enter the admin password.'
      : 'The admin hub needs ADMIN_HUB_PASSWORD before it can open.';
    gate.appendChild(copy);
    if (!configured) {
      panel.appendChild(gate);
      return;
    }
    gate.appendChild(field('Password', '', 'password'));
    const input = gate.querySelector('input');
    input.type = 'password';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn-primary';
    submit.textContent = 'Enter';
    gate.appendChild(submit);
    gate.addEventListener('submit', async function (event) {
      event.preventDefault();
      setMessage('');
      try {
        await api('/api/admin/session', {
          method: 'POST',
          body: JSON.stringify({ password: new FormData(gate).get('password') }),
        });
        sectionsEl.hidden = false;
        await boot();
      } catch (err) {
        setMessage(err.message);
      }
    });
    panel.appendChild(gate);
  }

  async function boot() {
    try {
      const session = await api('/api/admin/session');
      if (Array.isArray(session.sections) && session.sections.length) {
        state.sections = session.sections;
      }
      state.events = (await api('/api/admin/events')).events;
      sectionsEl.hidden = false;
      render();
    } catch (err) {
      if (err.status === 503) {
        renderGate(false);
        return;
      }
      renderGate(true);
    }
  }

  boot();
})();
