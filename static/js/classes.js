(function () {
    let classes = [];
    let disciplinas = [];
    let currentPage = 1;
    const ITEMS_PER_PAGE = 20; // Renderizar 20 turmas por página
    let totalPages = 1;
    let filteredClasses = [];
    let observer = null; // Variável global para o MutationObserver
    let lastPaginationState = { currentPage: null, totalPages: null }; // Armazenar o último estado da paginação

    const retryFetch = async (url, options, retries = 2, delay = 500) => {
        const cacheKey = `cache_${url}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const { data, timestamp } = JSON.parse(cached);
                console.log('Dados do cache local:', { 
                    url, 
                    data_length: data?.length || 0 
                });
                if (Date.now() - timestamp < 300000 && data && Array.isArray(data)) { // 5 minutos TTL (300.000 ms)
                    console.log('Cache local válido usado:', { url, data_length: data.length });
                    return data;
                } else {
                    console.warn('Cache local inválido ou incompleto:', {
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
                const response = await fetch(url, options);
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                const data = await response.json();
                try {
                    localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
                    console.log('Dados armazenados no cache local:', { 
                        url, 
                        data_length: data?.length || 0 
                    });
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
        const overlay = document.getElementById('loading-overlay');
        const mainContent = document.querySelector('.mb-6');

        // Show overlay immediately
        if (overlay && mainContent) {
            overlay.classList.remove('hidden');
            mainContent.classList.add('pointer-events-none');
            console.log('Loading overlay shown at start of fetchData');
        } else {
            console.warn('Overlay ou main-content não encontrados:', { overlay: !!overlay, mainContent: !!mainContent });
        }

        // Initialize Lucide icons early
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
            console.log('Lucide icons inicializados no início do fetchData');
        }

        try {
            classes = [];
            disciplinas = [];
            filteredClasses = [];

            let isRendered = false;

            // Cache para turmas
            const cacheKeyTurmas = 'cache_/api/turmas';
            const cachedTurmas = localStorage.getItem(cacheKeyTurmas);
            if (cachedTurmas) {
                try {
                    const { data, timestamp } = JSON.parse(cachedTurmas);
                    console.log('Dados do cache local (turmas):', { 
                        data_length: data?.length || 0 
                    });
                    if (Date.now() - timestamp < 300000 && data && Array.isArray(data)) {
                        classes = data;
                        filteredClasses = classes;
                        isRendered = true;
                        // Adicionar pequeno atraso para garantir que o overlay seja visível
                        await new Promise(resolve => setTimeout(resolve, 50));
                        renderClasses();
                        // Aumentar o atraso para garantir que o DOM esteja pronto
                        setTimeout(() => {
                            updatePaginationWithRetry();
                        }, 100);
                        console.log('Renderizado a partir do cache de turmas:', classes.length, 'turmas');
                    } else {
                        console.warn('Cache de turmas inválido ou expirado, removendo');
                        localStorage.removeItem(cacheKeyTurmas);
                    }
                } catch (e) {
                    console.warn('Erro ao processar cache de turmas:', e.message);
                    localStorage.removeItem(cacheKeyTurmas);
                }
            }

            // Cache para disciplinas
            const cacheKeyDisciplinas = 'cache_/api/disciplinas';
            const cachedDisciplinas = localStorage.getItem(cacheKeyDisciplinas);
            if (cachedDisciplinas) {
                try {
                    const { data, timestamp } = JSON.parse(cachedDisciplinas);
                    console.log('Dados do cache local (disciplinas):', { 
                        data_length: data?.length || 0 
                    });
                    if (Date.now() - timestamp < 300000 && data && Array.isArray(data)) {
                        disciplinas = data;
                        populateDisciplinaSelect();
                        console.log('Disciplinas preenchidas a partir do cache:', disciplinas.length, 'itens');
                    } else {
                        console.warn('Cache de disciplinas inválido ou expirado, removendo');
                        localStorage.removeItem(cacheKeyDisciplinas);
                    }
                } catch (e) {
                    console.warn('Erro ao processar cache de disciplinas:', e.message);
                    localStorage.removeItem(cacheKeyDisciplinas);
                }
            }

            // Se o cache foi usado para ambos os endpoints e renderizamos, podemos pular a busca de dados frescos
            if (isRendered && disciplinas.length > 0) {
                console.log('Cache válido usado para turmas e disciplinas, pulando busca de dados frescos');
                return;
            }

            // Buscar dados frescos
            console.log('Buscando dados frescos de /api/turmas e /api/disciplinas');
            const [turmasData, disciplinasData] = await Promise.all([
                retryFetch('/api/turmas', { credentials: 'include' }),
                retryFetch('/api/disciplinas', { credentials: 'include' })
            ]);

            const newClasses = Array.isArray(turmasData) ? turmasData : [];
            const newDisciplinas = Array.isArray(disciplinasData) ? disciplinasData : [];

            console.log('Dados frescos obtidos:', { classes: newClasses.length, disciplinas: newDisciplinas.length });
            console.log('Tipos de turmas encontradas:', [...new Set(newClasses.map(cls => cls.type))]);

            const classesChanged = JSON.stringify(newClasses) !== JSON.stringify(classes);
            const disciplinasChanged = JSON.stringify(newDisciplinas) !== JSON.stringify(disciplinas);

            classes = newClasses;
            disciplinas = newDisciplinas;
            filteredClasses = classes;

            if (!isRendered || classesChanged) {
                renderClasses();
                // Aumentar o atraso para garantir que o DOM esteja pronto
                setTimeout(() => {
                    updatePaginationWithRetry();
                }, 100);
                console.log('Turmas renderizadas com dados frescos');
            } else {
                console.log('Dados frescos idênticos ao cache, pulando renderização');
            }

            if (disciplinasChanged) {
                populateDisciplinaSelect();
                console.log('Select de disciplinas atualizado com dados frescos');
            }
        } catch (error) {
            console.error('Erro em fetchData:', error.message);
            showToast('Erro ao carregar dados: ' + error.message, 'error', 'alert-circle', 3000);
            renderClasses();
            // Aumentar o atraso para garantir que o DOM esteja pronto
            setTimeout(() => {
                updatePaginationWithRetry();
            }, 100);
        } finally {
            // Sempre ocultar o overlay
            if (overlay && mainContent) {
                overlay.classList.add('hidden');
                mainContent.classList.remove('pointer-events-none');
                console.log('Overlay de carregamento ocultado');
            } else {
                console.warn('Overlay ou main-content não encontrados para ocultar:', { overlay: !!overlay, mainContent: !!mainContent });
            }
            // Reinicializar ícones Lucide para garantir ícones no menu e tabela
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
                console.log('Ícones Lucide reinicializados após fetchData');
            }
        }
    }

    function populateDisciplinaSelect() {
        const select = document.getElementById('create-disciplina-id');
        select.innerHTML = '<option value="" disabled selected hidden>Escolha uma disciplina...</option>';
        disciplinas.forEach(disciplina => {
            const option = document.createElement('option');
            option.value = disciplina.id;
            option.textContent = disciplina.nome.charAt(0).toUpperCase() + disciplina.nome.slice(1);
            select.appendChild(option);
        });
        console.log('Select de disciplinas preenchido com', disciplinas.length, 'opções');
    }

    function filterClasses(type) {
        filteredClasses = type ? classes.filter(cls => cls.type.toLowerCase() === type) : classes;
        currentPage = 1; // Resetar para a primeira página ao filtrar
        renderClasses();
        // Aumentar o atraso para garantir que o DOM esteja pronto
        setTimeout(() => {
            updatePaginationWithRetry();
        }, 100);

        // Atualizar apenas os botões de filtro
        const filterButtons = [document.getElementById('filter-cognitiva'), document.getElementById('filter-motora')];
        filterButtons.forEach(btn => {
            if (btn) {
                btn.classList.remove('bg-blue-600', 'text-white');
                btn.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
            }
        });
        if (type) {
            const activeButton = document.querySelector(`#filter-${type}`);
            if (activeButton) {
                activeButton.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
                activeButton.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');
            }
        }
        console.log('Turmas filtradas por tipo:', type || 'todas', filteredClasses.length, 'resultados');
    }

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
    }

    function extractClassName(name) {
        const match = name.match(/^[^0-9]+/i);
        return match ? match[0].trim() : name;
    }

    // Função para formatar o nome do polo visualmente
    function formatPoloName(poloName) {
        const mapping = {
            'POLO I (Bacaxá)': 'POLO Bacaxá',
            'POLO II (Sampaio Correia)': 'POLO Sampaio Correia',
            'POLO III (Jaconé)': 'POLO Jaconé', // Ajustado para corresponder ao banco
            'POLO IV (Saquarema)': 'POLO Saquarema' // Ajustado para corresponder ao banco
        };
        return mapping[poloName] || poloName;
    }

    function renderClasses() {
        const tbody = document.getElementById('class-table-body');
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const paginatedClasses = filteredClasses.slice(start, end);

        // Calcular total de páginas
        totalPages = Math.ceil(filteredClasses.length / ITEMS_PER_PAGE);

        let html = '';
        if (paginatedClasses.length === 0) {
            const colspan = currentUserRole === 'admin' || currentUserRole === 'secretaria' || currentUserRole === 'coordenador' ? 8 : 7;
            html = `<tr><td colspan="${colspan}" class="px-6 py-4 text-center text-gray-500">Nenhuma turma encontrada.</td></tr>`;
        } else {
            paginatedClasses.forEach((cls, index) => {
                const globalIndex = start + index; // Índice global para os botões de edição
                const icon = cls.type.toLowerCase() === 'motora' ? 'fast-forward' : 'brain';
                const iconColor = cls.type.toLowerCase() === 'motora' ? 'text-purple-600' : 'text-green-600';
                const typeClass = cls.type.toLowerCase() === 'cognitiva' ? 'bg-green-100 text-green-600' : 'bg-purple-100 text-purple-600';
                const typeText = cls.type.toLowerCase() === 'cognitiva' ? 'Cognitiva' : 'Motora';
                const firstName = extractClassName(cls.name);
                const capitalizedName = capitalizeFirstLetter(firstName);
                const typeStyle = cls.type.toLowerCase() === 'motora' ? 'style="background-color: #f3e8ff"' : '';
                const actionButtons = (currentUserRole === 'admin' || currentUserRole === 'secretaria' || currentUserRole === 'coordenador')
                    ? `<td class="px-6 py-4">
                           <button class="edit-button" data-index="${globalIndex}">
                               <i data-lucide="edit" class="h-4 w-4 mr-1"></i> Editar
                           </button>
                           <button class="delete-button" data-id="${cls.id}">
                               <i data-lucide="trash-2" class="h-4 w-4 mr-1"></i> Excluir
                           </button>
                       </td>`
                    : '';
                html += `
                    <tr>
                        <td class="px-6 py-4">
                            <div class="flex items-center">
                                <i data-lucide="${icon}" class="h-10 w-10 ${iconColor} flex items-center justify-center mr-3"></i>
                                <div>
                                    <div class="font-medium">${capitalizedName}</div>
                                    <div class="text-sm text-gray-500">Faixa etária: ${formatGrades(cls.grades)} anos</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4">${formatPoloName(cls.polo_name)}</td>
                        <td class="px-6 py-4">
                            <span class="inline-flex px-2 py-1 rounded-full text-xs font-medium ${typeClass}" ${typeStyle}>
                                ${typeText}
                            </span>
                        </td>
                        <td class="px-6 py-4">${formatGrades(cls.grades)}</td>
                        <td class="px-6 py-4">${formatSchedule(cls.day)}</td>
                        <td class="px-6 py-4">${cls.period}</td>
                        <td class="px-6 py-4">
                            ${cls.enrollmentCount}/${cls.capacity}
                            <div class="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                                <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${(cls.enrollmentCount / cls.capacity * 100).toFixed(0)}%"></div>
                            </div>
                        </td>
                        ${actionButtons}
                    </tr>
                `;
            });
        }

        // Atualizar o DOM uma única vez
        tbody.innerHTML = html;

        // Adicionar ouvintes de eventos para os botões
        document.querySelectorAll('.edit-button').forEach(button => {
            button.addEventListener('click', () => {
                const index = button.getAttribute('data-index');
                openEditModal(index);
            });
        });

        document.querySelectorAll('.delete-button').forEach(button => {
            button.addEventListener('click', () => {
                const classId = button.getAttribute('data-id');
                deleteClass(classId);
            });
        });

        lucide.createIcons();
        console.log('Tabela de turmas renderizada com', paginatedClasses.length, 'itens (página', currentPage, 'de', totalPages, ')');
    }

    function updatePaginationWithRetry(attempt = 1, maxAttempts = 10) {
        const delay = 200; // Atraso entre tentativas (ms)

        // Logar o estado do DOM para depuração
        const tableContainer = document.querySelector('.bg-white.rounded-lg.shadow-md.overflow-hidden.px-6');
        console.log('Estado do DOM:', {
            tableContainerExists: !!tableContainer,
            tableContainerInnerHTML: tableContainer ? tableContainer.innerHTML : 'N/A',
            topPaginationExists: !!document.querySelector('.pagination-top'),
            bottomPaginationExists: !!document.querySelector('.pagination'),
            attempt
        });

        // Forçar a criação dos contêineres se não existirem
        if (tableContainer) {
            let topPagination = document.querySelector('.pagination-top');
            if (!topPagination) {
                console.log('Criando contêiner .pagination-top dinamicamente');
                topPagination = document.createElement('div');
                topPagination.className = 'pagination-top py-4';
                tableContainer.insertBefore(topPagination, tableContainer.querySelector('table'));
            }

            let bottomPagination = document.querySelector('.pagination');
            if (!bottomPagination) {
                console.log('Criando contêiner .pagination dinamicamente');
                bottomPagination = document.createElement('div');
                bottomPagination.className = 'pagination py-4';
                tableContainer.appendChild(bottomPagination);
            }
        } else if (attempt < maxAttempts) {
            console.warn(`Contêiner pai .bg-white.rounded-lg.shadow-md.overflow-hidden.px-6 não encontrado no DOM (tentativa ${attempt}/${maxAttempts}), tentando novamente em ${delay}ms...`);
            setTimeout(() => {
                updatePaginationWithRetry(attempt + 1, maxAttempts);
            }, delay);
            return;
        } else {
            console.error(`Contêiner pai .bg-white.rounded-lg.shadow-md.overflow-hidden.px-6 não encontrado no DOM após ${maxAttempts} tentativas`);
            return;
        }

        // Verificar se os controles de paginação já estão atualizados
        if (lastPaginationState.currentPage === currentPage && lastPaginationState.totalPages === totalPages) {
            console.log('Controles de paginação já estão atualizados, pulando atualização:', { currentPage, totalPages });
            return;
        }

        // Função auxiliar para criar os controles de paginação
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
                    renderClasses();
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
                    renderClasses();
                    setTimeout(() => {
                        updatePaginationWithRetry();
                    }, 100);
                }
            };
            paginationDiv.appendChild(nextButton);

            return paginationDiv;
        };

        // Desconectar o MutationObserver temporariamente para evitar loops
        if (observer) {
            observer.disconnect();
            console.log('MutationObserver desconectado temporariamente durante a atualização dos controles de paginação');
        }

        // Atualizar a paginação no topo (pagination-top)
        const topPagination = document.querySelector('.pagination-top');
        if (topPagination) {
            topPagination.innerHTML = ''; // Limpar o conteúdo existente
            topPagination.appendChild(createPaginationControls());
            console.log('Controles de paginação (topo) atualizados na tentativa', attempt, ':', { currentPage, totalPages });
        } else if (attempt < maxAttempts) {
            console.warn(`Contêiner .pagination-top não encontrado no DOM (tentativa ${attempt}/${maxAttempts}), tentando novamente em ${delay}ms...`);
            setTimeout(() => {
                updatePaginationWithRetry(attempt + 1, maxAttempts);
            }, delay);
            return;
        } else {
            console.error(`Contêiner .pagination-top não encontrado no DOM após ${maxAttempts} tentativas`);
        }

        // Atualizar a paginação no final (pagination)
        const bottomPagination = document.querySelector('.pagination');
        if (bottomPagination) {
            bottomPagination.innerHTML = ''; // Limpar o conteúdo existente
            bottomPagination.appendChild(createPaginationControls());
            console.log('Controles de paginação (final) atualizados na tentativa', attempt, ':', { currentPage, totalPages });
        } else if (attempt < maxAttempts) {
            console.warn(`Contêiner .pagination não encontrado no DOM (tentativa ${attempt}/${maxAttempts}), tentando novamente em ${delay}ms...`);
            setTimeout(() => {
                updatePaginationWithRetry(attempt + 1, maxAttempts);
            }, delay);
            return;
        } else {
            console.error(`Contêiner .pagination não encontrado no DOM após ${maxAttempts} tentativas`);
        }

        // Atualizar o último estado da paginação
        lastPaginationState = { currentPage, totalPages };

        // Reconectar o MutationObserver após a atualização
        if (observer) {
            const tableContainer = document.querySelector('.bg-white.rounded-lg.shadow-md.overflow-hidden.px-6');
            if (tableContainer) {
                observer.observe(tableContainer, {
                    childList: true,
                    subtree: true
                });
                console.log('MutationObserver reconectado após a atualização dos controles de paginação');
            }
        }
    }

    // Inicializar o MutationObserver globalmente
    document.addEventListener('DOMContentLoaded', () => {
        const tableContainer = document.querySelector('.bg-white.rounded-lg.shadow-md.overflow-hidden.px-6');
        if (tableContainer) {
            observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    console.log('Mudança detectada no DOM:', {
                        mutationType: mutation.type,
                        target: mutation.target.className,
                        addedNodes: Array.from(mutation.addedNodes).map(node => node.className || 'Sem classe'),
                        removedNodes: Array.from(mutation.removedNodes).map(node => node.className || 'Sem classe')
                    });
                    // Evitar reagir a mudanças nos contêineres de paginação
                    const isPaginationChange = Array.from(mutation.addedNodes).some(node => node.className && node.className.includes('pagination')) ||
                                              Array.from(mutation.removedNodes).some(node => node.className && node.className.includes('pagination'));
                    if (!isPaginationChange) {
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
        }
    });

    function formatSchedule(day) {
        const days = {
            monday: 'Segunda-feira',
            tuesday: 'Terça-feira',
            wednesday: 'Quarta-feira',
            thursday: 'Quinta-feira',
            friday: 'Sexta-feira',
            seg: 'Segunda-feira',
            ter: 'Terça-feira',
            qua: 'Quarta-feira',
            qui: 'Quinta-feira',
            sex: 'Sexta-feira'
        };
        return days[day] || day;
    }

    function formatGrades(grades) {
        if (!grades) {
            return 'Não especificado';
        }

        let gradesString;
        if (Array.isArray(grades)) {
            gradesString = grades.join(',');
        } else if (typeof grades === 'string') {
            gradesString = grades;
        } else {
            return 'Não especificado';
        }

        try {
            return gradesString.split(',').map(g => `${g.trim()}º`).join(' e ');
        } catch (error) {
            return 'Não especificado';
        }
    }

    function openEditModal(index) {
        const cls = classes[index];
        if (!cls) {
            console.error('Turma não encontrada no índice:', index);
            return;
        }

        const modal = document.getElementById('edit-class-modal');
        if (!modal) {
            console.error('Modal de edição não encontrado');
            return;
        }
        modal.style.display = 'block';
        console.log('Modal de edição aberto para a turma:', cls.id);

        document.getElementById('edit-class-id').value = cls.id || '';
        document.getElementById('edit-name').value = cls.name || '';
        document.getElementById('edit-polo-name').value = cls.polo_name || userPoloName;
        document.getElementById('edit-type').value = cls.type.toLowerCase() || 'cognitiva';

        const gradesSelect = document.getElementById('edit-grades');
        const gradesValue = JSON.stringify(cls.grades);
        if (gradesSelect.querySelector(`option[value='${gradesValue}']`)) {
            gradesSelect.value = gradesValue;
        } else {
            gradesSelect.value = '["4", "5"]';
        }

        const daySelect = document.getElementById('edit-day');
        if (cls.day && daySelect.querySelector(`option[value="${cls.day}"]`)) {
            daySelect.value = cls.day;
        } else {
            daySelect.value = 'seg';
        }

        const periodSelect = document.getElementById('edit-period');
        if (cls.period && periodSelect.querySelector(`option[value="${cls.period.toLowerCase()}"]`)) {
            periodSelect.value = cls.period.toLowerCase();
        } else {
            periodSelect.value = 'manha';
        }

        document.getElementById('edit-capacity').value = cls.capacity || 0;
    }

    function closeEditModal() {
        const modal = document.getElementById('edit-class-modal');
        if (!modal) {
            console.error('Modal de edição não encontrado');
            return;
        }
        modal.style.display = 'none';
        console.log('Modal de edição fechado');
    }

    async function saveClassChanges(event) {
        event.preventDefault();
        const form = document.getElementById('edit-class-form');
        const formData = new FormData(form);
        const classData = Object.fromEntries(formData);
        classData.grades = JSON.parse(classData.grades);

        try {
            const updateResponse = await retryFetch(`/api/turmas/${classData.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(classData),
                credentials: 'include'
            });
            showToast('Dados da turma salvos com sucesso!', 'success', 'check-circle', 3000);

            const unenrollResponse = await retryFetch(`/api/turmas/${classData.id}/unenroll`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            showToast('Alunos desmatriculados com sucesso! É necessário matriculá-los novamente.', 'warning', 'alert-circle', 5000);

            closeEditModal();
            fetchData();
        } catch (error) {
            console.error('Erro ao salvar alterações da turma:', error.message);
            showToast('Erro: ' + error.message, 'error', 'alert-circle', 3000);
        }
    }

    async function deleteClass(classId) {
        if (!confirm('Tem certeza que deseja excluir esta turma? Todos os alunos matriculados serão desmatriculados.')) {
            return;
        }

        try {
            const response = await retryFetch(`/api/turmas/${classId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            showToast('Turma excluída com sucesso!', 'success', 'check-circle', 3000);
            fetchData();
        } catch (error) {
            console.error('Erro ao excluir turma:', error.message);
            showToast('Erro: ' + error.message, 'error', 'alert-circle', 3000);
        }
    }

    function openCreateModal() {
        const modal = document.getElementById('create-class-modal');
        if (!modal) {
            console.error('Modal de criação não encontrado');
            return;
        }
        modal.style.display = 'block';

        document.getElementById('create-class-form').reset();
        document.querySelectorAll('.tooltip').forEach(tooltip => {
            tooltip.style.display = 'none';
        });

        updateTypeIcon(disciplinas.length > 0 ? disciplinas[0].tipo : 'cognitiva');
        lucide.createIcons();
        console.log('Modal de criação aberto');
    }

    function closeCreateModal() {
        const modal = document.getElementById('create-class-modal');
        if (!modal) {
            console.error('Modal de criação não encontrado');
            return;
        }
        modal.style.display = 'none';
        console.log('Modal de criação fechado');
    }

    function updateTypeIcon(type) {
        const typeIcon = document.getElementById('type-icon');
        if (!typeIcon) return;

        typeIcon.removeAttribute('data-lucide');
        typeIcon.className = 'h-5 w-5 mr-2';

        typeIcon.setAttribute('data-lucide', type.toLowerCase() === 'cognitiva' ? 'brain' : 'fast-forward');
        lucide.createIcons();
        console.log('Ícone de tipo atualizado para', type);
    }

    function showTooltip(elementId, message) {
        const tooltip = document.getElementById(`tooltip-${elementId}`);
        if (tooltip) {
            tooltip.textContent = message;
            tooltip.style.display = 'block';
            console.log('Exibindo tooltip para', elementId, ':', message);
        } else {
            console.warn('Tooltip não encontrado para', elementId);
        }
    }

    async function createClass(event) {
        event.preventDefault();

        const form = document.getElementById('create-class-form');
        if (!form) {
            console.error('Formulário de criação de turma não encontrado');
            return;
        }

        const formData = new FormData(form);
        const classData = Object.fromEntries(formData);

        let hasError = false;
        const fields = [
            { id: 'name', message: 'Por favor, insira o nome da turma' },
            { id: 'disciplina_id', message: 'Por favor, selecione a disciplina da turma' },
            { id: 'day', message: 'Por favor, selecione o dia da semana' },
            { id: 'period', message: 'Por favor, selecione o período' },
            { id: 'grades', message: 'Por favor, selecione o ano escolar' },
            { id: 'polo_name', message: 'Por favor, selecione o polo' },
            { id: 'capacity', message: 'Por favor, insira a capacidade da turma' }
        ];

        fields.forEach(field => {
            const value = classData[field.id];
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
            classData.grades = JSON.parse(classData.grades);
        } catch (error) {
            showTooltip('grades', 'Erro ao processar o ano escolar');
            console.error('Erro ao processar grades:', error.message);
            return;
        }

        try {
            const createResponse = await retryFetch('/api/turmas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(classData),
                credentials: 'include'
            });
            showToast('Turma criada com sucesso!', 'success', 'check-circle', 3000);
            closeCreateModal();
            fetchData();
            console.log('Turma criada com sucesso:', classData);
        } catch (error) {
            console.error('Erro ao criar turma:', error.message);
            showToast('Erro: ' + error.message, 'error', 'alert-circle', 3000);
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
        closeButton.addEventListener('click', () => {
            clearTimeout(timeout);
            toastDiv.remove();
            console.log('Toast fechado manualmente:', message);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        const editModal = document.getElementById('edit-class-modal');
        if (editModal) {
            editModal.addEventListener('click', (event) => {
                if (event.target === editModal) {
                    closeEditModal();
                }
            });
        }

        const createModal = document.getElementById('create-class-modal');
        if (createModal) {
            createModal.addEventListener('click', (event) => {
                if (event.target === createModal) {
                    closeCreateModal();
                }
            });
        }

        const cancelEditButton = document.getElementById('cancel-edit-class');
        if (cancelEditButton) {
            cancelEditButton.addEventListener('click', closeEditModal);
        }

        const cancelCreateButton = document.getElementById('cancel-create-class');
        if (cancelEditButton) {
            cancelCreateButton.addEventListener('click', closeCreateModal);
        }

        const createClassButton = document.getElementById('create-class-button');
        if (createClassButton) {
            createClassButton.addEventListener('click', openCreateModal);
        }

        const createClassForm = document.getElementById('create-class-form');
        if (createClassForm) {
            createClassForm.addEventListener('submit', createClass);
        }

        const disciplinaSelect = document.getElementById('create-disciplina-id');
        if (disciplinaSelect) {
            disciplinaSelect.addEventListener('change', (event) => {
                const selectedDisciplinaId = event.target.value;
                const selectedDisciplina = disciplinas.find(d => d.id === selectedDisciplinaId);
                updateTypeIcon(selectedDisciplina ? selectedDisciplina.tipo : 'cognitiva');
            });
        }

        const filterCognitivaButton = document.getElementById('filter-cognitiva');
        if (filterCognitivaButton) {
            filterCognitivaButton.addEventListener('click', () => filterClasses('cognitiva'));
        } else {
            console.warn('Botão filter-cognitiva não encontrado');
        }

        const filterMotoraButton = document.getElementById('filter-motora');
        if (filterMotoraButton) {
            filterMotoraButton.addEventListener('click', () => filterClasses('motora'));
        } else {
            console.warn('Botão filter-motora não encontrado');
        }

        const editForm = document.getElementById('edit-class-form');
        if (editForm) {
            editForm.addEventListener('submit', saveClassChanges);
        }

        fetchData();
        console.log('Evento DOMContentLoaded disparado, fetchData chamado');
    });
})();