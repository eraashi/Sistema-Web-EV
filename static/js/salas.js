(function () {
    let rooms = [];
    let polos = [];
    let currentPage = 1;
    const ITEMS_PER_PAGE = 20;
    let totalPages = 1;
    let filteredRooms = [];
    let observer = null;
    let lastPaginationState = { currentPage: null, totalPages: null };
    let forceRefresh = false;
    const currentUserRole = document.querySelector('header span')?.textContent.includes('Olá,') ? 'admin' : document.querySelector('header span')?.textContent.split(', ')[1]?.trim().toLowerCase() || 'unknown';
    const userPoloName = document.querySelector('.sidebar .p-4.text-sm')?.textContent.includes('Polo Atual:') ? document.querySelector('.sidebar .p-4.text-sm').textContent.replace('Polo Atual: ', '').trim() : '';

    console.log('salas.js carregado, userRole:', currentUserRole, 'userPoloName:', userPoloName);

    function invalidateCaches() {
        const roomsCacheKey = 'cache_/api/salas';
        localStorage.removeItem(roomsCacheKey);
        console.log('Cache local removido:', roomsCacheKey);

        const localStorageKeys = Object.keys(localStorage);
        localStorageKeys.forEach(key => {
            if (key.startsWith('cache_/api/salas')) {
                localStorage.removeItem(key);
                console.log(`Cache local removido: ${key}`);
            }
        });

        const sessionStorageKeys = Object.keys(sessionStorage);
        sessionStorageKeys.forEach(key => {
            if (key.startsWith('precache:/api/salas')) {
                sessionStorage.removeItem(key);
                console.log(`Pré-cache removido: ${key}`);
            }
        });
    }

    const retryFetch = async (url, options, retries = 2, delay = 500) => {
        const cacheKey = `cache_${url}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached && !forceRefresh) {
            try {
                const { data, timestamp } = JSON.parse(cached);
                console.log('Dados do cache local:', { url, data_length: data?.length || 0 });
                if (Date.now() - timestamp < 300000 && data && Array.isArray(data)) {
                    console.log('Cache local válido usado:', { url, data_length: data.length });
                    return data;
                } else {
                    console.warn('Cache local inválido ou expirado:', {
                        timestamp_valid: Date.now() - timestamp < 300000,
                        data_valid: data && Array.isArray(data)
                    });
                    localStorage.removeItem(cacheKey);
                }
            } catch (e) {
                console.warn('Erro ao processar cache do localStorage:', e.message);
                localStorage.removeItem(cacheKey);
            }
        }

        for (let i = 0; i < retries; i++) {
            try {
                console.log(`Tentando fetch para ${url}, tentativa ${i + 1}`);
                const response = await fetch(url, options);
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                const data = await response.json();
                try {
                    localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
                    console.log('Dados armazenados no cache local:', { url, data_length: data?.length || 0 });
                } catch (e) {
                    console.warn('Erro ao salvar no localStorage:', e.message);
                }
                return data;
            } catch (error) {
                if (i < retries - 1) {
                    console.warn(`Tentativa ${i + 1} falhou para ${url}: ${error}. Tentando novamente em ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.error(`Falhou após ${retries} tentativas para ${url}: ${error}`);
                    throw error;
                }
            }
        }
    };

    async function fetchData() {
        console.log('fetchData iniciado');
        const overlay = document.getElementById('loading-overlay');
        const mainContent = document.querySelector('.mb-6');

        if (overlay && mainContent) {
            overlay.style.display = 'flex';
            mainContent.classList.add('pointer-events-none');
            console.log('Loading overlay shown at start of fetchData');
        }

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
            console.log('Lucide icons inicializados no início do fetchData');
        }

        try {
            rooms = [];
            polos = [];

            let isRendered = false;

            const cacheKeyRooms = 'cache_/api/salas';
            const cachedRooms = localStorage.getItem(cacheKeyRooms);
            if (cachedRooms && !forceRefresh) {
                try {
                    const { data, timestamp } = JSON.parse(cachedRooms);
                    console.log('Dados do cache local (salas):', { data_length: data?.length || 0 });
                    if (Date.now() - timestamp < 300000 && data && Array.isArray(data)) {
                        rooms = data;
                        filteredRooms = rooms;
                        isRendered = true;
                        await new Promise(resolve => setTimeout(resolve, 50));
                        renderRooms();
                        setTimeout(() => {
                            updatePaginationWithRetry();
                        }, 100);
                        console.log('Renderizado a partir do cache de salas:', rooms.length, 'salas');
                    } else {
                        console.warn('Cache de salas inválido ou expirado, removendo');
                        localStorage.removeItem(cacheKeyRooms);
                    }
                } catch (e) {
                    console.warn('Erro ao processar cache de salas:', e.message);
                    localStorage.removeItem(cacheKeyRooms);
                }
            }

            const cacheKeyPolos = 'cache_/api/polos';
            const cachedPolos = localStorage.getItem(cacheKeyPolos);
            if (cachedPolos && !forceRefresh) {
                try {
                    const { data, timestamp } = JSON.parse(cachedPolos);
                    console.log('Dados do cache local (polos):', { data_length: data?.length || 0 });
                    if (Date.now() - timestamp < 300000 && data && Array.isArray(data)) {
                        polos = data;
                        if (currentUserRole === 'admin' || currentUserRole === 'secretaria') {
                            populatePoloSelect('polo-filter');
                            populatePoloSelect('create-polo-select');
                            populatePoloSelect('edit-polo-select');
                        }
                        console.log('Polos preenchidos a partir do cache:', polos.length, 'itens');
                    } else {
                        console.warn('Cache de polos inválido ou expirado, removendo');
                        localStorage.removeItem(cacheKeyPolos);
                    }
                } catch (e) {
                    console.warn('Erro ao processar cache de polos:', e.message);
                    localStorage.removeItem(cacheKeyPolos);
                }
            }

            if (isRendered && (currentUserRole !== 'admin' && currentUserRole !== 'secretaria' || polos.length > 0) && !forceRefresh) {
                console.log('Cache válido usado para salas e polos, pulando busca de dados frescos');
                return;
            }

            console.log('Buscando dados frescos de /api/salas e /api/polos');
            const fetchPromises = [retryFetch('/api/salas', { credentials: 'include' })];
            if (currentUserRole === 'admin' || currentUserRole === 'secretaria') {
                fetchPromises.push(retryFetch('/api/polos', { credentials: 'include' }));
            }

            const [roomsData, polosData] = await Promise.all(fetchPromises);

            const newRooms = Array.isArray(roomsData) ? roomsData : [];
            const newPolos = (currentUserRole === 'admin' || currentUserRole === 'secretaria') && Array.isArray(polosData) ? polosData : [];

            console.log('Dados frescos obtidos:', { rooms: newRooms.length, polos: newPolos.length });

            const roomsChanged = JSON.stringify(newRooms) !== JSON.stringify(rooms);
            const polosChanged = JSON.stringify(newPolos) !== JSON.stringify(polos);

            rooms = newRooms;
            polos = newPolos;
            filteredRooms = rooms;

            if (!isRendered || roomsChanged) {
                renderRooms();
                setTimeout(() => {
                    updatePaginationWithRetry();
                }, 100);
                console.log('Salas renderizadas com dados frescos');
            }

            if (polosChanged && (currentUserRole === 'admin' || currentUserRole === 'secretaria')) {
                populatePoloSelect('polo-filter');
                populatePoloSelect('create-polo-select');
                populatePoloSelect('edit-polo-select');
                console.log('Selects de polos atualizados com dados frescos');
            }
        } catch (error) {
            console.error('Erro em fetchData:', error.message);
            showToast('Erro ao carregar dados: ' + error.message, 'error', 'alert-circle', 3000);
            renderRooms();
            setTimeout(() => {
                updatePaginationWithRetry();
            }, 100);
        } finally {
            forceRefresh = false;
            const overlay = document.getElementById('loading-overlay');
            const mainContent = document.querySelector('.mb-6');
            if (overlay && mainContent) {
                overlay.style.display = 'none';
                mainContent.classList.remove('pointer-events-none');
                console.log('Overlay de carregamento ocultado');
            }
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
                console.log('Ícones Lucide reinicializados após fetchData');
            }
        }
    }

    function populatePoloSelect(selectId) {
        const select = document.getElementById(selectId);
        if (!select) {
            console.warn('Select de polos não encontrado:', selectId);
            return;
        }
        select.innerHTML = selectId === 'polo-filter' ? '<option value="">Todos os Polos</option>' : '<option value="" disabled selected>Escolha um polo...</option>';
        polos.forEach(polo => {
            const option = document.createElement('option');
            option.value = polo.nome;
            option.textContent = polo.nome;
            select.appendChild(option);
        });
        console.log('Select de polos preenchido com', polos.length, 'opções para', selectId);
    }

    function renderRooms() {
        const tbody = document.getElementById('room-table-body');
        if (!tbody) {
            console.error('Elemento room-table-body não encontrado');
            return;
        }
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const paginatedRooms = filteredRooms.slice(start, end);

        totalPages = Math.ceil(filteredRooms.length / ITEMS_PER_PAGE);

        let html = '';
        if (paginatedRooms.length === 0) {
            const colspan = currentUserRole === 'admin' || currentUserRole === 'secretaria' ? 5 : 4;
            html = `<tr><td colspan="${colspan}" class="px-6 py-4 text-center text-gray-500">Nenhuma sala encontrada.</td></tr>`;
        } else {
            paginatedRooms.forEach((room, index) => {
                const globalIndex = start + index;
                const turmasCount = room.turmas_vinculadas ? room.turmas_vinculadas.length : 0;
                const hasTurmas = turmasCount > 0;
                const turmasButton = `
                    <button class="${hasTurmas ? 'bg-green-800 hover:bg-green-900' : 'bg-gray-300 cursor-not-allowed'} text-white px-3 py-1 rounded-md flex items-center justify-center" ${hasTurmas ? `onclick='openClassesModal(${JSON.stringify(room)})'` : 'disabled'}>
                        <i data-lucide="search" class="h-4 w-4 mr-1"></i> Turmas
                    </button>`;
                const actionButtons = (currentUserRole === 'admin' || currentUserRole === 'secretaria')
                    ? `<td class="px-6 py-4 flex items-center gap-2">
                           <button class="edit-button bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-md flex items-center" data-index="${globalIndex}">
                               <i data-lucide="edit" class="h-4 w-4 mr-1"></i> Editar
                           </button>
                           <button class="delete-button bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md flex items-center" data-id="${room.id}">
                               <i data-lucide="trash-2" class="h-4 w-4 mr-1"></i> Excluir
                           </button>
                       </td>`
                    : '';
                html += `
                    <tr>
                        <td class="px-6 py-4">
                            <div class="flex items-center">
                                <i data-lucide="building" class="h-10 w-10 text-blue-600 flex items-center justify-center mr-3"></i>
                                <div>
                                    <div class="font-medium">${room.nome}</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4">${room.polo_nome || 'Não especificado'}</td>
                        <td class="px-6 py-4">${room.capacidade}</td>
                        <td class="px-6 py-4">${turmasButton}</td>
                        ${actionButtons}
                    </tr>
                `;
            });
        }

        tbody.innerHTML = html;

        document.querySelectorAll('.edit-button').forEach(button => {
            button.addEventListener('click', () => {
                const index = button.getAttribute('data-index');
                openEditModal(index);
            });
        });

        document.querySelectorAll('.delete-button').forEach(button => {
            button.addEventListener('click', () => {
                const roomId = button.getAttribute('data-id');
                deleteRoom(roomId);
            });
        });

        lucide.createIcons();
        console.log('Tabela de salas renderizada com', paginatedRooms.length, 'itens (página', currentPage, 'de', totalPages, ')');
    }

    function updatePaginationWithRetry(attempt = 1, maxAttempts = 10) {
        const delay = 200;
        const tableContainer = document.querySelector('.bg-white.rounded-lg.shadow-md.overflow-hidden');
        if (tableContainer) {
            let topPagination = document.querySelector('.pagination-top');
            if (!topPagination) {
                topPagination = document.createElement('div');
                topPagination.className = 'pagination-top py-4 px-6';
                tableContainer.insertBefore(topPagination, tableContainer.querySelector('table'));
            }

            let bottomPagination = document.querySelector('.pagination');
            if (!bottomPagination) {
                bottomPagination = document.createElement('div');
                bottomPagination.className = 'pagination py-4 px-6';
                tableContainer.appendChild(bottomPagination);
            }
        } else if (attempt < maxAttempts) {
            setTimeout(() => {
                updatePaginationWithRetry(attempt + 1, maxAttempts);
            }, delay);
            return;
        } else {
            console.warn('Contêiner da tabela não encontrado após', maxAttempts, 'tentativas');
            return;
        }

        if (lastPaginationState.currentPage === currentPage && lastPaginationState.totalPages === totalPages) {
            return;
        }

        const createPaginationControls = () => {
            const paginationDiv = document.createElement('div');
            paginationDiv.className = 'flex justify-center items-center space-x-2 mt-4';

            const prevButton = document.createElement('button');
            prevButton.textContent = 'Anterior';
            prevButton.className = `px-4 py-2 rounded-md ${currentPage === 1 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`;
            prevButton.disabled = currentPage === 1;
            prevButton.onclick = () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderRooms();
                    setTimeout(() => {
                        updatePaginationWithRetry();
                    }, 100);
                }
            };
            paginationDiv.appendChild(prevButton);

            const pageSpan = document.createElement('span');
            pageSpan.textContent = `Página ${currentPage} de ${totalPages}`;
            paginationDiv.appendChild(pageSpan);

            const nextButton = document.createElement('button');
            nextButton.textContent = 'Próxima';
            nextButton.className = `px-4 py-2 rounded-md ${currentPage === totalPages ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`;
            nextButton.disabled = currentPage === totalPages;
            nextButton.onclick = () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    renderRooms();
                    setTimeout(() => {
                        updatePaginationWithRetry();
                    }, 100);
                }
            };
            paginationDiv.appendChild(nextButton);

            return paginationDiv;
        };

        if (observer) {
            observer.disconnect();
            console.log('MutationObserver desconectado temporariamente durante a atualização dos controles de paginação');
        }

        const topPagination = document.querySelector('.pagination-top');
        if (topPagination) {
            topPagination.innerHTML = '';
            topPagination.appendChild(createPaginationControls());
            console.log('Controles de paginação (topo) atualizados na tentativa', attempt, ':', { currentPage, totalPages });
        } else if (attempt < maxAttempts) {
            setTimeout(() => {
                updatePaginationWithRetry(attempt + 1, maxAttempts);
            }, delay);
            return;
        }

        const bottomPagination = document.querySelector('.pagination');
        if (bottomPagination) {
            bottomPagination.innerHTML = '';
            bottomPagination.appendChild(createPaginationControls());
            console.log('Controles de paginação (final) atualizados na tentativa', attempt, ':', { currentPage, totalPages });
        } else if (attempt < maxAttempts) {
            setTimeout(() => {
                updatePaginationWithRetry(attempt + 1, maxAttempts);
            }, delay);
            return;
        }

        lastPaginationState = { currentPage, totalPages };

        if (observer) {
            const tableContainer = document.querySelector('.bg-white.rounded-lg.shadow-md.overflow-hidden');
            if (tableContainer) {
                observer.observe(tableContainer, {
                    childList: true,
                    subtree: true
                });
                console.log('MutationObserver reconectado após a atualização dos controles de paginação');
            }
        }
    }

    function filterRooms() {
        const search = document.getElementById('room-search')?.value.toLowerCase() || '';
        const poloFilter = document.getElementById('polo-filter')?.value || '';

        filteredRooms = rooms.filter(room => {
            const matchesSearch = room.nome.toLowerCase().includes(search);
            const matchesPolo = !poloFilter || (room.polo_nome && room.polo_nome === poloFilter);
            return matchesSearch && matchesPolo;
        });

        currentPage = 1;
        renderRooms();
        setTimeout(() => {
            updatePaginationWithRetry();
        }, 100);
        console.log('Salas filtradas:', filteredRooms.length, 'resultados');
    }

    function openCreateModal() {
        const modal = document.getElementById('create-room-modal');
        if (!modal) {
            console.error('Modal de criação não encontrado');
            return;
        }
        modal.style.display = 'block';
        const form = document.getElementById('create-room-form');
        if (form) {
            form.reset();
        }
        document.querySelectorAll('.tooltip').forEach(tooltip => {
            tooltip.style.display = 'none';
        });
        if (currentUserRole !== 'admin' && currentUserRole !== 'secretaria') {
            const poloInput = document.getElementById('create-polo-name');
            if (poloInput) {
                poloInput.value = userPoloName;
            }
        }
        lucide.createIcons();
        console.log('Modal de criação aberto');
    }

    function closeCreateModal() {
        const modal = document.getElementById('create-room-modal');
        if (!modal) {
            console.error('Modal de criação não encontrado');
            return;
        }
        modal.style.display = 'none';
        console.log('Modal de criação fechado');
    }

    function openEditModal(index) {
        const room = filteredRooms[index];
        if (!room) {
            console.error('Sala não encontrada no índice:', index);
            return;
        }

        const modal = document.getElementById('edit-room-modal');
        if (!modal) {
            console.error('Modal de edição não encontrado');
            return;
        }
        modal.style.display = 'block';
        console.log('Modal de edição aberto para a sala:', room.id);

        const editRoomId = document.getElementById('edit-room-id');
        const editNome = document.getElementById('edit-nome');
        const editCapacidade = document.getElementById('edit-capacidade');
        const editPoloSelect = document.getElementById('edit-polo-select');
        const editPoloName = document.getElementById('edit-polo-name');

        if (editRoomId) editRoomId.value = room.id;
        if (editNome) editNome.value = room.nome;
        if (editCapacidade) editCapacidade.value = room.capacidade;

        if (currentUserRole === 'admin' || currentUserRole === 'secretaria') {
            if (editPoloSelect && room.polo_nome && editPoloSelect.querySelector(`option[value="${room.polo_nome}"]`)) {
                editPoloSelect.value = room.polo_nome;
            } else if (editPoloSelect) {
                editPoloSelect.value = '';
            }
        } else {
            if (editPoloName) {
                editPoloName.value = room.polo_nome || userPoloName;
            }
        }
    }

    function closeEditModal() {
        const modal = document.getElementById('edit-room-modal');
        if (!modal) {
            console.error('Modal de edição não encontrado');
            return;
        }
        modal.style.display = 'none';
        console.log('Modal de edição fechado');
    }

    function openClassesModal(room) {
        const modal = document.getElementById('view-classes-modal');
        const classesList = document.getElementById('classes-list');
        if (!modal || !classesList) {
            console.error('Modal view-classes-modal ou classes-list não encontrado');
            return;
        }

        classesList.innerHTML = '';
        if (room.turmas_vinculadas && room.turmas_vinculadas.length > 0) {
            room.turmas_vinculadas.forEach(turma => {
                const classType = turma.tipo === 'cognitiva' ? 'Cognitiva' : 'Motora';
                const gradesDisplay = Array.isArray(turma.faixa_etaria)
                    ? turma.faixa_etaria.map(g => `${g}º`).join(' e ')
                    : turma.faixa_etaria || 'Não especificado';
                const card = `
                    <div class="class-card">
                        <h3 class="inline-flex items-center">
                            ${turma.nome}
                            <span class="class-type-tag ${turma.tipo}">${classType}</span>
                        </h3>
                        <p><strong>Dia:</strong> ${turma.dia_semana}</p>
                        <p><strong>Período:</strong> ${turma.periodo}</p>
                        <p><strong>Faixa Etária:</strong> ${gradesDisplay}</p>
                        <p><strong>Polo:</strong> ${turma.polo_nome}</p>
                    </div>
                `;
                classesList.innerHTML += card;
            });
        } else {
            classesList.innerHTML = '<p class="text-gray-500">Nenhuma turma vinculada a esta sala.</p>';
        }

        modal.style.display = 'block';
        lucide.createIcons();
        console.log('Modal de turmas aberto para a sala:', room.id);
    }

    function closeClassesModal() {
        const modal = document.getElementById('view-classes-modal');
        if (!modal) {
            console.error('Modal de turmas não encontrado');
            return;
        }
        modal.style.display = 'none';
        console.log('Modal de turmas fechado');
    }

    async function createRoom(event) {
        event.preventDefault();
        const form = document.getElementById('create-room-form');
        if (!form) {
            console.error('Formulário create-room-form não encontrado');
            return;
        }
        const formData = new FormData(form);
        const roomData = Object.fromEntries(formData);

        let hasError = false;
        const fields = [
            { id: 'create-nome', name: 'nome', message: 'Por favor, insira o nome da sala' },
            { id: 'create-capacidade', name: 'capacidade', message: 'Por favor, insira a capacidade da sala' },
        ];
        if (currentUserRole === 'admin' || currentUserRole === 'secretaria') {
            fields.push({ id: 'create-polo-select', name: 'polo_name', message: 'Por favor, selecione o polo' });
        }

        document.querySelectorAll('.tooltip').forEach(tooltip => {
            tooltip.style.display = 'none';
        });

        fields.forEach(field => {
            const value = roomData[field.name];
            if (!value || value.trim() === '') {
                showTooltip(field.id, field.message);
                hasError = true;
            }
        });

        if (hasError) {
            console.warn('Validação do formulário falhou, erros exibidos nos tooltips');
            return;
        }

        try {
            roomData.capacidade = parseInt(roomData.capacidade);
            if (currentUserRole !== 'admin' && currentUserRole !== 'secretaria') {
                roomData.polo_name = userPoloName;
            }
            console.log('Enviando dados para criar sala:', roomData);
            const response = await fetch('/api/salas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(roomData),
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Erro HTTP! Status: ${response.status}`);
            }

            const createdRoom = await response.json();
            if (!createdRoom.id) {
                throw new Error('Resposta da API não contém ID da sala criada');
            }

            console.log('Sala criada com sucesso:', createdRoom);
            showToast('Sala criada com sucesso!', 'success', 'check-circle', 3000);

            invalidateCaches();
            forceRefresh = true;
            closeCreateModal();
            await fetchData();
            renderRooms();
            setTimeout(() => {
                updatePaginationWithRetry();
            }, 100);
        } catch (error) {
            console.error('Erro ao criar sala:', error.message);
            showToast(`Erro ao criar sala: ${error.message}`, 'error', 'alert-circle', 5000);
        }
    }

    async function saveRoomChanges(event) {
        event.preventDefault();
        const form = document.getElementById('edit-room-form');
        if (!form) {
            console.error('Formulário edit-room-form não encontrado');
            return;
        }
        const formData = new FormData(form);
        const roomData = Object.fromEntries(formData);

        if (!roomData.room_id) {
            console.error('ID da sala não encontrado no formulário');
            showToast('Erro: ID da sala não especificado', 'error', 'alert-circle', 3000);
            return;
        }

        try {
            roomData.capacidade = parseInt(roomData.capacidade);
            if (currentUserRole !== 'admin' && currentUserRole !== 'secretaria') {
                roomData.polo_name = userPoloName;
            }
            console.log('Enviando dados para atualizar sala:', roomData);
            const response = await retryFetch(`/api/salas/${roomData.room_id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(roomData),
                credentials: 'include'
            });
            showToast('Sala atualizada com sucesso!', 'success', 'check-circle', 3000);

            invalidateCaches();
            forceRefresh = true;
            closeEditModal();
            await fetchData();
        } catch (error) {
            console.error('Erro ao salvar alterações da0sala:', error.message);
            showToast('Erro: ' + error.message, 'error', 'alert-circle', 3000);
        }
    }

    async function deleteRoom(roomId) {
        if (!confirm('Tem certeza que deseja excluir esta sala?')) {
            return;
        }

        try {
            console.log('Excluindo sala com ID:', roomId);
            const response = await retryFetch(`/api/salas/${roomId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            showToast('Sala excluída com sucesso!', 'success', 'check-circle', 3000);

            invalidateCaches();
            forceRefresh = true;
            await fetchData();
        } catch (error) {
            console.error('Erro ao excluir sala:', error.message);
            showToast('Erro: ' + error.message, 'error', 'alert-circle', 3000);
            invalidateCaches();
            forceRefresh = true;
            await fetchData();
        }
    }

    function showTooltip(elementId, message) {
        const tooltip = document.getElementById(`tooltip-${elementId}`);
        if (tooltip) {
            tooltip.textContent = message;
            tooltip.style.display = 'block';
            setTimeout(() => {
                tooltip.style.display = 'none';
            }, 3000);
            console.log('Exibindo tooltip para', elementId, ':', message);
        } else {
            console.warn('Tooltip não encontrado para', elementId);
        }
    }

    function showToast(message, type, icon, duration = 3000) {
        const toastContainer = document.getElementById('custom-toast-container');
        if (!toastContainer) {
            console.warn('Contêiner de toast não encontrado');
            return;
        }

        const toastDiv = document.createElement('div');
        toastDiv.className = `custom-toast custom-toast-${type}`;
        toastDiv.innerHTML = `
            <i data-lucide="${icon}" class="custom-toast-icon h-3 w-3"></i>
            <span class="custom-toast-message">${message}</span>
            <button class="custom-toast-close">×</button>
        `;

        toastContainer.appendChild(toastDiv);
        lucide.createIcons();

        const timeout = setTimeout(() => {
            toastDiv.remove();
            console.log('Toast removido:', message);
        }, duration);

        const closeButton = toastDiv.querySelector('.custom-toast-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                clearTimeout(timeout);
                toastDiv.remove();
                console.log('Toast fechado manualmente:', message);
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        console.log('Evento DOMContentLoaded disparado');
        const tableContainer = document.querySelector('.bg-white.rounded-lg.shadow-md.overflow-hidden');
        if (tableContainer) {
            observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    const isLucideChange = Array.from(mutation.addedNodes).some(node => node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('data-lucide')) ||
                                           Array.from(mutation.removedNodes).some(node => node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('data-lucide'));
                    const isPaginationChange = Array.from(mutation.addedNodes).some(node => node.nodeType === Node.ELEMENT_NODE && typeof node.className === 'string' && node.className.includes('pagination')) ||
                                               Array.from(mutation.removedNodes).some(node => node.nodeType === Node.ELEMENT_NODE && typeof node.className === 'string' && node.className.includes('pagination'));
                    if (!isLucideChange && !isPaginationChange) {
                        setTimeout(() => {
                            updatePaginationWithRetry();
                        }, 100);
                    }
                });
            });

            observer.observe(tableContainer, {
                childList: true,
                subtree: true
            });
            console.log('MutationObserver iniciado globalmente para monitorar mudanças no contêiner pai');
        } else {
            console.warn('Contêiner da tabela não encontrado');
        }

        const elements = [
            { id: 'create-room-button', handler: openCreateModal },
            { id: 'create-room-form', handler: createRoom, event: 'submit' },
            { id: 'cancel-create-room', handler: closeCreateModal },
            { id: 'edit-room-form', handler: saveRoomChanges, event: 'submit' },
            { id: 'cancel-edit-room', handler: closeEditModal },
            { id: 'room-search', handler: filterRooms, event: 'input' },
            { id: 'polo-filter', handler: filterRooms, event: 'change' },
            { id: 'view-classes-modal', handler: closeClassesModal, event: 'click', condition: event => event.target === document.getElementById('view-classes-modal') },
            { id: 'close-classes-modal', handler: closeClassesModal },
            { id: 'create-room-modal', handler: closeCreateModal, event: 'click', condition: event => event.target === document.getElementById('create-room-modal') },
            { id: 'edit-room-modal', handler: closeEditModal, event: 'click', condition: event => event.target === document.getElementById('edit-room-modal') }
        ];

        console.log('Inicializando eventos para elementos:', elements.map(e => e.id));
        elements.forEach(({ id, handler, event = 'click', condition }) => {
            const element = document.getElementById(id);
            if (element) {
                if (condition) {
                    element.addEventListener(event, (e) => { if (condition(e)) handler(); });
                } else {
                    element.addEventListener(event, handler);
                }
                console.log(`Evento ${event} adicionado ao elemento ${id}`);
            } else {
                console.warn(`Elemento ${id} não encontrado`);
            }
        });

        fetchData();
        console.log('fetchData chamado no DOMContentLoaded');
    });
})();