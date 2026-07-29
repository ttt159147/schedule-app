import React, { useState, useEffect, useMemo } from "react";

/* ===================== 定数 ===================== */

const EVENT_COLORS = [
  "#f44336", "#e57373", "#f06292", "#ba68c8", "#9575cd",
  "#7986cb", "#64b5f6", "#4fc3f7", "#4dd0e1",
  "#4db6ac", "#81c784", "#aed581", "#ffd54f",
  "#ffb74d", "#a1887f", "#212121", "#1a237e", "#616161",
];

const CLOTHING_COLORS = [
  "#f44336", "#ff8a80", "#ff80ab", "#ea80fc", "#b388ff",
  "#8c9eff", "#82b1ff", "#80d8ff", "#84ffff",
  "#a7ffeb", "#b9f6ca", "#ccff90", "#ffe57f",
  "#ffd180", "#bcaaa4", "#212121", "#1a237e", "#616161", "#bdbdbd",
];

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

const LS_KEYS = {
  events: "schedule_events_v1",
  eventPresets: "schedule_event_presets_v1",
  clothingLogs: "schedule_clothing_logs_v1",
  clothingPresets: "schedule_clothing_presets_v1",
  carFuel: "schedule_car_fuel_v1",
  carTrip: "schedule_car_trip_v1",
  carMaintenance: "schedule_car_maintenance_v1",
  carPresets: "schedule_car_presets_v1",
};

const DEFAULT_CAR_PRESETS = {
  fuel:        [{ id: "cf1", name: "コスモ石油" }, { id: "cf2", name: "エネオス" }, { id: "cf3", name: "出光" }],
  trip:        [{ id: "ct1", name: "通勤" }, { id: "ct2", name: "買い物" }, { id: "ct3", name: "ドライブ" }],
  maintenance: [{ id: "cm1", name: "オイル交換" }, { id: "cm2", name: "タイヤ交換" }, { id: "cm3", name: "車検" }],
};

const DEFAULT_EVENT_PRESETS = [
  { id: "ep2", name: "通院", color: EVENT_COLORS[0] },
  { id: "ep3", name: "買い物", color: EVENT_COLORS[9] },
  { id: "ep4", name: "予定なし", color: EVENT_COLORS[13] },
];

const DEFAULT_CLOTHING_PRESETS = [
  { id: "ctop1", name: "白シャツ", type: "top", color: CLOTHING_COLORS[6] },
  { id: "ctop2", name: "黒ニット", type: "top", color: CLOTHING_COLORS[14] },
  { id: "cbtm1", name: "デニム", type: "bottom", color: CLOTHING_COLORS[7] },
  { id: "cbtm2", name: "黒パンツ", type: "bottom", color: CLOTHING_COLORS[14] },
  { id: "chat1", name: "キャップ", type: "hat", color: CLOTHING_COLORS[14] },
  { id: "cshoe1", name: "スニーカー", type: "shoes", color: CLOTHING_COLORS[16] },
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

/* スワイプ検出フック */
function useSwipe(onSwipeLeft, onSwipeRight, threshold = 50) {
  const startX = React.useRef(null);
  const startY = React.useRef(null);

  function onTouchStart(e) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }

  function onTouchEnd(e) {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - startY.current);
    // 縦スクロールとの誤検出を防ぐ：横移動が縦より大きい場合のみ
    if (Math.abs(dx) > threshold && Math.abs(dx) > dy * 1.5) {
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
    }
    startX.current = null;
    startY.current = null;
  }

  return { onTouchStart, onTouchEnd };
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
  const [tab, setTab] = useState("calendar"); // calendar | clothing | car

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

  /* ---- 車データ ---- */
  const [carFuel, setCarFuel] = useState(() => loadLS(LS_KEYS.carFuel, []));
  const [carTrip, setCarTrip] = useState(() => loadLS(LS_KEYS.carTrip, []));
  const [carMaintenance, setCarMaintenance] = useState(() => loadLS(LS_KEYS.carMaintenance, []));
  const [carPresets, setCarPresets] = useState(() => loadLS(LS_KEYS.carPresets, DEFAULT_CAR_PRESETS));

  useEffect(() => saveLS(LS_KEYS.events, events), [events]);
  useEffect(() => saveLS(LS_KEYS.eventPresets, eventPresets), [eventPresets]);
  useEffect(() => saveLS(LS_KEYS.clothingLogs, clothingLogs), [clothingLogs]);
  useEffect(() => saveLS(LS_KEYS.clothingPresets, clothingPresets), [clothingPresets]);
  useEffect(() => saveLS(LS_KEYS.carFuel, carFuel), [carFuel]);
  useEffect(() => saveLS(LS_KEYS.carTrip, carTrip), [carTrip]);
  useEffect(() => saveLS(LS_KEYS.carMaintenance, carMaintenance), [carMaintenance]);
  useEffect(() => saveLS(LS_KEYS.carPresets, carPresets), [carPresets]);

  return (
    <div className="app">
      <Style />
      <header className="header">
        <h1>スケジュール</h1>
        <div className="tabbar">
          <button className={tab === "calendar" ? "tab active" : "tab"} onClick={() => setTab("calendar")}>
            📅 予定
          </button>
          <button className={tab === "clothing" ? "tab active" : "tab"} onClick={() => setTab("clothing")}>
            👕 服装
          </button>
          <button className={tab === "car" ? "tab active" : "tab"} onClick={() => setTab("car")}>
            🚗 車
          </button>
        </div>
      </header>

      {tab === "calendar" && (
        <CalendarTab
          events={events}
          setEvents={setEvents}
          presets={eventPresets}
          setPresets={setEventPresets}
          carMaintenance={carMaintenance}
          setCarMaintenance={setCarMaintenance}
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
      {tab === "car" && (
        <CarTab
          fuel={carFuel}
          setFuel={setCarFuel}
          trips={carTrip}
          setTrips={setCarTrip}
          maintenance={carMaintenance}
          setMaintenance={setCarMaintenance}
          carPresets={carPresets}
          setCarPresets={setCarPresets}
          setEvents={setEvents}
          onAddEvent={(ev) => {
            const newId = uid();
            setEvents((prev) => [...prev, { id: newId, ...ev }]);
            return newId;
          }}
        />
      )}
    </div>
  );
}

/* ===================== 予定タブ ===================== */

function CalendarTab({ events, setEvents, presets, setPresets, carMaintenance, setCarMaintenance }) {
  const [view, setView] = useState("month"); // day | week | month
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(fmtDate(new Date()));
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // event object or null
  const [showAdd, setShowAdd] = useState(false);
  const [addPrefillTime, setAddPrefillTime] = useState("");
  const [timeSlotPicker, setTimeSlotPicker] = useState(null); // "HH:MM" or null
  const [pendingPreset, setPendingPreset] = useState(null); // { preset, date } or null

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
    // メンテナンス記録と連動：calEventIdが一致するレコードを削除
    if (setCarMaintenance) {
      setCarMaintenance((prev) => prev.filter((m) => m.calEventId !== id));
    }
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

  const swipe = useSwipe(
    () => shift(1),   // 左スワイプ → 次へ
    () => shift(-1),  // 右スワイプ → 前へ
  );

  return (
    <div className="tabcontent">
      <div className="viewswitch">
        {["day", "week", "month"].map((v) => (
          <button
            key={v}
            className={view === v ? "vbtn active" : "vbtn"}
            onClick={() => {
              if (v === "day") {
                setCursor(parseDate(selectedDate));
              } else if (view === "day") {
                setSelectedDate(fmtDate(cursor));
              }
              setView(v);
            }}
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

      <div
        className="swipeable"
        onTouchStart={swipe.onTouchStart}
        onTouchEnd={swipe.onTouchEnd}
      >
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
            onMoveEvent={(id, time) => updateEvent(id, { time })}
            onToggleDone={(id) => updateEvent(id, { done: !((eventsByDate[fmtDate(cursor)] || []).find(e => e.id === id) || {}).done })}
            onAddAtHour={(hour, minute) => {
              setTimeSlotPicker(`${pad(hour)}:${pad(minute)}`);
            }}
          />
        )}
      </div>

      {view !== "day" && (
        <DayPanel
          date={selectedDate}
          events={eventsByDate[selectedDate] || []}
          presets={presets}
          onQuickAdd={(preset) => setPendingPreset({ preset, date: selectedDate })}
          onAddCustom={() => {
            setAddPrefillTime("");
            setShowAdd(true);
          }}
          onEdit={(ev) => setEditingEvent(ev)}
          onDelete={deleteEvent}
          onToggleDone={(id) => {
            const ev = (eventsByDate[selectedDate] || []).find(e => e.id === id);
            if (ev) updateEvent(id, { done: !ev.done });
          }}
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

      {timeSlotPicker && (
        <TimeSlotPresetModal
          time={timeSlotPicker}
          presets={presets}
          onCancel={() => setTimeSlotPicker(null)}
          onQuickAdd={(preset) => {
            addEvent({
              date: fmtDate(cursor),
              title: preset.name,
              color: preset.color,
              time: timeSlotPicker,
            });
            setTimeSlotPicker(null);
          }}
          onCustom={() => {
            setAddPrefillTime(timeSlotPicker);
            setTimeSlotPicker(null);
            setShowAdd(true);
          }}
        />
      )}

      {pendingPreset && (
        <PresetTimeModal
          preset={pendingPreset.preset}
          onCancel={() => setPendingPreset(null)}
          onSave={(time) => {
            addEvent({
              date: pendingPreset.date,
              title: pendingPreset.preset.name,
              color: pendingPreset.preset.color,
              time,
            });
            setPendingPreset(null);
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

function HourGrid({ date, events, onEdit, onAddAtHour, onMoveEvent, onToggleDone }) {
  const allDay = events.filter((e) => !e.time);
  const timed = events.filter((e) => e.time);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const [draggingId, setDraggingId] = useState(null);
  const dragStartY = React.useRef(0);
  const draggingEventRef = React.useRef(null);

  function eventsForHour(h) {
    return timed.filter((e) => {
      const hh = parseInt(e.time.split(":")[0], 10);
      return hh === h;
    });
  }

  function getPoint(e) {
    return e.touches ? e.touches[0] : e;
  }

  function startDrag(e, ev) {
    e.preventDefault();
    const pt = getPoint(e);
    dragStartY.current = pt.clientY;
    draggingEventRef.current = ev;
    setDraggingId(ev.id);
  }

  useEffect(() => {
    if (!draggingId) return;
    function onMove(e) {
      e.preventDefault();
    }
    function onUp(e) {
      const pt = getPoint(e);
      const deltaY = Math.abs(pt.clientY - dragStartY.current);
      if (deltaY < 6) {
        onEdit(draggingEventRef.current);
      } else {
        const el = document.elementFromPoint(pt.clientX, pt.clientY);
        const row = el && el.closest && el.closest(".hourrow");
        if (row) {
          const h = parseInt(row.getAttribute("data-hour"), 10);
          const rect = row.getBoundingClientRect();
          const frac = (pt.clientY - rect.top) / rect.height;
          const minute = frac < 0.25 ? 0 : frac < 0.5 ? 15 : frac < 0.75 ? 30 : 45;
          onMoveEvent(draggingEventRef.current.id, `${pad(h)}:${pad(minute)}`);
        }
      }
      setDraggingId(null);
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
  }, [draggingId, onEdit, onMoveEvent]);

  return (
    <div className="hourgridwrap">
      {allDay.length > 0 && (
        <div className="allday-section">
          <div className="allday-label">終日（タップで編集／長押しして時間枠へドラッグ）</div>
          {allDay.map((e) => (
            <div
              key={e.id}
              className={"evitem" + (draggingId === e.id ? " dragging" : "") + (e.done ? " ev-done" : "")}
              onPointerDown={(ev) => startDrag(ev, e)}
              onTouchStart={(ev) => startDrag(ev, e)}
            >
              <button
                className={"evcheck" + (e.done ? " checked" : "")}
                onClick={(ev) => { ev.stopPropagation(); onToggleDone(e.id); }}
              >{e.done ? "✓" : ""}</button>
              <span className="evcolor" style={{ background: e.color, opacity: e.done ? 0.4 : 1 }} />
              <span className="evtitle">{e.title}</span>
            </div>
          ))}
        </div>
      )}
      <div className="hourgrid">
        {hours.map((h) => {
          const evs = eventsForHour(h);
          return (
            <div
              key={h}
              className="hourrow"
              data-hour={h}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const frac = (e.clientY - rect.top) / rect.height;
                const minute = frac < 0.25 ? 0 : frac < 0.5 ? 15 : frac < 0.75 ? 30 : 45;
                onAddAtHour(h, minute);
              }}
            >
              <div className="hourlabel">{pad(h)}:00</div>
              <div className="hourslot">
                {evs.map((e) => (
                  <div
                    key={e.id}
                    className={"hourevent" + (draggingId === e.id ? " dragging" : "") + (e.done ? " ev-done-chip" : "")}
                    style={{ background: e.color, opacity: e.done ? 0.5 : 1 }}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      startDrag(ev, e);
                    }}
                    onTouchStart={(ev) => {
                      ev.stopPropagation();
                      startDrag(ev, e);
                    }}
                  >
                    <button
                      className={"evcheck light" + (e.done ? " checked" : "")}
                      onClick={(ev) => { ev.stopPropagation(); onToggleDone(e.id); }}
                    >{e.done ? "✓" : ""}</button>
                    <span className="houreventtime">{e.time}</span>
                    <span className="houreventtitle" style={{ textDecoration: e.done ? "line-through" : "none" }}>{e.title}</span>
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


function DayPanel({ date, events, presets, onQuickAdd, onAddCustom, onEdit, onDelete, onToggleDone, presetOnly }) {
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
              <div key={e.id} className={"evitem" + (e.done ? " ev-done" : "")} onClick={() => onEdit(e)}>
                <button
                  className={"evcheck" + (e.done ? " checked" : "")}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onToggleDone(e.id);
                  }}
                  title="完了にする"
                >
                  {e.done ? "✓" : ""}
                </button>
                <span className="evcolor" style={{ background: e.color, opacity: e.done ? 0.4 : 1 }} />
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
      <div className="dateweekdayhint">{fmtJpDate(parseDate(date))}</div>
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

const CLOTHING_TYPES = [
  { type: "hat",    label: "🧢 帽子" },
  { type: "top",    label: "👕 上"   },
  { type: "bottom", label: "👖 下"   },
  { type: "shoes",  label: "👟 靴"   },
];

function ClothingTab({ logs, setLogs, presets, setPresets }) {
  const [date, setDate] = useState(fmtDate(new Date()));
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [showAdd, setShowAdd] = useState(null);
  const [showStats, setShowStats] = useState(false);

  // ドラッグ状態（セクション間移動用）
  const [dragging, setDragging] = useState(null); // { id, name, color, fromType }
  const [overType, setOverType] = useState(null);  // ドロップ先のtype

  const dayLogs = useMemo(() => logs.filter((l) => l.date === date), [logs, date]);

  function addLog(type, name, color) {
    setLogs((prev) => [...prev, { id: uid(), date, type, name, color }]);
  }
  function deleteLog(id) {
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }
  function moveLog(id, toType) {
    setLogs((prev) => prev.map((l) => l.id === id ? { ...l, type: toType } : l));
  }

  function startItemDrag(e, log) {
    e.preventDefault();
    setDragging({ id: log.id, name: log.name, color: log.color, fromType: log.type });
  }

  useEffect(() => {
    if (!dragging) return;
    function onUp() {
      if (overType && overType !== dragging.fromType) {
        moveLog(dragging.id, overType);
      }
      setDragging(null);
      setOverType(null);
    }
    window.addEventListener("pointerup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragging, overType]);

  const clothingSwipe = useSwipe(
    () => setDate(fmtDate(addDays(parseDate(date), 1))),
    () => setDate(fmtDate(addDays(parseDate(date), -1))),
  );

  return (
    <div className="tabcontent" onTouchStart={clothingSwipe.onTouchStart} onTouchEnd={clothingSwipe.onTouchEnd}>
      <div className="navrow">
        <button className="navbtn" onClick={() => setDate(fmtDate(addDays(parseDate(date), -1)))}>‹</button>
        <div className="navlabel" onClick={() => setDate(fmtDate(new Date()))}>
          {fmtJpDate(parseDate(date))}
        </div>
        <button className="navbtn" onClick={() => setDate(fmtDate(addDays(parseDate(date), 1)))}>›</button>
      </div>

      <div className="toprow-actions">
        <button className="btn ghost small" onClick={() => setShowPresetManager(true)}>⚙️ 項目管理</button>
        <button className="btn ghost small" onClick={() => setShowStats(true)}>📊 集計を見る</button>
      </div>

      {dragging && (
        <div className="drag-hint">「{dragging.name}」を移動中… 移動先のセクションの上でドロップ</div>
      )}

      {CLOTHING_TYPES.map(({ type, label }) => (
        <ClothingSection
          key={type}
          label={label}
          type={type}
          items={dayLogs.filter((l) => l.type === type)}
          presets={presets.filter((p) => p.type === type)}
          onQuickAdd={(p) => addLog(type, p.name, p.color)}
          onAddCustom={() => setShowAdd(type)}
          onDelete={deleteLog}
          dragging={dragging}
          isOver={overType === type}
          onDragEnter={() => dragging && setOverType(type)}
          onItemDragStart={startItemDrag}
        />
      ))}

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

function ClothingSection({ label, type, items, presets, onQuickAdd, onAddCustom, onDelete, dragging, isOver, onDragEnter, onItemDragStart }) {
  return (
    <div
      className={"daypanel" + (isOver && dragging && dragging.fromType !== type ? " drop-target" : "")}
      onPointerEnter={onDragEnter}
      onTouchMove={(e) => {
        // タッチ中は座標からこのセクションに入ったか判定
        const pt = e.touches[0];
        const rect = e.currentTarget.getBoundingClientRect();
        if (pt.clientY >= rect.top && pt.clientY <= rect.bottom) {
          onDragEnter();
        }
      }}
    >
      <div className="daypanel-title">{label}</div>
      {items.length === 0 && (
        <div className={"empty" + (isOver && dragging && dragging.fromType !== type ? " drop-hint" : "")}>
          {isOver && dragging && dragging.fromType !== type ? "ここにドロップ" : "記録がありません"}
        </div>
      )}
      <div className="evlist">
        {items.map((l) => (
          <div
            key={l.id}
            className={"evitem" + (dragging && dragging.id === l.id ? " dragging" : "")}
            style={{ touchAction: "none" }}
            onPointerDown={(e) => onItemDragStart(e, l)}
            onTouchStart={(e) => onItemDragStart(e, l)}
          >
            <span className="draghandle" style={{ fontSize: 14, color: "#ccc" }}>⋮⋮</span>
            <span className="evcolor" style={{ background: l.color }} />
            <span className="evtitle">{l.name}</span>
            <button className="evdel" onPointerDown={(e) => e.stopPropagation()} onClick={() => onDelete(l.id)}>✕</button>
          </div>
        ))}
        {isOver && dragging && dragging.fromType !== type && items.length > 0 && (
          <div className="drop-indicator">↓ ここにドロップ</div>
        )}
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
        <button className="presetchip addchip" onClick={onAddCustom}>＋ 追加</button>
      </div>
    </div>
  );
}

function ClothingAddModal({ type, onCancel, onSave }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(CLOTHING_COLORS[0]);
  return (
    <Modal onClose={onCancel}>
      <h3>{type === "top" ? "上を追加" : type === "bottom" ? "下を追加" : type === "hat" ? "帽子を追加" : "靴を追加"}</h3>
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
                <option value="hat">帽子</option>
                <option value="shoes">靴</option>
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
          <option value="hat">帽子</option>
          <option value="shoes">靴</option>
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
  const [period, setPeriod] = useState("all"); // week | month | all
  const [type, setType] = useState("all"); // all | top | bottom

  const stats = useMemo(() => {
    const now = new Date();
    let from = null;
    if (period === "week") from = startOfWeek(now);
    if (period === "month") from = new Date(now.getFullYear(), now.getMonth(), 1);

    const filtered = logs.filter((l) => {
      if (!l.date || !l.name || !l.type) return false;
      if (type !== "all" && l.type !== type) return false;
      if (from) {
        try { if (parseDate(l.date) < from) return false; } catch { return false; }
      }
      return true;
    });

    const map = {};
    filtered.forEach((l) => {
      const key = l.type + "|" + l.name + "|" + (l.color || "");
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
            ["hat", "帽子"],
            ["shoes", "靴"],
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
          <div key={s.type + s.name + s.color} className="statsitem">
            <span className="evcolor" style={{ background: s.color }} />
            <span className="evtitle">
              {s.name}
              <span className="statstype">{s.type === "top" ? "（上）" : s.type === "bottom" ? "（下）" : s.type === "hat" ? "（帽子）" : "（靴）"}</span>
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

/* ===================== 車タブ ===================== */

const CAR_COLOR = "#ef5350";

function CarTab({ fuel, setFuel, trips, setTrips, maintenance, setMaintenance, carPresets, setCarPresets, onAddEvent, setEvents }) {
  const [subTab, setSubTab] = useState("fuel");
  const [showPresets, setShowPresets] = useState(false);

  function addFuel(entry) { setFuel((p) => [{ id: uid(), ...entry }, ...p]); }
  function delFuel(id)    { setFuel((p) => p.filter((x) => x.id !== id)); }
  function updFuel(id, entry) { setFuel((p) => p.map((x) => x.id === id ? { ...x, ...entry } : x)); }
  function addTrip(entry) { setTrips((p) => [{ id: uid(), ...entry }, ...p]); }
  function delTrip(id)    { setTrips((p) => p.filter((x) => x.id !== id)); }
  function updTrip(id, entry) { setTrips((p) => p.map((x) => x.id === id ? { ...x, ...entry } : x)); }
  function addMaint(entry, linkCal) {
    const newId = uid();
    let calEventId = null;
    if (linkCal && entry.nextDate) {
      calEventId = onAddEvent({ date: entry.nextDate, title: "🔧【次回】" + entry.title, color: "#212121", time: entry.nextTime || "" });
    }
    setMaintenance((p) => [{ id: newId, ...entry, calEventId }, ...p]);
  }
  function delMaint(id) {
    // カレンダー側も連動削除
    const target = maintenance.find((x) => x.id === id);
    if (target?.calEventId && setEvents) {
      setEvents((prev) => prev.filter((e) => e.id !== target.calEventId));
    }
    setMaintenance((p) => p.filter((x) => x.id !== id));
  }
  function updMaint(id, entry, linkCal) {
    let calEventId = null;
    if (linkCal && entry.nextDate) {
      calEventId = onAddEvent({ date: entry.nextDate, title: "🔧【次回】" + entry.title, color: "#212121", time: entry.nextTime || "" });
    }
    setMaintenance((p) => p.map((x) => x.id === id ? { ...x, ...entry, calEventId: calEventId ?? x.calEventId } : x));
  }

  return (
    <div className="tabcontent">
      <div className="car-subtab-row">
        {[["fuel","⛽ ガソリン"],["trip","📍 走行"],["maintenance","🔧 メンテ"]].map(([v,l]) => (
          <button key={v} className={subTab === v ? "car-subtab active" : "car-subtab"} onClick={() => setSubTab(v)}>{l}</button>
        ))}
      </div>
      <div style={{textAlign:"right", marginBottom: 10}}>
        <button className="btn ghost small" onClick={() => setShowPresets(true)}>⚙️ 定型文管理</button>
      </div>
      {subTab === "fuel"        && <FuelTab        logs={fuel}        onAdd={addFuel}  onDel={delFuel}  onUpd={updFuel}  presets={carPresets?.fuel || []}        />}
      {subTab === "trip"        && <TripTab        logs={trips}       onAdd={addTrip}  onDel={delTrip}  onUpd={updTrip}  presets={carPresets?.trip || []}        />}
      {subTab === "maintenance" && <MaintenanceTab logs={maintenance} onAdd={addMaint} onDel={delMaint} onUpd={updMaint} presets={carPresets?.maintenance || []} />}
      {showPresets && (
        <CarPresetManagerModal
          presets={carPresets}
          onClose={() => setShowPresets(false)}
          onSave={(p) => setCarPresets(p)}
        />
      )}
    </div>
  );
}

/* ---- ⛽ ガソリン ---- */
function FuelTab({ logs, onAdd, onDel, onUpd, presets }) {
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const totalLiters = logs.reduce((s, l) => s + Number(l.liters || 0), 0);
  const totalCost   = logs.reduce((s, l) => s + Number(l.totalPrice || 0), 0);
  // 燃費: ODOが入力されている連続したエントリ間で計算
  const sortedLogs = [...logs].sort((a,b) => a.date.localeCompare(b.date));
  const feList = sortedLogs.map((l, i) => {
    if (!l.odo || i === 0) return null;
    const prev = sortedLogs.slice(0, i).reverse().find((x) => x.odo);
    if (!prev) return null;
    const km = Number(l.odo) - Number(prev.odo);
    const lt = Number(l.liters);
    if (km <= 0 || lt <= 0) return null;
    return { id: l.id, fe: (km / lt).toFixed(1) };
  }).filter(Boolean);
  const feMap = Object.fromEntries(feList.map((x) => [x.id, x.fe]));
  const avgFe = feList.length
    ? (feList.reduce((s, x) => s + Number(x.fe), 0) / feList.length).toFixed(1)
    : null;

  return (
    <div>
      {logs.length > 0 && (
        <div className="car-summary">
          <div style={{display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap"}}>
            <div className="car-stat"><div className="car-stat-val">{totalLiters.toFixed(1)}<span className="car-stat-unit">L</span></div><div className="car-stat-label">累計給油量</div></div>
            <div className="car-stat"><div className="car-stat-val">¥{totalCost.toLocaleString()}</div><div className="car-stat-label">累計費用</div></div>
            {avgFe && <div className="car-stat"><div className="car-stat-val">{avgFe}<span className="car-stat-unit">km/L</span></div><div className="car-stat-label">平均燃費</div></div>}
          </div>
        </div>
      )}
      <button className="car-add-btn" onClick={() => setShowModal(true)}>＋ 給油記録を追加</button>
      <div className="car-list">
        {logs.map((l) => (
          <div key={l.id} className="car-item" onClick={() => setEditItem(l)} style={{cursor:"pointer"}}>
            <div className="car-item-date">{fmtJpDate(parseDate(l.date), true)} {l.store && <span className="car-item-sub">{l.store}</span>}</div>
            <div className="car-item-row">
              <span className="car-chip blue">{Number(l.liters).toFixed(1)}L</span>
              <span className="car-chip green">¥{Number(l.totalPrice).toLocaleString()}</span>
              <span className="car-chip gray">@¥{(Number(l.totalPrice)/Number(l.liters)).toFixed(1)}/L</span>
              {feMap[l.id] && <span className="car-chip orange">{feMap[l.id]}km/L</span>}
              <button className="evdel" onClick={(e) => { e.stopPropagation(); onDel(l.id); }}>✕</button>
            </div>
            {l.odo && <div className="car-item-memo">ODO: {Number(l.odo).toLocaleString()} km</div>}
          </div>
        ))}
      </div>
      {showModal && (
        <FuelModal presets={presets} onCancel={() => setShowModal(false)} onSave={(d) => { onAdd(d); setShowModal(false); }} />
      )}
      {editItem && (
        <FuelModal
          presets={presets}
          initial={editItem}
          onCancel={() => setEditItem(null)}
          onSave={(d) => { onUpd(editItem.id, d); setEditItem(null); }}
          onDelete={() => { onDel(editItem.id); setEditItem(null); }}
        />
      )}
    </div>
  );
}

function FuelModal({ initial, presets, onCancel, onSave, onDelete }) {
  const [date, setDate]     = useState(initial?.date || fmtDate(new Date()));
  const [store, setStore]   = useState(initial?.store || "");
  const [liters, setLiters] = useState(initial?.liters || "");
  const [total, setTotal]   = useState(initial?.totalPrice || "");
  const [odo, setOdo]       = useState(initial?.odo || "");
  const isEdit = !!initial;
  const perLiter = liters && total ? (Number(total) / Number(liters)).toFixed(1) : null;

  return (
    <Modal onClose={onCancel}>
      <h3>⛽ 給油記録{isEdit ? "を編集" : ""}</h3>
      <label className="flabel">日付</label>
      <input type="date" className="finput" value={date} onChange={(e) => setDate(e.target.value)} />
      <div className="dateweekdayhint">{date && fmtJpDate(parseDate(date))}</div>
      <label className="flabel">店舗名（任意）</label>
      {presets.length > 0 && (
        <div className="presetrow" style={{margin:"6px 0"}}>
          {presets.map((p) => (
            <button key={p.id} className="presetchip addchip" style={{background:"#e3f2fd",color:"#1565c0"}} onClick={() => setStore(p.name)}>{p.name}</button>
          ))}
        </div>
      )}
      <input type="text" className="finput" value={store} onChange={(e) => setStore(e.target.value)} placeholder="例：コスモ石油〇〇店" />
      <label className="flabel">ODOメーター（km・任意）</label>
      <input type="number" className="finput" value={odo} onChange={(e) => setOdo(e.target.value)} placeholder="例：12500" min="0" />
      <label className="flabel">給油量（L）</label>
      <input type="number" className="finput" value={liters} onChange={(e) => setLiters(e.target.value)} placeholder="0.0" step="0.1" min="0" />
      <label className="flabel">合計金額（円）</label>
      <input type="number" className="finput" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0" min="0" />
      {perLiter && <div className="car-calc-hint">1リッター ≈ ¥{perLiter}</div>}
      <div className="modalbtns">
        {isEdit && <button className="btn danger" onClick={onDelete}>削除</button>}
        <button className="btn ghost" onClick={onCancel}>キャンセル</button>
        <button className="btn primary" disabled={!liters || !total} onClick={() => onSave({ date, store, liters, totalPrice: total, odo })}>保存</button>
      </div>
    </Modal>
  );
}

/* ---- 📍 走行 ---- */
function TripTab({ logs, onAdd, onDel, onUpd, presets }) {
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [statPeriod, setStatPeriod] = useState("month");

  const now = new Date();
  const statsFiltered = useMemo(() => {
    return logs.filter((l) => {
      if (!l.date) return false;
      const d = parseDate(l.date);
      if (statPeriod === "day")   return fmtDate(d) === fmtDate(now);
      if (statPeriod === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      if (statPeriod === "year")  return d.getFullYear() === now.getFullYear();
      return true;
    });
  }, [logs, statPeriod]);

  const totalKm = statsFiltered.reduce((s, l) => s + Math.max(0, Number(l.endOdo||0) - Number(l.startOdo||0)), 0);

  return (
    <div>
      <div className="car-summary">
        <div className="viewswitch small" style={{ marginBottom: 8 }}>
          {[["day","今日"],["month","今月"],["year","今年"]].map(([v,l]) => (
            <button key={v} className={statPeriod===v?"vbtn active":"vbtn"} onClick={() => setStatPeriod(v)}>{l}</button>
          ))}
        </div>
        <div className="car-stat"><div className="car-stat-val">{totalKm.toLocaleString()}<span className="car-stat-unit">km</span></div><div className="car-stat-label">走行距離</div></div>
      </div>
      <button className="car-add-btn" onClick={() => setShowModal(true)}>＋ 走行記録を追加</button>
      <div className="car-list">
        {logs.map((l) => {
          const km = Math.max(0, Number(l.endOdo||0) - Number(l.startOdo||0));
          return (
            <div key={l.id} className="car-item" onClick={() => setEditItem(l)} style={{cursor:"pointer"}}>
              <div className="car-item-date">{fmtJpDate(parseDate(l.date), true)} {l.memo && <span className="car-item-sub">{l.memo}</span>}</div>
              <div className="car-item-row">
                <span className="car-chip gray">{Number(l.startOdo).toLocaleString()}km →</span>
                <span className="car-chip gray">{Number(l.endOdo).toLocaleString()}km</span>
                <span className="car-chip blue">+{km.toLocaleString()}km</span>
                <button className="evdel" onClick={(e) => { e.stopPropagation(); onDel(l.id); }}>✕</button>
              </div>
            </div>
          );
        })}
      </div>
      {showModal && (
        <TripModal presets={presets} onCancel={() => setShowModal(false)} onSave={(d) => { onAdd(d); setShowModal(false); }} />
      )}
      {editItem && (
        <TripModal
          presets={presets}
          initial={editItem}
          onCancel={() => setEditItem(null)}
          onSave={(d) => { onUpd(editItem.id, d); setEditItem(null); }}
          onDelete={() => { onDel(editItem.id); setEditItem(null); }}
        />
      )}
    </div>
  );
}

function TripModal({ initial, presets, onCancel, onSave, onDelete }) {
  const [date, setDate]      = useState(initial?.date || fmtDate(new Date()));
  const [startOdo, setStart] = useState(initial?.startOdo || "");
  const [endOdo, setEnd]     = useState(initial?.endOdo || "");
  const [memo, setMemo]      = useState(initial?.memo || "");
  const isEdit = !!initial;
  const km = startOdo && endOdo ? Math.max(0, Number(endOdo) - Number(startOdo)) : null;

  return (
    <Modal onClose={onCancel}>
      <h3>📍 走行記録{isEdit ? "を編集" : ""}</h3>
      <label className="flabel">日付</label>
      <input type="date" className="finput" value={date} onChange={(e) => setDate(e.target.value)} />
      <div className="dateweekdayhint">{date && fmtJpDate(parseDate(date))}</div>
      <label className="flabel">スタート（ODO km）</label>
      <input type="number" className="finput" value={startOdo} onChange={(e) => setStart(e.target.value)} placeholder="例：12000" min="0" />
      <label className="flabel">エンド（ODO km）</label>
      <input type="number" className="finput" value={endOdo} onChange={(e) => setEnd(e.target.value)} placeholder="例：12150" min="0" />
      {km !== null && <div className="car-calc-hint">走行距離：{km.toLocaleString()} km</div>}
      <label className="flabel">メモ（目的地・移動場所など）</label>
      {presets.length > 0 && (
        <div className="presetrow" style={{margin:"6px 0"}}>
          {presets.map((p) => (
            <button key={p.id} className="presetchip addchip" style={{background:"#e8f5e9",color:"#2e7d32"}} onClick={() => setMemo(p.name)}>{p.name}</button>
          ))}
        </div>
      )}
      <input type="text" className="finput" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="例：大阪→東京" />
      <div className="modalbtns">
        {isEdit && <button className="btn danger" onClick={onDelete}>削除</button>}
        <button className="btn ghost" onClick={onCancel}>キャンセル</button>
        <button className="btn primary" disabled={!startOdo || !endOdo} onClick={() => onSave({ date, startOdo, endOdo, memo })}>保存</button>
      </div>
    </Modal>
  );
}

function MaintenanceTab({ logs, onAdd, onDel, onUpd, presets }) {
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);

  return (
    <div>
      <button className="car-add-btn" onClick={() => setShowModal(true)}>＋ メンテナンス記録を追加</button>
      <div className="car-list">
        {logs.map((l) => (
          <div key={l.id} className="car-item" onClick={() => setEditItem(l)} style={{cursor:"pointer"}}>
            <div className="car-item-date">
              {fmtJpDate(parseDate(l.date), true)}
              {l.cost && <span className="car-chip green" style={{marginLeft:8}}>¥{Number(l.cost).toLocaleString()}</span>}
            </div>
            <div className="car-item-title">🔧 {l.title} {l.calEventId && <span style={{fontSize:11,color:"#4fc3f7"}}>📅連携中</span>}</div>
            {l.memo && <div className="car-item-memo">{l.memo}</div>}
            {l.nextDate && <div className="car-item-next">次回: {fmtJpDate(parseDate(l.nextDate), true)}</div>}
            <button className="evdel" style={{marginTop:4}} onClick={(e) => { e.stopPropagation(); onDel(l.id); }}>✕</button>
          </div>
        ))}
      </div>
      {showModal && (
        <MaintenanceModal presets={presets} onCancel={() => setShowModal(false)} onSave={(d, link) => { onAdd(d, link); setShowModal(false); }} />
      )}
      {editItem && (
        <MaintenanceModal
          presets={presets}
          initial={editItem}
          onCancel={() => setEditItem(null)}
          onSave={(d, link) => { onUpd(editItem.id, d, link); setEditItem(null); }}
          onDelete={() => { onDel(editItem.id); setEditItem(null); }}
        />
      )}
    </div>
  );
}

function MaintenanceModal({ initial, presets, onCancel, onSave, onDelete }) {
  const [date, setDate]       = useState(initial?.date || fmtDate(new Date()));
  const [title, setTitle]     = useState(initial?.title || "");
  const [cost, setCost]       = useState(initial?.cost || "");
  const [memo, setMemo]       = useState(initial?.memo || "");
  const [nextDate, setNext]   = useState(initial?.nextDate || "");
  const [nextTime, setNextTime] = useState(initial?.nextTime || "");
  const [linkCal, setLinkCal] = useState(!initial);
  const isEdit = !!initial;

  return (
    <Modal onClose={onCancel}>
      <h3>🔧 メンテナンス記録{isEdit ? "を編集" : ""}</h3>
      <label className="flabel">日付</label>
      <input type="date" className="finput" value={date} onChange={(e) => setDate(e.target.value)} />
      <div className="dateweekdayhint">{date && fmtJpDate(parseDate(date))}</div>
      <label className="flabel">内容</label>
      {presets.length > 0 && (
        <div className="presetrow" style={{margin:"6px 0"}}>
          {presets.map((p) => (
            <button key={p.id} className="presetchip addchip" style={{background:"#fce4ec",color:"#c62828"}} onClick={() => setTitle(p.name)}>{p.name}</button>
          ))}
        </div>
      )}
      <input type="text" className="finput" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：オイル交換、タイヤ交換" />
      <label className="flabel">費用（円・任意）</label>
      <input type="number" className="finput" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" min="0" />
      <label className="flabel">次回予定日（任意）</label>
      <input type="date" className="finput" value={nextDate} onChange={(e) => setNext(e.target.value)} />
      {nextDate && <div className="dateweekdayhint">{fmtJpDate(parseDate(nextDate))}</div>}
      <label className="flabel">次回予定時刻（任意）</label>
      <input type="time" className="finput" value={nextTime} onChange={(e) => setNextTime(e.target.value)} />
      <label className="flabel">メモ（任意）</label>
      <input type="text" className="finput" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="例：交換後の状態など" />
      <div className="cal-link-row">
        <label className="cal-link-label">
          <input type="checkbox" checked={linkCal} onChange={(e) => setLinkCal(e.target.checked)} />
          　予定カレンダーにも追加する
        </label>
      </div>
      <div className="modalbtns">
        {isEdit && <button className="btn danger" onClick={onDelete}>削除</button>}
        <button className="btn ghost" onClick={onCancel}>キャンセル</button>
        <button className="btn primary" disabled={!title.trim()} onClick={() => onSave({ date, title: title.trim(), cost, memo, nextDate, nextTime }, linkCal)}>保存</button>
      </div>
    </Modal>
  );
}


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

function TimeSlotPresetModal({ time, presets, onCancel, onQuickAdd, onCustom }) {
  return (
    <Modal onClose={onCancel}>
      <h3>{time} の予定を追加</h3>
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
        <button className="presetchip addchip" onClick={onCustom}>
          ＋ カスタム入力
        </button>
      </div>
      <div className="modalbtns">
        <button className="btn ghost" onClick={onCancel}>キャンセル</button>
      </div>
    </Modal>
  );
}

function PresetTimeModal({ preset, onCancel, onSave }) {
  const [time, setTime] = useState("");
  return (
    <Modal onClose={onCancel}>
      <h3>「{preset.name}」の時刻</h3>
      <label className="flabel">時刻（任意・指定しなければ終日になります）</label>
      <input
        type="time"
        className="finput"
        value={time}
        onChange={(e) => setTime(e.target.value)}
      />
      <div className="modalbtns">
        <button className="btn ghost" onClick={onCancel}>キャンセル</button>
        <button className="btn primary" onClick={() => onSave(time)}>
          保存
        </button>
      </div>
    </Modal>
  );
}

function CarPresetManagerModal({ presets, onClose, onSave }) {
  const [local, setLocal] = useState({ ...presets });
  const CATS = [
    { key: "fuel",        label: "⛽ 給油店舗" },
    { key: "trip",        label: "📍 目的地・用途" },
    { key: "maintenance", label: "🔧 メンテ内容" },
  ];

  function addItem(key, name) {
    if (!name.trim()) return;
    const next = { ...local, [key]: [...(local[key] || []), { id: uid(), name: name.trim() }] };
    setLocal(next);
    onSave(next);
  }
  function removeItem(key, id) {
    const next = { ...local, [key]: (local[key] || []).filter((x) => x.id !== id) };
    setLocal(next);
    onSave(next);
  }

  return (
    <Modal onClose={onClose}>
      <h3>🚗 定型文の管理</h3>
      {CATS.map(({ key, label }) => (
        <div key={key} style={{ marginBottom: 16 }}>
          <div className="daypanel-title">{label}</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:6 }}>
            {(local[key] || []).map((p) => (
              <div key={p.id} className="presetchip addchip" style={{ display:"flex", alignItems:"center", gap:4 }}>
                {p.name}
                <button style={{ border:"none", background:"transparent", color:"#999", cursor:"pointer", padding:0 }}
                  onClick={() => removeItem(key, p.id)}>✕</button>
              </div>
            ))}
          </div>
          <CarPresetAddRow onAdd={(name) => addItem(key, name)} />
        </div>
      ))}
      <div className="modalbtns">
        <button className="btn ghost" onClick={onClose}>閉じる</button>
      </div>
    </Modal>
  );
}

function CarPresetAddRow({ onAdd }) {
  const [name, setName] = useState("");
  return (
    <div style={{ display:"flex", gap:6 }}>
      <input className="finput inline" value={name} onChange={(e) => setName(e.target.value)} placeholder="新しい項目名" />
      <button className="btn primary" style={{ flex:"0 0 auto", padding:"8px 12px", fontSize:13 }}
        disabled={!name.trim()} onClick={() => { onAdd(name); setName(""); }}>追加</button>
    </div>
  );
}

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
        width: 100%;
        max-width: 100%;
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
      .modalbox {
        background: #fff;
        width: 100%;
        max-width: 100%;
        border-radius: 16px 16px 0 0;
        padding: 18px;
        max-height: 85vh;
        overflow-y: auto;
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
      .swipeable { touch-action: pan-y; user-select: none; }

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
        touch-action: none;
        cursor: grab;
      }
      .hourevent.dragging, .evitem.dragging {
        opacity: 0.5;
        outline: 2px dashed #4fc3f7;
      }
      .allday-section .evitem { touch-action: none; cursor: grab; }
      .allday-label { display: block; }
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
      .evcheck {
        width: 22px; height: 22px; border-radius: 50%;
        border: 2px solid #ccc; background: #fff;
        font-size: 12px; color: #4caf50; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        padding: 0; cursor: pointer;
      }
      .evcheck.checked { background: #e8f5e9; border-color: #4caf50; }
      .evcheck.light { background: rgba(255,255,255,0.25); border-color: rgba(255,255,255,0.6); color: #fff; }
      .evcheck.light.checked { background: rgba(255,255,255,0.5); }
      .ev-done .evtitle { text-decoration: line-through; opacity: 0.5; }
      .ev-done .evtime { opacity: 0.4; }
      .ev-done-chip .houreventtitle { opacity: 0.6; }
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
      .dateweekdayhint { font-size: 12px; color: #4fc3f7; font-weight: bold; margin-top: 4px; }
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

      .drop-target {
        outline: 2px dashed #4fc3f7;
        background: #e3f6fd;
      }
      .drop-indicator {
        color: #4fc3f7; font-size: 12px; text-align: center;
        padding: 6px; border: 1px dashed #4fc3f7; border-radius: 8px; margin-top: 4px;
      }
      .drop-hint { color: #4fc3f7 !important; }
      .drag-hint {
        background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px;
        padding: 8px 12px; font-size: 12px; margin-bottom: 8px; text-align: center;
      }
      .statsfilters { display: flex; flex-direction: column; gap: 6px; margin: 10px 0; }
      .car-subtab-row {
        display: flex;
        gap: 6px;
        margin-bottom: 10px;
      }
      .car-subtab {
        flex: 1;
        padding: 10px 4px;
        border: 1px solid #ddd;
        background: #fff;
        border-radius: 10px;
        font-size: 12px;
        color: #555;
        white-space: nowrap;
        text-align: center;
      }
      .car-subtab.active {
        background: #4fc3f7;
        color: #fff;
        border-color: #4fc3f7;
        font-weight: bold;
      }
      .car-summary {
        background: #fff; border-radius: 10px; padding: 14px;
        margin-bottom: 12px; display: flex; flex-direction: column; gap: 8px;
      }
      .car-stat { text-align: center; }
      .car-stat-val { font-size: 26px; font-weight: bold; color: #333; }
      .car-stat-unit { font-size: 14px; color: #888; margin-left: 2px; }
      .car-stat-label { font-size: 11px; color: #999; margin-top: 2px; }
      .car-add-btn {
        width: 100%; padding: 12px; border: 2px dashed #ccc;
        background: #fff; border-radius: 10px; font-size: 14px; color: #555;
        margin-bottom: 12px; cursor: pointer;
      }
      .car-list { display: flex; flex-direction: column; gap: 10px; }
      .car-item {
        background: #fff; border-radius: 10px; padding: 12px 14px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      }
      .car-item-date { font-size: 12px; color: #888; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .car-item-title { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
      .car-item-sub { color: #aaa; }
      .car-item-memo { font-size: 12px; color: #777; margin-top: 4px; }
      .car-item-next { font-size: 12px; color: #ff7043; margin-top: 4px; }
      .car-item-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
      .car-chip {
        padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;
      }
      .car-chip.blue  { background: #e3f2fd; color: #1565c0; }
      .car-chip.green { background: #e8f5e9; color: #2e7d32; }
      .car-chip.orange { background: #fff3e0; color: #e65100; }
      .car-calc-hint {
        font-size: 13px; color: #4fc3f7; font-weight: bold;
        margin-top: 6px; padding: 8px; background: #e3f6fd; border-radius: 8px; text-align: center;
      }
      .cal-link-row { margin-top: 12px; font-size: 13px; color: #555; }
      .cal-link-label { display: flex; align-items: center; gap: 4px; }
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
