const status = document.getElementById('status');
const list = document.getElementById('sessions');
async function render() {
  try {
    const sessions = await SnapRecRecordingStore.list();
    list.replaceChildren();
    status.textContent = sessions.length ? 'Local copies remain here until you remove them.' : 'No recordings to recover.';
    for (const session of sessions.sort((a, b) => b.createdAt - a.createdAt)) {
      const row = document.createElement('section');
      const title = document.createElement('h2');
      title.textContent = `${new Date(session.createdAt).toLocaleString()} — ${session.complete ? 'Saved' : 'Interrupted or still recording'}`;
      const download = document.createElement('button'); download.textContent = 'Download local copy';
      download.onclick = async () => {
        try {
          const blob = await SnapRecRecordingStore.blob(session.id, session.mime);
          if (!blob.size) throw new Error('No captured frames were saved yet.');
          const url = URL.createObjectURL(blob); const a = document.createElement('a');
          a.href = url; a.download = `snaprec-recovered-${session.id}.${session.mime.includes('mp4') ? 'mp4' : 'webm'}`;
          a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (error) { status.textContent = error.message; }
      };
      const remove = document.createElement('button'); remove.textContent = 'Remove local copy';
      remove.onclick = async () => {
        if (!confirm('Remove this local copy? Download it first. Do not remove a recording that is still running.')) return;
        try { await SnapRecRecordingStore.remove(session.id); await render(); }
        catch (error) { status.textContent = error.message; }
      };
      row.append(title, download, remove); list.append(row);
    }
  } catch (error) { status.textContent = `Could not read local recordings: ${error.message}`; }
}
render();
