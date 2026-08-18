/**
 * B3 Plantão de Notícias - Monitor & Visualizador Institucional B3
 * Clean Light UI, Responsive Master-Detail, Modern Custom Dropdowns, Smart Document & Text-Notice Viewer
 */

(function () {
    // Default monitored tickers if empty
    const defaultMonitored = ['HGLG11', 'MXRF11', 'KNIP11', 'PETR4', 'VALE3'];
    const savedMonitored = JSON.parse(localStorage.getItem('b3_monitored_tickers') || 'null');
    
    const state = {
        agency: localStorage.getItem('b3_agency') || 'fii_only', // 'fii_only', 'acoes', 'all', 'monitored'
        period: localStorage.getItem('b3_period') || 'mes',
        customStartDate: localStorage.getItem('b3_custom_start') || null,
        customEndDate: localStorage.getItem('b3_custom_end') || null,
        calViewYear: new Date().getFullYear(),
        calViewMonth: new Date().getMonth(), // 0 to 11
        calStep: 1, // 1: picking start date, 2: picking end date
        hoveredDate: null,
        news: [],
        filteredNews: [],
        renderedCount: 0,
        pageSize: 80,
        knownIds: new Set(),
        newIds: new Set(),
        readIds: new Set(JSON.parse(localStorage.getItem('b3_read_ids') || '[]')),
        favoriteIds: new Set(JSON.parse(localStorage.getItem('b3_fav_ids') || '[]')),
        monitoredTickers: new Set(savedMonitored || defaultMonitored),
        selectedId: null,
        activeCategory: 'ALL',
        searchQuery: '',
        isFetching: false,
        soundEnabled: localStorage.getItem('b3_sound') !== 'false'
    };

    const elements = {
        dashboardWrapper: document.getElementById('dashboardWrapper'),
        btnRefresh: document.getElementById('btnRefresh'),
        refreshIcon: document.getElementById('refreshIcon'),
        btnLabel: document.getElementById('btnLabel'),
        lastUpdatedText: document.getElementById('lastUpdatedText'),
        
        // Custom Asset / Agency Dropdown
        assetDropdownContainer: document.getElementById('assetDropdownContainer'),
        btnAssetTrigger: document.getElementById('btnAssetTrigger'),
        assetTriggerIcon: document.getElementById('assetTriggerIcon'),
        assetTriggerLabel: document.getElementById('assetTriggerLabel'),
        assetTriggerChevron: document.getElementById('assetTriggerChevron'),
        assetDropdownCard: document.getElementById('assetDropdownCard'),
        
        // Custom Period Picker & Calendar Dropdown
        periodPickerContainer: document.getElementById('periodPickerContainer'),
        btnPeriodTrigger: document.getElementById('btnPeriodTrigger'),
        periodTriggerLabel: document.getElementById('periodTriggerLabel'),
        periodTriggerChevron: document.getElementById('periodTriggerChevron'),
        periodDropdownCard: document.getElementById('periodDropdownCard'),
        btnClearPeriod: document.getElementById('btnClearPeriod'),
        presetOptions: document.querySelectorAll('.preset-option'),
        periodHelperBadge: document.getElementById('periodHelperBadge'),
        calPrevMonth: document.getElementById('calPrevMonth'),
        calNextMonth: document.getElementById('calNextMonth'),
        calMonthTitle: document.getElementById('calMonthTitle'),
        calDaysGrid: document.getElementById('calDaysGrid'),

        // Custom Category Filter Dropdown
        categoryDropdownContainer: document.getElementById('categoryDropdownContainer'),
        btnCategoryTrigger: document.getElementById('btnCategoryTrigger'),
        categoryTriggerIcon: document.getElementById('categoryTriggerIcon'),
        categoryTriggerLabel: document.getElementById('categoryTriggerLabel'),
        categoryTriggerChevron: document.getElementById('categoryTriggerChevron'),
        categoryDropdownCard: document.getElementById('categoryDropdownCard'),
        btnResetCategory: document.getElementById('btnResetCategory'),

        inputSearch: document.getElementById('inputSearch'),
        btnClearSearch: document.getElementById('btnClearSearch'),
        newsList: document.getElementById('newsList'),
        panelHeading: document.getElementById('panelHeading'),
        renderedCount: document.getElementById('renderedCount'),
        loadMoreContainer: document.getElementById('loadMoreContainer'),
        btnLoadMore: document.getElementById('btnLoadMore'),
        btnMarkAllRead: document.getElementById('btnMarkAllRead'),
        statTotal: document.getElementById('statTotal'),
        statNew: document.getElementById('statNew'),
        statMonitored: document.getElementById('statMonitored'),
        statFavorites: document.getElementById('statFavorites'),
        monitoredCountBadge: document.getElementById('monitoredCountBadge'),
        btnToggleSound: document.getElementById('btnToggleSound'),
        soundIcon: document.getElementById('soundIcon'),
        
        // Viewer elements
        viewerPanel: document.getElementById('viewerPanel'),
        viewerTicker: document.getElementById('viewerTicker'),
        viewerTitle: document.getElementById('viewerTitle'),
        viewerTime: document.getElementById('viewerTime'),
        btnViewerExternal: document.getElementById('btnViewerExternal'),
        btnViewerDownload: document.getElementById('btnViewerDownload'),
        btnViewerExpand: document.getElementById('btnViewerExpand'),
        btnViewerClose: document.getElementById('btnViewerClose'),
        btnMobileBack: document.getElementById('btnMobileBack'),
        viewerPlaceholder: document.getElementById('viewerPlaceholder'),
        docLoading: document.getElementById('docLoading'),
        textNoticeView: document.getElementById('textNoticeView'),
        textNoticeTitle: document.getElementById('textNoticeTitle'),
        textNoticeContent: document.getElementById('textNoticeContent'),
        btnCopyNoticeText: document.getElementById('btnCopyNoticeText'),
        docFrame: document.getElementById('docFrame'),
        rawContentBox: document.getElementById('rawContentBox'),
        tabBtns: document.querySelectorAll('.viewer-tab'),
        toastContainer: document.getElementById('toastContainer'),

        // Watchlist Modal Elements
        watchlistModal: document.getElementById('watchlistModal'),
        btnOpenWatchlist: document.getElementById('btnOpenWatchlist'),
        btnCloseWatchlist: document.getElementById('btnCloseWatchlist'),
        btnDoneWatchlist: document.getElementById('btnDoneWatchlist'),
        inputNewTicker: document.getElementById('inputNewTicker'),
        btnAddTicker: document.getElementById('btnAddTicker'),
        monitoredListCount: document.getElementById('monitoredListCount'),
        monitoredTagsGrid: document.getElementById('monitoredTagsGrid')
    };

    // Audio chime using Web Audio API
    let audioCtx = null;
    function playChime() {
        if (!state.soundEnabled) return;
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now);
            osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.15);

            gain.gain.setValueAtTime(0.01, now);
            gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start(now);
            osc.stop(now + 0.4);
        } catch (e) {
            console.error('Audio chime error:', e);
        }
    }

    function showToast(message, type = 'info') {
        if (!elements.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'alert' ? 'toast-alert' : ''}`;
        toast.innerHTML = `<span>${message}</span>`;
        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 250);
        }, 4000);
    }

    // =========================================================================
    // Custom Asset Dropdown Logic
    // =========================================================================
    const ASSET_CONFIG = {
        'fii_only': { icon: '🏢', label: 'FIIs (Imobiliários)' },
        'acoes': { icon: '📈', label: 'Ações & Empresas' },
        'all': { icon: '🌐', label: 'Todos os Tipos' },
        'monitored': { icon: '⭐', label: 'Ativos Monitorados' }
    };

    function updateAssetTriggerLabel() {
        const conf = ASSET_CONFIG[state.agency] || ASSET_CONFIG['fii_only'];
        if (elements.assetTriggerIcon) elements.assetTriggerIcon.textContent = conf.icon;
        if (elements.assetTriggerLabel) elements.assetTriggerLabel.textContent = conf.label;

        if (elements.assetDropdownCard) {
            elements.assetDropdownCard.querySelectorAll('.custom-option').forEach(btn => {
                const val = btn.getAttribute('data-value');
                if (val === state.agency) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    }

    function toggleAssetDropdown(forceState) {
        if (!elements.assetDropdownCard) return;
        const isHidden = elements.assetDropdownCard.style.display === 'none' || !elements.assetDropdownCard.style.display;
        const shouldOpen = typeof forceState === 'boolean' ? forceState : isHidden;

        if (shouldOpen) {
            togglePeriodDropdown(false);
            toggleCategoryDropdown(false);
            elements.assetDropdownCard.style.display = 'block';
            if (elements.btnAssetTrigger) {
                elements.btnAssetTrigger.classList.add('is-open');
                elements.btnAssetTrigger.setAttribute('aria-expanded', 'true');
            }
            if (elements.assetTriggerChevron) elements.assetTriggerChevron.textContent = '▲';
        } else {
            elements.assetDropdownCard.style.display = 'none';
            if (elements.btnAssetTrigger) {
                elements.btnAssetTrigger.classList.remove('is-open');
                elements.btnAssetTrigger.setAttribute('aria-expanded', 'false');
            }
            if (elements.assetTriggerChevron) elements.assetTriggerChevron.textContent = '▼';
        }
    }

    function selectAssetAgency(agencyKey) {
        if (state.agency === agencyKey) {
            toggleAssetDropdown(false);
            return;
        }
        state.agency = agencyKey;
        state.knownIds.clear();
        state.newIds.clear();
        state.selectedId = null;

        if (elements.viewerPlaceholder) elements.viewerPlaceholder.style.display = 'flex';
        if (elements.docFrame) elements.docFrame.style.display = 'none';
        if (elements.textNoticeView) elements.textNoticeView.style.display = 'none';
        if (elements.docLoading) elements.docLoading.style.display = 'none';

        updateAssetTriggerLabel();
        saveState();
        toggleAssetDropdown(false);
        fetchNews(true);
    }

    // =========================================================================
    // Custom Category Dropdown Logic
    // =========================================================================
    const CATEGORY_ICONS = {
        'ALL': '🌐',
        'Comunicado ao Mercado': '📄',
        'Fato Relevante': '🚨',
        'Rendimentos': '💰',
        'Avisos': '📢',
        'Relatórios Gerenciais': '📊',
        'Informes Periódicos': '📑',
        'Demonstrações Financeiras': '📑',
        'Atas & Governança': '🏛️',
        'Assembleias': '📋',
        'Ofertas & Emissões': '🎯',
        'Leilões & Pregão': '⚡',
        'Dados Diários': '📈',
        'Outros': '📌',
        'FAVORITES': '⭐',
        'UNREAD': '📬'
    };

    function updateCategoryTriggerLabel() {
        const icon = CATEGORY_ICONS[state.activeCategory] || '📁';
        const label = state.activeCategory === 'ALL' ? 'Todas as Categorias' : state.activeCategory;

        if (elements.categoryTriggerIcon) elements.categoryTriggerIcon.textContent = icon;
        if (elements.categoryTriggerLabel) elements.categoryTriggerLabel.textContent = label;

        if (elements.categoryDropdownCard) {
            elements.categoryDropdownCard.querySelectorAll('.custom-option').forEach(btn => {
                const val = btn.getAttribute('data-value');
                if (val === state.activeCategory) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    }

    function toggleCategoryDropdown(forceState) {
        if (!elements.categoryDropdownCard) return;
        const isHidden = elements.categoryDropdownCard.style.display === 'none' || !elements.categoryDropdownCard.style.display;
        const shouldOpen = typeof forceState === 'boolean' ? forceState : isHidden;

        if (shouldOpen) {
            togglePeriodDropdown(false);
            toggleAssetDropdown(false);
            elements.categoryDropdownCard.style.display = 'flex';
            if (elements.btnCategoryTrigger) {
                elements.btnCategoryTrigger.classList.add('is-open');
                elements.btnCategoryTrigger.setAttribute('aria-expanded', 'true');
            }
            if (elements.categoryTriggerChevron) elements.categoryTriggerChevron.textContent = '▲';
        } else {
            elements.categoryDropdownCard.style.display = 'none';
            if (elements.btnCategoryTrigger) {
                elements.btnCategoryTrigger.classList.remove('is-open');
                elements.btnCategoryTrigger.setAttribute('aria-expanded', 'false');
            }
            if (elements.categoryTriggerChevron) elements.categoryTriggerChevron.textContent = '▼';
        }
    }

    function selectCategoryOption(catKey) {
        state.activeCategory = catKey;
        updateCategoryTriggerLabel();
        toggleCategoryDropdown(false);
        applyFiltersAndRender(true);
    }

    // =========================================================================
    // Custom Period Picker & Calendar Logic
    // =========================================================================
    const MONTH_NAMES_PT = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    function formatIso(year, month, day) {
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        return `${year}-${mm}-${dd}`;
    }

    function parseIso(isoStr) {
        if (!isoStr) return null;
        const parts = isoStr.split('-');
        if (parts.length !== 3) return null;
        return {
            year: parseInt(parts[0], 10),
            month: parseInt(parts[1], 10) - 1,
            day: parseInt(parts[2], 10)
        };
    }

    function formatBR(isoStr) {
        if (!isoStr) return '';
        const parts = isoStr.split('-');
        if (parts.length !== 3) return isoStr;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    function formatShortBR(isoStr) {
        if (!isoStr) return '';
        const parts = isoStr.split('-');
        if (parts.length !== 3) return isoStr;
        return `${parts[2]}/${parts[1]}`;
    }

    function getTodayIso() {
        const d = new Date();
        return formatIso(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function getWeekRangeIso() {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - dayOfWeek);
        const saturday = new Date(sunday);
        saturday.setDate(sunday.getDate() + 6);
        return {
            start: formatIso(sunday.getFullYear(), sunday.getMonth(), sunday.getDate()),
            end: formatIso(today.getFullYear(), today.getMonth(), today.getDate())
        };
    }

    function getMonthRangeIso(year, month) {
        const lastDay = new Date(year, month + 1, 0).getDate();
        return {
            start: formatIso(year, month, 1),
            end: formatIso(year, month, lastDay)
        };
    }

    function updatePeriodTriggerLabel() {
        if (!elements.periodTriggerLabel) return;
        if (state.period === 'hoje') {
            elements.periodTriggerLabel.textContent = 'Hoje';
        } else if (state.period === 'semana') {
            elements.periodTriggerLabel.textContent = 'Esta semana';
        } else if (state.period === 'mes') {
            elements.periodTriggerLabel.textContent = 'Este mês';
        } else if (state.period === 'todos') {
            elements.periodTriggerLabel.textContent = 'Todos';
        } else if (state.period === 'custom') {
            if (state.customStartDate && state.customEndDate) {
                if (state.customStartDate === state.customEndDate) {
                    elements.periodTriggerLabel.textContent = formatShortBR(state.customStartDate);
                } else {
                    elements.periodTriggerLabel.textContent = `${formatShortBR(state.customStartDate)} a ${formatShortBR(state.customEndDate)}`;
                }
            } else if (state.customStartDate) {
                elements.periodTriggerLabel.textContent = formatShortBR(state.customStartDate);
            } else {
                elements.periodTriggerLabel.textContent = 'Personalizado';
            }
        } else {
            elements.periodTriggerLabel.textContent = 'Este mês';
        }

        const presetButtons = document.querySelectorAll('.preset-option');
        presetButtons.forEach(btn => {
            const p = btn.getAttribute('data-period');
            if (state.period === p) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    function renderCalendar() {
        if (!elements.calDaysGrid || !elements.calMonthTitle) return;

        const year = state.calViewYear;
        const month = state.calViewMonth;

        elements.calMonthTitle.textContent = `${MONTH_NAMES_PT[month]} ${year}`;

        const firstDayWeekday = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayIso = getTodayIso();

        let rangeStart = null;
        let rangeEnd = null;

        if (state.calStep === 2 && state.customStartDate) {
            rangeStart = state.customStartDate;
            rangeEnd = state.hoveredDate || state.customStartDate;
            if (rangeEnd < rangeStart) {
                const tmp = rangeStart;
                rangeStart = rangeEnd;
                rangeEnd = tmp;
            }
        } else if (state.period === 'custom' && state.customStartDate) {
            rangeStart = state.customStartDate;
            rangeEnd = state.customEndDate || state.customStartDate;
        } else if (state.period === 'mes') {
            const mRange = getMonthRangeIso(year, month);
            rangeStart = mRange.start;
            rangeEnd = mRange.end;
        } else if (state.period === 'hoje') {
            rangeStart = todayIso;
            rangeEnd = todayIso;
        } else if (state.period === 'semana') {
            const wRange = getWeekRangeIso();
            rangeStart = wRange.start;
            rangeEnd = wRange.end;
        }

        let gridHtml = '';

        for (let i = 0; i < firstDayWeekday; i++) {
            gridHtml += `<div class="cal-day-cell is-empty"></div>`;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateIso = formatIso(year, month, d);
            const isToday = dateIso === todayIso;

            let classes = ['cal-day-cell'];
            if (isToday) classes.push('is-today');

            if (rangeStart && rangeEnd) {
                if (rangeStart === rangeEnd && dateIso === rangeStart) {
                    classes.push('is-single-selected');
                } else if (dateIso === rangeStart) {
                    classes.push('is-range-start');
                } else if (dateIso === rangeEnd) {
                    classes.push('is-range-end');
                } else if (dateIso > rangeStart && dateIso < rangeEnd) {
                    classes.push('is-in-range');
                }
            } else if (rangeStart && dateIso === rangeStart) {
                classes.push('is-range-start');
            }

            gridHtml += `<button type="button" class="${classes.join(' ')}" data-date="${dateIso}">${d}</button>`;
        }

        elements.calDaysGrid.innerHTML = gridHtml;
    }

    function togglePeriodDropdown(forceState) {
        if (!elements.periodDropdownCard) return;
        const isHidden = elements.periodDropdownCard.style.display === 'none' || !elements.periodDropdownCard.style.display;
        const shouldOpen = typeof forceState === 'boolean' ? forceState : isHidden;

        if (shouldOpen) {
            toggleAssetDropdown(false);
            toggleCategoryDropdown(false);
            elements.periodDropdownCard.style.display = 'block';
            if (elements.btnPeriodTrigger) {
                elements.btnPeriodTrigger.classList.add('is-open');
                elements.btnPeriodTrigger.setAttribute('aria-expanded', 'true');
            }
            if (elements.periodTriggerChevron) {
                elements.periodTriggerChevron.textContent = '▲';
            }

            if (state.customStartDate) {
                const p = parseIso(state.customStartDate);
                if (p) {
                    state.calViewYear = p.year;
                    state.calViewMonth = p.month;
                }
            } else {
                const now = new Date();
                state.calViewYear = now.getFullYear();
                state.calViewMonth = now.getMonth();
            }

            renderCalendar();
        } else {
            elements.periodDropdownCard.style.display = 'none';
            if (elements.btnPeriodTrigger) {
                elements.btnPeriodTrigger.classList.remove('is-open');
                elements.btnPeriodTrigger.setAttribute('aria-expanded', 'false');
            }
            if (elements.periodTriggerChevron) {
                elements.periodTriggerChevron.textContent = '▼';
            }
            state.hoveredDate = null;
            if (state.calStep === 2 && !state.customEndDate) {
                state.calStep = 1;
                if (elements.periodHelperBadge) {
                    elements.periodHelperBadge.textContent = 'Clique 1: Selecione a Data Inicial';
                }
            }
        }
    }

    function selectPresetPeriod(periodKey) {
        state.period = periodKey;
        state.customStartDate = null;
        state.customEndDate = null;
        state.calStep = 1;
        if (elements.periodHelperBadge) {
            elements.periodHelperBadge.textContent = 'Clique 1: Selecione a Data Inicial';
        }

        const now = new Date();
        state.calViewYear = now.getFullYear();
        state.calViewMonth = now.getMonth();

        updatePeriodTriggerLabel();
        renderCalendar();
        saveState();
        fetchNews(true);

        setTimeout(() => {
            togglePeriodDropdown(false);
        }, 180);
    }

    function handleCalendarDateClick(dateStr) {
        if (state.calStep === 1) {
            state.customStartDate = dateStr;
            state.customEndDate = null;
            state.calStep = 2;
            if (elements.periodHelperBadge) {
                elements.periodHelperBadge.textContent = 'Clique 2: Selecione a Data Final';
            }
            document.querySelectorAll('.preset-option').forEach(btn => btn.classList.remove('active'));
            renderCalendar();
        } else if (state.calStep === 2) {
            let start = state.customStartDate;
            let end = dateStr;

            if (end < start) {
                const tmp = start;
                start = end;
                end = tmp;
            }

            state.customStartDate = start;
            state.customEndDate = end;
            state.period = 'custom';
            state.calStep = 1;
            state.hoveredDate = null;

            if (elements.periodHelperBadge) {
                elements.periodHelperBadge.textContent = `${formatBR(start)} até ${formatBR(end)}`;
            }

            updatePeriodTriggerLabel();
            renderCalendar();
            saveState();
            fetchNews(true);

            showToast(`Período personalizado: ${formatBR(start)} a ${formatBR(end)}`, 'info');

            setTimeout(() => {
                togglePeriodDropdown(false);
            }, 300);
        }
    }

    function clearPeriod() {
        state.period = 'mes';
        state.customStartDate = null;
        state.customEndDate = null;
        state.calStep = 1;
        if (elements.periodHelperBadge) {
            elements.periodHelperBadge.textContent = 'Clique 1: Selecione a Data Inicial';
        }

        const now = new Date();
        state.calViewYear = now.getFullYear();
        state.calViewMonth = now.getMonth();

        updatePeriodTriggerLabel();
        renderCalendar();
        saveState();
        fetchNews(true);
        showToast('Filtro de período redefinido para Este mês.', 'info');
    }

    // =========================================================================
    // Category Badge Helpers
    // =========================================================================
    function getCategoryClass(category) {
        switch (category) {
            case 'Fato Relevante': return 'cat-fato';
            case 'Rendimentos': return 'cat-rendimentos';
            case 'Comunicado ao Mercado': return 'cat-comunicado';
            case 'Avisos': return 'cat-avisos';
            case 'Relatórios Gerenciais': return 'cat-relatorios';
            case 'Informes Periódicos': return 'cat-informes';
            case 'Demonstrações Financeiras': return 'cat-df';
            case 'Atas & Governança': return 'cat-governanca';
            case 'Assembleias': return 'cat-assembleia';
            case 'Ofertas & Emissões': return 'cat-ofertas';
            case 'Leilões & Pregão': return 'cat-leilao';
            case 'Dados Diários': return 'cat-dados';
            default: return 'cat-geral';
        }
    }

    // =========================================================================
    // Fetch News List
    // =========================================================================
    async function fetchNews(isUserAction = false) {
        if (state.isFetching) return;
        state.isFetching = true;
        if (elements.refreshIcon) elements.refreshIcon.classList.add('spinning');
        if (elements.btnLabel) elements.btnLabel.textContent = 'Buscando...';

        try {
            let url = `/api/noticias?agencia=${state.agency}&periodo=${state.period}`;
            if (state.period === 'custom' && state.customStartDate && state.customEndDate) {
                url += `&dataInicial=${encodeURIComponent(state.customStartDate)}&dataFinal=${encodeURIComponent(state.customEndDate)}`;
            }
            const res = await fetch(url);
            if (!res.ok) throw new Error('Falha ao conectar com o servidor.');
            const data = await res.json();
            const items = data.items || [];

            let newItemsCount = 0;
            let firstRun = state.knownIds.size === 0;

            items.forEach(item => {
                if (!state.knownIds.has(item.id)) {
                    state.knownIds.add(item.id);
                    if (!firstRun) {
                        state.newIds.add(item.id);
                        newItemsCount++;
                    }
                }
            });

            state.news = items;
            updateStats();
            applyFiltersAndRender(true);

            const now = new Date();
            const timeStr = now.toLocaleTimeString('pt-BR');
            if (elements.lastUpdatedText) {
                elements.lastUpdatedText.textContent = `Última atualização: ${timeStr}`;
            }

            if (newItemsCount > 0) {
                playChime();
                showToast(`🔔 ${newItemsCount} novo(s) comunicado(s) encontrado(s)!`, 'success');
            } else if (isUserAction) {
                showToast(`Lista atualizada (${items.length.toLocaleString('pt-BR')} comunicados).`, 'info');
            }
        } catch (err) {
            console.error('Erro ao buscar notícias:', err);
            showToast('Erro ao atualizar comunicados: ' + err.message, 'alert');
        } finally {
            state.isFetching = false;
            if (elements.refreshIcon) elements.refreshIcon.classList.remove('spinning');
            if (elements.btnLabel) elements.btnLabel.textContent = 'Atualizar';
        }
    }

    function isItemMonitored(item) {
        if (!item || !state.monitoredTickers || state.monitoredTickers.size === 0) return false;

        const itemTicker = (item.ticker || '').toUpperCase().trim();
        const headlineUpper = (item.headline || '').toUpperCase();

        // 1. Direct match on item.ticker (e.g. 'HGLG11' === 'HGLG11' or 'PETR4' === 'PETR4')
        if (itemTicker && state.monitoredTickers.has(itemTicker)) {
            return true;
        }

        // 2. Smart base matching & headline check for all monitored tickers
        for (const mon of state.monitoredTickers) {
            const monClean = mon.toUpperCase().trim();
            if (!monClean) continue;

            // Check if exact monitored string appears in headline
            if (headlineUpper.includes(monClean)) {
                return true;
            }

            // Extract base root (e.g., 'HGLG' from 'HGLG11', 'PETR' from 'PETR4', 'VALE' from 'VALE3')
            const monBase = monClean.replace(/\d+$/, '');
            const itemBase = itemTicker ? itemTicker.replace(/\d+$/, '') : '';

            // Match base root (e.g., itemTicker 'HGBS' matches monitored 'HGBS11')
            if (monBase && itemBase && monBase === itemBase) {
                return true;
            }

            // Match 4-letter base in headline (e.g., '(HGBS)' or 'FII HEDGEBS (HGBS)')
            if (monBase && monBase.length >= 4) {
                if (headlineUpper.includes(`(${monBase})`) || 
                    headlineUpper.includes(` ${monBase} `) || 
                    headlineUpper.includes(` ${monBase}-`) ||
                    headlineUpper.includes(` ${monBase}/`) ||
                    headlineUpper.includes(`FII ${monBase}`) ||
                    headlineUpper.includes(`FIAGRO ${monBase}`)) {
                    return true;
                }
            }
        }

        return false;
    }

    // Filter Logic
    function applyFiltersAndRender(resetRender = true) {
        const filtered = state.news.filter(item => {
            // Monitored Filter
            if (state.agency === 'monitored') {
                if (!isItemMonitored(item)) {
                    return false;
                }
            }

            // Category Filter
            if (state.activeCategory === 'FAVORITES') {
                if (!state.favoriteIds.has(item.id)) return false;
            } else if (state.activeCategory === 'UNREAD') {
                if (state.readIds.has(item.id)) return false;
            } else if (state.activeCategory !== 'ALL') {
                if (item.category !== state.activeCategory) return false;
            }

            // Search Query Filter
            if (state.searchQuery) {
                const query = state.searchQuery.toLowerCase();
                const matchHeadline = (item.headline || '').toLowerCase().includes(query);
                const matchTicker = (item.ticker || '').toLowerCase().includes(query);
                if (!matchHeadline && !matchTicker) return false;
            }

            return true;
        });

        state.filteredNews = filtered;
        if (elements.panelHeading) {
            elements.panelHeading.textContent = `Comunicados (${filtered.length.toLocaleString('pt-BR')})`;
        }

        if (resetRender) {
            state.renderedCount = 0;
            if (elements.newsList) elements.newsList.innerHTML = '';
        }

        renderNextBatch();
    }

    // Render Next Batch (Incremental Rendering)
    function renderNextBatch() {
        if (!elements.newsList) return;
        const total = state.filteredNews.length;
        if (total === 0) {
            elements.newsList.innerHTML = `
                <div class="viewer-empty-placeholder">
                    <div class="placeholder-icon">🔍</div>
                    <h4>Nenhum comunicado encontrado</h4>
                    <p>Tente ajustar os termos de busca, selecionar outra categoria ou adicionar ativos na opção <strong>"Carteira"</strong>.</p>
                </div>
            `;
            if (elements.renderedCount) elements.renderedCount.textContent = '';
            if (elements.loadMoreContainer) elements.loadMoreContainer.style.display = 'none';
            return;
        }

        const start = state.renderedCount;
        const end = Math.min(start + state.pageSize, total);
        const batch = state.filteredNews.slice(start, end);

        const html = batch.map(item => {
            const isRead = state.readIds.has(item.id);
            const isFavorite = state.favoriteIds.has(item.id);
            const isNew = state.newIds.has(item.id);
            const isActive = state.selectedId === item.id;
            const catClass = getCategoryClass(item.category);

            const dateStr = item.dateTime ? item.dateTime.replace(/^(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1') : '';

            return `
                <div class="news-card ${isRead ? 'read' : ''} ${isNew ? 'is-new' : ''} ${isActive ? 'active-card' : ''}" 
                     data-id="${item.id}" 
                     data-time="${item.dateTime || ''}">
                    <div class="card-top-row">
                        <div class="card-badges">
                            ${item.ticker ? `<span class="ticker-badge">${item.ticker}</span>` : ''}
                            <span class="category-pill ${catClass}">${item.category}</span>
                            ${isNew ? '<span class="new-badge">NOVO</span>' : ''}
                        </div>
                        <span class="card-datetime">${dateStr}</span>
                    </div>

                    <div class="card-title">${escapeHtml(item.headline)}</div>

                    <div class="card-bottom-row">
                        <button class="btn-open-doc" data-action="open-doc">
                            <span>📄 Abrir Comunicado</span>
                        </button>
                        <div class="card-mini-actions">
                            <button class="mini-icon-btn ${isFavorite ? 'favorited' : ''}" data-action="toggle-fav" title="${isFavorite ? 'Remover dos favoritos' : 'Favoritar comunicado'}">
                                ${isFavorite ? '⭐' : '☆'}
                            </button>
                            <button class="mini-icon-btn ${isRead ? 'is-read-btn' : ''}" data-action="toggle-read" title="${isRead ? 'Marcar como não lido' : 'Marcar como lido'}">
                                ${isRead ? '✓' : '○'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        if (start === 0) {
            elements.newsList.innerHTML = html;
        } else {
            elements.newsList.insertAdjacentHTML('beforeend', html);
        }

        state.renderedCount = end;
        if (elements.renderedCount) {
            elements.renderedCount.textContent = `Exibindo ${end.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}`;
        }

        if (elements.loadMoreContainer) {
            elements.loadMoreContainer.style.display = end < total ? 'block' : 'none';
        }
    }

    // Open Document Details in Viewer
    async function openDocument(id, dateTime = '') {
        state.selectedId = id;
        state.readIds.add(id);
        state.newIds.delete(id);
        saveState();
        updateStats();

        // Responsive Master-Detail: activate mobile viewer
        if (elements.dashboardWrapper) {
            elements.dashboardWrapper.classList.add('mobile-viewer-open');
        }

        document.querySelectorAll('.news-card').forEach(c => {
            if (parseInt(c.getAttribute('data-id'), 10) === id) {
                c.classList.add('active-card', 'read');
                c.classList.remove('is-new');
            } else {
                c.classList.remove('active-card');
            }
        });

        const selectedItem = state.news.find(n => n.id === id);
        if (selectedItem) {
            if (elements.viewerTicker) elements.viewerTicker.textContent = selectedItem.ticker || 'DOCUMENTO';
            if (elements.viewerTitle) elements.viewerTitle.textContent = selectedItem.headline;
            if (elements.viewerTime) elements.viewerTime.textContent = selectedItem.dateTime || '';
        }

        // Show Loading State, reset views
        if (elements.viewerPlaceholder) elements.viewerPlaceholder.style.display = 'none';
        if (elements.docLoading) elements.docLoading.style.display = 'flex';
        if (elements.textNoticeView) elements.textNoticeView.style.display = 'none';
        if (elements.docFrame) {
            elements.docFrame.style.display = 'none';
            elements.docFrame.src = 'about:blank';
        }
        if (elements.rawContentBox) elements.rawContentBox.textContent = 'Carregando detalhes do comunicado...';

        // Ensure default tab is doc tab
        elements.tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-view').forEach(c => c.classList.remove('active'));
        const firstTabBtn = document.querySelector('.viewer-tab[data-tab="doc"]');
        if (firstTabBtn) firstTabBtn.classList.add('active');
        const tabDocElem = document.getElementById('tabDoc');
        if (tabDocElem) tabDocElem.classList.add('active');

        try {
            const res = await fetch(`/api/documento/${id}?agencia=${state.agency}&data_noticia=${encodeURIComponent(dateTime)}`);
            if (!res.ok) throw new Error('Erro ao carregar detalhes do documento.');
            const data = await res.json();

            if (elements.docLoading) elements.docLoading.style.display = 'none';
            if (elements.rawContentBox) {
                elements.rawContentBox.textContent = data.rawContent || selectedItem?.headline || 'Nenhum texto adicional disponível.';
            }

            if (data.hasDocument && data.viewerUrl) {
                // PDF or HTML structured document
                if (elements.docFrame) {
                    elements.docFrame.style.display = 'block';
                    elements.docFrame.src = data.viewerUrl;
                }
                if (elements.textNoticeView) elements.textNoticeView.style.display = 'none';

                if (elements.btnViewerExternal) {
                    if (data.fnetViewerUrl || data.mainDocUrl) {
                        elements.btnViewerExternal.href = data.fnetViewerUrl || data.mainDocUrl;
                        elements.btnViewerExternal.style.display = 'inline-flex';
                    } else {
                        elements.btnViewerExternal.style.display = 'none';
                    }
                }

                if (elements.btnViewerDownload) {
                    if (data.downloadUrl) {
                        elements.btnViewerDownload.href = data.downloadUrl;
                        elements.btnViewerDownload.style.display = 'inline-flex';
                    } else {
                        elements.btnViewerDownload.style.display = 'none';
                    }
                }
            } else {
                // Text-Only Market Message / Pregão Notice
                if (elements.docFrame) elements.docFrame.style.display = 'none';
                if (elements.textNoticeView) elements.textNoticeView.style.display = 'flex';
                if (elements.textNoticeTitle) {
                    elements.textNoticeTitle.textContent = data.title || selectedItem?.headline || 'Comunicado ao Mercado';
                }
                if (elements.textNoticeContent) {
                    elements.textNoticeContent.textContent = data.rawContent || selectedItem?.headline || 'Sem conteúdo adicional.';
                }

                if (elements.btnViewerExternal) elements.btnViewerExternal.style.display = 'none';
                if (elements.btnViewerDownload) elements.btnViewerDownload.style.display = 'none';
            }

        } catch (err) {
            console.error('Erro no openDocument:', err);
            if (elements.docLoading) elements.docLoading.style.display = 'none';
            if (elements.rawContentBox) elements.rawContentBox.textContent = 'Erro ao carregar documento: ' + err.message;
            showToast('Erro ao carregar comunicado: ' + err.message, 'alert');
        }
    }

    function closeMobileViewer() {
        if (elements.dashboardWrapper) {
            elements.dashboardWrapper.classList.remove('mobile-viewer-open');
        }
        if (elements.viewerPanel && elements.viewerPanel.classList.contains('full-screen')) {
            elements.viewerPanel.classList.remove('full-screen');
        }
    }

    // Toggle Favorites & Read Actions
    function toggleFavorite(id, targetBtn) {
        if (state.favoriteIds.has(id)) {
            state.favoriteIds.delete(id);
            if (targetBtn) {
                targetBtn.classList.remove('favorited');
                targetBtn.textContent = '☆';
            }
        } else {
            state.favoriteIds.add(id);
            if (targetBtn) {
                targetBtn.classList.add('favorited');
                targetBtn.textContent = '⭐';
            }
        }
        saveState();
        updateStats();
        if (state.activeCategory === 'FAVORITES') {
            applyFiltersAndRender(true);
        }
    }

    function toggleRead(id, targetBtn, cardElem) {
        if (state.readIds.has(id)) {
            state.readIds.delete(id);
            if (targetBtn) {
                targetBtn.classList.remove('is-read-btn');
                targetBtn.textContent = '○';
            }
            if (cardElem) cardElem.classList.remove('read');
        } else {
            state.readIds.add(id);
            if (targetBtn) {
                targetBtn.classList.add('is-read-btn');
                targetBtn.textContent = '✓';
            }
            if (cardElem) cardElem.classList.add('read');
        }
        saveState();
        updateStats();
        if (state.activeCategory === 'UNREAD') {
            applyFiltersAndRender(true);
        }
    }

    function markAllRead() {
        state.news.forEach(item => state.readIds.add(item.id));
        state.newIds.clear();
        saveState();
        updateStats();
        applyFiltersAndRender(false);
        showToast('Todos os comunicados foram marcados como lidos!', 'info');
    }

    // Watchlist Management
    function addMonitoredTicker(ticker) {
        if (!ticker) return;
        const clean = ticker.trim().toUpperCase();
        if (!clean) return;

        state.monitoredTickers.add(clean);
        saveState();
        updateStats();
        renderWatchlistModalTags();
        if (state.agency === 'monitored') {
            applyFiltersAndRender(true);
        }
        showToast(`Ticker ${clean} adicionado aos ativos monitorados!`, 'success');
    }

    function removeMonitoredTicker(ticker) {
        state.monitoredTickers.delete(ticker);
        saveState();
        updateStats();
        renderWatchlistModalTags();
        if (state.agency === 'monitored') {
            applyFiltersAndRender(true);
        }
    }

    function renderWatchlistModalTags() {
        if (!elements.monitoredTagsGrid) return;
        const list = Array.from(state.monitoredTickers).sort();
        if (elements.monitoredListCount) elements.monitoredListCount.textContent = list.length;
        if (elements.monitoredCountBadge) elements.monitoredCountBadge.textContent = list.length;

        if (list.length === 0) {
            elements.monitoredTagsGrid.innerHTML = `<span style="font-size:12px; color:var(--text-muted);">Nenhum ativo cadastrado. Digite um ticker acima ou clique nas sugestões.</span>`;
            return;
        }

        elements.monitoredTagsGrid.innerHTML = list.map(t => `
            <span class="monitored-tag">
                <span>${t}</span>
                <button class="remove-tag-btn" data-ticker="${t}" title="Remover ${t}">&times;</button>
            </span>
        `).join('');
    }

    function saveState() {
        localStorage.setItem('b3_read_ids', JSON.stringify(Array.from(state.readIds)));
        localStorage.setItem('b3_fav_ids', JSON.stringify(Array.from(state.favoriteIds)));
        localStorage.setItem('b3_monitored_tickers', JSON.stringify(Array.from(state.monitoredTickers)));
        localStorage.setItem('b3_agency', state.agency);
        localStorage.setItem('b3_period', state.period);
        if (state.customStartDate) {
            localStorage.setItem('b3_custom_start', state.customStartDate);
        } else {
            localStorage.removeItem('b3_custom_start');
        }
        if (state.customEndDate) {
            localStorage.setItem('b3_custom_end', state.customEndDate);
        } else {
            localStorage.removeItem('b3_custom_end');
        }
        localStorage.setItem('b3_sound', state.soundEnabled);
    }

    function updateStats() {
        if (elements.statTotal) elements.statTotal.textContent = state.news.length.toLocaleString('pt-BR');
        if (elements.statNew) elements.statNew.textContent = state.newIds.size;

        const monitoredCount = state.news.filter(n => isItemMonitored(n)).length;
        if (elements.statMonitored) elements.statMonitored.textContent = monitoredCount.toLocaleString('pt-BR');

        if (elements.statFavorites) elements.statFavorites.textContent = state.favoriteIds.size;
        if (elements.monitoredCountBadge) {
            elements.monitoredCountBadge.textContent = state.monitoredTickers.size;
        }
    }

    function initTabs() {
        elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                elements.tabBtns.forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-view').forEach(c => c.classList.remove('active'));

                btn.classList.add('active');
                const tabId = btn.getAttribute('data-tab');
                if (tabId === 'doc') document.getElementById('tabDoc').classList.add('active');
                if (tabId === 'raw') document.getElementById('tabRaw').classList.add('active');
            });
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function setupEvents() {
        // Refresh Manual
        if (elements.btnRefresh) {
            elements.btnRefresh.addEventListener('click', () => fetchNews(true));
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'r' || e.key === 'R') {
                if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                    return;
                }
                e.preventDefault();
                fetchNews(true);
            }
            if (e.key === 'Escape') {
                togglePeriodDropdown(false);
                toggleAssetDropdown(false);
                toggleCategoryDropdown(false);
                if (elements.watchlistModal && elements.watchlistModal.style.display !== 'none') {
                    elements.watchlistModal.style.display = 'none';
                } else if (elements.viewerPanel && elements.viewerPanel.classList.contains('full-screen')) {
                    elements.viewerPanel.classList.remove('full-screen');
                } else if (elements.dashboardWrapper && elements.dashboardWrapper.classList.contains('mobile-viewer-open')) {
                    closeMobileViewer();
                }
            }
        });

        // Mobile Back Button
        if (elements.btnMobileBack) {
            elements.btnMobileBack.addEventListener('click', closeMobileViewer);
        }

        // Copy Notice Text Button
        if (elements.btnCopyNoticeText) {
            elements.btnCopyNoticeText.addEventListener('click', () => {
                const textToCopy = elements.textNoticeContent ? elements.textNoticeContent.textContent || '' : '';
                navigator.clipboard.writeText(textToCopy).then(() => {
                    showToast('Texto do comunicado copiado com sucesso!', 'success');
                }).catch(() => {
                    showToast('Não foi possível copiar o texto automaticamente.', 'alert');
                });
            });
        }

        // Global Click Outside Dropdowns
        document.addEventListener('click', (e) => {
            if (elements.periodPickerContainer && !elements.periodPickerContainer.contains(e.target)) {
                togglePeriodDropdown(false);
            }
            if (elements.assetDropdownContainer && !elements.assetDropdownContainer.contains(e.target)) {
                toggleAssetDropdown(false);
            }
            if (elements.categoryDropdownContainer && !elements.categoryDropdownContainer.contains(e.target)) {
                toggleCategoryDropdown(false);
            }
        });

        // 1. Asset Dropdown Events
        if (elements.btnAssetTrigger) {
            elements.btnAssetTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleAssetDropdown();
            });
        }

        if (elements.assetDropdownCard) {
            elements.assetDropdownCard.addEventListener('click', (e) => {
                const opt = e.target.closest('.custom-option');
                if (opt) {
                    e.stopPropagation();
                    const val = opt.getAttribute('data-value');
                    if (val) selectAssetAgency(val);
                }
            });
        }

        // 2. Category Dropdown Events
        if (elements.btnCategoryTrigger) {
            elements.btnCategoryTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleCategoryDropdown();
            });
        }

        if (elements.categoryDropdownCard) {
            elements.categoryDropdownCard.addEventListener('click', (e) => {
                const opt = e.target.closest('.custom-option');
                if (opt) {
                    e.stopPropagation();
                    const val = opt.getAttribute('data-value');
                    if (val) selectCategoryOption(val);
                }
            });
        }

        if (elements.btnResetCategory) {
            elements.btnResetCategory.addEventListener('click', (e) => {
                e.stopPropagation();
                selectCategoryOption('ALL');
            });
        }

        // 3. Period Picker Events
        if (elements.btnPeriodTrigger) {
            elements.btnPeriodTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePeriodDropdown();
            });
        }

        elements.presetOptions.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const p = btn.getAttribute('data-period');
                selectPresetPeriod(p);
            });
        });

        if (elements.btnClearPeriod) {
            elements.btnClearPeriod.addEventListener('click', (e) => {
                e.stopPropagation();
                clearPeriod();
            });
        }

        if (elements.calPrevMonth) {
            elements.calPrevMonth.addEventListener('click', (e) => {
                e.stopPropagation();
                state.calViewMonth--;
                if (state.calViewMonth < 0) {
                    state.calViewMonth = 11;
                    state.calViewYear--;
                }
                renderCalendar();
            });
        }

        if (elements.calNextMonth) {
            elements.calNextMonth.addEventListener('click', (e) => {
                e.stopPropagation();
                state.calViewMonth++;
                if (state.calViewMonth > 11) {
                    state.calViewMonth = 0;
                    state.calViewYear++;
                }
                renderCalendar();
            });
        }

        if (elements.calDaysGrid) {
            elements.calDaysGrid.addEventListener('click', (e) => {
                const dayCell = e.target.closest('.cal-day-cell');
                if (dayCell && !dayCell.classList.contains('is-empty')) {
                    e.stopPropagation();
                    const dateStr = dayCell.getAttribute('data-date');
                    if (dateStr) handleCalendarDateClick(dateStr);
                }
            });

            elements.calDaysGrid.addEventListener('mouseover', (e) => {
                if (state.calStep === 2) {
                    const dayCell = e.target.closest('.cal-day-cell');
                    if (dayCell && !dayCell.classList.contains('is-empty')) {
                        const dateStr = dayCell.getAttribute('data-date');
                        if (dateStr && state.hoveredDate !== dateStr) {
                            state.hoveredDate = dateStr;
                            renderCalendar();
                        }
                    }
                }
            });

            elements.calDaysGrid.addEventListener('mouseleave', () => {
                if (state.calStep === 2 && state.hoveredDate) {
                    state.hoveredDate = null;
                    renderCalendar();
                }
            });
        }

        // Search Input (Debounced)
        let searchTimeout = null;
        if (elements.inputSearch) {
            elements.inputSearch.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    state.searchQuery = e.target.value.trim();
                    if (elements.btnClearSearch) {
                        elements.btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
                    }
                    applyFiltersAndRender(true);
                }, 150);
            });
        }

        if (elements.btnClearSearch) {
            elements.btnClearSearch.addEventListener('click', () => {
                if (elements.inputSearch) elements.inputSearch.value = '';
                state.searchQuery = '';
                elements.btnClearSearch.style.display = 'none';
                applyFiltersAndRender(true);
            });
        }

        // Infinite Scroll
        if (elements.newsList) {
            elements.newsList.addEventListener('scroll', () => {
                const { scrollTop, scrollHeight, clientHeight } = elements.newsList;
                if (scrollTop + clientHeight >= scrollHeight - 300) {
                    if (state.renderedCount < state.filteredNews.length) {
                        renderNextBatch();
                    }
                }
            });
        }

        if (elements.btnLoadMore) {
            elements.btnLoadMore.addEventListener('click', () => {
                renderNextBatch();
            });
        }

        // Mark All Read
        if (elements.btnMarkAllRead) {
            elements.btnMarkAllRead.addEventListener('click', markAllRead);
        }

        // Sound Toggle
        if (elements.btnToggleSound) {
            elements.btnToggleSound.addEventListener('click', () => {
                state.soundEnabled = !state.soundEnabled;
                if (elements.soundIcon) {
                    elements.soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
                }
                saveState();
                showToast(`Alerta sonoro ${state.soundEnabled ? 'ativado' : 'desativado'}.`, 'info');
                if (state.soundEnabled) playChime();
            });
        }

        // Viewer panel controls
        if (elements.btnViewerExpand) {
            elements.btnViewerExpand.addEventListener('click', () => {
                if (elements.viewerPanel) elements.viewerPanel.classList.toggle('full-screen');
            });
        }

        if (elements.btnViewerClose) {
            elements.btnViewerClose.addEventListener('click', () => {
                if (elements.viewerPanel) elements.viewerPanel.classList.remove('full-screen');
                closeMobileViewer();
                if (elements.viewerPlaceholder) elements.viewerPlaceholder.style.display = 'flex';
                if (elements.docFrame) elements.docFrame.style.display = 'none';
                if (elements.textNoticeView) elements.textNoticeView.style.display = 'none';
                if (elements.docLoading) elements.docLoading.style.display = 'none';
                state.selectedId = null;
                applyFiltersAndRender(false);
            });
        }

        // Watchlist Modal Controls
        if (elements.btnOpenWatchlist) {
            elements.btnOpenWatchlist.addEventListener('click', () => {
                renderWatchlistModalTags();
                if (elements.watchlistModal) {
                    elements.watchlistModal.style.display = 'flex';
                    setTimeout(() => {
                        if (elements.inputNewTicker) elements.inputNewTicker.focus();
                    }, 50);
                }
            });
        }

        if (elements.btnCloseWatchlist) {
            elements.btnCloseWatchlist.addEventListener('click', () => {
                if (elements.watchlistModal) elements.watchlistModal.style.display = 'none';
            });
        }

        if (elements.btnDoneWatchlist) {
            elements.btnDoneWatchlist.addEventListener('click', () => {
                if (elements.watchlistModal) elements.watchlistModal.style.display = 'none';
            });
        }

        if (elements.btnAddTicker) {
            elements.btnAddTicker.addEventListener('click', () => {
                if (elements.inputNewTicker) {
                    addMonitoredTicker(elements.inputNewTicker.value);
                    elements.inputNewTicker.value = '';
                }
            });
        }

        if (elements.inputNewTicker) {
            elements.inputNewTicker.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addMonitoredTicker(elements.inputNewTicker.value);
                    elements.inputNewTicker.value = '';
                }
            });
        }

        // Preset chip clicks in modal
        document.querySelectorAll('.chip-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const ticker = btn.getAttribute('data-ticker');
                addMonitoredTicker(ticker);
            });
        });

        // Remove tag in watchlist modal delegation
        if (elements.monitoredTagsGrid) {
            elements.monitoredTagsGrid.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.remove-tag-btn');
                if (removeBtn) {
                    const ticker = removeBtn.getAttribute('data-ticker');
                    removeMonitoredTicker(ticker);
                }
            });
        }

        // Card Click Delegation
        if (elements.newsList) {
            elements.newsList.addEventListener('click', (e) => {
                const actionBtn = e.target.closest('[data-action]');
                const card = e.target.closest('.news-card');
                if (!card) return;

                const id = parseInt(card.getAttribute('data-id'), 10);
                const time = card.getAttribute('data-time') || '';

                if (actionBtn) {
                    const action = actionBtn.getAttribute('data-action');
                    if (action === 'toggle-fav') {
                        e.stopPropagation();
                        toggleFavorite(id, actionBtn);
                        return;
                    }
                    if (action === 'toggle-read') {
                        e.stopPropagation();
                        toggleRead(id, actionBtn, card);
                        return;
                    }
                    if (action === 'open-doc') {
                        e.stopPropagation();
                        openDocument(id, time);
                        return;
                    }
                }

                openDocument(id, time);
            });
        }
    }

    function init() {
        updateAssetTriggerLabel();
        updateCategoryTriggerLabel();
        updatePeriodTriggerLabel();
        renderCalendar();
        if (elements.soundIcon) {
            elements.soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
        }

        initTabs();
        setupEvents();
        fetchNews(false);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
