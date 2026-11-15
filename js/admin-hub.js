(function () {
  const state = {
    sections: [
      { id: 'events', label: 'Live Events' },
      { id: 'archive', label: 'Archive Events' },
    ],
    section: 'events',
    view: 'list',
    events: [],
    archived: [],
    event: null,
    mode: 'edit',
  };

  const panel = document.getElementById('panel');
  const message = document.getElementById('message');
  const sectionsEl = document.getElementById('sections');
  const primary = document.getElementById('primary-action');

  function setMessage(text, href) {
    message.hidden = !text;
    message.textContent = text || '';
    if (!text || !href) return;
    message.append(' ');
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Open the pull request';
    message.appendChild(link);
  }

  function reviewNote(done, data) {
    if (!data || !data.published) {
      setMessage(done);
      return;
    }
    setMessage(done + ' Review the branch, then merge it into main.', data.pullRequestUrl);
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
    input.value = value == null ? '' : value;
    wrap.appendChild(input);
    return wrap;
  }

  function applyLists(data) {
    state.events = Array.isArray(data.events) ? data.events : [];
    state.archived = Array.isArray(data.archived) ? data.archived : [];
  }

  function renderList() {
    const archived = state.section === 'archive';
    const events = archived ? state.archived : state.events;
    primary.innerHTML = '';
    if (!archived) {
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
    }

    panel.innerHTML = '';
    if (!events.length) {
      const empty = document.createElement('p');
      empty.textContent = archived ? 'No archived events.' : 'No live events yet.';
      panel.appendChild(empty);
      return;
    }

    events.forEach(function (event) {
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

      const move = document.createElement('button');
      move.type = 'button';
      move.className = 'btn-text';
      move.textContent = archived ? 'Restore' : 'Archive';
      move.addEventListener('click', function () {
        moveEvent(event, !archived);
      });

      actions.append(more, move);
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
    meta.textContent = [state.event.date, state.event.priceLabel || 'No price'].filter(Boolean).join('  ·  ');
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
      state.view = creating ? 'list' : 'detail';
      render();
    });
    bar.appendChild(back);

    const form = document.createElement('form');
    form.className = 'event-form';
    form.append(
      field('Event name', state.event.name, 'name'),
      field('Event date', state.event.date, 'date'),
      field('Price', state.event.price, 'price'),
      field('Event info', state.event.copy, 'copy', true)
    );

    const actions = document.createElement('div');
    actions.className = 'event-form__actions';
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'btn-primary';
    save.textContent = 'Save';
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
      reviewNote('Saved.', data);
      applyLists(await api('/api/admin/events'));
      render();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function moveEvent(event, archived) {
    const confirmed = window.confirm(
      archived
        ? 'Archive ' + event.name + '? It leaves the live events list. The page stays up.'
        : 'Restore ' + event.name + ' to the live events list?'
    );
    if (!confirmed) return;
    setMessage('');
    try {
      const data = await api('/api/admin/events/' + encodeURIComponent(event.slug), {
        method: 'PATCH',
        body: JSON.stringify({ archived: archived }),
      });
      applyLists(await api('/api/admin/events'));
      state.view = 'list';
      state.section = archived ? 'archive' : 'events';
      reviewNote(archived ? 'Event archived.' : 'Event restored.', data);
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
      submit.disabled = true;
      setMessage('Checking password...');
      try {
        await api('/api/admin/session', {
          method: 'POST',
          body: JSON.stringify({ password: new FormData(gate).get('password') }),
        });
        const failed = await boot();
        if (failed && failed.status === 401) {
          setMessage('That password was accepted, but the browser did not keep the sign-in. Refresh and try again.');
        }
      } catch (err) {
        setMessage(err.message);
      } finally {
        submit.disabled = false;
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
      applyLists(await api('/api/admin/events'));
      sectionsEl.hidden = false;
      setMessage('');
      render();
      return null;
    } catch (err) {
      if (err.status === 503) {
        renderGate(false);
        return err;
      }
      if (err.status === 401) {
        renderGate(true);
        return err;
      }
      setMessage(err.message);
      return err;
    }
  }

  boot();
})();
