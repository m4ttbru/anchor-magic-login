const $ = s => document.querySelector(s);

function send(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, r => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (r && r.ok) resolve(r.data);
      else reject(new Error((r && r.error) || 'No response from extension.'));
    });
  });
}

function result(text, cls) {
  const el = $('#result');
  el.textContent = text;
  el.className = cls || '';
}

(async () => {
  const { user, pass } = await chrome.storage.local.get(['user', 'pass']);
  if (user) $('#user').value = user;
  if (pass) $('#pass').placeholder = 'Saved (leave blank to keep)';
  $('#pass').required = !pass;
})();

$('#form').addEventListener('submit', async e => {
  e.preventDefault();
  const user = $('#user').value.trim();
  let pass = $('#pass').value.trim();
  if (!pass) pass = (await chrome.storage.local.get('pass')).pass || '';
  if (!user || !pass) return result('Enter a username and application password.', 'err');

  $('#save').disabled = true;
  result('Testing connection…');
  try {
    const me = await send({ type: 'test', user, pass });
    await chrome.storage.local.set({ user, pass });
    await chrome.storage.local.remove('cache');
    const { sites } = await send({ type: 'getSites', force: true });
    const who = (me && (me.name || me.username)) || user;
    result(`Connected as ${who}. Loaded ${sites.length} sites.`, 'ok');
    $('#pass').value = '';
    $('#pass').placeholder = 'Saved (leave blank to keep)';
    $('#pass').required = false;
  } catch (err) {
    result(err.message, 'err');
  } finally {
    $('#save').disabled = false;
  }
});

$('#clear').addEventListener('click', async () => {
  await chrome.storage.local.remove(['user', 'pass', 'cache']);
  $('#user').value = '';
  $('#pass').value = '';
  $('#pass').placeholder = 'xxxx xxxx xxxx xxxx xxxx xxxx';
  $('#pass').required = true;
  result('Saved login removed.', 'ok');
});
