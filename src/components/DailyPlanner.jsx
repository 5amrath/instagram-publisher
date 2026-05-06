import { useState, useEffect, useCallback } from 'react';

const API = (path, opts) => fetch(`/.netlify/functions/${path}`, opts).then(r => r.json());

const CATEGORIES = ['content', 'research', 'posting', 'sales', 'general'];
const PRIORITIES = ['high', 'medium', 'low'];
const CAT_COLORS = { content: '#C9A84C', research: '#4A9EFF', posting: '#22C55E', sales: '#FF4444', general: '#888' };
const CAT_ICONS = { content: '🎬', research: '🔍', posting: '📱', sales: '💰', general: '📋' };
const PRI_COLORS = { high: '#FF4444', medium: '#C9A84C', low: '#22C55E' };

export default function DailyPlanner({ showToast }) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [tasks, setTasks] = useState([]);
    const [stats, setStats] = useState({});
    const [notes, setNotes] = useState([]);
    const [bookmarks, setBookmarks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('tasks');
    const [newTask, setNewTask] = useState({ title: '', category: 'general', priority: 'medium' });
    const [newNote, setNewNote] = useState({ title: '', content: '', category: 'general' });
    const [newBookmark, setNewBookmark] = useState({ title: '', url: '', description: '', category: 'general' });
    const [editNote, setEditNote] = useState(null);
    const [showAddNote, setShowAddNote] = useState(false);
    const [showAddBookmark, setShowAddBookmark] = useState(false);
    const [filterCat, setFilterCat] = useState('');

  const load = useCallback(async () => {
        setLoading(true);
        const data = await API(`planner-api?date=${date}`);
        setTasks(data.tasks || []);
        setStats(data.stats || {});
        setNotes(data.notes || []);
        setBookmarks(data.bookmarks || []);
        setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const addTask = async () => {
        if (!newTask.title.trim()) return showToast('Task title required', 'error');
        const data = await API('planner-api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_task', ...newTask, date }) });
        if (data.success) { setNewTask({ title: '', category: 'general', priority: 'medium' }); load(); showToast('Task added!', 'success'); }
  };

  const toggleTask = async (id) => {
        const data = await API('planner-api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle_task', id }) });
        if (data.success) { setTasks(ts => ts.map(t => t.id === id ? data.task : t)); }
  };

  const deleteTask = async (id) => {
        await API('planner-api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_task', id }) });
        setTasks(ts => ts.filter(t => t.id !== id));
        showToast('Removed', 'success');
  };

  const addNote = async () => {
        if (!newNote.title.trim()) return showToast('Title required', 'error');
        const data = await API('planner-api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_note', ...newNote }) });
        if (data.success) { setShowAddNote(false); setNewNote({ title: '', content: '', category: 'general' }); load(); showToast('Note saved!', 'success'); }
  };

  const deleteNote = async (id) => {
        await API('planner-api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_note', id }) });
        setNotes(ns => ns.filter(n => n.id !== id));
  };

  const addBookmark = async () => {
        if (!newBookmark.title.trim()) return showToast('Title required', 'error');
        const data = await API('planner-api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_bookmark', ...newBookmark }) });
        if (data.success) { setShowAddBookmark(false); setNewBookmark({ title: '', url: '', description: '', category: 'general' }); load(); showToast('Bookmark saved!', 'success'); }
  };

  const deleteBookmark = async (id) => {
        await API('planner-api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_bookmark', id }) });
        setBookmarks(bs => bs.filter(b => b.id !== id));
  };

  const completedCount = tasks.filter(t => t.completed).length;
    const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
    const filteredTasks = filterCat ? tasks.filter(t => t.category === filterCat) : tasks;

  return (
        <div className="page-container">
              <div className="page-header">
                      <div>
                                <h1 className="page-title">Daily Planner</h1>h1>
                                <p className="page-subtitle">{completedCount}/{tasks.length} tasks · {progress}% complete</p>p>
                      </div>div>
                      <input type="date" className="date-input" value={date} onChange={e => setDate(e.target.value)} />
              </div>div>
        
          {/* Progress Bar */}
              <div className="progress-container" style={{ marginBottom: 24 }}>
                      <div className="progress-bar" style={{ '--progress': `${progress}%` }} />
              </div>div>
        
          {/* Stats Strip */}
              <div className="planner-stats">
                {CATEGORIES.map(cat => (
                    <div key={cat} className="planner-stat-item" style={{ borderColor: CAT_COLORS[cat] }}>
                                <span>{CAT_ICONS[cat]}</span>span>
                                <span style={{ fontWeight: 700 }}>{tasks.filter(t => t.category === cat).length}</span>span>
                                <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{cat}</span>span>
                    </div>div>
                  ))}
              </div>div>
        
          {/* Tabs */}
              <div className="tab-bar" style={{ marginBottom: 20 }}>
                {[{ id: 'tasks', label: `Tasks (${tasks.length})` }, { id: 'notes', label: `Notes (${notes.length})` }, { id: 'bookmarks', label: `Bookmarks (${bookmarks.length})` }].map(t => (
                    <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>button>
                  ))}
              </div>div>
        
          {/* TASKS */}
          {activeTab === 'tasks' && (
                  <div className="tasks-layout">
                    {/* Add task */}
                            <div className="add-task-bar">
                                        <input className="task-input" placeholder="Add task..." value={newTask.title} onChange={e => setNewTask(f => ({...f, title: e.target.value}))} onKeyDown={e => e.key === 'Enter' && addTask()} />
                                        <select value={newTask.category} onChange={e => setNewTask(f => ({...f, category: e.target.value}))}>
                                          {CATEGORIES.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {c}</option>option>)}
                                        </select>select>
                                        <select value={newTask.priority} onChange={e => setNewTask(f => ({...f, priority: e.target.value}))}>
                                          {PRIORITIES.map(p => <option key={p}>{p}</option>option>)}
                                        </select>select>
                                        <button className="btn-primary" onClick={addTask}>Add</button>button>
                            </div>div>
                  
                    {/* Category Filter */}
                            <div className="filter-pills" style={{ marginBottom: 16 }}>
                                        <button className={`pill ${!filterCat ? 'active' : ''}`} onClick={() => setFilterCat('')}>All</button>button>
                              {CATEGORIES.map(c => <button key={c} className={`pill ${filterCat === c ? 'active' : ''}`} onClick={() => setFilterCat(c)}>{CAT_ICONS[c]} {c}</button>button>)}
                            </div>div>
                  
                    {loading ? <div className="loading-state">Loading...</div>div> : filteredTasks.length === 0 ? (
                              <div className="empty-state">
                                            <div className="empty-icon">✅</div>div>
                                            <div className="empty-title">No tasks</div>div>
                                            <div className="empty-sub">Add your first task above</div>div>
                              </div>div>
                            ) : (
                              <div className="task-list">
                                {filteredTasks.map(task => (
                                    <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                                                      <button className="task-check" onClick={() => toggleTask(task.id)} style={{ borderColor: CAT_COLORS[task.category] }}>
                                                        {task.completed && <span style={{ color: CAT_COLORS[task.category] }}>✓</span>span>}
                                                      </button>button>
                                                      <div className="task-content">
                                                                          <div className="task-title" style={{ textDecoration: task.completed ? 'line-through' : 'none' }}>{task.title}</div>div>
                                                                          <div className="task-meta">
                                                                                                <span className="task-cat" style={{ color: CAT_COLORS[task.category] }}>{CAT_ICONS[task.category]} {task.category}</span>span>
                                                                                                <span className="task-pri" style={{ color: PRI_COLORS[task.priority] }}>● {task.priority}</span>span>
                                                                          </div>div>
                                                      </div>div>
                                                      <button className="icon-btn" onClick={() => deleteTask(task.id)}>×</button>button>
                                    </div>div>
                                  ))}
                              </div>div>
                            )}
                  </div>div>
              )}
        
          {/* NOTES */}
          {activeTab === 'notes' && (
                  <div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                                        <button className="btn-primary" onClick={() => setShowAddNote(true)}>+ New Note</button>button>
                            </div>div>
                    {notes.length === 0 ? (
                                <div className="empty-state"><div className="empty-icon">📝</div>div><div className="empty-title">No notes yet</div>div></div>div>
                              ) : (
                                <div className="notes-grid">
                                  {notes.map(note => (
                                                  <div key={note.id} className="note-card">
                                                    {note.pinned && <span className="note-pin">📌</span>span>}
                                                                    <div className="note-title">{note.title}</div>div>
                                                                    <div className="note-content">{note.content}</div>div>
                                                                    <div className="note-footer">
                                                                                        <span className="note-cat">{note.category}</span>span>
                                                                                        <button className="btn-sm btn-danger" onClick={() => deleteNote(note.id)}>×</button>button>
                                                                    </div>div>
                                                  </div>div>
                                                ))}
                                </div>div>
                            )}
                    {showAddNote && (
                                <div className="modal-overlay" onClick={() => setShowAddNote(false)}>
                                              <div className="modal" onClick={e => e.stopPropagation()}>
                                                              <div className="modal-header"><h3>New Note</h3>h3><button className="icon-btn" onClick={() => setShowAddNote(false)}>×</button>button></div>div>
                                                              <div className="modal-body">
                                                                                <div className="form-group"><label>Title</label>label><input value={newNote.title} onChange={e => setNewNote(f => ({...f, title: e.target.value}))} placeholder="Note title..." /></div>div>
                                                                                <div className="form-group"><label>Content</label>label><textarea rows={5} value={newNote.content} onChange={e => setNewNote(f => ({...f, content: e.target.value}))} placeholder="Write your note..." /></div>div>
                                                                                <div className="form-group"><label>Category</label>label><select value={newNote.category} onChange={e => setNewNote(f => ({...f, category: e.target.value}))}>{CATEGORIES.map(c => <option key={c}>{c}</option>option>)}</select>select></div>div>
                                                              </div>div>
                                                              <div className="modal-footer"><button className="btn-ghost" onClick={() => setShowAddNote(false)}>Cancel</button>button><button className="btn-primary" onClick={addNote}>Save Note</button>button></div>div>
                                              </div>div>
                                </div>div>
                            )}
                  </div>div>
              )}
        
          {/* BOOKMARKS */}
          {activeTab === 'bookmarks' && (
                  <div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                                        <button className="btn-primary" onClick={() => setShowAddBookmark(true)}>+ Bookmark</button>button>
                            </div>div>
                    {bookmarks.length === 0 ? (
                                <div className="empty-state"><div className="empty-icon">🔖</div>div><div className="empty-title">No bookmarks yet</div>div></div>div>
                              ) : (
                                <div className="bookmarks-list">
                                  {bookmarks.map(bm => (
                                                  <div key={bm.id} className="bookmark-item">
                                                                    <div className="bookmark-info">
                                                                                        <div className="bookmark-title">{bm.title}</div>div>
                                                                      {bm.description && <div className="bookmark-desc">{bm.description}</div>div>}
                                                                      {bm.url && <a href={bm.url} target="_blank" rel="noreferrer" className="bookmark-url">{bm.url}</a>a>}
                                                                    </div>div>
                                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                                                        <span className="note-cat">{bm.category}</span>span>
                                                                                        <button className="btn-sm btn-danger" onClick={() => deleteBookmark(bm.id)}>×</button>button>
                                                                    </div>div>
                                                  </div>div>
                                                ))}
                                </div>div>
                            )}
                    {showAddBookmark && (
                                <div className="modal-overlay" onClick={() => setShowAddBookmark(false)}>
                                              <div className="modal" onClick={e => e.stopPropagation()}>
                                                              <div className="modal-header"><h3>Add Bookmark</h3>h3><button className="icon-btn" onClick={() => setShowAddBookmark(false)}>×</button>button></div>div>
                                                              <div className="modal-body">
                                                                                <div className="form-group"><label>Title *</label>label><input value={newBookmark.title} onChange={e => setNewBookmark(f => ({...f, title: e.target.value}))} /></div>div>
                                                                                <div className="form-group"><label>URL</label>label><input value={newBookmark.url} onChange={e => setNewBookmark(f => ({...f, url: e.target.value}))} placeholder="https://..." /></div>div>
                                                                                <div className="form-group"><label>Description</label>label><input value={newBookmark.description} onChange={e => setNewBookmark(f => ({...f, description: e.target.value}))} /></div>div>
                                                                                <div className="form-group"><label>Category</label>label><select value={newBookmark.category} onChange={e => setNewBookmark(f => ({...f, category: e.target.value}))}>{CATEGORIES.map(c => <option key={c}>{c}</option>option>)}</select>select></div>div>
                                                              </div>div>
                                                              <div className="modal-footer"><button className="btn-ghost" onClick={() => setShowAddBookmark(false)}>Cancel</button>button><button className="btn-primary" onClick={addBookmark}>Save</button>button></div>div>
                                              </div>div>
                                </div>div>
                            )}
                  </div>div>
              )}
        </div>div>
      );
}</div>
