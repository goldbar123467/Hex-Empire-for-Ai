/**
 * UI initialization and event handlers
 * Handles game log, filters, statistics tabs, and status updates
 */

function getGameReplay() {
  return window.game?.replay && window.game?.board
    ? { replay: window.game.replay, board: window.game.board }
    : null;
}

function bindReplayControl(elementId, handler) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.addEventListener('click', () => {
    const context = getGameReplay();
    if (context) handler(context.replay, context.board);
  });
}

function bindReplaySlider(elementId) {
  const slider = document.getElementById(elementId);
  if (!slider) return;
  slider.addEventListener('input', function() {
    const context = getGameReplay();
    if (context) context.replay.goToTurn(parseInt(this.value, 10), context.board);
  });
}

export function resetGameLog() {
  const gamelogElement = document.getElementById('gamelog');
  if (gamelogElement) {
    gamelogElement.innerHTML = '';
  }
}

/** Creates a collapsible turn section in the game log and returns its content container. */
export function beginTurnSection(turnNumber) {
  const gamelogElement = document.getElementById('gamelog');
  if (!gamelogElement) return null;

  gamelogElement.insertAdjacentHTML('beforeend', `
    <div class="log-turn-section">
      <div class="log-turn-header">Turn ${turnNumber}</div>
      <div class="log-turn-content"></div>
    </div>
  `);

  const turnSections = gamelogElement.querySelectorAll('.log-turn-section');
  return turnSections[turnSections.length - 1].querySelector('.log-turn-content');
}

/** Syncs map controls after a map finishes loading. */
export function onMapReady(mapNumber) {
  const mapNumberInput = document.getElementById('mapNumberInput');
  if (mapNumberInput) {
    mapNumberInput.value = mapNumber;
  }

  const startBattleButton = document.getElementById('startBattleButton');
  if (startBattleButton) {
    startBattleButton.disabled = false;
  }
}

/** Updates the hidden #mapStatus copy and visible map # / turn row. displayTurn is 1-based. */
export function updateStatusBar(mapNumber, displayTurn) {
  const mapStatus = document.getElementById('mapStatus');
  const mapNumberStatus = document.getElementById('mapNumberStatus');
  const turnStatus = document.getElementById('turnStatus');
  if (mapStatus) {
    mapStatus.innerHTML = '<b>Map</b> ' + mapNumber + ', <b>Turn</b> ' + displayTurn;
  }
  if (mapNumberStatus) {
    mapNumberStatus.textContent = mapNumber;
  }
  if (turnStatus) {
    turnStatus.textContent = displayTurn;
  }
}

function getLogEntryType(entry) {
  for (const className of entry.classList) {
    if (className.startsWith('log-') && className !== 'log-entry') {
      return className.substring(4);
    }
  }
  return '';
}

function setTurnNumberVisibility(entries, visible) {
  entries.forEach(entry => {
    const turnNumberSpan = entry.querySelector('.log-turn-number');
    if (turnNumberSpan) {
      turnNumberSpan.style.display = visible ? 'inline' : 'none';
    }
  });
}

export function initializeUI() {
  const gamelogElement = document.getElementById('gamelog');
  if (gamelogElement) {
    const observer = new MutationObserver(function() {
      gamelogElement.scrollTop = gamelogElement.scrollHeight;
    });
    observer.observe(gamelogElement, { childList: true, subtree: true });
  }

  const logSearch = document.getElementById('logSearch');
  const filterButtons = document.querySelectorAll('.log-filter-btn');
  let currentFilter = 'all';
  let searchTerm = '';

  function shouldShowTurnNumbers() {
    return currentFilter !== 'all' || searchTerm.length > 0;
  }

  function applyFilters() {
    if (!gamelogElement) return;

    const showTurnNumbers = shouldShowTurnNumbers();
    const entries = gamelogElement.querySelectorAll('.log-entry');

    entries.forEach(entry => {
      const entryType = getLogEntryType(entry);
      const entryText = entry.textContent.toLowerCase();
      const turnNumber = entry.dataset.turn || '';
      const turnText = turnNumber ? `turn ${turnNumber}` : '';

      const matchesFilter = currentFilter === 'all' || entryType === currentFilter;
      const matchesSearch = !searchTerm || entryText.includes(searchTerm) || turnText.includes(searchTerm);
      entry.classList.toggle('hidden', !(matchesFilter && matchesSearch));
    });

    setTurnNumberVisibility(entries, showTurnNumbers);

    gamelogElement.querySelectorAll('.log-turn-section').forEach(section => {
      const visibleEntries = section.querySelectorAll('.log-entry:not(.hidden)');
      section.style.display = visibleEntries.length === 0 ? 'none' : 'block';
    });
  }

  const logBadge = document.getElementById('logBadge');
  if (logBadge && gamelogElement) {
    const logObserver = new MutationObserver(function() {
      const entries = gamelogElement.querySelectorAll('.log-entry');
      logBadge.textContent = entries.length;
      setTurnNumberVisibility(entries, shouldShowTurnNumbers());

      if (currentFilter !== 'all' || searchTerm) {
        applyFilters();
      }
    });
    logObserver.observe(gamelogElement, { childList: true, subtree: true });
  }

  filterButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      filterButtons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentFilter = this.dataset.filter;
      applyFilters();
    });
  });

  if (logSearch) {
    logSearch.addEventListener('input', function() {
      searchTerm = this.value.toLowerCase();
      applyFilters();
    });
  }

  if (gamelogElement) {
    gamelogElement.addEventListener('click', function(e) {
      if (!e.target.classList.contains('log-turn-header')) return;

      const content = e.target.nextElementSibling;
      if (!content?.classList.contains('log-turn-content')) return;

      e.target.classList.toggle('collapsed');
      content.classList.toggle('collapsed');
    });
  }

  const infoPanelTabs = document.querySelectorAll('.info-panel-tab');
  const infoPanelLog = document.getElementById('infoPanelLog');
  const infoPanelStats = document.getElementById('infoPanelStats');

  infoPanelTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      infoPanelTabs.forEach(t => t.classList.remove('active'));
      if (infoPanelLog) infoPanelLog.classList.remove('active');
      if (infoPanelStats) infoPanelStats.classList.remove('active');

      this.classList.add('active');

      const panelName = this.dataset.panel;
      if (panelName === 'log' && infoPanelLog) {
        infoPanelLog.classList.add('active');
      } else if (panelName === 'stats' && infoPanelStats) {
        infoPanelStats.classList.add('active');
      }
    });
  });

  const statsTabs = document.querySelectorAll('.stats-tab');
  const statsCharts = {
    cities: document.getElementById('statsChartCities'),
    army: document.getElementById('statsChartArmy'),
    territory: document.getElementById('statsChartTerritory'),
    morale: document.getElementById('statsChartMorale')
  };

  statsTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      statsTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');

      Object.values(statsCharts).forEach(chart => {
        if (chart) chart.style.display = 'none';
      });

      const tabName = this.dataset.tab;
      if (statsCharts[tabName]) {
        statsCharts[tabName].style.display = 'block';
      }
    });
  });

  bindReplayControl('replayPlayBtn', (replay, board) => replay.togglePlay(board));
  bindReplayControl('replayPrevBtn', (replay, board) => replay.previousTurn(board));
  bindReplayControl('replayNextBtn', (replay, board) => replay.nextTurn(board));
  bindReplayControl('replayExitBtn', (replay, board) => replay.exitReplay(board));
  bindReplaySlider('replaySlider');
}
