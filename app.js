/* app.js */
document.addEventListener("DOMContentLoaded", () => {
  const eventsList = document.getElementById("events-list");
  const calendarGrid = document.getElementById("calendar-grid");
  const nextUpList = document.getElementById("next-up-list");
  const lastUpdated = document.getElementById("last-updated");
  const filterStart = document.getElementById("filter-start");
  const filterEnd = document.getElementById("filter-end");
  const filterVenue = document.getElementById("filter-venue");
  const applyBtn = document.getElementById("apply-range");
  const resetBtn = document.getElementById("reset-range");
  const countDisplay = document.getElementById("count");
  const calendarTitle = document.getElementById("calendar-title");
  const prevMonthBtn = document.getElementById("prev-month");
  const nextMonthBtn = document.getElementById("next-month");

  let allEvents = [];
  let filteredEvents = [];
  let currentCalDate = new Date();

  // Load the structured JSON feed
  fetch("events.json")
    .then(res => {
      if (!res.ok) throw new Error("Target file down or unreachable");
      return res.json();
    })
    .then(data => {
      allEvents = data.events || [];
      filteredEvents = [...allEvents];

      if (data.generated && lastUpdated) {
        const updateDate = new Date(data.generated);
        lastUpdated.textContent = updateDate.toLocaleDateString('en-CA', { 
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
      }

      initFilters();
      renderUI();
    })
    .catch(err => {
      console.error(err);
      if (eventsList) {
        eventsList.innerHTML = `<div class="state-msg"><strong>Sync Connection Lost</strong> Unable to communicate with JSON ledger.</div>`;
      }
    });

  function initFilters() {
    if (!filterVenue) return;
    const venues = [...new Set(allEvents.map(e => e.venue))].sort();
    venues.forEach(venue => {
      const opt = document.createElement("option");
      opt.value = venue;
      opt.textContent = venue;
      filterVenue.appendChild(opt);
    });

    if (filterStart) {
      filterStart.value = new Date().toISOString().split("T")[0];
    }
  }

  function renderUI() {
    renderMainEventsList();
    renderNextUpSidebar();
    renderCalendarPanel();
    updateCounter();
  }

  function renderMainEventsList() {
    if (!eventsList) return;
    if (filteredEvents.length === 0) {
      eventsList.innerHTML = `<div class="state-msg"><strong>Empty</strong> No live events match these parameters.</div>`;
      return;
    }

    const groups = {};
    filteredEvents.forEach(ev => {
      if (!groups[ev.date]) groups[ev.date] = [];
      groups[ev.date].push(ev);
    });

    eventsList.innerHTML = Object.keys(groups).sort().map(dateStr => {
      const displayDate = new Date(dateStr + "T00:00:00").toLocaleDateString('en-CA', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });

      const itemsHtml = groups[dateStr].map(ev => `
        <article class="event-row">
          <div class="time-meta">${ev.start}</div>
          <div class="details">
            <h3><a href="${ev.url}" target="_blank" rel="noopener">${ev.title}</a></h3>
            <div class="venue-info">${ev.venue} • <span class="hood">${ev.neighborhood}</span></div>
          </div>
          <div class="tags">
            ${ev.cost === 'free' ? '<span class="tag free">Free</span>' : ''}
            ${ev.allAges ? '<span class="tag age">All Ages</span>' : ''}
            <span class="tag dynamic">${ev.source}</span>
          </div>
        </article>
      `).join('');

      return `
        <div class="date-group">
          <h2 class="date-header">${displayDate}</h2>
          <div class="date-events">${itemsHtml}</div>
        </div>
      `;
    }).join('');
  }

  function renderNextUpSidebar() {
    if (!nextUpList) return;
    const upcoming = [...allEvents]
      .filter(e => new Date(e.date) >= new Date().setHours(0,0,0,0))
      .slice(0, 4);

    if (upcoming.length === 0) {
      nextUpList.innerHTML = `<div class="empty-msg">No entries found.</div>`;
      return;
    }

    nextUpList.innerHTML = upcoming.map(ev => `
      <div class="sidebar-item">
        <div class="item-date">${ev.date.substring(5)} @ ${ev.start}</div>
        <div class="item-title"><a href="${ev.url}" target="_blank">${ev.title}</a></div>
        <div class="item-venue">${ev.venue}</div>
      </div>
    `).join('');
  }

  function renderCalendarPanel() {
    if (!calendarGrid || !calendarTitle) return;
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    
    calendarTitle.textContent = currentCalDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const activeShowDates = new Set(allEvents.map(e => e.date));

    let html = "";
    for (let i = 0; i < firstDayIndex; i++) {
      html += `<div class="cal-day empty"></div>`;
    }

    for (let day = 1; day <= totalDays; day++) {
      const currentString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hasShow = activeShowDates.has(currentString);
      
      html += `
        <div class="cal-day ${hasShow ? 'has-events' : ''}" data-date="${currentString}">
          ${day}
        </div>
      `;
    }
    calendarGrid.innerHTML = html;
  }

  function updateCounter() {
    if (countDisplay) {
      countDisplay.textContent = `${filteredEvents.length} shows listed`;
    }
  }

  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      const start = filterStart?.value;
      const end = filterEnd?.value;
      const venue = filterVenue?.value;

      filteredEvents = allEvents.filter(ev => {
        if (start && ev.date < start) return false;
        if (end && ev.date > end) return false;
        if (venue && ev.venue !== venue) return false;
        return true;
      });
      renderUI();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (filterStart) filterStart.value = new Date().toISOString().split("T")[0];
      if (filterEnd) filterEnd.value = "";
      if (filterVenue) filterVenue.value = "";
      filteredEvents = [...allEvents];
      renderUI();
    });
  }

  if (prevMonthBtn) {
    prevMonthBtn.addEventListener("click", () => {
      currentCalDate.setMonth(currentCalDate.getMonth() - 1);
      renderCalendarPanel();
    });
  }

  if (nextMonthBtn) {
    nextMonthBtn.addEventListener("click", () => {
      currentCalDate.setMonth(currentCalDate.getMonth() + 1);
      renderCalendarPanel();
    });
  }

  if (calendarGrid) {
    calendarGrid.addEventListener("click", (e) => {
      const targetDate = e.target.getAttribute("data-date");
      if (targetDate && filterStart && filterEnd && applyBtn) {
        filterStart.value = targetDate;
        filterEnd.value = targetDate;
        applyBtn.click();
      }
    });
  }
});
