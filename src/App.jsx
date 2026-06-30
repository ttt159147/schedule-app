import React, { useState, useEffect, useMemo } from "react";

/* ===================== 定数 ===================== */

const EVENT_COLORS = [
  "#e57373", "#f06292", "#ba68c8", "#9575cd",
  "#7986cb", "#64b5f6", "#4fc3f7", "#4dd0e1",
  "#4db6ac", "#81c784", "#aed581", "#ffd54f",
  "#ffb74d", "#a1887f", "#212121", "#1a237e", "#616161",
];

const CLOTHING_COLORS = [
  "#ff8a80", "#ff80ab", "#ea80fc", "#b388ff",
  "#8c9eff", "#82b1ff", "#80d8ff", "#84ffff",
  "#a7ffeb", "#b9f6ca", "#ccff90", "#ffe57f",
  "#ffd180", "#bcaaa4", "#212121", "#1a237e", "#616161",
];

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

const LS_KEYS = {
  events: "schedule_events_v1",
  eventPresets: "schedule_event_presets_v1",
  clothingLogs: "schedule_clothing_logs_v1",
  clothingPresets: "schedule_clothing_presets_v1",
};

const DEFAULT_EVENT_PRESETS = [
  { id: "ep1", name: "仕事", color: EVENT_COLORS[5] },
  { id: "ep2", name: "通院", color: EVENT_COLORS[0] },
  { id: "ep3", name: "買い物", color: EVENT_COLORS[9] },
  { id: "ep4", name: "予定なし", color: EVENT_COLORS[13] },
];

const DEFAULT_CLOTHING_PRESETS = [
  { id: "ctop1", name: "白シャツ", type: "top", color: CLOTHING_COLORS[6] },
  { id: "ctop2", name: "黒ニット", type: "top", color: CLOTHING_COLORS[13] },
  { id: "cbtm1", name: "デニム", type: "bottom", color: CLOTHING_COLORS[7] },
  { id: "cbtm2", name: "黒パンツ", type: "bottom", color: CLOTHING_COLORS[13] },
];

/* ===================== ユーティリティ ===================== */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function pad(n) {
  return n.toString().padStart(2, "0");
}

function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d) {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

function isSameDate(a, b) {
  return fmtDate(a) === fmtDate(b);
}

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function saveLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

function reorderArray(arr, from, to) {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/* ドラッグで並べ替え可能なリストを実現するフック */
function useDragReorder(list, commit) {
  const itemRefs = React.useRef([]);
  const [draggingIndex, setDraggingIndex] = useState(null);

  function startDrag(e, index) {
    e.preventDefault();
    setDraggingIndex(index);
  }

  useEffect(() => {
    if (draggingIndex === null) return;
    function onMove(e) {
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      let target = list.length - 1;
      for (let i = 0; i < itemRefs.current.length; i++) {
        const el = itemRefs.current[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (y < rect.top + rect.height / 2) {
          target = i;
          break;
        }
      }
      if (target !== draggingIndex) {
        commit(reorderArray(list, draggingIndex, target));
        setDraggingIndex(target);
      }
    }
    function onUp() {
      setDraggingIndex(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [draggingIndex, list, commit]);

  return { itemRefs, draggingIndex, startDrag };
}

function DragHandle({ onPointerDown, onTouchStart }) {
  return (
    <span
      className="draghandle"
      onPointerDown={onPointerDown}
      onTouchStart={onTouchStart}
    >
      ⋮⋮
    </span>
  );
}



export default function App() {
  const [tab, setTab] = useState("calendar"); // calendar | clothing

  /* ---- 予定データ ---- */
  const [events, setEvents] = useState(() => loadLS(LS_KEYS.events, []));
  const [eventPresets, setEventPresets] = useState(() =>
    loadLS(LS_KEYS.eventPresets, DEFAULT_EVENT_PRESETS)
  );

  /* ---- 服装データ ---- */
  const [clothingLogs, setClothingLogs] = useState(() =>
    loadLS(LS_KEYS.clothingLogs, [])
  );
  const [clothingPresets, setClothingPresets] = useState(() =>
    loadLS(LS_KEYS.clothingPresets, DEFAULT_CLOTHING_PRESETS)
  );

  useEffect(() => saveLS(LS_KEYS.events, events), [events]);
  useEffect(() => saveLS(LS_KEYS.eventPresets, eventPresets), [eventPresets]);
  useEffect(() => saveLS(LS_KEYS.clothingLogs, clothingLogs), [clothingLogs]);
  useEffect(
    () => saveLS(LS_KEYS.clothingPresets, clothingPresets),
    [clothingPresets]
  );

  return (
    <div className="app">
      <Style />
      <header className="header">
        <h1>スケジュール</h1>
        <div className="tabbar">
          <button
            className={tab === "calendar" ? "tab active" : "tab"}
            onClick={() => setTab("calendar")}
          >
            📅 予定
          </button>
          <button
            className={tab === "clothing" ? "tab active" : "tab"}
            onClick={() => setTab("clothing")}
          >
            👕 服装
          </button>
        </div>
      </header>

      {tab === "calendar" && (
        <CalendarTab
          events={events}
          setEvents={setEvents}
          presets={eventPresets}
          setPresets={setEventPresets}
        />
      )}
      {tab === "clothing" && (
        <ClothingTab
          logs={clothingLogs}
          setLogs={setClothingLogs}
          presets={clothingPresets}
          setPresets={setClothingPresets}
        />
      )}
    </div>
  );
}

/* ===================== 予定タブ ===================== */

function CalendarTab({ events, setEvents, presets, setPresets }) {
  const [view, setView] = useState("month"); // day | week | month
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(fmtDate(new Date()));
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // event object or null
  const [showAdd, setShowAdd] = useState(false);
  const [addPrefillTime, setAddPrefillTime] = useState("");

  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => (a.time || "").localeCompare(b.time || ""))
    );
    return map;
  }, [events]);

  function goToday() {
    const t = new Date();
    setCursor(t);
    setSelectedDate(fmtDate(t));
  }

  function shift(n) {
    if (view === "day") setCursor((c) => addDays(c, n));
    else if (view === "week") setCursor((c) => addDays(c, n * 7));
    else {
      setCursor((c) => {
        const r = new Date(c);
        r.setMonth(r.getMonth() + n);
        return r;
      });
    }
  }

  function addEvent(ev) {
    setEvents((prev) => [...prev, { id: uid(), ...ev }]);
  }
  function updateEvent(id, patch) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function deleteEvent(id) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  const headerLabel = useMemo(() => {
    if (view === "day") return fmtJpDate(cursor);
    if (view === "week") {
      const s = startOfWeek(cursor);
      const e = addDays(s, 6);
      return `${fmtJpDate(s, true)} 〜 ${fmtJpDate(e, true)}`;
    }
    return `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`;
  }, [view, cursor]);

  return (
    <div className="tabcontent">
      <div className="viewswitch">
        {["day", "week", "month"].map((v) => (
          <button
            key={v}
            className={view === v ? "vbtn active" : "vbtn"}
            onClick={() => setView(v)}
          >
            {v === "day" ? "日" : v === "week" ? "週" : "月"}
          </button>
        ))}
        <button
          className="gear"
          title="予定項目の管理"
          onClick={() => setShowPresetManager(true)}
        >
          ⚙️
        </button>
      </div>

      <div className="navrow">
        <button className="navbtn" onClick={() => shift(-1)}>‹</button>
        <div className="navlabel" onClick={goToday}>{headerLabel}</div>
        <button className="navbtn" onClick={() => shift(1)}>›</button>
      </div>

      {view === "month" && (
        <MonthGrid
          cursor={cursor}
          eventsByDate={eventsByDate}
          selectedDate={selectedDate}
          onSelect={(d) => setSelectedDate(d)}
        />
      )}
      {view === "week" && (
        <WeekGrid
          cursor={cursor}
          eventsByDate={eventsByDate}
          selectedDate={selectedDate}
          onSelect={(d) => setSelectedDate(d)}
        />
      )}
      {view === "day" && (
        <HourGrid
          date={fmtDate(cursor)}
          events={eventsByDate[fmtDate(cursor)] || []}
          onEdit={(ev) => setEditingEvent(ev)}
          onAddAtHour={(hour) => {
            setAddPrefillTime(`${pad(hour)}:00`);
            setShowAdd(true);
          }}
        />
      )}

      {view !== "day" && (
        <DayPanel
          date={selectedDate}
          events={eventsByDate[selectedDate] || []}
          presets={presets}
          onQuickAdd={(preset) =>
            addEvent({
              date: selectedDate,
              title: preset.name,
              color: preset.color,
              time: "",
            })
          }
          onAddCustom={() => {
            setAddPrefillTime("");
            setShowAdd(true);
          }}
          onEdit={(ev) => setEditingEvent(ev)}
          onDelete={deleteEvent}
        />
      )}

      {view === "day" && (
        <DayPanel
          date={fmtDate(cursor)}
          events={[]}
          presets={presets}
          onQuickAdd={(preset) =>
            addEvent({
              date: fmtDate(cursor),
              title: preset.name,
              color: preset.color,
              time: "",
            })
          }
          onAddCustom={() => {
            setAddPrefillTime("");
            setShowAdd(true);
          }}
          onEdit={(ev) => setEditingEvent(ev)}
          onDelete={deleteEvent}
          presetOnly
        />
      )}

      {showAdd && (
        <EventEditModal
          initial={{
            date: view === "day" ? fmtDate(cursor) : selectedDate,
            title: "",
            color: EVENT_COLORS[0],
            time: addPrefillTime,
          }}
          onCancel={() => setShowAdd(false)}
          onSave={(data) => {
            addEvent(data);
            setShowAdd(false);
          }}
        />
      )}

      {editingEvent && (
        <EventEditModal
          initial={editingEvent}
          isEdit
          onCancel={() => setEditingEvent(null)}
          onSave={(data) => {
            updateEvent(editingEvent.id, data);
            setEditingEvent(null);
          }}
          onDelete={() => {
            deleteEvent(editingEvent.id);
            setEditingEvent(null);
          }}
        />
      )}

      {showPresetManager && (
        <PresetManagerModal
          title="予定項目の管理"
          presets={presets}
          colors={EVENT_COLORS}
          onClose={() => setShowPresetManager(false)}
          onSave={setPresets}
        />
      )}
    </div>
  );
}

function fmtJpDate(d, short) {
  if (short) return `${d.getMonth() + 1}/${d.getDate()}`;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${DOW[d.getDay()]})`;
}

function MonthGrid({ cursor, eventsByDate, selectedDate, onSelect }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = fmtDate(new Date());

  return (
    <div>
      <div className="weekrow header">
        {DOW.map((d) => (
          <div className="weekcell header" key={d}>{d}</div>
        ))}
      </div>
      <div className="monthgrid">
        {cells.map((d) => {
          const ds = fmtDate(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const evs = eventsByDate[ds] || [];
          return (
            <div
              key={ds}
              className={
                "monthcell" +
                (inMonth ? "" : " dim") +
                (ds === selectedDate ? " selected" : "") +
                (ds === today ? " today" : "")
              }
              onClick={() => onSelect(ds)}
            >
              <div className="dnum">{d.getDate()}</div>
              <div className="dots">
                {evs.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className="dot"
                    style={{ background: e.color }}
                  />
                ))}
                {evs.length > 3 && <span className="more">+{evs.length - 3}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ cursor, eventsByDate, selectedDate, onSelect }) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = fmtDate(new Date());

  return (
    <div className="weekrow">
      {days.map((d) => {
        const ds = fmtDate(d);
        const evs = eventsByDate[ds] || [];
        return (
          <div
            key={ds}
            className={
              "weekcell" +
              (ds === selectedDate ? " selected" : "") +
              (ds === today ? " today" : "")
            }
            onClick={() => onSelect(ds)}
          >
            <div className="dow">{DOW[d.getDay()]}</div>
            <div className="dnum">{d.getDate()}</div>
            <div className="weekevs">
              {evs.slice(0, 5).map((e) => (
                <div
                  key={e.id}
                  className="weekevchip"
                  style={{ background: e.color }}
                  title={e.title}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HourGrid({ date, events, onEdit, onAddAtHour }) {
  const allDay = events.filter((e) => !e.time);
  const timed = events.filter((e) => e.time);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  function eventsForHour(h) {
    return timed.filter((e) => {
      const hh = parseInt(e.time.split(":")[0], 10);
      return hh === h;
    });
  }

  return (
    <div className="hourgridwrap">
      {allDay.length > 0 && (
        <div className="allday-section">
          <div className="allday-label">終日</div>
          {allDay.map((e) => (
            <div key={e.id} className="evitem" onClick={() => onEdit(e)}>
              <span className="evcolor" style={{ background: e.color }} />
              <span className="evtitle">{e.title}</span>
            </div>
          ))}
        </div>
      )}
      <div className="hourgrid">
        {hours.map((h) => {
          const evs = eventsForHour(h);
          return (
            <div key={h} className="hourrow" onClick={() => onAddAtHour(h)}>
              <div className="hourlabel">{pad(h)}:00</div>
              <div className="hourslot">
                {evs.map((e) => (
                  <div
                    key={e.id}
                    className="hourevent"
                    style={{ background: e.color }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onEdit(e);
                    }}
                  >
                    <span className="houreventtime">{e.time}</span>
                    <span className="houreventtitle">{e.title}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function DayPanel({ date, events, presets, onQuickAdd, onAddCustom, onEdit, onDelete, presetOnly }) {
  if (!date) return null;
  const d = parseDate(date);
  return (
    <div className="daypanel">
      {!presetOnly && <div className="daypanel-title">{fmtJpDate(d)}</div>}
      {presetOnly && <div className="daypanel-title">よく使う項目から追加</div>}

      {!presetOnly && (
        <>
          {events.length === 0 && <div className="empty">予定はありません</div>}
          <div className="evlist">
            {events.map((e) => (
              <div key={e.id} className="evitem" onClick={() => onEdit(e)}>
                <span className="evcolor" style={{ background: e.color }} />
                <span className="evtime">{e.time || ""}</span>
                <span className="evtitle">{e.title}</span>
                <button
                  className="evdel"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onDelete(e.id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="presetrow">
        {presets.map((p) => (
          <button
            key={p.id}
            className="presetchip"
            style={{ background: p.color }}
            onClick={() => onQuickAdd(p)}
          >
            {p.name}
          </button>
        ))}
        <button className="presetchip addchip" onClick={onAddCustom}>
          ＋ 追加
        </button>
      </div>
    </div>
  );
}

function EventEditModal({ initial, isEdit, onCancel, onSave, onDelete }) {
  const [title, setTitle] = useState(initial.title || "");
  const [color, setColor] = useState(initial.color || EVENT_COLORS[0]);
  const [time, setTime] = useState(initial.time || "");
  const [date, setDate] = useState(initial.date);

  return (
    <Modal onClose={onCancel}>
      <h3>{isEdit ? "予定を編集" : "予定を追加"}</h3>
      <label className="flabel">日付</label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="finput"
      />
      <label className="flabel">タイトル</label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="finput"
        placeholder="例：通院"
      />
      <label className="flabel">時刻（任意）</label>
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="finput"
      />
      <label className="flabel">色</label>
      <div className="colorgrid">
        {EVENT_COLORS.map((c) => (
          <button
            key={c}
            className={"colorswatch" + (c === color ? " selected" : "")}
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <div className="modalbtns">
        {isEdit && (
          <button className="btn danger" onClick={onDelete}>
            削除
          </button>
        )}
        <button className="btn ghost" onClick={onCancel}>
          キャンセル
        </button>
        <button
          className="btn primary"
          disabled={!title.trim()}
          onClick={() => onSave({ title: title.trim(), color, time, date })}
        >
          保存
        </button>
      </div>
    </Modal>
  );
}

/* ===================== 服装タブ ===================== */

function ClothingTab({ logs, setLogs, presets, setPresets }) {
  const [date, setDate] = useState(fmtDate(new Date()));
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [showAdd, setShowAdd] = useState(null); // "top" | "bottom" | null
  const [showStats, setShowStats] = useState(false);

  const dayLogs = useMemo(() => logs.filter((l) => l.date === date), [logs, date]);
  const tops = dayLogs.filter((l) => l.type === "top");
  const bottoms = dayLogs.filter((l) => l.type === "bottom");

  const topPresets = presets.filter((p) => p.type === "top");
  const bottomPresets = presets.filter((p) => p.type === "bottom");

  function addLog(type, name, color) {
    setLogs((prev) => [...prev, { id: uid(), date, type, name, color }]);
  }
  function deleteLog(id) {
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div className="tabcontent">
      <div className="navrow">
        <button className="navbtn" onClick={() => setDate(fmtDate(addDays(parseDate(date), -1)))}>
          ‹
        </button>
        <div className="navlabel" onClick={() => setDate(fmtDate(new Date()))}>
          {fmtJpDate(parseDate(date))}
        </div>
        <button className="navbtn" onClick={() => setDate(fmtDate(addDays(parseDate(date), 1)))}>
          ›
        </button>
      </div>

      <div className="toprow-actions">
        <button className="btn ghost small" onClick={() => setShowPresetManager(true)}>
          ⚙️ 項目管理
        </button>
        <button className="btn ghost small" onClick={() => setShowStats(true)}>
          📊 集計を見る
        </button>
      </div>

      <ClothingSection
        label="👕 上"
        items={tops}
        presets={topPresets}
        onQuickAdd={(p) => addLog("top", p.name, p.color)}
        onAddCustom={() => setShowAdd("top")}
        onDelete={deleteLog}
      />
      <ClothingSection
        label="👖 下"
        items={bottoms}
        presets={bottomPresets}
        onQuickAdd={(p) => addLog("bottom", p.name, p.color)}
        onAddCustom={() => setShowAdd("bottom")}
        onDelete={deleteLog}
      />

      {showAdd && (
        <ClothingAddModal
          type={showAdd}
          onCancel={() => setShowAdd(null)}
          onSave={(name, color) => {
            addLog(showAdd, name, color);
            setShowAdd(null);
          }}
        />
      )}

      {showPresetManager && (
        <ClothingPresetManagerModal
          presets={presets}
          onClose={() => setShowPresetManager(false)}
          onSave={setPresets}
        />
      )}

      {showStats && (
        <ClothingStatsModal logs={logs} onClose={() => setShowStats(false)} />
      )}
    </div>
  );
}

function ClothingSection({ label, items, presets, onQuickAdd, onAddCustom, onDelete }) {
  return (
    <div className="daypanel">
      <div className="daypanel-title">{label}</div>
      {items.length === 0 && <div className="empty">記録がありません</div>}
      <div className="evlist">
        {items.map((l) => (
          <div key={l.id} className="evitem">
            <span className="evcolor" style={{ background: l.color }} />
            <span className="evtitle">{l.name}</span>
            <button className="evdel" onClick={() => onDelete(l.id)}>✕</button>
          </div>
        ))}
      </div>
      <div className="presetrow">
        {presets.map((p) => (
          <button
            key={p.id}
            className="presetchip"
            style={{ background: p.color }}
            onClick={() => onQuickAdd(p)}
          >
            {p.name}
          </button>
        ))}
        <button className="presetchip addchip" onClick={onAddCustom}>
          ＋ 追加
        </button>
      </div>
    </div>
  );
}

function ClothingAddModal({ type, onCancel, onSave }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(CLOTHING_COLORS[0]);
  return (
    <Modal onClose={onCancel}>
      <h3>{type === "top" ? "上を追加" : "下を追加"}</h3>
      <label className="flabel">名前</label>
      <input
        type="text"
        className="finput"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="例：白シャツ"
      />
      <label className="flabel">色</label>
      <div className="colorgrid">
        {CLOTHING_COLORS.map((c) => (
          <button
            key={c}
            className={"colorswatch" + (c === color ? " selected" : "")}
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <div className="modalbtns">
        <button className="btn ghost" onClick={onCancel}>キャンセル</button>
        <button
          className="btn primary"
          disabled={!name.trim()}
          onClick={() => onSave(name.trim(), color)}
        >
          記録する
        </button>
      </div>
    </Modal>
  );
}

function ClothingPresetManagerModal({ presets, onClose, onSave }) {
  const [list, setList] = useState(presets);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("top");
  const [newColor, setNewColor] = useState(CLOTHING_COLORS[0]);
  const [colorEditId, setColorEditId] = useState(null);

  function commit(next) {
    setList(next);
    onSave(next);
  }

  const { itemRefs, draggingIndex, startDrag } = useDragReorder(list, commit);

  function addItem() {
    if (!newName.trim()) return;
    commit([...list, { id: uid(), name: newName.trim(), type: newType, color: newColor }]);
    setNewName("");
  }
  function removeItem(id) {
    commit(list.filter((p) => p.id !== id));
  }
  function updateItem(id, patch) {
    commit(list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  return (
    <Modal onClose={onClose}>
      <h3>服装項目（定型文）の管理</h3>
      <div className="presetmanagerlist">
        {list.map((p, i) => (
          <div
            key={p.id}
            ref={(el) => (itemRefs.current[i] = el)}
            className={draggingIndex === i ? "dragging" : ""}
          >
            <div className="presetmanageritem">
              <DragHandle
                onPointerDown={(e) => startDrag(e, i)}
                onTouchStart={(e) => startDrag(e, i)}
              />
              <button
                className="evcolor colorbtn"
                style={{ background: p.color }}
                onClick={() => setColorEditId(colorEditId === p.id ? null : p.id)}
                title="色を変更"
              />
              <input
                className="finput inline"
                value={p.name}
                onChange={(e) => updateItem(p.id, { name: e.target.value })}
              />
              <select
                className="finput inline select"
                value={p.type}
                onChange={(e) => updateItem(p.id, { type: e.target.value })}
              >
                <option value="top">上</option>
                <option value="bottom">下</option>
              </select>
              <button className="evdel" onClick={() => removeItem(p.id)}>✕</button>
            </div>
            {colorEditId === p.id && (
              <div className="colorgrid inlineColorEdit">
                {CLOTHING_COLORS.map((c) => (
                  <button
                    key={c}
                    className={"colorswatch" + (c === p.color ? " selected" : "")}
                    style={{ background: c }}
                    onClick={() => {
                      updateItem(p.id, { color: c });
                      setColorEditId(null);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="addpresetrow">
        <input
          className="finput inline"
          placeholder="新しい項目名"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <select
          className="finput inline select"
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
        >
          <option value="top">上</option>
          <option value="bottom">下</option>
        </select>
      </div>
      <div className="colorgrid">
        {CLOTHING_COLORS.map((c) => (
          <button
            key={c}
            className={"colorswatch" + (c === newColor ? " selected" : "")}
            style={{ background: c }}
            onClick={() => setNewColor(c)}
          />
        ))}
      </div>
      <div className="modalbtns">
        <button className="btn primary" onClick={addItem} disabled={!newName.trim()}>
          ＋ 項目を追加
        </button>
        <button className="btn ghost" onClick={onClose}>閉じる</button>
      </div>
    </Modal>
  );
}

function ClothingStatsModal({ logs, onClose }) {
  const [period, setPeriod] = useState("month"); // week | month | all
  const [type, setType] = useState("all"); // all | top | bottom

  const stats = useMemo(() => {
    const now = new Date();
    let from = null;
    if (period === "week") from = startOfWeek(now);
    if (period === "month") from = new Date(now.getFullYear(), now.getMonth(), 1);

    const filtered = logs.filter((l) => {
      if (type !== "all" && l.type !== type) return false;
      if (from && parseDate(l.date) < from) return false;
      return true;
    });

    const map = {};
    filtered.forEach((l) => {
      const key = l.type + "|" + l.name;
      if (!map[key]) {
        map[key] = { name: l.name, type: l.type, color: l.color, count: 0, last: l.date };
      }
      map[key].count += 1;
      if (l.date > map[key].last) map[key].last = l.date;
    });

    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [logs, period, type]);

  return (
    <Modal onClose={onClose}>
      <h3>服装の集計</h3>
      <div className="statsfilters">
        <div className="viewswitch small">
          {[
            ["week", "今週"],
            ["month", "今月"],
            ["all", "全期間"],
          ].map(([v, label]) => (
            <button
              key={v}
              className={period === v ? "vbtn active" : "vbtn"}
              onClick={() => setPeriod(v)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="viewswitch small">
          {[
            ["all", "全部"],
            ["top", "上"],
            ["bottom", "下"],
          ].map(([v, label]) => (
            <button
              key={v}
              className={type === v ? "vbtn active" : "vbtn"}
              onClick={() => setType(v)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {stats.length === 0 && <div className="empty">記録がありません</div>}
      <div className="statslist">
        {stats.map((s) => (
          <div key={s.type + s.name} className="statsitem">
            <span className="evcolor" style={{ background: s.color }} />
            <span className="evtitle">
              {s.name}
              <span className="statstype">{s.type === "top" ? "（上）" : "（下）"}</span>
            </span>
            <span className="statscount">{s.count}回</span>
            <span className="statslast">最終: {fmtJpDate(parseDate(s.last), true)}</span>
          </div>
        ))}
      </div>
      <div className="modalbtns">
        <button className="btn ghost" onClick={onClose}>閉じる</button>
      </div>
    </Modal>
  );
}

/* ===================== 予定プリセット管理（共通） ===================== */

function PresetManagerModal({ title, presets, colors, onClose, onSave }) {
  const [list, setList] = useState(presets);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(colors[0]);
  const [colorEditId, setColorEditId] = useState(null);

  function commit(next) {
    setList(next);
    onSave(next);
  }

  const { itemRefs, draggingIndex, startDrag } = useDragReorder(list, commit);

  function addItem() {
    if (!newName.trim()) return;
    commit([...list, { id: uid(), name: newName.trim(), color: newColor }]);
    setNewName("");
  }
  function removeItem(id) {
    commit(list.filter((p) => p.id !== id));
  }
  function updateItem(id, patch) {
    commit(list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  return (
    <Modal onClose={onClose}>
      <h3>{title}</h3>
      <div className="presetmanagerlist">
        {list.map((p, i) => (
          <div
            key={p.id}
            ref={(el) => (itemRefs.current[i] = el)}
            className={draggingIndex === i ? "dragging" : ""}
          >
            <div className="presetmanageritem">
              <DragHandle
                onPointerDown={(e) => startDrag(e, i)}
                onTouchStart={(e) => startDrag(e, i)}
              />
              <button
                className="evcolor colorbtn"
                style={{ background: p.color }}
                onClick={() => setColorEditId(colorEditId === p.id ? null : p.id)}
                title="色を変更"
              />
              <input
                className="finput inline"
                value={p.name}
                onChange={(e) => updateItem(p.id, { name: e.target.value })}
              />
              <button className="evdel" onClick={() => removeItem(p.id)}>✕</button>
            </div>
            {colorEditId === p.id && (
              <div className="colorgrid inlineColorEdit">
                {colors.map((c) => (
                  <button
                    key={c}
                    className={"colorswatch" + (c === p.color ? " selected" : "")}
                    style={{ background: c }}
                    onClick={() => {
                      updateItem(p.id, { color: c });
                      setColorEditId(null);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="addpresetrow">
        <input
          className="finput inline"
          placeholder="新しい項目名"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
      </div>
      <div className="colorgrid">
        {colors.map((c) => (
          <button
            key={c}
            className={"colorswatch" + (c === newColor ? " selected" : "")}
            style={{ background: c }}
            onClick={() => setNewColor(c)}
          />
        ))}
      </div>
      <div className="modalbtns">
        <button className="btn primary" onClick={addItem} disabled={!newName.trim()}>
          ＋ 項目を追加
        </button>
        <button className="btn ghost" onClick={onClose}>閉じる</button>
      </div>
    </Modal>
  );
}

/* ===================== 共通モーダル ===================== */

function Modal({ children, onClose }) {
  return (
    <div className="modaloverlay" onClick={onClose}>
      <div className="modalbox" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* ===================== スタイル ===================== */

function Style() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      body, html, #root { margin: 0; padding: 0; }
      .app {
        font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif;
        background: #f5f6f8;
        min-height: 100vh;
        max-width: 480px;
        margin: 0 auto;
        padding-bottom: 40px;
        color: #2d2d2d;
      }
      .header {
        background: #fff;
        padding: 14px 16px 0 16px;
        position: sticky;
        top: 0;
        z-index: 5;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      }
      .header h1 {
        font-size: 18px;
        margin: 0 0 10px 0;
      }
      .tabbar { display: flex; gap: 4px; }
      .tab {
        flex: 1;
        padding: 10px 0;
        border: none;
        background: transparent;
        font-size: 14px;
        border-bottom: 3px solid transparent;
        color: #888;
      }
      .tab.active { color: #333; border-bottom-color: #4fc3f7; font-weight: bold; }

      .tabcontent { padding: 12px; }

      .viewswitch {
        display: flex;
        gap: 6px;
        align-items: center;
        margin-bottom: 10px;
      }
      .viewswitch.small { flex: 1; }
      .vbtn {
        flex: 1;
        padding: 8px 0;
        border: 1px solid #ddd;
        background: #fff;
        border-radius: 8px;
        font-size: 13px;
        color: #555;
      }
      .vbtn.active { background: #4fc3f7; color: #fff; border-color: #4fc3f7; }
      .gear { border: none; background: transparent; font-size: 18px; padding: 4px 8px; }

      .navrow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      .navbtn {
        border: none;
        background: #fff;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        font-size: 18px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }
      .navlabel { font-weight: bold; font-size: 15px; }

      .weekrow.header { display: flex; margin-bottom: 4px; }
      .weekcell.header {
        flex: 1;
        text-align: center;
        font-size: 11px;
        color: #999;
        padding: 4px 0;
      }

      .monthgrid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
      }
      .monthcell {
        background: #fff;
        border-radius: 8px;
        min-height: 52px;
        padding: 4px;
        text-align: center;
        font-size: 12px;
      }
      .monthcell.dim { opacity: 0.35; }
      .monthcell.selected { outline: 2px solid #4fc3f7; }
      .monthcell.today .dnum { color: #ff7043; font-weight: bold; }
      .dots { display: flex; justify-content: center; gap: 2px; flex-wrap: wrap; margin-top: 3px; }
      .dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
      .more { font-size: 9px; color: #999; }

      .weekrow { display: flex; gap: 4px; }
      .weekcell {
        flex: 1;
        background: #fff;
        border-radius: 8px;
        padding: 6px 2px;
        text-align: center;
        min-height: 90px;
      }
      .weekcell .dow { font-size: 10px; color: #999; }
      .weekcell .dnum { font-size: 14px; font-weight: bold; }
      .weekcell.selected { outline: 2px solid #4fc3f7; }
      .weekcell.today .dnum { color: #ff7043; }
      .weekevs { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
      .weekevchip { height: 5px; border-radius: 3px; }

      .daystrip { display: flex; margin-bottom: 8px; }
      .daystripcell { padding: 6px 14px; background: #fff; border-radius: 8px; text-align: center; }
      .daystripcell .dow { font-size: 11px; color: #999; }
      .daystripcell .dnum { font-size: 16px; font-weight: bold; }

      .hourgridwrap { background: #fff; border-radius: 10px; padding: 10px; }
      .allday-section { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
      .allday-label { font-size: 11px; color: #999; margin-bottom: 4px; }
      .hourgrid { display: flex; flex-direction: column; }
      .hourrow {
        display: flex;
        align-items: flex-start;
        min-height: 44px;
        border-top: 1px solid #f0f0f0;
        padding: 4px 0;
      }
      .hourrow:first-child { border-top: none; }
      .hourlabel { width: 48px; flex-shrink: 0; font-size: 11px; color: #aaa; padding-top: 4px; }
      .hourslot { flex: 1; display: flex; flex-direction: column; gap: 4px; }
      .hourevent {
        border-radius: 6px;
        padding: 6px 8px;
        font-size: 12px;
        color: #fff;
        display: flex;
        gap: 6px;
        text-shadow: 0 1px 1px rgba(0,0,0,0.15);
      }
      .houreventtime { opacity: 0.85; }

      .daypanel {
        background: #fff;
        border-radius: 10px;
        padding: 12px;
        margin-top: 12px;
      }
      .daypanel-title { font-weight: bold; margin-bottom: 8px; font-size: 14px; }
      .empty { color: #aaa; font-size: 13px; padding: 8px 0; }

      .evlist { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
      .evitem {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #f8f9fa;
        padding: 8px 10px;
        border-radius: 8px;
        font-size: 13px;
      }
      .evcolor { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
      .colorbtn {
        width: 22px; height: 22px; border: 2px solid #fff; box-shadow: 0 0 0 1px #ddd;
        cursor: pointer; padding: 0; flex-shrink: 0;
      }
      .inlineColorEdit {
        margin: 4px 0 8px 36px;
        padding: 8px;
        background: #f8f9fa;
        border-radius: 8px;
      }
      .evtime { color: #888; font-size: 12px; min-width: 38px; }
      .evtitle { flex: 1; }
      .statstype { color: #999; font-size: 11px; margin-left: 4px; }
      .evdel {
        border: none; background: transparent; color: #ccc; font-size: 13px; padding: 2px 6px;
      }

      .presetrow { display: flex; flex-wrap: wrap; gap: 6px; }
      .presetchip {
        border: none;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        color: #fff;
        text-shadow: 0 1px 1px rgba(0,0,0,0.15);
      }
      .addchip { background: #e0e0e0 !important; color: #555 !important; text-shadow: none; }

      .toprow-actions { display: flex; gap: 8px; margin-bottom: 10px; }
      .btn.small { font-size: 12px; padding: 7px 10px; }

      .modaloverlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.4);
        display: flex; align-items: flex-end; justify-content: center;
        z-index: 50;
      }
      .modalbox {
        background: #fff;
        width: 100%;
        max-width: 480px;
        border-radius: 16px 16px 0 0;
        padding: 18px;
        max-height: 85vh;
        overflow-y: auto;
      }
      .modalbox h3 { margin-top: 0; font-size: 16px; }
      .flabel { font-size: 12px; color: #888; margin-top: 10px; display: block; }
      .finput {
        width: 100%;
        padding: 9px 10px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
        margin-top: 4px;
      }
      .finput.inline { width: auto; flex: 1; margin-top: 0; }
      .finput.select { flex: 0 0 70px; }

      .colorgrid {
        display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;
      }
      .colorswatch {
        width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent;
      }
      .colorswatch.selected { border-color: #333; }

      .modalbtns { display: flex; gap: 8px; margin-top: 18px; }
      .btn {
        flex: 1;
        padding: 11px 0;
        border-radius: 8px;
        border: none;
        font-size: 14px;
      }
      .btn.primary { background: #4fc3f7; color: #fff; }
      .btn.primary:disabled { background: #ccc; }
      .btn.ghost { background: #f0f0f0; color: #555; }
      .btn.danger { background: #ffebee; color: #e53935; }

      .presetmanagerlist { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
      .presetmanageritem { display: flex; align-items: center; gap: 6px; }
      .draghandle {
        cursor: grab;
        touch-action: none;
        color: #bbb;
        font-size: 16px;
        padding: 4px 2px;
        user-select: none;
        flex-shrink: 0;
      }
      .dragging { opacity: 0.5; background: #f0f8ff; border-radius: 8px; }
      .addpresetrow { display: flex; gap: 6px; margin-top: 12px; }

      .statsfilters { display: flex; flex-direction: column; gap: 6px; margin: 10px 0; }
      .statslist { display: flex; flex-direction: column; gap: 6px; }
      .statsitem {
        display: flex; align-items: center; gap: 8px;
        background: #f8f9fa; padding: 8px 10px; border-radius: 8px; font-size: 12px;
      }
      .statscount { font-weight: bold; color: #4fc3f7; }
      .statslast { color: #999; font-size: 11px; }
    `}</style>
  );
}
